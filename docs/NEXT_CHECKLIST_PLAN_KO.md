# ai-assitant 작업 체크리스트

> 현행 Orbit/LifeHub 화면과 개발 흐름은 `LIFEHUB_MAINTENANCE_KO.md`와 `WEB_UI_UX_AUDIT_KO.md`를 우선한다. 아래 공개 포트폴리오 정리 이력은 현재의 6탭 UI, 빠른 기록 제거, 로컬 Bridge 원클릭 연결을 되돌리는 근거로 사용하지 않는다.

## 운영 기준

- 기본 앱 화면은 `/app`이다.
- 루트 `/`은 별도 메인 화면을 렌더링하지 않고 `/app`으로 넘긴다.
- 앱 이름과 설치 대상 표기는 `ai-assitant`로 유지한다.
- 공개 저장소에는 최소 Android 래퍼 소스만 포함하고, debug APK·checksum·롤백 번들은 GitHub Release 또는 별도 전달 채널로 관리한다.
- Android build 디렉터리, keystore, 서명 암호는 Git에서 제외한다.
- 내부 IP, 사설 저장소 주소, 계정값은 소스 기본값에 넣지 않는다.
- 사설 Maven 저장소가 필요하면 로컬 환경 변수 또는 `.env.example` placeholder로만 안내한다.
- 실행/배포 문서는 Docker 기준으로 유지한다.
- Workspace 실행 기능은 로컬 개발/관리자 전용이며 운영 배포에서는 기본 비활성화를 권장한다.

## 현재 공개용 정리 작업

아래 항목은 공개 포트폴리오 정리 이력이다. 현재 공개 배포 정책은 위 운영 기준과
`AGENTS.md`를 따른다.

- [x] 앱 이름 오타 표기를 `ai-assistant`로 정리했다.
- [x] Android 래퍼 소스와 빌드 스크립트는 유지하고, 생성 APK·checksum·롤백 번들은 Git 대상에서 제거했다.
- [x] Gradle의 내부 Maven URL 기본값을 제거하고 `MAVEN_REPO_URL` 옵션으로 바꿨다.
- [x] API 설정의 내부 IP 기본값을 localhost 또는 placeholder로 교체했다.
- [x] 웹 로그인 URL의 외부 IP 하드코딩을 제거하고 `/login` 기본값으로 바꿨다.
- [x] README를 포트폴리오용 구조로 재작성했다.

## 검증 기준

- `git grep`으로 내부 IP와 오타 표기가 남지 않는지 확인한다.
- `git diff --check`를 실행한다.
- `npm --prefix apps/web run build`를 실행한다.
- API는 Gradle 빌드 또는 Docker build로 컴파일을 확인한다.
- `scripts/build_android_apk.sh`로 debug APK를 만들고 `apksigner verify`를 통과한다.
- Docker compose 실행은 필요 시 `WEB_HTTP_PORT=80` 기준으로 확인한다.

## 후속 개선

- Workspace 실행 API의 운영 비활성화 플래그를 더 명확히 분리한다.
- Jenkins 파이프라인에 web build, API build, HTTP 헬스체크를 단계별로 표시한다.
- `/portfolio` 화면의 설명도 README의 핵심 기능 범위와 맞춘다.
