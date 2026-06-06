# 프로젝트 변경 기록

## 2026-06-06 공개 포트폴리오 정리

변경 내용:

- 앱 표기를 `ai-assistant`로 정리했습니다.
- Android/APK 소스, 다운로드 APK, Android 빌드 스크립트를 Git 대상에서 제거했습니다.
- Gradle의 내부 Maven 주소 기본값을 제거하고 `MAVEN_REPO_URL` 환경 변수로만 사설 저장소를 연결하게 했습니다.
- API 설정의 내부 IP 기본값을 localhost 또는 placeholder로 교체했습니다.
- 웹 로그인 경로의 외부 IP 하드코딩을 제거하고 `/login` 기본값과 `VITE_LOGIN_URL` 옵션으로 정리했습니다.
- README를 프로젝트 목적, 주요 기능, 아키텍처, 기술 스택, 실행 방법, 배포 구조, 트러블슈팅 경험, 향후 개선 계획 중심으로 다시 작성했습니다.

검증 예정:

- `git diff --check`
- `npm --prefix apps/web run build`
- API Gradle build 또는 Docker build
- 내부 IP/오타 잔여 검색
