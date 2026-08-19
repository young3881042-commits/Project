# Orbit

메모·일정·운동·식단·가계부를 한 기기에서 관리하는 개인 생활 워크스페이스입니다.

| 구분 | 경로 | 역할 |
| --- | --- | --- |
| Web | `apps/web` | React/Vite 기반 브라우저·PWA |
| App | `apps/mobile/android` | Web 결과물을 포함하는 Android WebView 앱 |
| API | `apps/api` | 선택형 Spring Boot API |

Web과 Android App은 실행 방식이 다릅니다. UI를 수정·확인할 때는 Web 개발 서버를 사용하고, 실제 기기에서 확인할 때만 Android APK를 빌드합니다. 현재 제품에서는 음식 사진 AI 분석과 AI Bridge 연결 화면을 제공하지 않습니다.

## 시작 전 준비

- Git, Node.js 20 LTS, npm
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

- 설정·백업: `/more`

`apps/web/.env`의 `VITE_API_PROXY`는 개발 서버의 `/api`, `/ws` 요청을 전달할 API 주소입니다. 기본값은 `http://localhost:8080`입니다. `VITE_` 값은 브라우저 번들에 포함되므로 API 키·토큰·비밀번호를 넣지 않습니다.

## 2. Android App 빌드·설치하기

Android App은 Web 개발 서버를 읽지 않고 현재 `apps/web/dist`를 APK에 포함합니다. 따라서 평소 UI 작업은 Web에서 확인하고, 기기 확인이 필요할 때만 APK를 빌드합니다.

```bash
bash scripts/build_android_apk.sh

adb install -r apps/mobile/android/release/ai-assitant-debug.apk
```

## 3. Docker로 Web·API·DB 실행하기

Docker Compose는 Web, API, MariaDB, loopback 전용 Notebook을 함께 실행합니다.

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
infra/                     Docker·Kubernetes·Caddy·DB 구성
scripts/                   APK 빌드 및 운영 보조 스크립트
docs/                      유지보수·보안 문서
```

기본 진입 경로는 `/app`이며 홈·일정·메모·운동·식단·가계부 6개 탭을 제공합니다. `/`는 `/app`으로 이동합니다.

## 공개 저장소 보안 규칙

- `.env.example`만 커밋하고 실제 `.env`, API 키, Codex 인증 파일, 관리자 토큰, 개인 기록, 운영 주소는 커밋하지 않습니다.
- Android APK·서명 파일·배포용 압축 파일은 빌드 산출물입니다. GitHub Release 등 별도 배포 채널을 사용합니다.

## 검증

```bash
npm --prefix apps/web test
npm --prefix apps/web run build
docker compose -f docker-compose.dev.yml config
git diff --check
```

## 문서

- [Docker 실행 요약](run-guide.md)
- [Android 빌드·보안 안내](apps/mobile/android/README.md)
- [유지보수 기준](docs/LIFEHUB_MAINTENANCE_KO.md)
- [변경 기록](docs/PROJECT_CHANGELOG_KO.md)

## 라이선스

[ISC License](LICENSE)
