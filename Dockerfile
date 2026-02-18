# Build stage
FROM node:20-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Production stage
FROM node:20-bookworm-slim AS production

LABEL org.opencontainers.image.title="Orcha Go" \
      org.opencontainers.image.description="Mobile-first web terminal for GitHub repos" \
      org.opencontainers.image.source="https://github.com/orcha-go/orcha-go"

RUN apt-get update && \
    apt-get install -y --no-install-recommends tmux git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

COPY --from=build /app/dist/ ./dist/
COPY public/ ./public/

# Azure App Service uses /home as persistent storage
ENV PORT=8080 \
    NODE_ENV=production \
    WORKSPACE_DIR=/home/workspaces \
    STORE_DIR=/home/.orcha-go

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD node -e "fetch('http://localhost:8080/api/health').then(r=>{if(!r.ok)throw 1}).catch(()=>process.exit(1))"

# Run as node user (UID 1000) -- can still use tmux and git
USER node

CMD ["node", "dist/server.js"]
