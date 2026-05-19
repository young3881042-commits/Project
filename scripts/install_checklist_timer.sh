#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SYSTEMD_DIR="${SYSTEMD_DIR:-/etc/systemd/system}"

install -m 0644 "$ROOT_DIR/infra/systemd/localtrip-checklist-auto.service" "$SYSTEMD_DIR/localtrip-checklist-auto.service"
install -m 0644 "$ROOT_DIR/infra/systemd/localtrip-checklist-auto.timer" "$SYSTEMD_DIR/localtrip-checklist-auto.timer"

systemctl daemon-reload
systemctl enable --now localtrip-checklist-auto.timer
systemctl list-timers localtrip-checklist-auto.timer
