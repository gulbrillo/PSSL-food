#!/usr/bin/env bash
# Update PSSL LunchPad to the latest version from git and restart the containers.
# The deployment copy is force-synced to the remote branch — any local edits to
# tracked files are discarded. Untracked files (.env, apache-vhost-*.conf) and
# the database are never touched.
set -euo pipefail
cd "$(dirname "$0")"

# Everything lives inside main() so bash parses the whole script before running
# it — otherwise git rewriting this very file mid-run would corrupt execution.
main() {
  local branch
  branch=$(git rev-parse --abbrev-ref HEAD)

  echo "→ Fetching latest source (branch: $branch) ..."
  git fetch origin "$branch"

  if ! git diff --quiet || ! git diff --cached --quiet; then
    echo "⚠ Discarding local changes to tracked files (deployment copies should be pristine):"
    git status --short
  fi
  git reset --hard "origin/$branch"

  echo "→ Rebuilding images ..."
  docker compose build --pull

  echo "→ Restarting services (db schema updates apply automatically on start) ..."
  docker compose up -d

  echo "→ Cleaning up old images ..."
  docker image prune -f >/dev/null

  echo "✅ Update complete."
  docker compose ps
}

main "$@"; exit $?
