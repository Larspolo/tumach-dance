# The image of the site (#7), after the Next.js example `with-docker`. One image serves the preview and the live
# site: the settings of each site come from environment variables at run time (`deploy/`).
# Debian slim, not Alpine: better-sqlite3 has prebuilt binaries for glibc.
FROM node:24-slim AS deps
# npm ci builds better-sqlite3 from source (the lockfile does not record its gypfile: false), so it needs the tools.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24-slim AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && mkdir -p public

FROM node:24-slim AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 DATABASE_PATH=/app/data/tumach.db
RUN groupadd --system --gid 1001 nodejs && useradd --system --uid 1001 --gid nodejs nextjs \
  && mkdir data && chown nextjs:nodejs data
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public
# `src/instrumentation.ts` applies the migrations at the start.
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle
COPY --from=build --chown=nextjs:nodejs /app/scripts/restore.mjs ./scripts/restore.mjs
USER nextjs
VOLUME /app/data
EXPOSE 3000
CMD ["node", "server.js"]
