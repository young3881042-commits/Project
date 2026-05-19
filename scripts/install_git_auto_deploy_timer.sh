#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"

chmod 0755 "$ROOT_DIR/scripts/git_auto_deploy.sh"
install -m 0644 "$ROOT_DIR/infra/systemd/localtrip-git-auto-deploy.service" "$SYSTEMD_DIR/localtrip-git-auto-deploy.service"
install -m 0644 "$ROOT_DIR/infra/systemd/localtrip-git-auto-deploy.timer" "$SYSTEMD_DIR/localtrip-git-auto-deploy.timer"

systemctl daemon-reload
systemctl enable --now localtrip-git-auto-deploy.timer
systemctl list-timers localtrip-git-auto-deploy.timer
