# ai-assitant

`ai-assitant`는 모바일에서 먼저 써보며 다듬는 개인용 메모/일정 앱입니다.

현재 방향은 “완성된 AI 비서 서비스”가 아니라, 예쁜 모바일 UI를 만들고 API를 하나씩 붙여 실제 개인 AI 비서 서비스로 발전시키는 것입니다. 우선 핸드폰에 설치해서 메모, 일정, 여행 코스 흐름을 직접 테스트하고 불편한 부분을 작은 단위로 고칩니다.

최종 목표는 휴대폰의 문자, 메일, 로컬 파일처럼 사용자가 권한을 준 개인 데이터를 읽고 정리하는 모바일 AI 비서입니다. 웹/PWA만으로는 이런 로컬 권한을 직접 다룰 수 없으므로, 먼저 모바일 UI와 서버 API를 안정화한 뒤 Android/iOS 권한을 가진 앱 구조로 확장합니다.

## 현재 목표

- 모바일에서 바로 쓰기 쉬운 메모 앱 UX
- 일정, 메모, 여행 코스를 한 앱 안에서 연결
- API를 붙여 개인 데이터 기반 기능으로 확장
- 날씨, 내 위치 주변 여행지, 주변 식당/카페 추천 API를 붙여 실제 생활 동선으로 확장
- 장기적으로 Android/iOS 권한을 통해 문자, 메일, 로컬 파일을 개인 AI 비서 입력으로 연결
- `/app`을 기본 앱 홈으로 사용
- `/`은 별도 화면 없이 `/app`으로 이동
- Docker 기준으로 빌드, 실행, 배포

## 지금 있는 기능

- `/app`: 앱 홈
- `/notes`: 메모 보드
- `/scheduler`: 개인 일정
- `/destinations`: 여행 장소 찾기
- `/planner`: 여행 코스 만들기
- `/plans`: 저장한 여행 코스
- `/connect`: 개인 데이터 연결 준비 화면
- `/portfolio`: 외부 공유용 포트폴리오 화면
- `/analysisadmin`: 관리자용 워크스페이스

## 아직 완성 서비스가 아닌 부분

- 실제 개인 AI 비서 대화 서비스는 아직 완성 전입니다.
- Gmail, 네이버 메일, 로컬 메시지 연결은 설계/준비 단계입니다.
- 문자, 메일 앱, 로컬 파일 같은 휴대폰 데이터 접근은 네이티브 권한이 필요합니다.
- 사용자별 OpenAI/Gemini 키 정책은 준비되어 있지만, 제품 기능으로 더 다듬어야 합니다.
- 여행 코스 생성은 API와 DB 데이터를 붙여가는 중이며, 실제 품질은 계속 테스트하면서 개선합니다.

## 기술 구성

- Web: React, Vite
- API: Spring Boot
- DB: MariaDB
- 배포: Docker Compose
- 모바일 설치: PWA 또는 Android WebView APK 흐름으로 테스트

## 모바일 권한 방향

휴대폰의 문자, 메일, 로컬 파일을 읽는 기능은 일반 웹 화면만으로 구현하지 않습니다.

- Android: SMS, 파일, 알림, 공유 인텐트 같은 권한을 앱에서 요청해야 합니다.
- iOS: 앱 샌드박스와 공유 확장, 파일 선택, 메일 연동 정책을 따라야 합니다.
- 메일: Gmail 같은 서비스는 공식 OAuth API를 우선 사용합니다.
- 로컬 파일: 사용자가 선택하거나 공유한 파일부터 안전하게 연결합니다.
- 서버 API: 모바일 앱이 읽은 데이터를 요약, 검색, 일정/메모화하는 API로 연결합니다.

## 실행

Docker 기준으로 실행합니다.

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

상태 확인:

```bash
docker compose -f docker-compose.dev.yml ps
```

주요 URL 확인:

```bash
curl -I http://127.0.0.1/app
curl -I http://127.0.0.1/notes
curl -I http://127.0.0.1/planner
curl -I http://127.0.0.1/api/destinations?size=1
```

운영 검증도 웹은 포트 `80` 기준으로 맞춥니다. DB/API 호스트 포트만 충돌을 피하려면 아래처럼 실행합니다.

```bash
DB_PORT=13306 API_PORT=18080 WEB_HTTP_PORT=80 WEB_HTTPS_PORT=443 \
docker compose -f docker-compose.dev.yml up -d --build
```

## API

여행 기능에서 현재 사용하는 주요 API:

- `GET /api/destinations`
- `GET /api/destinations/{id}`
- `POST /api/destinations/sync/mock`
- `POST /api/travel-plans/generate`
- `GET /api/travel-plans`
- `GET /api/travel-plans/{id}`
- `DELETE /api/travel-plans/{id}`

## 작업 기준

- 먼저 모바일에서 직접 쓰기 쉬운 UI를 만든다.
- 화면 문구는 실제 구현된 기능만 설명한다.
- AI 비서라고 과장하지 않고, 메모/일정 앱에서 API를 붙여가는 단계로 유지한다.
- 배포와 검증은 Docker 기준으로 한다.

## 다음 우선순위

- 모바일 메모 UX를 계속 단순화
- 핸드폰 설치 후 실제 터치, 스크롤, 입력 불편 수정
- 메모와 일정 연결 강화
- 여행 코스 입력을 일자별 출발지/도착지 중심으로 단순화
- 날씨, 위치 기반 여행지, 주변 식당/카페 API를 단계적으로 연결
- 개인 데이터 연결 API를 실제 사용 흐름에 맞춰 하나씩 추가
