# ============================================
# 🎮 Three.js Game - Docker Configuration
# ============================================
# Multi-stage build for optimal image size
# Supports both development and production modes

# -----------------------------
# 📦 Stage 1: Dependencies
# -----------------------------
FROM node:20-alpine AS deps

WORKDIR /app

# Install dependencies only (cached layer)
COPY package.json package-lock.json* ./
RUN npm ci --silent

# -----------------------------
# 🔨 Stage 2: Builder
# -----------------------------
FROM node:20-alpine AS builder

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build for production
RUN npm run build

# -----------------------------
# 🚀 Stage 3: Production
# -----------------------------
FROM node:20-alpine AS production

WORKDIR /app

ENV NODE_ENV=production

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 gameuser

# Copy only necessary files
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server ./server

# Set proper ownership
RUN chown -R gameuser:nodejs /app

USER gameuser

EXPOSE 3000 8080

# Start both Vite preview and WebSocket server
CMD ["sh", "-c", "PORT=8080 node server/websocket-server.js & npm run preview -- --host 0.0.0.0 --port 3000"]

# -----------------------------
# 🛠️ Stage 4: Development
# -----------------------------
FROM node:20-alpine AS development

WORKDIR /app

ENV NODE_ENV=development
ENV HOST=0.0.0.0

# Copy dependencies and source
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 5173 8080

# Hot reload with Vite + WebSocket server
CMD ["sh", "-c", "PORT=8080 node server/websocket-server.js & npm run dev -- --host 0.0.0.0 --port 5173"]
