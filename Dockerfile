# syntax=docker/dockerfile:1

# ---------- Build Stage ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Tambahkan dependensi dasar untuk build Next.js & modul native (sharp, node-gyp, dll)
RUN apk add --no-cache libc6-compat python3 make g++

# Arg dari workflow (dikirim lewat build-args)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Salin package.json dan lockfile dulu (biar caching lebih efisien)
COPY package*.json ./
RUN npm ci

# Nonaktifkan telemetry dan lint di dalam build container
ENV NODE_ENV=production
ENV NEXT_DISABLE_ESLINT=1
ENV NEXT_TELEMETRY_DISABLED=1

# Salin seluruh source code
COPY . .

# (Opsional) tampilkan ENV untuk verifikasi di log CI
RUN node -e "console.log('✅ NEXT_PUBLIC_API_URL =', process.env.NEXT_PUBLIC_API_URL || 'undefined')"

# Jalankan type check biar error TS langsung muncul di CI
RUN npx tsc --noEmit

# Build Next.js (standalone output)
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_DISABLE_ESLINT=1

# Buat user non-root untuk keamanan
RUN adduser -D -u 1001 nextjs

# Copy hasil build standalone
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
USER nextjs

# Jalankan server Next.js standalone
CMD ["node", "server.js"]
