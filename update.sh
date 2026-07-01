#!/usr/bin/env bash
# Update PSSL LunchPad to the latest version from git and restart the containers.
# Your .env and the database are untouched.
set -euo pipefail
cd "$(dirname "$0")"

# A deployment copy should be pristine — local edits (often just a stray
# chmod or a line-ending change) block git pull, so offer to discard them.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "⚠ This copy has local changes that would block the update:"
  git status --short
  read -r -p "Discard these local changes and continue? (y/N) " REPLY
  if [ "$REPLY" = "y" ] || [ "$REPLY" = "Y" ]; then
    git checkout -- .
    git reset -q
  else
    echo "Aborted. Commit/stash your changes, then run ./update.sh again."
    exit 1
  fi
fi

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
