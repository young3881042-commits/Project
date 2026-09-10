#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/apps/mobile/android"
WEB_DIR="${ROOT_DIR}/apps/web"
BUILD_DIR="${ANDROID_BUILD_DIR:-${APP_DIR}/build}"
RELEASE_DIR="${ANDROID_RELEASE_DIR:-${APP_DIR}/release}"
ANDROID_IMAGE="${ANDROID_BUILD_IMAGE:-ghcr.io/cirruslabs/android-sdk@sha256:c724009e305b4607157287624033ab97f319af44c244bfc9f73b6293f3bb01b9}"
TARGET_API="${ANDROID_TARGET_API:-35}"
MIN_API="${ANDROID_MIN_API:-23}"
PACKAGE_NAME="com.platform.aiassitant"

log() {
  printf '[android-build] %s\n' "$*"
}

build_web() {
  if [[ "${SKIP_WEB_BUILD:-0}" == "1" ]]; then
    if [[ ! -f "${WEB_DIR}/dist/index.html" ]]; then
      echo "SKIP_WEB_BUILD=1 was set, but apps/web/dist/index.html does not exist." >&2
      exit 2
    fi
    log "Using the existing web dist directory."
    return
  fi

  if ! command -v npm >/dev/null 2>&1; then
    echo "npm is required to build apps/web. Build the web app first, then rerun with SKIP_WEB_BUILD=1." >&2
    exit 2
  fi
  if [[ ! -x "${WEB_DIR}/node_modules/.bin/vite" ]]; then
    log "Installing locked web dependencies with npm ci."
    npm --prefix "${WEB_DIR}" ci
  fi
  log "Building the current web source."
  npm --prefix "${WEB_DIR}" run build
}

