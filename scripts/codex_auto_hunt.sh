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
LOG_DIR="${LOG_DIR:-$ROOT_DIR/.local/logs}"
RUN_ID="$(date -u '+%Y%m%dT%H%M%SZ')"
LOG_FILE="$LOG_DIR/codex-auto-hunt-$RUN_ID.log"

mkdir -p "$LOG_DIR"

log() {
  printf '[%s] %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')" "$*" | tee -a "$LOG_FILE"
}

run() {
  log "run: $*"
  "$@" 2>&1 | tee -a "$LOG_FILE"
}

prepare_worktree() {
  log "prepare isolated worktree: $AUTO_WORKTREE_DIR"
  run git -C "$ROOT_DIR" fetch origin "$BASE_BRANCH"
  if [[ ! -d "$AUTO_WORKTREE_DIR/.git" ]]; then
    run git -C "$ROOT_DIR" worktree add -B "$AUTO_BRANCH" "$AUTO_WORKTREE_DIR" "origin/$BASE_BRANCH"
  else
    run git -C "$AUTO_WORKTREE_DIR" checkout "$AUTO_BRANCH"
    run git -C "$AUTO_WORKTREE_DIR" reset --hard "origin/$BASE_BRANCH"
    run git -C "$AUTO_WORKTREE_DIR" clean -fd
  fi
}

codex_prompt() {
  cat <<'PROMPT'
You are running unattended on a 6-hour timer for the LocalTrip project.

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
  codex_prompt | docker run --rm \
    --network host \
    -v "$AUTO_WORKTREE_DIR:/workspace" \
    -v "$CODEX_HOME_DIR:/root/.codex" \
    --entrypoint "$CODEX_BIN" \
    "$CODEX_IMAGE" \
    exec \
    --cd /workspace \
    --sandbox workspace-write \
    --ask-for-approval never \
    --model "$CODEX_MODEL" \
    - 2>&1 | tee -a "$LOG_FILE"
}

build_deploy_check() {
  log "run build/deploy/check from isolated worktree"
  RUN_WEB_BUILD=1 \
  RUN_API_BUILD=1 \
  RUN_DOCKER_DEPLOY=1 \
  RUN_MOCK_SYNC=1 \
  AUTO_COMMIT=0 \
  AUTO_PUSH=0 \
  LOG_DIR="$LOG_DIR" \
  "$AUTO_WORKTREE_DIR/scripts/checklist_auto_check.sh" 2>&1 | tee -a "$LOG_FILE"
}

commit_and_push() {
  if git -C "$AUTO_WORKTREE_DIR" diff --quiet && [[ -z "$(git -C "$AUTO_WORKTREE_DIR" status --porcelain)" ]]; then
    log "no changes to commit"
    return 0
  fi

  run git -C "$AUTO_WORKTREE_DIR" add .
  run git -C "$AUTO_WORKTREE_DIR" \
    -c user.name="${GIT_USER_NAME:-LocalTrip Auto}" \
    -c user.email="${GIT_USER_EMAIL:-localtrip-auto@localhost}" \
    commit -m "Run automated checklist work"
  run git -C "$AUTO_WORKTREE_DIR" push origin "HEAD:$BASE_BRANCH"
}

fix_ownership() {
  local uid gid
  uid="$(stat -c '%u' "$ROOT_DIR")"
  gid="$(stat -c '%g' "$ROOT_DIR")"
  if [[ "$(id -u)" == "0" ]]; then
    chown -R "$uid:$gid" "$AUTO_WORKTREE_DIR" "$LOG_DIR" || true
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

if ! main; then
  log "codex auto hunt failed"
  fix_ownership
  exit 1
fi
