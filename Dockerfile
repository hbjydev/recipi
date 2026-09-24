FROM rockylinux/rockylinux:10-ubi AS base
WORKDIR /app

RUN dnf install -y --setopt=install_weak_deps=no nodejs24 && \
  ln -sf /usr/bin/node-24 /usr/bin/node && \
  dnf clean all && \
  rm -rf /var/cache/dnf
RUN useradd -u 1000 -U -M -d /app -s /sbin/nologin recipi

FROM base AS build
RUN dnf install -y git nodejs24-npm && \
  dnf clean all && \
  rm -rf /var/cache/dnf
RUN npm-24 install --global pnpm@12.5.1
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM base AS runner

ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0

COPY --from=build --chown=recipi:recipi /app/public ./public
COPY --from=build --chown=recipi:recipi /app/.next/standalone ./
COPY --from=build --chown=recipi:recipi /app/.next/static ./.next/static
COPY --from=build --chown=recipi:recipi /app/drizzle ./drizzle

USER recipi
EXPOSE 3000
CMD ["node", "server.js"]
