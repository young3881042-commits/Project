#!/usr/bin/env bash
set -euo pipefail

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if [[ -x ./gradlew ]]; then
  ./gradlew bootRun --no-daemon
else
  gradle bootRun --no-daemon
fi
