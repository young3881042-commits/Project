#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AUTO_WORKTREE_DIR="${AUTO_WORKTREE_DIR:-/home/lezzs5103/vibeCoding-auto}"
AUTO_BRANCH="${AUTO_BRANCH:-auto-checklist}"
BASE_BRANCH="${BASE_BRANCH:-main}"
CODEX_IMAGE="${CODEX_IMAGE:-vibecoding-api}"
CODEX_BIN="${CODEX_BIN:-/opt/jupiter-cli/bin/codex}"
CODEX_HOME_DIR="${CODEX_HOME_DIR:-/data/codex}"
CODEX_MODEL="${CODEX_MODEL:-gpt-5.5}"
AUTO_GIT_USER="${AUTO_GIT_USER:-lezzs5103}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.local/logs}"
RUN_ID="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="$LOG_DIR/codex-auto-hunt-$RUN_ID.log"

mkdir -p "$LOG_DIR"

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

run_git() {
  if [[ "$(id -u)" == "0" ]] && id "$AUTO_GIT_USER" >/dev/null 2>&1; then
    log "run as $AUTO_GIT_USER: git $*"
    set +e
    sudo -n -H -u "$AUTO_GIT_USER" git "$@" 2>&1 | tee -a "$LOG_FILE"
    local status="${PIPESTATUS[0]}"
    set -e
    return "$status"
  fi
  run git "$@"
}

ensure_ssh_known_hosts() {
  if ! command -v ssh-keyscan >/dev/null 2>&1; then
    return 0
  fi
  if [[ "$(id -u)" == "0" ]] && id "$AUTO_GIT_USER" >/dev/null 2>&1; then
    log "ensure github.com SSH known_hosts for $AUTO_GIT_USER"
    sudo -n -H -u "$AUTO_GIT_USER" bash -lc 'mkdir -p ~/.ssh && touch ~/.ssh/known_hosts && chmod 700 ~/.ssh && chmod 600 ~/.ssh/known_hosts && grep -q github.com ~/.ssh/known_hosts || ssh-keyscan github.com >> ~/.ssh/known_hosts' 2>>"$LOG_FILE" || true
    sudo -n -H -u "$AUTO_GIT_USER" git config --global --add safe.directory "$ROOT_DIR" 2>>"$LOG_FILE" || true
    sudo -n -H -u "$AUTO_GIT_USER" git config --global --add safe.directory "$AUTO_WORKTREE_DIR" 2>>"$LOG_FILE" || true
    return 0
  fi
  mkdir -p "$HOME/.ssh" && touch "$HOME/.ssh/known_hosts"
  chmod 700 "$HOME/.ssh" && chmod 600 "$HOME/.ssh/known_hosts"
  if ! grep -q 'github.com' "$HOME/.ssh/known_hosts"; then
    log "ensure github.com SSH known_hosts"
    ssh-keyscan github.com >> "$HOME/.ssh/known_hosts" 2>>"$LOG_FILE" || true
  fi
}

prepare_worktree() {
  log "prepare isolated worktree: $AUTO_WORKTREE_DIR"
  ensure_ssh_known_hosts
  run_git -C "$ROOT_DIR" fetch origin "$BASE_BRANCH"
  if [[ -e "$AUTO_WORKTREE_DIR" ]]; then
    fix_ownership
  fi
  if [[ ! -e "$AUTO_WORKTREE_DIR/.git" ]]; then
    run_git -C "$ROOT_DIR" worktree add -B "$AUTO_BRANCH" "$AUTO_WORKTREE_DIR" "origin/$BASE_BRANCH"
  else
    run_git -C "$AUTO_WORKTREE_DIR" checkout "$AUTO_BRANCH"
    run_git -C "$AUTO_WORKTREE_DIR" reset --hard "origin/$BASE_BRANCH"
    run_git -C "$AUTO_WORKTREE_DIR" clean -fd
  fi
}

