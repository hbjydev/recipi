# Recipi

A private household recipe collection built with Next.js, TypeScript, PostgreSQL, Kanidm OIDC, and S3-compatible image storage. Members of the configured Kanidm group share one collection and can all add, edit, and delete recipes. The app supports searching, tagging, and favoriting recipes, plus ingredients, steps, timing, notes, source links, image uploads, and public read-only sharing.

## Share a recipe

Open a recipe and select **Share** to create a public link. Anyone with the link can read the recipe without signing in. The link shows recipe details, including its image, but never personal notes or edit controls. Share again to copy the active link. Select **Revoke link** to make it stop working; sharing the recipe again creates a different link. Deleting a recipe also removes its link. Treat an active link as public: anyone who receives it can pass it on.

Share links are signed with `NEXTAUTH_SECRET`; changing that secret invalidates existing links. Keep the secret stable across deployments. The app serves uploaded images through a share-checked route, so the S3 bucket stays private.

## API tokens and MCP

Sign in with Kanidm and open **API tokens** in the sidebar. Name a token, choose read-only or read/write access, and choose its expiry. Copy the token when it appears: Recipi stores only its SHA-256 hash and cannot show it again. You can revoke your tokens from the same page. Tokens belong to the household you were in when created and expire after 30, 90, or 365 days. A Kanidm sign-in is required to create and revoke them; a token cannot manage tokens.

Use the token as `Authorization: Bearer <token>` with the JSON recipe API (`/api/recipes` and `/api/recipes/:id`), the image API (`/api/images` and `/api/images/:id`), or the share API (`/api/recipes/:id/share`). Read-only tokens can list and retrieve. Read/write tokens can also add, edit, delete, upload images, and manage public links. The existing browser session works as before.

The MCP Streamable HTTP endpoint is `/mcp`. Configure your MCP client with the full HTTPS URL and the same Bearer header. Read-only tokens can use `list_recipes`, `get_recipe`, `list_tags`, and `list_recipes_by_tag`, plus `get_recipe_share` to inspect an existing public link. Read/write tokens also get `create_recipe`, `update_recipe`, `delete_recipe`, `share_recipe`, and `revoke_recipe_share`. Tag matching ignores letter case. MCP recipe reads include household notes; public share pages omit them. Use a read-only token for clients that do not need to change recipes.

Removing someone from the Kanidm group does not automatically invalidate tokens they already created. Revoke their tokens in PostgreSQL when removing their access (`UPDATE api_tokens SET revoked_at=now() WHERE household_id='household:home' AND user_id='<Kanidm subject>' AND revoked_at IS NULL;`), or wait for their expiry. Keep issued tokens in a secret store and use HTTPS outside local development.

## Run locally

