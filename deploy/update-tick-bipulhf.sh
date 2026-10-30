#!/usr/bin/env bash
# Pulls the latest main, rebuilds the web app and restarts the API on the
# tick.bipulhf.dev server. Run from the repo root on the server:
#   deploy/update-tick-bipulhf.sh
# apps/api/.env and apps/web/.env.production stay on the server, never in git.
set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="$HOME/.bun/bin:$PATH"

git pull --ff-only
bun install --frozen-lockfile
(cd apps/web && bun run build)
sudo rsync -a --delete apps/web/dist/ /var/www/tick-taka/app/
pm2 restart tick-taka-api --update-env
pm2 save
sudo nginx -t && sudo systemctl reload nginx
echo "Deployed $(git rev-parse --short HEAD)"
