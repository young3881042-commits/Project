#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_DIR="${ROOT_DIR}/apps/mobile/android"
BUILD_DIR="${APP_DIR}/build"
SDK_HOME="${ANDROID_HOME:-/opt/android-sdk}"
PLATFORM="${SDK_HOME}/platforms/android-35"
BUILD_TOOLS="${SDK_HOME}/build-tools/35.0.0"
PACKAGE_NAME="com.platform.aiassitant"
KEYSTORE="${BUILD_DIR}/ai-assitant-debug.keystore"

rm -rf "${BUILD_DIR}"
mkdir -p "${BUILD_DIR}/compiled" "${BUILD_DIR}/classes" "${BUILD_DIR}/dex"

"${BUILD_TOOLS}/aapt2" compile --dir "${APP_DIR}/res" -o "${BUILD_DIR}/compiled/resources.zip"
"${BUILD_TOOLS}/aapt2" link \
  -o "${BUILD_DIR}/ai-assitant-unsigned.apk" \
  -I "${PLATFORM}/android.jar" \
  --manifest "${APP_DIR}/AndroidManifest.xml" \
  -R "${BUILD_DIR}/compiled/resources.zip" \
  --java "${BUILD_DIR}/generated" \
  --auto-add-overlay

javac \
  -source 8 \
  -target 8 \
  -bootclasspath "${PLATFORM}/android.jar" \
  -d "${BUILD_DIR}/classes" \
  $(find "${APP_DIR}/src" "${BUILD_DIR}/generated" -name '*.java' | sort)

"${BUILD_TOOLS}/d8" \
  --min-api 23 \
  --lib "${PLATFORM}/android.jar" \
  --output "${BUILD_DIR}/dex" \
  $(find "${BUILD_DIR}/classes" -name '*.class' | sort)

cp "${BUILD_DIR}/ai-assitant-unsigned.apk" "${BUILD_DIR}/ai-assitant-with-dex.apk"
(cd "${BUILD_DIR}/dex" && zip -q "${BUILD_DIR}/ai-assitant-with-dex.apk" classes.dex)

keytool -genkeypair \
  -keystore "${KEYSTORE}" \
  -storepass android \
  -keypass android \
  -alias ai-assitant-debug \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000 \
  -dname "CN=ai-assitant,O=Local,C=KR" >/dev/null

"${BUILD_TOOLS}/zipalign" -f -p 4 \
  "${BUILD_DIR}/ai-assitant-with-dex.apk" \
  "${BUILD_DIR}/ai-assitant-aligned.apk"

"${BUILD_TOOLS}/apksigner" sign \
  --ks "${KEYSTORE}" \
  --ks-key-alias ai-assitant-debug \
  --ks-pass pass:android \
  --key-pass pass:android \
  --out "${BUILD_DIR}/ai-assitant-debug.apk" \
  "${BUILD_DIR}/ai-assitant-aligned.apk"

"${BUILD_TOOLS}/apksigner" verify "${BUILD_DIR}/ai-assitant-debug.apk"
echo "${BUILD_DIR}/ai-assitant-debug.apk"