find_sdk_home() {
  local candidate
  for candidate in \
    "${ANDROID_HOME:-}" \
    "${ANDROID_SDK_ROOT:-}" \
    /opt/android-sdk-linux \
    /opt/android-sdk \
    "${HOME}/Android/Sdk"; do
    if [[ -n "${candidate}" && -d "${candidate}/platforms/android-${TARGET_API}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
  return 1
}

find_android_lint() {
  local sdk_home="$1"
  local candidate
  for candidate in \
    "${ANDROID_LINT_BIN:-}" \
    "${sdk_home}/cmdline-tools/latest/bin/lint" \
    "${sdk_home}/tools/bin/lint"; do
    if [[ -n "${candidate}" && -x "${candidate}" ]]; then
      printf '%s\n' "${candidate}"
      return 0
    fi
  done
  return 1
}

run_android_lint() {
  local sdk_home="$1"
  if [[ "${SKIP_ANDROID_LINT:-0}" == "1" ]]; then
    log "Skipping Android Lint because SKIP_ANDROID_LINT=1 was set."
    return
  fi

  local lint_bin
  lint_bin="$(find_android_lint "${sdk_home}" || true)"
  if [[ -z "${lint_bin}" ]]; then
    echo "Android Lint was not found under ${sdk_home}. Set ANDROID_LINT_BIN or explicitly use SKIP_ANDROID_LINT=1." >&2
    exit 2
  fi

  log "Running Android Lint."
  "${lint_bin}" \
    --exitcode \
    --offline \
    --compile-sdk-version "${TARGET_API}" \
    --sdk-home "${sdk_home}" \
    --java-language-level 8 \
    --classpath "${BUILD_DIR}/classes" \
    "${APP_DIR}"
}

run_android_security_tests() {
  local platform_dir="$1"
  local test_dir="${APP_DIR}/tests"
  if [[ ! -d "${test_dir}" ]]; then
    return
  fi

  local test_classes_dir="${BUILD_DIR}/test-classes"
  local test_source_list="${BUILD_DIR}/test-sources.txt"
  mkdir -p "${test_classes_dir}"
  find "${test_dir}" -type f -name '*.java' -print | sort > "${test_source_list}"
  mapfile -t test_sources < "${test_source_list}"
  if [[ "${#test_sources[@]}" -eq 0 ]]; then
    return
  fi

  log "Running Android native security smoke tests."
  javac \
    -encoding UTF-8 \
    -source 8 \
    -target 8 \
    -bootclasspath "${platform_dir}/android.jar" \
    -classpath "${BUILD_DIR}/classes" \
    -d "${test_classes_dir}" \
    "${test_sources[@]}"
  java \
    -classpath "${test_classes_dir}:${BUILD_DIR}/classes:${platform_dir}/android.jar" \
    com.platform.aiassitant.AppNotificationCoordinatorStaticTest
  java \
    -classpath "${test_classes_dir}:${BUILD_DIR}/classes:${platform_dir}/android.jar" \
    com.platform.aiassitant.LifeHubBackupDocumentPolicyStaticTest
  java \
    -classpath "${test_classes_dir}:${BUILD_DIR}/classes:${platform_dir}/android.jar" \
    com.platform.aiassitant.FinanceNotificationParserStaticTest
  java \
    -classpath "${test_classes_dir}:${BUILD_DIR}/classes:${platform_dir}/android.jar" \
    com.platform.aiassitant.FinanceNotificationPolicyStaticTest
  java \
    -classpath "${test_classes_dir}:${BUILD_DIR}/classes:${platform_dir}/android.jar" \
    com.platform.aiassitant.FinanceSharePolicyStaticTest
  java \
    -classpath "${test_classes_dir}:${BUILD_DIR}/classes:${platform_dir}/android.jar" \
    com.platform.aiassitant.TravelApiPolicyStaticTest
}

scan_apk_credentials() {
  log "Scanning APK for embedded credential files and values."
  python3 "${ROOT_DIR}/scripts/scan_android_credentials.py" "$1"
}

verify_apk_finance_notification_capability() {
  local aapt2_bin="$1"
  local apk_path="$2"
  local manifest_dump listener_block listener_count dex_listener_count approved_package
  log "Checking the approved finance notification-listener capability."
  manifest_dump="$("${aapt2_bin}" dump xmltree "${apk_path}" --file AndroidManifest.xml)"
  listener_block="$(printf '%s\n' "${manifest_dump}" | awk '
    /^          E: service/ { capture = 1; block = $0 ORS; next }
    capture && /^          E: (activity|service|receiver|provider)/ { capture = 0 }
    capture { block = block $0 ORS }
    END { printf "%s", block }
  ')"
  listener_count="$(printf '%s\n' "${manifest_dump}" \
    | LC_ALL=C grep -c 'E: service' || true)"
  if [[ "${listener_count}" != "1" ]] \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F '=".FinanceNotificationListenerService"' >/dev/null \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F ':exported(0x01010010)=false' >/dev/null \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F '="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"' >/dev/null \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F '="android.service.notification.NotificationListenerService"' >/dev/null; then
    echo "APK manifest does not contain exactly one protected, non-exported finance notification listener." >&2
    exit 2
  fi
  dex_listener_count="$(unzip -p "${apk_path}" classes.dex \
    | strings -a -n 8 \
    | LC_ALL=C grep -c 'FinanceNotificationListenerService' || true)"
  if [[ "${dex_listener_count}" -lt 1 ]]; then
    echo "APK DEX is missing the approved finance notification listener implementation." >&2
    exit 2
  fi
  for approved_package in \
      'com.samsung.android.spay' \
      'com.kakaopay.app' \
      'viva.republica.toss'; do
    if ! unzip -p "${apk_path}" classes.dex \
        | strings -a -n 8 \
        | LC_ALL=C grep -c "${approved_package}" >/dev/null; then
      echo "APK DEX is missing an approved finance notification source." >&2
      exit 2
    fi
  done
  if unzip -p "${apk_path}" \
      | strings -a -n 8 \
      | LC_ALL=C grep -E \
          'BridgeHttpProxy|SecureTokenStore|lifehub:native-bridge-(response|stream)|/api/food/analyze|음식 사진 분석|AI 연결 설정' \
          >/dev/null; then
    echo "APK still contains a removed AI Bridge or food-photo capability." >&2
    exit 2
  fi
}

verify_apk_finance_share_capability() {
  local aapt2_bin="$1"
  local apk_path="$2"
  local manifest_dump provider_block provider_count dex_provider_count
  log "Checking the grant-only finance file share capability."
  manifest_dump="$("${aapt2_bin}" dump xmltree "${apk_path}" --file AndroidManifest.xml)"
  provider_block="$(printf '%s\n' "${manifest_dump}" | awk '
    /^          E: provider/ { capture = 1; block = $0 ORS; next }
    capture && /^          E: (activity|service|receiver|provider)/ { capture = 0 }
    capture { block = block $0 ORS }
    END { printf "%s", block }
  ')"
  provider_count="$(printf '%s\n' "${manifest_dump}" \
    | LC_ALL=C grep -c 'E: provider' || true)"
  if [[ "${provider_count}" != "1" ]] \
      || ! printf '%s\n' "${provider_block}" \
          | LC_ALL=C grep -F '=".FinanceShareFileProvider"' >/dev/null \
      || ! printf '%s\n' "${provider_block}" \
          | LC_ALL=C grep -F '="com.platform.aiassitant.finance-share"' >/dev/null \
      || ! printf '%s\n' "${provider_block}" \
          | LC_ALL=C grep -F ':exported(0x01010010)=false' >/dev/null \
      || ! printf '%s\n' "${provider_block}" \
          | LC_ALL=C grep -F ':grantUriPermissions(0x0101001b)=true' >/dev/null; then
    echo "APK manifest does not contain exactly one non-exported, grant-only finance share provider." >&2
    exit 2
  fi
  if printf '%s\n' "${manifest_dump}" \
      | LC_ALL=C grep -F 'android.permission.BLUETOOTH' >/dev/null; then
    echo "APK finance sharing must not request a broad Bluetooth permission." >&2
    exit 2
  fi
  dex_provider_count="$(unzip -p "${apk_path}" classes.dex \
    | strings -a -n 8 \
    | LC_ALL=C grep -c 'FinanceShareFileProvider' || true)"
  if [[ "${dex_provider_count}" -lt 1 ]]; then
    echo "APK DEX is missing the finance share provider implementation." >&2
    exit 2
  fi
}

audit_android_source_security() {
  local java_dir="${APP_DIR}/src"
  local forbidden='public[[:space:]]+(String|boolean)[[:space:]]+(getSecureValue|setSecureValue|setBridgeToken|getBridgeCapabilities|bridgeRequest|bridgeStream|bridgeCancel)[[:space:]]*\(|BridgeHttpProxy|SecureTokenStore|ImageFileChooserPolicy|setWebContentsDebuggingEnabled[[:space:]]*\([[:space:]]*true[[:space:]]*\)|\.proceed[[:space:]]*\([[:space:]]*\)|setHostnameVerifier|setSSLSocketFactory'
  local listener_source="${java_dir}/com/platform/aiassitant/FinanceNotificationListenerService.java"
  local finance_queue_source="${java_dir}/com/platform/aiassitant/FinanceTransactionQueue.java"
  local listener_block listener_source_count listener_permission_count listener_action_count
  local forbidden_finance_logging='android\.util\.Log|System\.(out|err)|printStackTrace'
  local forbidden_finance_storage_fields='"(raw|rawText|title|text|bigText|cardNumber|account|accountNumber|balance)"'
  local forbidden_storage='READ_EXTERNAL_STORAGE|WRITE_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|MANAGE_DOCUMENTS|READ_MEDIA_(IMAGES|VIDEO|AUDIO)'
  local backup_source="${java_dir}/com/platform/aiassitant/LifeHubBackupDocumentCoordinator.java"
  local forbidden_backup_logging='android\.util\.Log|System\.(out|err)|printStackTrace'
  local finance_share_sources="${java_dir}/com/platform/aiassitant/FinanceShare*.java"
  local finance_share_provider_block
  log "Checking Android source security invariants."
  if LC_ALL=C grep -R -E "${forbidden}" "${java_dir}" >/dev/null; then
    echo "Android source security audit found a token-export, TLS-bypass, or debug-enabling API." >&2
    exit 2
  fi
  listener_source_count="$(LC_ALL=C grep -R -E -c \
    'extends[[:space:]]+NotificationListenerService' "${java_dir}" \
    | awk -F: '{ total += $2 } END { print total + 0 }' || true)"
  listener_permission_count="$(LC_ALL=C grep -c \
    'android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"' \
    "${APP_DIR}/AndroidManifest.xml" || true)"
  listener_action_count="$(LC_ALL=C grep -c \
    'android:name="android.service.notification.NotificationListenerService"' \
    "${APP_DIR}/AndroidManifest.xml" || true)"
  listener_block="$(awk '
    /<service/ { capture = 1; block = $0 ORS; next }
    capture { block = block $0 ORS }
    capture && /<\/service>/ {
      if (block ~ /FinanceNotificationListenerService/) printf "%s", block
      capture = 0
      block = ""
    }
  ' "${APP_DIR}/AndroidManifest.xml")"
  if [[ ! -f "${listener_source}" ]] \
      || [[ "${listener_source_count}" != "1" ]] \
      || [[ "${listener_permission_count}" != "1" ]] \
      || [[ "${listener_action_count}" != "1" ]] \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F 'android:name=".FinanceNotificationListenerService"' >/dev/null \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F 'android:exported="false"' >/dev/null \
      || ! printf '%s\n' "${listener_block}" \
          | LC_ALL=C grep -F 'android:permission="android.permission.BIND_NOTIFICATION_LISTENER_SERVICE"' >/dev/null; then
    echo "Android source audit requires exactly one protected, non-exported finance notification listener." >&2
    exit 2
  fi
  for approved_package in \
      'com.samsung.android.spay' \
      'com.kakaopay.app' \
      'viva.republica.toss'; do
    if ! LC_ALL=C grep -F "${approved_package}" \
        "${java_dir}/com/platform/aiassitant/FinanceNotificationParser.java" >/dev/null; then
      echo "Android source audit requires every approved finance package in the exact allowlist." >&2
      exit 2
    fi
  done
  if ! LC_ALL=C grep -F 'sourceForPackage' \
      "${java_dir}/com/platform/aiassitant/FinanceNotificationParser.java" >/dev/null; then
    echo "Android source audit requires package-to-source resolution before notification parsing." >&2
    exit 2
  fi
  if LC_ALL=C grep -E "${forbidden_finance_logging}" \
      "${java_dir}/com/platform/aiassitant/FinanceNotification"*.java \
      "${finance_queue_source}" >/dev/null; then
    echo "Android source audit found logging in the finance notification path." >&2
    exit 2
  fi
  if LC_ALL=C grep -E "${forbidden_finance_storage_fields}" \
      "${finance_queue_source}" >/dev/null \
      || ! LC_ALL=C grep -F 'Context.MODE_PRIVATE' "${finance_queue_source}" >/dev/null \
      || ! LC_ALL=C grep -F 'orbit-finance-notification-v2' "${finance_queue_source}" >/dev/null \
      || ! LC_ALL=C grep -F 'return publicItems(candidates).toString();' \
          "${finance_queue_source}" >/dev/null; then
    echo "Android source audit found an unsafe finance notification queue contract." >&2
    exit 2
  fi
  if LC_ALL=C grep -E "${forbidden_storage}" "${APP_DIR}/AndroidManifest.xml" >/dev/null; then
    echo "Android source security audit found a broad storage or media permission." >&2
    exit 2
  fi
  if LC_ALL=C grep -E \
      'ACCESS_NETWORK_STATE|android:usesCleartextTraffic="true"' \
      "${APP_DIR}/AndroidManifest.xml" >/dev/null \
      || ! LC_ALL=C grep -F 'android:usesCleartextTraffic="false"' \
          "${APP_DIR}/AndroidManifest.xml" >/dev/null; then
    echo "Android source security audit requires cleartext disabled by default." >&2
    exit 2
  fi
  local travel_network_expected='<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <base-config cleartextTrafficPermitted="false" />
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">127.0.0.1</domain>
    </domain-config>
</network-security-config>'
  if ! LC_ALL=C grep -F 'android:networkSecurityConfig="@xml/travel_network_security"' "${APP_DIR}/AndroidManifest.xml" >/dev/null \
      || [[ ! -f "${APP_DIR}/res/xml/travel_network_security.xml" ]] \
      || [[ "$(< "${APP_DIR}/res/xml/travel_network_security.xml")" != "${travel_network_expected}" ]]; then
    echo "Android travel networking must allow only the explicit loopback exception." >&2
    exit 2
  fi
  if [[ -f "${backup_source}" ]] \
      && LC_ALL=C grep -E "${forbidden_backup_logging}" "${backup_source}" >/dev/null; then
    echo "Android source security audit found logging in the JSON backup document path." >&2
    exit 2
  fi
  if compgen -G "${finance_share_sources}" >/dev/null \
      && LC_ALL=C grep -E "${forbidden_finance_logging}" ${finance_share_sources} >/dev/null; then
    echo "Android source security audit found logging in the finance share path." >&2
    exit 2
  fi
  finance_share_provider_block="$(awk '
    /<provider/ { capture = 1; block = $0 ORS; next }
    capture { block = block $0 ORS }
    capture && /\/>/ {
      if (block ~ /FinanceShareFileProvider/) printf "%s", block
      capture = 0
      block = ""
    }
  ' "${APP_DIR}/AndroidManifest.xml")"
  if ! printf '%s\n' "${finance_share_provider_block}" \
          | LC_ALL=C grep -F 'android:authorities="com.platform.aiassitant.finance-share"' >/dev/null \
      || ! printf '%s\n' "${finance_share_provider_block}" \
          | LC_ALL=C grep -F 'android:exported="false"' >/dev/null \
      || ! printf '%s\n' "${finance_share_provider_block}" \
          | LC_ALL=C grep -F 'android:grantUriPermissions="true"' >/dev/null; then
    echo "Android source audit requires a non-exported, grant-only finance share provider." >&2
    exit 2
  fi
}

run_in_android_container() {
  if ! command -v docker >/dev/null 2>&1; then
    echo "Android SDK ${TARGET_API} was not found and Docker is unavailable." >&2
    exit 2
  fi

  local uid gid
  uid="$(id -u)"
  gid="$(id -g)"
  log "Running the raw Android SDK stage in ${ANDROID_IMAGE}."
  docker run --rm \
    --user "${uid}:${gid}" \
    --env HOME=/tmp/android-home \
    --env ANDROID_CONTAINER_BUILD=1 \
    --env SKIP_WEB_BUILD=1 \
    --env ANDROID_TARGET_API="${TARGET_API}" \
    --env ANDROID_MIN_API="${MIN_API}" \
    --volume "${ROOT_DIR}:/workspace" \
    --workdir /workspace \
    "${ANDROID_IMAGE}" \
    bash scripts/build_android_apk.sh
}

build_raw_apk() {
  local sdk_home platform_dir resource_jar build_tools_dir
  local -a resource_sdk_args=()
  sdk_home="$(find_sdk_home)"
  platform_dir="${sdk_home}/platforms/android-${TARGET_API}"
  resource_jar="${ANDROID_RESOURCE_JAR:-${platform_dir}/android.jar}"
  if [[ ! -f "${resource_jar}" ]]; then
    echo "Android resource include JAR was not found: ${resource_jar}" >&2
    exit 2
  fi
  if [[ -n "${ANDROID_COMPILE_SDK_VERSION_NAME:-}" ]]; then
    resource_sdk_args=(
      --compile-sdk-version-code "${TARGET_API}"
      --compile-sdk-version-name "${ANDROID_COMPILE_SDK_VERSION_NAME}"
    )
  fi
  build_tools_dir="${ANDROID_BUILD_TOOLS_DIR:-}"
  if [[ -z "${build_tools_dir}" ]]; then
    build_tools_dir="$(find "${sdk_home}/build-tools" -mindepth 1 -maxdepth 1 -type d -printf '%p\n' | sort -V | tail -n 1)"
  fi
  if [[ -z "${build_tools_dir}" || ! -x "${build_tools_dir}/aapt2" ]]; then
    echo "Android build-tools were not found under ${sdk_home}." >&2
    exit 2
  fi

  local keytool_bin
  keytool_bin="$(command -v keytool || true)"
  local d8_bin="${ANDROID_D8_BIN:-${build_tools_dir}/d8}"
  for tool in aapt2 d8 zipalign apksigner; do
    local tool_path="${build_tools_dir}/${tool}"
    if [[ "${tool}" == "d8" ]]; then
      tool_path="${d8_bin}"
    fi
    if [[ ! -x "${tool_path}" ]]; then
      echo "Missing Android build tool: ${tool_path}" >&2
      exit 2
    fi
  done
  for tool in java javac sha256sum strings unzip zip; do
    if ! command -v "${tool}" >/dev/null 2>&1; then
      echo "Missing build command: ${tool}" >&2
      exit 2
    fi
  done
  if [[ -z "${keytool_bin}" ]]; then
    echo "Missing build command: keytool" >&2
    exit 2
  fi

  audit_android_source_security

  if [[ -d "${BUILD_DIR}" ]]; then
    find "${BUILD_DIR}" -mindepth 1 -delete
  fi
  mkdir -p \
    "${BUILD_DIR}/compiled" \
    "${BUILD_DIR}/classes" \
    "${BUILD_DIR}/dex" \
    "${BUILD_DIR}/assets/www" \
    "${BUILD_DIR}/generated" \
    "${RELEASE_DIR}"

  log "Embedding apps/web/dist into the APK."
  cp -R "${WEB_DIR}/dist/." "${BUILD_DIR}/assets/www/"
  if [[ -n "${ORBIT_NATIVE_RUNTIME_DIR:-}" ]]; then
    cp -R "${ORBIT_NATIVE_RUNTIME_DIR}/assets/." "${BUILD_DIR}/assets/"
  fi
  node "${ROOT_DIR}/scripts/build_travel_runtime.mjs" "${BUILD_DIR}/assets/orbit-travel-runtime.mjs"

  local embedded_web_build_id embedded_web_build_source
  embedded_web_build_id="$({
    sha256sum "${WEB_DIR}/dist/index.html"
    sha256sum "${WEB_DIR}/dist/sw.js"
  } | sha256sum | cut -d' ' -f1)"
  embedded_web_build_source="${BUILD_DIR}/generated/com/platform/aiassitant/EmbeddedWebBuild.java"
  mkdir -p "$(dirname "${embedded_web_build_source}")"
  printf '%s\n' \
    'package com.platform.aiassitant;' \
    '' \
    'final class EmbeddedWebBuild {' \
    "    static final String ID = \"${embedded_web_build_id}\";" \
    '' \
    '    private EmbeddedWebBuild() {}' \
    '}' \
    > "${embedded_web_build_source}"
  log "Embedded web build: ${embedded_web_build_id:0:12}."

  log "Compiling Android resources."
  "${build_tools_dir}/aapt2" compile \
    --dir "${APP_DIR}/res" \
    -o "${BUILD_DIR}/compiled/resources.zip"
  "${build_tools_dir}/aapt2" link \
    -o "${BUILD_DIR}/ai-assitant-unsigned.apk" \
    -I "${resource_jar}" \
    --manifest "${APP_DIR}/AndroidManifest.xml" \
    -R "${BUILD_DIR}/compiled/resources.zip" \
    "${resource_sdk_args[@]}" \
    --java "${BUILD_DIR}/generated" \
    --auto-add-overlay \
    -A "${BUILD_DIR}/assets"

  local java_source_list="${BUILD_DIR}/java-sources.txt"
  find \
    "${APP_DIR}/src" \
    "${BUILD_DIR}/generated" \
    -type f -name '*.java' -print | sort > "${java_source_list}"
  mapfile -t java_sources < "${java_source_list}"
  if [[ "${#java_sources[@]}" -eq 0 ]]; then
    echo "No Android Java sources were found." >&2
    exit 2
  fi

  log "Compiling ${PACKAGE_NAME}."
  javac \
    -encoding UTF-8 \
    -source 8 \
    -target 8 \
    -bootclasspath "${platform_dir}/android.jar" \
    -d "${BUILD_DIR}/classes" \
    "${java_sources[@]}"

  run_android_lint "${sdk_home}"
  run_android_security_tests "${platform_dir}"

  local class_file_list="${BUILD_DIR}/class-files.txt"
  find "${BUILD_DIR}/classes" -type f -name '*.class' -print | sort > "${class_file_list}"
  mapfile -t class_files < "${class_file_list}"
  "${d8_bin}" \
    --min-api "${MIN_API}" \
    --lib "${platform_dir}/android.jar" \
    --output "${BUILD_DIR}/dex" \
    "${class_files[@]}"

  cp "${BUILD_DIR}/ai-assitant-unsigned.apk" "${BUILD_DIR}/ai-assitant-with-dex.apk"
  (
    cd "${BUILD_DIR}/dex"
    zip -q "${BUILD_DIR}/ai-assitant-with-dex.apk" classes.dex
  )

  if [[ -n "${ORBIT_NATIVE_RUNTIME_DIR:-}" ]]; then
    if [[ ! -f "${ORBIT_NATIVE_RUNTIME_DIR}/lib/arm64-v8a/liborbit_codex.so" ]]; then
      echo "Missing staged Android Codex engine." >&2; exit 2
    fi
    (cd "${ORBIT_NATIVE_RUNTIME_DIR}" && zip -qr "${BUILD_DIR}/ai-assitant-with-dex.apk" lib)
  fi

  local keystore keystore_password key_alias key_password
  keystore="${ANDROID_KEYSTORE:-${APP_DIR}/.debug/ai-assitant-debug.keystore}"
  keystore_password="${ANDROID_KEYSTORE_PASSWORD:-android}"
  key_alias="${ANDROID_KEY_ALIAS:-ai-assitant-debug}"
  key_password="${ANDROID_KEY_PASSWORD:-android}"
  if [[ ! -f "${keystore}" ]]; then
    mkdir -p "$(dirname "${keystore}")"
    log "Creating a reusable local debug keystore."
    "${keytool_bin}" -genkeypair \
      -keystore "${keystore}" \
      -storepass "${keystore_password}" \
      -keypass "${key_password}" \
      -alias "${key_alias}" \
      -keyalg RSA \
      -keysize 2048 \
      -validity 10000 \
      -dname "CN=ai-assitant Debug,O=Local Development,C=KR" \
      >/dev/null
  fi

  "${build_tools_dir}/zipalign" -f -p 4 \
    "${BUILD_DIR}/ai-assitant-with-dex.apk" \
    "${BUILD_DIR}/ai-assitant-aligned.apk"
  "${build_tools_dir}/apksigner" sign \
    --ks "${keystore}" \
    --ks-key-alias "${key_alias}" \
    --ks-pass "pass:${keystore_password}" \
    --key-pass "pass:${key_password}" \
    --out "${BUILD_DIR}/ai-assitant-debug.apk" \
    "${BUILD_DIR}/ai-assitant-aligned.apk"
  "${build_tools_dir}/apksigner" verify --verbose "${BUILD_DIR}/ai-assitant-debug.apk"
  verify_apk_finance_notification_capability \
    "${build_tools_dir}/aapt2" \
    "${BUILD_DIR}/ai-assitant-debug.apk"
  verify_apk_finance_share_capability \
    "${build_tools_dir}/aapt2" \
    "${BUILD_DIR}/ai-assitant-debug.apk"
  scan_apk_credentials "${BUILD_DIR}/ai-assitant-debug.apk"

  local release_apk current_cert next_cert
  release_apk="${RELEASE_DIR}/ai-assitant-debug.apk"
  if [[ -f "${release_apk}" ]]; then
    current_cert="$("${build_tools_dir}/apksigner" verify --print-certs "${release_apk}" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1)"
    next_cert="$("${build_tools_dir}/apksigner" verify --print-certs "${BUILD_DIR}/ai-assitant-debug.apk" | sed -n 's/^Signer #1 certificate SHA-256 digest: //p' | head -n 1)"
    if [[ -z "${current_cert}" || -z "${next_cert}" ]]; then
      echo "Could not read the Android signing certificate digest." >&2
      exit 2
    fi
    if [[ "${current_cert}" != "${next_cert}" && "${ALLOW_ANDROID_SIGNING_KEY_ROTATION:-0}" != "1" ]]; then
      echo "Refusing to replace the release APK with a differently signed build." >&2
      echo "Use the original ANDROID_KEYSTORE; changing keys prevents Android updates." >&2
      echo "Set ALLOW_ANDROID_SIGNING_KEY_ROTATION=1 only for an intentional rotation." >&2
      exit 2
    fi
  fi

  cp "${BUILD_DIR}/ai-assitant-debug.apk" "${RELEASE_DIR}/ai-assitant-debug.apk"
  log "APK ready: ${RELEASE_DIR}/ai-assitant-debug.apk"
  if command -v sha256sum >/dev/null 2>&1; then
    (
      cd "${RELEASE_DIR}"
      sha256sum ai-assitant-debug.apk | tee ai-assitant-debug.apk.sha256
    )
  fi
}

build_web

if ! find_sdk_home >/dev/null 2>&1; then
  if [[ "${ANDROID_CONTAINER_BUILD:-0}" == "1" ]]; then
    echo "Android SDK ${TARGET_API} is unavailable inside ${ANDROID_IMAGE}." >&2
    exit 2
  fi
  run_in_android_container
  exit $?
fi

build_raw_apk
