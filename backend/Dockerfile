FROM node:22-alpine

# Устанавливаем OpenSSL 3.0
RUN apk add --no-cache openssl openssl3

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем зависимости
RUN npm install

# Генерируем Prisma с правильными бинарниками
RUN npx prisma generate

COPY . .

RUN npm run build
RUN mkdir -p /app/uploads/products

EXPOSE 5000

CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
