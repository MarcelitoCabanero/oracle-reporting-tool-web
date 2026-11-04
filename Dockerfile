# ==========================================
# Stage 1: Build Server & Client Workspaces
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY client/package.json ./client/
COPY server/package.json ./server/

# Install all workspace dependencies
RUN npm ci

# Copy source code
COPY client ./client
COPY server ./server

# Build TypeScript server and Vite React client
RUN npm run build

# Prune devDependencies so only production runtime packages remain
RUN npm prune --omit=dev

# ==========================================
# Stage 2: Lightweight Production Runtime
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV API_HOST=0.0.0.0
ENV API_PORT=3001
ENV TZ=Asia/Manila

# Copy production node_modules and compiled artifacts
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3001/api/health || exit 1

CMD ["node", "server/dist/server.js"]
