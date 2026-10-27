# syntax=docker/dockerfile:1
# Build from the repository root:
#   docker build -f apps/web/Dockerfile .

FROM node:24-alpine AS base
RUN npm install -g pnpm@12.15.0
WORKDIR /app

# ---- dependencies -------------------------------------------------------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/web/package.json apps/web/
RUN pnpm install --frozen-lockfile

# ---- build --------------------------------------------------------------------
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1 NEXT_OUTPUT=standalone
# next build (output: standalone) + self-contained migrate/seed scripts.
RUN pnpm --filter web build && pnpm --filter web build:scripts

# ---- runtime ------------------------------------------------------------------
FROM node:24-alpine AS runner
RUN apk add --no-cache tzdata && addgroup -S app && adduser -S app -G app
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    TZ=Europe/Paris \
    MIGRATIONS_DIR=/app/drizzle \
    SEED_FILE=/app/docs/seed-data.json

COPY --from=build --chown=app:app /app/apps/web/.next/standalone ./
COPY --from=build --chown=app:app /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=app:app /app/apps/web/public ./apps/web/public
COPY --from=build --chown=app:app /app/apps/web/drizzle ./drizzle
COPY --from=build --chown=app:app /app/apps/web/dist-scripts ./scripts
COPY --from=build --chown=app:app /app/docs/seed-data.json ./docs/seed-data.json

USER app
EXPOSE 3000
# Apply pending migrations, then start the server (which also runs the job worker).
CMD ["sh", "-c", "node scripts/migrate.mjs && exec node apps/web/server.js"]
