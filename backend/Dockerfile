<<<<<<< HEAD
# backend/Dockerfile
FROM node:18-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json
=======
FROM node:22-alpine

# Устанавливаем OpenSSL 3.0
RUN apk add --no-cache openssl openssl3

WORKDIR /app

>>>>>>> feature/edit-order
COPY package*.json ./
COPY prisma ./prisma/

# Устанавливаем зависимости
<<<<<<< HEAD
RUN npm ci --only=production || npm install --production

# Копируем исходники
COPY . .

# Генерируем Prisma Client
RUN npx prisma generate

# Финальный образ
FROM node:18-alpine

WORKDIR /app

# Устанавливаем необходимые системные пакеты
RUN apk add --no-cache openssl

# Копируем собранные файлы
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/src ./src
COPY --from=builder /app/uploads ./uploads

# Создаем папку для загрузок
=======
RUN npm install

# Генерируем Prisma с правильными бинарниками
RUN npx prisma generate

COPY . .

RUN npm run build
>>>>>>> feature/edit-order
RUN mkdir -p /app/uploads/products

EXPOSE 5000

<<<<<<< HEAD
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
=======
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/server.js"]
>>>>>>> feature/edit-order
