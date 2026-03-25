FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --omit=dev && npm install tsx @prisma/adapter-pg pg bcryptjs cors express

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/src/generated ./src/generated

ENV NODE_ENV=production
ENV API_PORT=3000
# build v2

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
