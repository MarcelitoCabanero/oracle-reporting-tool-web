#!/bin/sh
set -e

# ==============================================================================
# Oracle Reporting Tool Web - Synology Production Deployment & Update Script
# Usage: sudo sh deploy/update.sh
# ==============================================================================

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"

echo "========================================================"
echo "🚀 Starting Oracle Reporting Tool Web Update"
echo "📂 Project Directory: $PROJECT_DIR"
echo "🕒 Timestamp: $(date)"
echo "========================================================"

# 1. Pull Latest Changes from GitHub
echo ""
echo "📥 [1/4] Pulling latest code from GitHub (origin main)..."
if command -v git >/dev/null 2>&1; then
  git pull origin main
else
  echo "ℹ️  'git' binary not found on host DSM. Running via Alpine Docker..."
  docker run --rm -v "$PROJECT_DIR":/git alpine/git pull origin main
fi

# 2. Check for required .env file
if [ ! -f .env ]; then
  echo "⚠️  WARNING: .env file is missing in $PROJECT_DIR!"
  echo "   Please create .env before running the application."
  exit 1
fi

# 3. Rebuild and restart container
echo ""
echo "🔨 [2/4] Building and restarting Docker containers..."
if docker compose version >/dev/null 2>&1; then
  docker compose up -d --build
elif command -v docker-compose >/dev/null 2>&1; then
  docker-compose up -d --build
else
  echo "❌ Error: Neither 'docker compose' nor 'docker-compose' found!"
  exit 1
fi

# 4. Clean up dangling images to save Synology storage
echo ""
echo "🧹 [3/4] Cleaning up unused image layers..."
docker image prune -f

# 5. Verify Health Status
echo ""
echo "🩺 [4/4] Verifying health check on port 3001..."
sleep 5

HEALTH_STATUS=""
if command -v curl >/dev/null 2>&1; then
  HEALTH_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3001/api/health || true)
elif command -v wget >/dev/null 2>&1; then
  HEALTH_STATUS=$(wget --spider -S http://localhost:3001/api/health 2>&1 | awk '/HTTP\// {print $2}' | tail -1 || true)
fi

echo ""
echo "========================================================"
if [ "$HEALTH_STATUS" = "200" ]; then
  echo "✅ DEPLOYMENT SUCCESSFUL! (Health check HTTP 200 OK)"
else
  echo "ℹ️  Container restarted. Health check returned: '${HEALTH_STATUS:-N/A}'"
  echo "   Run 'docker logs --tail 30 oracle-reporting-web' to inspect startup logs."
fi
echo "🌐 URL: http://$(hostname -I 2>/dev/null | awk '{print $1}' || echo '192.168.5.237'):3001"
echo "========================================================"
