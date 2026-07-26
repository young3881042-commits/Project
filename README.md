# Orbit

메모·일정·운동·식단·가계부를 관리하고, 필요할 때 로컬 AI Bridge로 프로젝트 작업을 연결하는 개인 생활 워크스페이스입니다.

| 구분 | 경로 | 역할 |
| --- | --- | --- |
| Web | `apps/web` | React/Vite 기반 브라우저·PWA |
| App | `apps/mobile/android` | Web 결과물을 포함하는 Android WebView 앱 |
| Bridge | `tools/lifehub-bridge` | 로그인된 로컬 Codex와 Web/App을 연결하는 선택형 서버 |
| API | `apps/api` | 선택형 Spring Boot API |

Web과 Android App은 실행 방식이 다릅니다. UI를 수정·확인할 때는 Web 개발 서버를 사용하고, 실제 기기에서 확인할 때만 Android APK를 빌드합니다. Bridge는 Docker Compose에 포함되지 않으며 Codex가 로그인된 호스트에서 별도로 실행합니다.

## 시작 전 준비

- Git, Node.js 20 LTS, npm
- Bridge AI 기능 사용 시: Codex CLI가 `PATH`에 설치되어 있고 `codex login`이 완료된 상태
- Docker 통합 실행 시: Docker Engine과 Docker Compose plugin
- Android 빌드 시: Android SDK 35 또는 Docker

```bash
git clone <저장소-주소>
cd Project
```

## 1. Web만 실행하기

