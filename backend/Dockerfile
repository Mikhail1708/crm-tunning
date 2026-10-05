FROM node:22-bookworm-slim

WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY prisma ./prisma

RUN npm ci
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

RUN mkdir -p /app/uploads/products

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
