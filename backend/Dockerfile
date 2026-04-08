FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json prisma ./
RUN npm ci && npx prisma generate

FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY . .
RUN npm run build
EXPOSE 5000
CMD ["node", "dist/server.js"]