FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

ENV NODE_ENV=production
ENV API_PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server/index.ts"]
