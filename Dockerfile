# The API image (S10b). Built on the owner's machine by deploy/deploy.sh; see docs/DEPLOY.md.
FROM node:24-trixie-slim AS deps
WORKDIR /app
RUN corepack enable
# The mobile manifest only lets the frozen lockfile match; --filter keeps its dependencies out.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/server/package.json apps/server/
COPY apps/mobile/package.json apps/mobile/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile --prod --filter @our-players/server...

FROM node:24-trixie-slim
WORKDIR /app
# Manifests and every node_modules level, including the workspace link to packages/shared.
COPY --from=deps /app ./
COPY packages/shared packages/shared
COPY apps/server/src apps/server/src
COPY apps/server/scripts apps/server/scripts
COPY apps/server/drizzle apps/server/drizzle
COPY apps/server/data apps/server/data
# tsx, not node: the source imports without file extensions, which Node's type stripping can't load.
ENV NODE_ENV=production PATH=/app/node_modules/.bin:$PATH
# The API runs tsx from node_modules and never npm; npm's bundled packages were all of the image's Node CVEs.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
USER node
WORKDIR /app/apps/server
EXPOSE 3001
CMD ["tsx", "src/main.ts"]
