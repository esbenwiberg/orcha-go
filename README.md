# Orcha Go

Mobile-first web terminal for GitHub repos. Clone a repo, get a terminal, work from your phone.

## Features

- Full interactive terminal (xterm.js) in your mobile browser
- Clone any GitHub repo and work in it
- Extra keys toolbar (Ctrl, Alt, Esc, Tab, arrows) for mobile use
- Sticky modifier keys (tap once for next key, double-tap to lock)
- Pinch-to-zoom font size
- Session persistence via tmux (survives browser disconnect)
- PWA installable (add to home screen)
- Encrypted GitHub PAT storage

## Quick Start (Local)

```bash
npm install
npm run build
ENCRYPTION_KEY=your-secret-key npm start
# Open http://localhost:8080
```

## Docker

```bash
docker build -t orcha-go .
docker run -p 8080:8080 -e ENCRYPTION_KEY=your-secret-key orcha-go
```

## Deploy to Azure App Service

### Prerequisites
- Azure subscription
- Azure Container Registry (ACR)
- Azure App Service Plan (B1 Linux, ~$13/month)

### Setup

1. Create resources:
```bash
az group create -n orcha-go-rg -l westeurope
az acr create -n orchagoacr -g orcha-go-rg --sku Basic
az appservice plan create -n orcha-go-plan -g orcha-go-rg --sku B1 --is-linux
az webapp create -n orcha-go -g orcha-go-rg -p orcha-go-plan \
  --deployment-container-image-name orchagoacr.azurecr.io/orcha-go:latest
```

2. Configure App Settings:
```bash
az webapp config appsettings set -n orcha-go -g orcha-go-rg --settings \
  WEBSITES_PORT=8080 \
  ENCRYPTION_KEY=$(openssl rand -hex 16) \
  WEBSITES_ENABLE_APP_SERVICE_STORAGE=true
```

3. Enable WebSocket:
```bash
az webapp config set -n orcha-go -g orcha-go-rg --web-sockets-enabled true
```

4. Set up EasyAuth (Azure Portal):
   - App Service > Authentication > Add provider
   - Choose Azure AD or GitHub
   - Enable "Require authentication"

5. Configure GitHub Actions secrets:
   - `ACR_LOGIN_SERVER`: your-acr.azurecr.io
   - `ACR_USERNAME`: ACR admin username
   - `ACR_PASSWORD`: ACR admin password
   - `AZURE_WEBAPP_NAME`: orcha-go
   - `AZURE_WEBAPP_PUBLISH_PROFILE`: download from Azure Portal

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ENCRYPTION_KEY` | Yes | Key for encrypting GitHub PAT (any string, min 8 chars) |
| `GITHUB_TOKEN` | No | Default GitHub PAT (can also set via UI) |
| `PORT` | No | Server port (default: 8080) |
| `WORKSPACE_DIR` | No | Repo storage path (default: /home/workspaces) |
| `STORE_DIR` | No | Config storage path (default: /home/.orcha-go) |

### Notes
- Azure App Service B1 costs ~$13/month
- `/home` directory is persistent storage (survives container restarts)
- tmux sessions are lost on container recycle (~every 29 hours), but cloned repos persist
- EasyAuth handles all authentication -- no app code changes needed
- WebSocket must be enabled in App Service configuration

## Tech Stack

- **Backend**: Node.js 20, Express 5, ws, node-pty, tmux
- **Frontend**: Vanilla JS, xterm.js, Tailwind CSS (all via CDN)
- **Hosting**: Azure App Service B1, Docker
- **Auth**: Azure EasyAuth
