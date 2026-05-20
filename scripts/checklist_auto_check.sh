#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CHECKLIST_FILE="${CHECKLIST_FILE:-$ROOT_DIR/docs/NEXT_CHECKLIST_PLAN_KO.md}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.local/logs}"
COMPOSE_FILE="${COMPOSE_FILE:-$ROOT_DIR/docker-compose.dev.yml}"
WEB_URL="${WEB_URL:-http://localhost}"
API_URL="${API_URL:-http://localhost:8080}"

RUN_WEB_BUILD="${RUN_WEB_BUILD:-1}"
RUN_API_BUILD="${RUN_API_BUILD:-1}"
RUN_DOCKER_DEPLOY="${RUN_DOCKER_DEPLOY:-1}"
RUN_MOCK_SYNC="${RUN_MOCK_SYNC:-1}"
AUTO_COMMIT="${AUTO_COMMIT:-0}"
AUTO_PUSH="${AUTO_PUSH:-0}"

mkdir -p "$LOG_DIR"
RUN_ID="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="$LOG_DIR/checklist-auto-$RUN_ID.log"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE"
}

run() {
  log "run: $*"
  set +e
  "$@" 2>&1 | tee -a "$LOG_FILE"
  local status="${PIPESTATUS[0]}"
  set -e
  return "$status"
}

ensure_web_dependencies() {
  if [[ "$RUN_WEB_BUILD" != "1" ]]; then
    return 0
  fi
  if [[ -x "$ROOT_DIR/apps/web/node_modules/vite/bin/vite.js" ]]; then
    return 0
  fi
  log "install web dependencies for isolated worktree"
  run npm --prefix apps/web ci
}

wait_for_http() {
  local url="$1"
  local label="$2"
  local attempts="${3:-30}"
  for _ in $(seq 1 "$attempts"); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      log "ok: $label"
      return 0
    fi
    sleep 2
  done
  log "fail: $label ($url)"
  return 1
}

append_checklist_note() {
  local status="$1"
  local detail="$2"
  {
    printf '\n## 자동 점검 메모\n\n'
    printf -- '- %s UTC `%s`: %s\n' "$(date -u '+%Y-%m-%d %H:%M')" "$status" "$detail"
    printf -- '  - 로그: `%s`\n' "$LOG_FILE"
  } >> "$CHECKLIST_FILE"
}

main() {
  cd "$ROOT_DIR"
  log "checklist auto check start"

  if [[ "$RUN_WEB_BUILD" == "1" ]]; then
    ensure_web_dependencies
    run npm --prefix apps/web run build
  fi

  if [[ "$RUN_API_BUILD" == "1" ]]; then
    run docker compose -f "$COMPOSE_FILE" build api
  fi

  if [[ "$RUN_DOCKER_DEPLOY" == "1" ]]; then
    run docker compose -f "$COMPOSE_FILE" build web
    run docker compose -f "$COMPOSE_FILE" up -d api web
  fi

  wait_for_http "$WEB_URL" "web root"
  wait_for_http "$API_URL/api/destinations?size=1" "api destinations"

  if [[ "$RUN_MOCK_SYNC" == "1" ]]; then
    run curl -fsS -X POST "$API_URL/api/destinations/sync/mock"
    run curl -fsSG --data-urlencode "region=강릉" --data-urlencode "size=1" "$API_URL/api/destinations"
    run curl -fsSG --data-urlencode "region=대전" --data-urlencode "size=1" "$API_URL/api/destinations"
  fi

  append_checklist_note "성공" "Web/API 빌드, Docker 재배포, health check, mock destination sync 확인"

  if [[ "$AUTO_COMMIT" == "1" || "$AUTO_PUSH" == "1" ]]; then
    if ! git diff --quiet -- "$CHECKLIST_FILE"; then
      run git add "$CHECKLIST_FILE"
      run git commit -m "자동 체크리스트 점검 로그 반영"
    fi
  fi

  if [[ "$AUTO_PUSH" == "1" ]]; then
    run git push origin "$(git branch --show-current)"
  fi

  log "checklist auto check done"
}

on_error() {
  local status="$?"
  append_checklist_note "실패" "자동 점검 실패. 로그 확인 필요" || true
  exit "$status"
}

trap on_error ERR
main
trap - ERR
