# Orcha Go

Mobile-first single-terminal web app. Pick a GitHub repo, clone it, get a full interactive terminal.

## Tech Stack
- **Backend**: TypeScript 5.x, Express 5.x, ws 8.x, node-pty 1.x
- **Frontend**: Vanilla JS, xterm.js 5.x (CDN), Tailwind CSS (CDN)
- **Runtime**: Node 20, Docker (node:20-bookworm)
- **Deployment**: Azure App Service B1

## Conventions
- ESM modules (`"type": "module"` in package.json)
- Port 8080 (Azure App Service convention)
- Dark theme: bg-primary #0d0d0d, bg-secondary #1a1a1a, accent #9b59b6
- TypeScript strict mode, compiled to dist/
- Static files served from public/

## Commands
- `npm run build` -- Compile TypeScript to dist/
- `npm start` -- Run production server
- `npm run dev` -- Watch mode for development
- `docker build -t orcha-go .` -- Build Docker image
- `docker run -p 8080:8080 orcha-go` -- Run container

## Project Structure
```
src/          -- TypeScript backend source
public/       -- Static frontend files
dist/         -- Compiled JS output (gitignored)
```

## Non-Goals
- Multi-user support
- Multiple simultaneous terminals
- AI agent orchestration
- Code editor (Monaco)
- Desktop-optimized layout
