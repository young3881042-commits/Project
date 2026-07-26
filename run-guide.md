# Orbit Docker 실행 요약

전체 Web·API·MariaDB 환경을 Docker로 실행하는 방법입니다. Bridge는 Docker Compose에 포함되지 않으므로 AI 기능이 필요하면 [루트 README](README.md)의 Bridge 실행 절차를 별도 터미널에서 사용합니다.

## 준비

Docker Engine과 Docker Compose plugin이 필요합니다.

```bash
cp .env.example .env
# .env에서 DB_ROOT_PASSWORD와 DB_PASSWORD를 서로 다른 로컬 비밀번호로 설정합니다.
docker compose -f docker-compose.dev.yml up -d --build
```

`.env.example`의 기본 Web 포트는 HTTP 80, HTTPS 443입니다. 이미 사용 중이면 `.env`에서 다음처럼 바꿉니다.

```env
WEB_HTTP_PORT=8088
WEB_HTTPS_PORT=8443
```

Compose는 기본적으로 `127.0.0.1`에만 포트를 바인딩합니다. 다른 PC에서 접근시켜야 할 때만 `HOST_BIND_ADDRESS=0.0.0.0`을 명시하고, 방화벽·TLS·접근 제어를 함께 구성합니다.

## 접속과 상태 확인

기본 포트 기준:

```bash
docker compose -f docker-compose.dev.yml ps
curl -fsSI http://127.0.0.1/healthz
curl -fsSI http://127.0.0.1/app
curl -fsSI http://127.0.0.1:8080/api/overview
curl -fsSI http://127.0.0.1:30888/lab
```

Web 포트를 변경했다면 위 Web 주소의 포트도 함께 바꿉니다. 서비스별 기본 주소는 다음과 같습니다.

| 서비스 | 주소 | 용도 |
| --- | --- | --- |
| Web | `http://127.0.0.1/app` | Orbit 브라우저 화면 |
| API | `http://127.0.0.1:8080` | Spring Boot API |
| MariaDB | `127.0.0.1:3306` | 로컬 개발 DB |
| Notebook | `http://127.0.0.1:30888/lab` | loopback 전용 개발 도구 |

Notebook은 인증 없는 개발 도구이므로 외부에 직접 공개하지 않습니다.

## 중지와 데이터

```bash
# 컨테이너만 중지하고 DB·Notebook 데이터는 유지합니다.
docker compose -f docker-compose.dev.yml down

# 로컬 볼륨까지 삭제합니다. 데이터가 필요한 경우 실행하지 마세요.
docker compose -f docker-compose.dev.yml down -v
```

## Web 개발과 Android

UI 작업은 Docker 재빌드보다 Vite 개발 서버가 빠릅니다.

```bash
npm --prefix apps/web ci
npm --prefix apps/web run dev -- --host 127.0.0.1 --port 5173
```

Android APK는 현재 Web 빌드 결과를 포함하므로 기기 확인이 필요할 때만 빌드합니다. Bridge 주소는 APK 빌드 시 주입하며, 자세한 절차는 [루트 README](README.md#3-android-app-빌드설치하기)와 [Android 안내](apps/mobile/android/README.md)를 참고하세요.