Requirements: Docker Compose, [mise](https://mise.jdx.dev/), and a browser that can open `kanidm.localhost`. The compose file runs **PostgreSQL, Kanidm, and MinIO**; Next.js runs on your host through mise.

```sh
mise install
bash scripts/init-local.sh
pnpm install --frozen-lockfile
pnpm run dev
```

The init script starts Postgres, Kanidm, and MinIO; creates the private `recipi-images` bucket, a local Kanidm account, and the Recipi OIDC client; and writes an ignored `.env`. It prints a one-time URL for setting the `cook` account password. Open that URL, set the password, then visit [http://localhost:3000](http://localhost:3000) and sign in with Kanidm.

The local Kanidm `recipi_users` group is the household. Add another Kanidm person to that group to give them the same cookbook. `HOUSEHOLD_ID=home` is the stable storage key for this shared collection.

For example, after initialization, add another local member with:

```sh
docker compose run --rm tools person create second_cook "Second Cook" --name idm_admin
docker compose run --rm tools group add-members recipi_users second_cook --name idm_admin
docker compose run --rm tools person credential create-reset-token second_cook --name idm_admin
```

Open the printed reset link to set that person's password.

For an existing deployment with recipes from the earlier per-person version, back up PostgreSQL and run `psql -v household_id=home -f scripts/migrate-household.sql` against Recipi's database. This moves all existing recipes into the shared collection. The local init script performs that move automatically.

Kanidm uses a locally generated evaluation certificate. Your browser may ask you to trust [the public certificate](.local/kanidm/chain.pem) before opening the password setup URL. The script copies this certificate from Kanidm to `.local/kanidm/chain.pem`; Node trusts it through `NODE_EXTRA_CA_CERTS` in `.env`. Keep the local private key and `.env` out of version control.

`mise.toml` loads `.env` via `[env] _.file = ".env"`. If your shell has not activated mise, run `mise exec -- pnpm run dev` instead. After changing `.env`, restart the dev server.

The database is available at `localhost:5432`, Kanidm at `https://kanidm.localhost:8443`, and MinIO at `http://localhost:9000` (console: `http://localhost:9001`). To stop them, run `docker compose down`. The named volumes keep the local data across restarts. `docker compose down -v` deletes the local data and requires running the init script again.

## Production configuration

Build the app with the included `Dockerfile`. It requires these runtime variables:

| Variable                                     | Purpose                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| `DATABASE_URL`                               | PostgreSQL connection URL for Recipi's database                                      |
| `NEXTAUTH_URL`                               | Public HTTPS URL of Recipi, e.g. `https://recipi.hayden.moe`                         |
| `NEXTAUTH_SECRET`                            | A persistent, random session and public-link signing secret                          |
| `OIDC_ISSUER`                                | Kanidm issuer URL, e.g. `https://sso.hayden.moe/oauth2/openid/recipi`                |
| `OIDC_CLIENT_ID`                             | Kanidm client ID (`recipi`)                                                          |
| `OIDC_CLIENT_SECRET`                         | Kanidm confidential client secret                                                    |
| `S3_BUCKET`                                  | Existing private bucket for recipe images                                            |
| `HOUSEHOLD_ID`                               | Stable lowercase key for this household; changing it selects a different collection  |
| `S3_REGION`                                  | Bucket region (`us-east-1` for local MinIO)                                          |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | S3 credentials, unless the runtime supplies credentials through its normal AWS chain |
| `S3_ENDPOINT`                                | Optional endpoint for MinIO or another S3-compatible service                         |
| `S3_FORCE_PATH_STYLE`                        | Optional `true` for S3-compatible services requiring path-style requests             |

Register `https://recipi.hayden.moe/api/auth/callback/kanidm` as the OIDC redirect URL. Give the household's Kanidm group `openid`, `profile`, and `email` scopes. Only members allowed by Kanidm can sign in; everyone who can sign in shares the configured `HOUSEHOLD_ID` and can edit all recipes. Use Phoebe's existing Postgres and Kanidm components for the database, client, and secrets. The app runs Drizzle migrations on first database access. The initial migration safely adopts tables from earlier Recipi versions. After changing `src/lib/schema.ts`, run `pnpm db:generate` and commit the generated migration.

The container exposes port 3000 and `/api/healthz` for a probe. Keep a single app replica until migrations and multi-replica rollout have been tested. Recipes are stored in Postgres; uploaded images are stored in a private S3 bucket and served through an authenticated or share-checked app route. Images are limited to 5 MB and JPEG, PNG, or WebP. An upload that is never saved to a recipe can leave an unused object; bucket lifecycle cleanup is a future improvement.

GitHub Actions runs formatting, linting, type checking, the production build, Docker-backed integration tests, and a container build on pull requests. Pushing to `main` or a `v*` tag runs the same app checks before publishing `ghcr.io/hbjydev/recipi`. The image gets a full-commit `sha-...` tag plus `main` or the version number (for example, `1.2.3` for `v1.2.3`). Pin the image digest for immutable deployments; grant the deployment environment access to the GHCR package if it is private. No deployment secrets are needed by these workflows.

`deploy/phoebe` contains a Flux/app-template starting point matching Phoebe's current Postgres and Kanidm components. Build and publish the image, replace the image repository and tag in the HelmRelease, provision the private S3 bucket and `recipi-s3` credential Secret (or adjust the template for workload credentials), copy that directory to `kubernetes/apps/selfhosted/recipi` in Phoebe, and add `./recipi/ks.yaml` to `kubernetes/apps/selfhosted/kustomization.yaml`. Review the hostname and group membership before Flux reconciles it. The manifests are a template in this repository; they are not applied to Phoebe yet.

## Project layout

- `src/app/recipes`: list, detail, new, and edit pages behind Kanidm sign-in
- `src/app/share`: public, read-only shared recipes and their images
- `src/components/recipes`: focused cookbook, filter, card, detail, and form components
- `src/app/api`: authenticated recipe HTTP routes
- `src/app/mcp`: authenticated MCP Streamable HTTP endpoint
- `src/lib/api-tokens.ts`: hashed, expiring API tokens
- `src/lib/recipe.ts`: recipe types and input validation
- `src/lib/db.ts`: Drizzle connection and recipe queries
- `src/lib/schema.ts`: PostgreSQL table definitions
- `drizzle/`: versioned database migrations
- `src/lib/auth.ts`: Kanidm OIDC session configuration
- `src/lib/images.ts`: S3 object storage adapter
- `compose.yaml`: local Postgres, Kanidm, and MinIO services
- `scripts/init-local.sh`: local OIDC bootstrap

## Tests

Run `pnpm test` with Docker running. The test launcher starts disposable PostgreSQL 17 and MinIO containers, applies the Drizzle migrations, creates a test bucket, runs the test files, and stops both containers. It uses the active Docker CLI context when Docker's standard socket is unavailable, including Colima. No test database or S3 environment variables are needed.

Run `pnpm run build` and `pnpm run lint` before deployment.
