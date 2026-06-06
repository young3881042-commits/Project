# MU

MU는 모바일에서 메모와 일정을 빠르게 기록하고,
AI가 메모를 일정/할 일/여행 계획으로 정리해주는 개인 워크스페이스입니다.

## 프로젝트 목적

흩어진 메모, 오늘 할 일, 여행 준비 내용을 한 화면에서 기록하고 다시 일정으로 옮기는 과정을 줄이는 것이 목표입니다. 포트폴리오에서는 "많은 기능"보다 메모와 일정이 자연스럽게 이어지는 개인 워크스페이스, 그리고 이를 Docker/Jenkins로 배포 가능한 구조로 만든 점을 중심에 둡니다.

## 주요 기능

- 메모 관리: 폴더형 메모 보드, 블록 기반 편집, 체크리스트 작성
- 일정 관리: 오늘/주간 일정, 할 일 상태, 카테고리별 스케줄 관리
- 메모 기반 일정화: 메모의 날짜와 시간 정보를 일정으로 연결
- 여행 계획 플러그인: 장소 탐색, 여행 코스 생성, 저장 코스 관리
- AI/RAG 확장 구조: 사용자 API 키 기반 AI 연결, 문서 검색과 요약 확장 준비
- Docker/Jenkins 배포: web/api/db compose와 Jenkins 배포 파이프라인

터미널, 파일 실행, Python 실행, 관리자 워크스페이스 기능은 핵심 사용자 기능이 아니라 로컬 개발/관리 확장 기능입니다.

Workspace 실행 기능은 로컬 개발/관리자 전용 기능이며,
운영 배포 시 기본 비활성화하는 것을 권장합니다.

## 아키텍처

```text
Browser/PWA
  -> Nginx web gateway
  -> React/Vite web-source
  -> Spring Boot API
  -> MariaDB

Jenkins
  -> Docker build
  -> docker compose up
```

루트 경로 `/`은 별도 랜딩 화면을 렌더링하지 않고 `/app`으로 이동합니다. 공개 소개 화면은 `/portfolio`, 실제 앱 홈은 `/app`입니다.

## 기술 스택

- Frontend: React, Vite
- Editor/UI: BlockNote, React Markdown, custom CSS
- Backend: Spring Boot, Spring Data JPA
- Database: MariaDB
- AI 확장: OpenAI 호환 API, Gemini 연결 구조, RAG 서비스 구조
- Deployment: Docker Compose, Nginx, Jenkins

## 실행 방법

환경 예시는 `apps/api/.env.example`, `apps/web/.env.example`을 참고합니다. 내부 IP나 사설 저장소 주소는 소스 기본값에 넣지 않고, 필요한 경우 로컬 `.env`에서만 설정합니다.

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
docker compose -f docker-compose.dev.yml up -d --build
```

주요 확인 URL:

```bash
curl -I http://127.0.0.1/app
curl -I http://127.0.0.1/notes
curl -I http://127.0.0.1/scheduler
curl -I http://127.0.0.1/api/destinations?size=1
```

사설 Maven proxy가 필요한 환경에서는 `MAVEN_REPO_URL`만 로컬 환경에 설정합니다.

```env
MAVEN_REPO_URL=http://your-maven-proxy.example.com/repository/maven-public
VITE_API_BASE_URL=http://localhost:8080
```

## 배포 구조

- `docker-compose.dev.yml`: MariaDB, API, nginx web, Vite web-source를 함께 실행
- `infra/api/docker/Dockerfile`: Spring Boot API 이미지
- `infra/web/docker/Dockerfile`: nginx gateway 이미지
- `infra/jenkins/Dockerfile`: Jenkins 배포 서버 이미지
- `Jenkinsfile`: Jenkins에서 Docker build와 compose 배포 수행

Jenkins를 실행할 때는 먼저 로컬 전용 환경 파일을 만듭니다.

```bash
cp .jenkins.env.example .jenkins.env
```

외부 공개 포트는 web `80/443` 기준으로 맞추고, API와 DB 포트는 환경 변수로 충돌을 피합니다.

## 트러블슈팅 경험

- 내부 IP와 사설 Maven 저장소 주소가 build/config/docs에 남아 있던 문제를 `.env.example` placeholder와 localhost 기본값으로 정리했습니다.
- `/`, `/apps`, `/connections`처럼 흔들리던 진입 경로를 `/app`, `/connect` 기준으로 정리했습니다.
- 메모 편집기를 수제 Markdown 편집에서 BlockNote 기반으로 옮기면서 기존 저장 구조와 호환되게 보존했습니다.
- web 컨테이너를 nginx gateway와 Vite source 컨테이너로 분리해 일반 웹 수정은 이미지 재빌드 없이 반영되게 했습니다.

## 향후 개선 계획

- 메모에서 일정 후보를 더 정확히 추출하는 AI 정리 흐름 강화
- 여행 계획 플러그인을 코스 비교와 일정 충돌 확인까지 확장
- RAG 문서 업로드와 검색 결과의 출처 표시 개선
- 관리자 실행 기능의 운영 기본 비활성화와 권한 감사 로그 강화
- Jenkins 배포 파이프라인에 빌드 테스트와 헬스체크를 더 촘촘하게 추가