메모·일정 등 브라우저 로컬 기록 기능을 가장 빠르게 확인하는 방법입니다. API가 필요한 기능은 이 단계에서 동작하지 않을 수 있으며, [Docker 통합 실행](#4-docker로-webapidb-실행하기)을 사용하면 함께 확인할 수 있습니다.

```bash
npm --prefix apps/web ci
cp apps/web/.env.example apps/web/.env
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5173
```

브라우저에서 [http://127.0.0.1:5173/app](http://127.0.0.1:5173/app)을 엽니다.

- AI 연결: `/ai/settings`
- 앱 수정: `/ai/edit`
- 설정·백업: `/more`

`apps/web/.env`의 `VITE_API_PROXY`는 개발 서버의 `/api`, `/ws` 요청을 전달할 API 주소입니다. 기본값은 `http://localhost:8080`입니다. `VITE_` 값은 브라우저 번들에 포함되므로 API 키·토큰·비밀번호를 넣지 않습니다.

## 2. PC에서 Bridge와 Web 함께 실행하기

AI 대화, 음식 사진 분석, 앱 수정 기능을 사용하려면 같은 PC에서 Bridge를 먼저 실행합니다. 이 방식은 loopback 전용 연결이므로 Web도 반드시 같은 PC의 `localhost` 또는 `127.0.0.1`에서 열어야 합니다.

### 터미널 1: Bridge

```bash
npm --prefix tools/lifehub-bridge ci
cp tools/lifehub-bridge/.env.example tools/lifehub-bridge/.env
chmod 600 tools/lifehub-bridge/.env
codex login
npm --prefix tools/lifehub-bridge run cli -- project add "$PWD" Orbit

set -a
. tools/lifehub-bridge/.env
set +a
npm run bridge:dev
```

Bridge 기본 주소는 `http://127.0.0.1:4317`이고, 관리자 화면은 [http://127.0.0.1:4317/admin/](http://127.0.0.1:4317/admin/)입니다. 처음 실행하면 관리자 비밀번호가 `~/.lifehub-bridge/admin-token`에 생성됩니다. 이 파일과 `.env`는 커밋하지 않습니다.

개발 서버 대신 빌드 결과를 실행하려면 같은 셸에서 다음을 사용합니다.

```bash
set -a
. tools/lifehub-bridge/.env
set +a
npm run bridge:build
npm run bridge:start
```

### 터미널 2: Web

[Web만 실행하기](#1-web만-실행하기)의 명령으로 개발 서버를 띄운 뒤, `/ai/settings`에서 **로컬 Bridge 바로 사용**을 선택합니다. 같은 PC의 직접 loopback 연결만 코드·관리자 승인 없이 사용할 수 있습니다.

## 3. Android App 빌드·설치하기

Android App은 Web 개발 서버를 읽지 않고 현재 `apps/web/dist`를 APK에 포함합니다. 따라서 평소 UI 작업은 Web에서 확인하고, 기기 확인이 필요할 때만 APK를 빌드합니다.

AI 기능에 사용할 Bridge 주소는 앱 화면에서 입력하지 않고 **APK 빌드 시** `VITE_LIFEHUB_BRIDGE_ADDRESS`와 `VITE_LIFEHUB_BRIDGE_PORT`로 포함합니다. 실제 휴대폰에서 `127.0.0.1:4317`은 휴대폰 자신을 가리키므로 사용할 수 없습니다. HTTPS Bridge 또는 신뢰하는 VPN/LAN 주소를 사용하세요.

```bash
VITE_LIFEHUB_BRIDGE_ADDRESS=https://bridge.example.com \
VITE_LIFEHUB_BRIDGE_PORT=443 \
bash scripts/build_android_apk.sh

adb install -r apps/mobile/android/release/ai-assitant-debug.apk
```

앱의 `/ai/settings`에서는 6자리 연결 코드와 기기 이름만 입력합니다. Bridge는 별도 PC에서 실행하고, Android 연결에는 관리자 승인 절차를 사용합니다. 외부 네트워크에 Bridge 포트를 직접 공개하지 말고 VPN 또는 HTTPS reverse proxy를 사용하세요.

## 4. Docker로 Web·API·DB 실행하기

Docker Compose는 Web, API, MariaDB, loopback 전용 Notebook을 함께 실행합니다. Bridge는 위의 Node.js 방식으로 호스트에서 따로 실행합니다.

```bash
cp .env.example .env
# .env의 DB_ROOT_PASSWORD와 DB_PASSWORD에 서로 다른 로컬 비밀번호를 입력합니다.
docker compose -f docker-compose.dev.yml up -d --build
docker compose -f docker-compose.dev.yml ps
curl -fsSI http://127.0.0.1/healthz
```

기본 포트와 주소는 다음과 같습니다.

| 서비스 | 기본 주소 |
| --- | --- |
| Web | `http://127.0.0.1/app` |
| Web HTTPS | `https://127.0.0.1/app` (개발용 자체 서명 인증서) |
| API | `http://127.0.0.1:8080` |
| MariaDB | `127.0.0.1:3306` |
| Notebook | `http://127.0.0.1:30888` (loopback 전용) |

80/443 포트를 사용할 수 없으면 `.env`의 `WEB_HTTP_PORT=8088`, `WEB_HTTPS_PORT=8443`처럼 바꾼 뒤 해당 포트로 접속합니다. 다른 PC에서 Docker 서비스를 공개해야 할 때만 `HOST_BIND_ADDRESS=0.0.0.0`을 명시하고, 방화벽·TLS·접근 제어를 함께 구성합니다. 중지는 `docker compose -f docker-compose.dev.yml down`, DB 볼륨까지 삭제할 때는 `down -v`를 사용합니다.

## 프로젝트 구조

```text
apps/web/                  React + Vite Web/PWA
apps/api/                  Spring Boot API
apps/mobile/android/       Android WebView 래퍼
tools/lifehub-bridge/      로컬 Codex Bridge
infra/                     Docker·Kubernetes·Caddy·DB 구성
scripts/                   APK 빌드 및 운영 보조 스크립트
docs/                      유지보수·보안 문서
```

기본 진입 경로는 `/app`이며 홈·일정·메모·운동·식단·가계부 6개 탭을 제공합니다. `/`는 `/app`으로 이동합니다.

## 공개 저장소 보안 규칙

- `.env.example`만 커밋하고 실제 `.env`, API 키, Codex 인증 파일, 관리자 토큰, 개인 기록, 운영 주소는 커밋하지 않습니다.
- Bridge 기본 bind인 `127.0.0.1:4317`을 유지합니다. 원격 연결이 필요할 때만 VPN 또는 전용 HTTPS reverse proxy 뒤에 둡니다.
- Android APK·서명 파일·배포용 압축 파일은 빌드 산출물입니다. GitHub Release 등 별도 배포 채널을 사용합니다.
- 원격 명령·Git push·워크스페이스 실행은 기본 비활성화 상태를 유지합니다.

## 검증

```bash
npm --prefix apps/web test
npm --prefix apps/web run build
npm --prefix tools/lifehub-bridge test
npm --prefix tools/lifehub-bridge run build
docker compose -f docker-compose.dev.yml config
git diff --check
```

## 문서

- [Docker 실행 요약](run-guide.md)
- [LifeHub Bridge 상세 안내](tools/lifehub-bridge/README.md)
- [Android 빌드·보안 안내](apps/mobile/android/README.md)
- [유지보수 기준](docs/LIFEHUB_MAINTENANCE_KO.md)
- [변경 기록](docs/PROJECT_CHANGELOG_KO.md)

## 라이선스

[ISC License](LICENSE)