codex_prompt() {
  cat <<'PROMPT'
You are running unattended on the 00:00, 06:00, 12:00, and 18:00 UTC timer for the LocalTrip project.

Goal:
- Pick exactly one small unchecked item from docs/NEXT_CHECKLIST_PLAN_KO.md.
- Prefer safe LocalTrip AI trip work: mobile UI/UX polish, dataset/checklist docs, lightweight validation, or user-facing error copy.
- Implement a small, reviewable change.
- Do not perform broad refactors.
- Do not change secrets, credentials, deployment ports, or destructive infrastructure.
- Do not run git commit or git push. The host automation will build, deploy, commit, and push.
- Update docs/NEXT_CHECKLIST_PLAN_KO.md with what you completed.

Validation:
- Run the smallest relevant local validation available in this workspace.
- If validation cannot run, document why in docs/NEXT_CHECKLIST_PLAN_KO.md.
PROMPT
}

run_codex() {
  if [[ ! -d "$CODEX_HOME_DIR" ]]; then
    log "skip codex: CODEX_HOME_DIR not found: $CODEX_HOME_DIR"
    return 0
  fi

  log "start unattended Codex worker"
  set +e
  codex_prompt | docker run --rm \
    --network host \
    -v "$AUTO_WORKTREE_DIR:/workspace" \
    -v "$CODEX_HOME_DIR:/root/.codex" \
    --entrypoint "$CODEX_BIN" \
    "$CODEX_IMAGE" \
    exec \
    --cd /workspace \
    --sandbox workspace-write \
    --dangerously-bypass-approvals-and-sandbox \
    --model "$CODEX_MODEL" \
    - 2>&1 | tee -a "$LOG_FILE"
  local status="${PIPESTATUS[1]}"
  set -e
  return "$status"
}

build_deploy_check() {
  log "run build/deploy/check from isolated worktree"
  RUN_WEB_BUILD=1 \
  RUN_API_BUILD=1 \
  RUN_DOCKER_DEPLOY=1 \
  RUN_MOCK_SYNC=1 \
  AUTO_COMMIT=0 \
  AUTO_PUSH=0 \
  DB_PORT="${AUTO_DB_PORT:-13306}" \
  API_PORT="${AUTO_API_PORT:-18080}" \
  WEB_HTTP_PORT="${AUTO_WEB_HTTP_PORT:-18000}" \
  WEB_HTTPS_PORT="${AUTO_WEB_HTTPS_PORT:-18443}" \
  WEB_URL="${AUTO_WEB_URL:-http://localhost:18000}" \
  API_URL="${AUTO_API_URL:-http://localhost:18080}" \
  LOG_DIR="$LOG_DIR" \
  "$AUTO_WORKTREE_DIR/scripts/checklist_auto_check.sh" 2>&1 | tee -a "$LOG_FILE"
  local status="${PIPESTATUS[0]}"
  return "$status"
}

commit_and_push() {
  fix_ownership
  if sudo -n -H -u "$AUTO_GIT_USER" git -C "$AUTO_WORKTREE_DIR" diff --quiet && [[ -z "$(sudo -n -H -u "$AUTO_GIT_USER" git -C "$AUTO_WORKTREE_DIR" status --porcelain)" ]]; then
    log "no changes to commit"
    return 0
  fi

  run_git -C "$AUTO_WORKTREE_DIR" add .
  run_git -C "$AUTO_WORKTREE_DIR" \
    -c user.name="${GIT_USER_NAME:-LocalTrip Auto}" \
    -c user.email="${GIT_USER_EMAIL:-localtrip-auto@localhost}" \
    commit -m "Run automated checklist work"
  run_git -C "$AUTO_WORKTREE_DIR" push origin "HEAD:$BASE_BRANCH"
}

fix_ownership() {
  local uid gid
  uid="$(stat -c '%u' "$ROOT_DIR")"
  gid="$(stat -c '%g' "$ROOT_DIR")"
  if [[ "$(id -u)" == "0" ]]; then
    local worktree_meta="$ROOT_DIR/.git/worktrees/$(basename "$AUTO_WORKTREE_DIR")"
    chown -R "$uid:$gid" "$AUTO_WORKTREE_DIR" "$LOG_DIR" "$worktree_meta" 2>/dev/null || true
  fi
}

main() {
  prepare_worktree
  run_codex
  build_deploy_check
  commit_and_push
  fix_ownership
  log "codex auto hunt done"
}

on_error() {
  local status="$?"
  log "codex auto hunt failed"
  fix_ownership
  exit "$status"
}

trap on_error ERR
main
trap - ERR
