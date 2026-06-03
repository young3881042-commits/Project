#!/usr/bin/env bash
set -euo pipefail

APP_REPO="${APP_REPO:-/workspace/vibeCoding}"
DEPLOY_SOURCE="${DEPLOY_SOURCE:-local-codex}"
GIT_REMOTE="${GIT_REMOTE:-git@github.com:young3881042-commits/Project.git}"
GIT_BRANCH="${GIT_BRANCH:-main}"
GIT_WORKTREE="${GIT_WORKTREE:-/var/jenkins_home/git/ai-assitant}"

if [ "${DEPLOY_SOURCE}" = "git" ]; then
  mkdir -p "$(dirname "${GIT_WORKTREE}")"
  if [ ! -d "${GIT_WORKTREE}/.git" ]; then
    git clone --branch "${GIT_BRANCH}" "${GIT_REMOTE}" "${GIT_WORKTREE}"
  else
    git -C "${GIT_WORKTREE}" fetch "${GIT_REMOTE}" "${GIT_BRANCH}"
    git -C "${GIT_WORKTREE}" checkout "${GIT_BRANCH}"
    git -C "${GIT_WORKTREE}" pull --ff-only "${GIT_REMOTE}" "${GIT_BRANCH}"
  fi
  APP_REPO="${GIT_WORKTREE}"
elif [ "${DEPLOY_SOURCE}" != "local-codex" ]; then
  echo "Unknown DEPLOY_SOURCE: ${DEPLOY_SOURCE}" >&2
  exit 2
fi

COMPOSE_FILE="${APP_REPO}/docker-compose.dev.yml"
export DB_PORT="${DB_PORT:-13306}"
export API_PORT="${API_PORT:-18080}"
export WEB_HTTP_PORT="${WEB_HTTP_PORT:-80}"
export WEB_HTTPS_PORT="${WEB_HTTPS_PORT:-443}"
export DOCKER_BUILDKIT="${DOCKER_BUILDKIT:-1}"
export COMPOSE_PROJECT_NAME="${COMPOSE_PROJECT_NAME:-vibecoding}"

cd "${APP_REPO}"

echo "Repository: ${APP_REPO}"
echo "Deploy source: ${DEPLOY_SOURCE}"
git rev-parse --short HEAD || true
git status --short || true

docker compose -f "${COMPOSE_FILE}" build web api
docker compose -f "${COMPOSE_FILE}" up -d api web
docker compose -f "${COMPOSE_FILE}" ps

docker exec vibecoding-web-1 wget -qO- http://127.0.0.1/app >/dev/null
docker exec vibecoding-web-1 wget -qO- http://127.0.0.1/notes >/dev/null
docker exec vibecoding-web-1 wget -qO- http://127.0.0.1/manifest.webmanifest >/dev/null
