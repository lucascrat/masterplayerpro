# syntax=docker/dockerfile:1

# ── Stage 1: build the client + generate Prisma client ──────────────
FROM node:20-alpine AS builder
WORKDIR /app

# DATABASE_URL is referenced by prisma.config.ts at generate time; a dummy
# value is enough because `prisma generate` never opens a connection.
ENV DATABASE_URL="postgresql://user:pass@localhost:5432/db"

COPY package*.json ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Stage 2: runtime ───────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

ENV NODE_ENV=production
EXPOSE 3001

# Entrypoint syncs the DB schema (prisma db push) then starts the server.
CMD ["./docker-entrypoint.sh"]
