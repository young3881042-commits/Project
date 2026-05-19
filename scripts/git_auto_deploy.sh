#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
BRANCH="${AUTO_DEPLOY_BRANCH:-main}"
REMOTE="${AUTO_DEPLOY_REMOTE:-origin}"
COMPOSE_FILE="${AUTO_DEPLOY_COMPOSE_FILE:-docker-compose.dev.yml}"
LOG_DIR="${AUTO_DEPLOY_LOG_DIR:-$ROOT_DIR/.local/logs}"
LOCK_FILE="${AUTO_DEPLOY_LOCK_FILE:-/tmp/localtrip-git-auto-deploy.lock}"

mkdir -p "$LOG_DIR"
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  echo "[auto-deploy] another deploy is already running"
  exit 0
fi

cd "$ROOT_DIR"

log() {
  printf '[auto-deploy] %s %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*"
}

current_branch="$(git branch --show-current)"
if [[ "$current_branch" != "$BRANCH" ]]; then
  log "skip: current branch is $current_branch, expected $BRANCH"
  exit 0
fi

if [[ -n "$(git status --porcelain)" ]]; then
  log "skip: working tree has local changes"
  git status --short
  exit 0
fi

log "fetch $REMOTE $BRANCH"
git fetch "$REMOTE" "$BRANCH"

local_sha="$(git rev-parse HEAD)"
remote_sha="$(git rev-parse "$REMOTE/$BRANCH")"

if [[ "$local_sha" == "$remote_sha" ]]; then
  log "up to date: $local_sha"
  exit 0
fi

base_sha="$(git merge-base HEAD "$REMOTE/$BRANCH")"
if [[ "$base_sha" != "$local_sha" ]]; then
  log "skip: local branch is not a fast-forward of $REMOTE/$BRANCH"
  log "local=$local_sha remote=$remote_sha base=$base_sha"
  exit 1
fi

log "deploy start: $local_sha -> $remote_sha"
git pull --ff-only "$REMOTE" "$BRANCH"

docker compose -f "$COMPOSE_FILE" up -d --build

log "wait for API"
for attempt in {1..30}; do
  if curl -fsS -o /dev/null http://localhost:8080/api/destinations; then
    log "API ready"
    break
  fi
  if [[ "$attempt" == "30" ]]; then
    log "API health check failed"
    exit 1
  fi
  sleep 2
done

log "web check"
curl -fsS -o /dev/null http://localhost/

log "deploy complete: $(git rev-parse HEAD)"
