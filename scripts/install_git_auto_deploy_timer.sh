#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEMD_USER_DIR="${SYSTEMD_USER_DIR:-$HOME/.config/systemd/user}"

chmod 0755 "$ROOT_DIR/scripts/git_auto_deploy.sh"
install -d -m 0755 "$SYSTEMD_USER_DIR"
install -m 0644 "$ROOT_DIR/infra/systemd/user/localtrip-git-auto-deploy.service" "$SYSTEMD_USER_DIR/localtrip-git-auto-deploy.service"
install -m 0644 "$ROOT_DIR/infra/systemd/user/localtrip-git-auto-deploy.timer" "$SYSTEMD_USER_DIR/localtrip-git-auto-deploy.timer"

systemctl --user daemon-reload
systemctl --user enable --now localtrip-git-auto-deploy.timer
systemctl --user list-timers localtrip-git-auto-deploy.timer
