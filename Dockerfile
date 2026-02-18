# Build stage
FROM node:20-bookworm AS build

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/

RUN npm run build

# Production stage
FROM node:20-bookworm AS production

RUN apt-get update && \
    apt-get install -y --no-install-recommends tmux git && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY --from=build /app/dist/ ./dist/
COPY public/ ./public/

EXPOSE 8080

USER node

CMD ["node", "dist/server.js"]
