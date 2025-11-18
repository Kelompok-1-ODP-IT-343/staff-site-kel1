# ---------- Base Builder Stage ----------
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /app

# Install system deps
RUN apk add --no-cache libc6-compat

# Copy dependency files
COPY package*.json ./

# Install dependencies cleanly
RUN npm ci

# Environment for build optimization
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DISABLE_ESLINT=1
# 🧩 Prevent static prerendering issues with useSearchParams
ENV NEXT_DISABLE_STATIC_GENERATION=true

# Copy the rest of the source code
COPY . .

# Build the Next.js app
RUN npm run build

# ---------- Runtime Stage ----------
FROM node:20-alpine AS runner

# Set working directory
WORKDIR /app

# Environment for runtime
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_DISABLE_ESLINT=1

# Create non-root user
RUN adduser -D -u 1001 nextjs

# Copy necessary build output (standalone mode)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Expose the app port
EXPOSE 3000

# Run as non-root user
USER nextjs

# Default command to start the Next.js standalone server
CMD ["node", "server.js"]
