#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
umask 077

if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  echo "Docker is not running. Start Docker or Colima, then rerun this script." >&2
  exit 1
fi

mkdir -p .local/kanidm .local/kanidm-cli

if [[ ! -f .local/kanidm-cli/kanidm_tokens ]]; then
  printf '{}\n' > .local/kanidm-cli/kanidm_tokens
  chmod 600 .local/kanidm-cli/kanidm_tokens
fi

auth_secret="$(sed -n 's/^NEXTAUTH_SECRET=//p' .env 2>/dev/null | tail -n 1 || true)"
existing_client_secret="$(sed -n 's/^OIDC_CLIENT_SECRET=//p' .env 2>/dev/null | tail -n 1 || true)"
if [[ -z "$auth_secret" ]]; then auth_secret="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"; fi
cat > .env <<EOF
DATABASE_URL=postgres://recipi:recipi@localhost:5432/recipi
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$auth_secret
OIDC_ISSUER=https://kanidm.localhost:8443/oauth2/openid/recipi
OIDC_CLIENT_ID=recipi
OIDC_CLIENT_SECRET=$existing_client_secret
NODE_EXTRA_CA_CERTS=.local/kanidm/chain.pem
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=recipi-images
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=recipi-local
AWS_SECRET_ACCESS_KEY=recipi-local-password
HOUSEHOLD_ID=home
EOF

echo "Starting PostgreSQL and MinIO…"
docker compose up -d db minio
echo "Waiting for PostgreSQL…"
database_ready=false
for _ in {1..45}; do
  if docker compose exec -T db pg_isready -U recipi -d recipi >/dev/null 2>&1; then
    database_ready=true
    break
  fi
  sleep 2
done
if [[ "$database_ready" != "true" ]]; then
  echo "PostgreSQL did not become ready. Check: docker compose logs db" >&2
  exit 1
fi
echo "Waiting for MinIO…"
minio_ready=false
for _ in {1..45}; do
  if curl --silent --fail http://localhost:9000/minio/health/ready >/dev/null; then
    minio_ready=true
    break
  fi
  sleep 2
done
if [[ "$minio_ready" != "true" ]]; then
  echo "MinIO did not become ready. Check: docker compose logs minio" >&2
  exit 1
fi
docker compose exec -T minio mc mb --ignore-existing local/recipi-images

# The first version stored each person's subject in owner_id. Local Recipi now
# has one shared household, so bring those recipes into that collection.
if [[ -n "$(docker compose exec -T db psql -U recipi -d recipi -tAc "SELECT to_regclass('public.recipes')")" ]]; then
  docker compose exec -T db psql -U recipi -d recipi -v ON_ERROR_STOP=1 \
    -c "UPDATE recipes SET owner_id = 'household:home' WHERE owner_id NOT LIKE 'household:%'" \
    >/dev/null
fi
if [[ ! -f .local/kanidm/chain.pem ]]; then
  echo "Generating Kanidm's evaluation certificate…"
  docker compose stop kanidm >/dev/null 2>&1 || true
  docker compose run --rm -T kanidm kanidmd cert-generate
fi
echo "Starting Kanidm…"
docker compose up -d kanidm
docker compose cp kanidm:/data/chain.pem .local/kanidm/chain.pem
chmod 644 .local/kanidm/chain.pem

echo "Waiting for Kanidm…"
ready=false
for _ in {1..45}; do
  if [[ "$(curl --silent --cacert .local/kanidm/chain.pem --resolve kanidm.localhost:8443:127.0.0.1 https://kanidm.localhost:8443/status 2>/dev/null)" == "true" ]]; then
    ready=true
    break
  fi
  sleep 2
done
if [[ "$ready" != "true" ]]; then
  echo "Kanidm did not become ready. Check: docker compose logs kanidm" >&2
  exit 1
fi

kanidm() { docker compose run --rm -T tools "$@"; }
has_entry() {
  local result
  result="$(kanidm "$@" 2>/dev/null)" || return 1
  [[ -n "$result" && "$result" != *"No matching"* ]]
}

if ! kanidm self whoami --name idm_admin >/dev/null 2>&1; then
  echo "Creating a one-time Kanidm administrator password…"
  recovery="$(docker compose exec -T kanidm kanidmd recover-account idm_admin)"
  password="$(printf '%s\n' "$recovery" | sed -n 's/.*new_password: "\([^"]*\)".*/\1/p' | tail -n 1)"
  if [[ -z "$password" ]]; then
    echo "Could not read the recovery password. Kanidm said:" >&2
    printf '%s\n' "$recovery" >&2
    exit 1
  fi
  echo "Kanidm idm_admin password: $password"
  echo "Enter that password in the next prompt. The CLI session is kept in .local/kanidm-cli."
  docker compose run --rm tools login --name idm_admin
fi

group_created=false
person_created=false
if ! has_entry group get recipi_users --name idm_admin; then
  kanidm group create recipi_users --name idm_admin
  group_created=true
fi
if ! has_entry person get cook --name idm_admin; then
  kanidm person create cook "Local Cook" --name idm_admin
  person_created=true
fi
if [[ "$group_created" == "true" || "$person_created" == "true" ]]; then
  kanidm group add-members recipi_users cook --name idm_admin
fi

if ! has_entry system oauth2 get recipi --name idm_admin; then
  kanidm system oauth2 create recipi "Recipi Local" http://localhost:3000 --name idm_admin
  kanidm system oauth2 add-redirect-url recipi http://localhost:3000/api/auth/callback/kanidm --name idm_admin
  kanidm system oauth2 update-scope-map recipi recipi_users openid profile email --name idm_admin
fi

client_secret="$(kanidm system oauth2 show-basic-secret recipi --name idm_admin | awk 'NF && $0 != "---" { secret=$0 } END { print secret }')"
if [[ -z "$client_secret" ]]; then
  echo "Could not read the Recipi OIDC client secret." >&2
  exit 1
fi
cat > .env <<EOF
DATABASE_URL=postgres://recipi:recipi@localhost:5432/recipi
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=$auth_secret
OIDC_ISSUER=https://kanidm.localhost:8443/oauth2/openid/recipi
OIDC_CLIENT_ID=recipi
OIDC_CLIENT_SECRET=$client_secret
NODE_EXTRA_CA_CERTS=.local/kanidm/chain.pem
S3_ENDPOINT=http://localhost:9000
S3_BUCKET=recipi-images
S3_REGION=us-east-1
AWS_ACCESS_KEY_ID=recipi-local
AWS_SECRET_ACCESS_KEY=recipi-local-password
HOUSEHOLD_ID=home
EOF
chmod 600 .env

echo "Set or reset the local cook account password with this one-time link:"
kanidm person credential create-reset-token cook --name idm_admin

echo "Local services are ready. Run: pnpm run dev"
echo "Then open http://localhost:3000 after setting the cook account password."
echo "If your browser warns about the local Kanidm certificate, trust .local/kanidm/chain.pem for this development environment."
