# ---- BUILD STAGE ----
FROM node:20-alpine AS builder

WORKDIR /app

# Install build dependencies for Prisma/Native modules
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDeps for building)
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build

# ---- PRODUCTION STAGE ----
FROM node:20-alpine AS runner

WORKDIR /app

# 1. Set Timezone to Sri Lanka
RUN apk add --no-cache tzdata
ENV TZ=Asia/Colombo

# 2. Production Environment
ENV NODE_ENV=production

# 3. Copy necessary files only
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

EXPOSE 5000

CMD ["node", "dist/main.js"]