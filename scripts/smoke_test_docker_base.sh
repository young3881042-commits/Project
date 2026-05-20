#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1}"
EXPECTED_TEXT="${EXPECTED_TEXT:-내 여행과 하루 일정을 간단하게 정리하세요}"
REMOVED_TEXT="${REMOVED_TEXT:-Guest mode}"

tmp_html="$(mktemp)"
tmp_js="$(mktemp)"

cleanup() {
  rm -f "$tmp_html" "$tmp_js"
}
trap cleanup EXIT

echo "[smoke] Web root: ${BASE_URL}"
for _ in $(seq 1 30); do
  if curl -fsS "${BASE_URL}/mypage" -o "$tmp_html"; then
    break
  fi
  sleep 2
done

if [[ ! -s "$tmp_html" ]]; then
  echo "[smoke] Web root did not become ready: ${BASE_URL}/mypage" >&2
  exit 1
fi

asset_path="$(grep -o '/assets/[^"]*\.js' "$tmp_html" | head -n 1)"
if [[ -z "$asset_path" ]]; then
  echo "[smoke] JS asset path not found" >&2
  exit 1
fi

echo "[smoke] JS bundle: ${asset_path}"
curl -fsS "${BASE_URL}${asset_path}" -o "$tmp_js"

if ! grep -q "$EXPECTED_TEXT" "$tmp_js"; then
  echo "[smoke] Expected deployed text not found: ${EXPECTED_TEXT}" >&2
  exit 1
fi

if grep -q "$REMOVED_TEXT" "$tmp_js"; then
  echo "[smoke] Removed UI text is still deployed: ${REMOVED_TEXT}" >&2
  exit 1
fi

cache_headers="$(curl -fsSI "${BASE_URL}${asset_path}" | tr -d '\r')"
if echo "$cache_headers" | grep -qi 'immutable'; then
  echo "[smoke] JS asset is still served with immutable cache" >&2
  echo "$cache_headers" >&2
  exit 1
fi

echo "[smoke] Deployed UI text and cache headers confirmed"
