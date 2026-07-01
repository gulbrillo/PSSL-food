#!/usr/bin/env bash
# Update PSSL LunchPad to the latest version from git and restart the containers.
# Your .env and the database are untouched.
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Pulling latest source ..."
git pull --ff-only

echo "→ Rebuilding images ..."
docker compose build --pull

echo "→ Restarting services (db schema updates apply automatically on start) ..."
docker compose up -d

echo "→ Cleaning up old images ..."
docker image prune -f >/dev/null

echo "✅ Update complete."
docker compose ps
