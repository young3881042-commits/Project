# Orbit

메모·일정·가계부를 한 기기에서 관리하는 개인 생활 워크스페이스입니다.

| 구분 | 경로 | 역할 |
| --- | --- | --- |
| Web | `apps/web` | React/Vite 기반 브라우저·PWA |
| App | `apps/mobile/android` | Web 결과물을 포함하는 Android WebView 앱 |
| API | `apps/api` | 선택형 Spring Boot API |

Web과 Android App은 실행 방식이 다릅니다. UI를 수정·확인할 때는 Web 개발 서버를 사용하고, 실제 기기에서 확인할 때만 Android APK를 빌드합니다. 현재 제품에서는 운동·식단 기록, 음식 사진 AI 분석과 AI Bridge 연결 화면을 제공하지 않습니다.

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

- 메모: `/memo`
- 정기 결제: `/finance`
- 설정·백업: `/more`

메모는 데스크톱에서 좌측 폴더 사이드바, 모바일에서 폴더 서랍으로 관리합니다. 작성 화면은 일반 텍스트 입력 하나만 제공하고 폴더·제목·태그는 필요할 때 펼칩니다. `Ctrl/Command+Enter`로 저장할 수 있으며, 이전 rich 메모는 원본을 바꾸지 않고 텍스트 사본으로 편집할 수 있습니다.

일정은 완료하지 않은 지난 날짜와 오늘 시간이 지난 항목을 `미완료`로 분류하며, 일정 화면·홈 달력·아침 브리핑에 같은 기준을 사용합니다. `예정` 목록은 날짜와 시간을 함께 표시합니다.

가계부에서는 월세·통신비·구독 같은 정기 결제를 이름, 금액, 결제일 또는 말일로 등록합니다. 이번 달 예정액과 실제 가계부 기록을 분리해 보여주며, 자동 반영은 같은 규칙·월에 한 번만 생성됩니다. 카드 알림 자동 가져오기를 함께 켜면 중복 가능성을 안내합니다.

`가계부 파일 보내기`에서는 이번 달·전체·직접 고른 기간을 한 번의 사본으로 내보냅니다. Android는 시스템 공유 창을 열므로 Bluetooth, Quick Share, 메신저 등 기기에 표시되는 대상을 고를 수 있습니다. Orbit 간 이동에는 중복 미리보기와 새 거래만 추가하는 JSON을, 사람이 확인할 때는 CSV를 사용합니다. 메모는 기본으로 제외되며 이 기능은 실시간 동기화가 아닙니다.

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

기본 진입 경로는 `/app`이며 홈·일정·메모·가계부 4개 탭을 같은 너비로 제공합니다. `/`, `/workout`, `/diet`는 `/app`으로 이동합니다.

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
