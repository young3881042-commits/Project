#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

npm install
npm run dev -- --host 0.0.0.0 --port "${PORT:-5173}"
