<img width="1916" height="975" alt="image" src="https://github.com/user-attachments/assets/752ecd77-8075-4bb5-b945-4e2086389b93" /> 
<img width="1915" height="1037" alt="image" src="https://github.com/user-attachments/assets/d8ce5b6d-7f68-4a75-bdc9-4d17568dc651" />

# ai-assitant

ai-assitant는 개인 모바일 기기나 설치 앱에서 내 서버와 외부 서비스를 API로 연결해 일정과 메모를 확장하는 **개인 AI 비서** 프로젝트입니다.

기존처럼 홈 디렉터리 전체를 그대로 옮기는 방식이 아니라, 실제로 관리해야 하는 코드와 실행 구성만 남겨서 **재현 가능하고 설명 가능한 구조**로 다시 정리했습니다.

---

## 프로젝트 개요

이 프로젝트는 단순한 웹 화면 저장소가 아니라, 개인 데이터 허브와 AI 작업 흐름을 한 번에 다루기 위한 개발용 워크스페이스입니다.

현재 기준으로 다음 범위를 포함합니다.

- React + Vite 기반 Web UI
- Spring Boot 기반 API 서버
- MariaDB 기반 DB 구성
- Docker 실행 구조
- `/` 개인 AI 비서 홈, `/portfolio` 포트폴리오, `/connections` 개인 데이터 연결 화면
- 일정/메모 중심의 개인 데이터 허브
- Gmail, 네이버 메일, 파일, 향후 로컬 메시지 연결 설계
- 로그인 사용자별 OpenAI/Gemini 키 등록 구조
- 개인별 분석환경을 만들기 위한 실행 템플릿
- Gemini 연동을 통해 분석환경에서 **파이썬 파일 생성, 수정, 실행 흐름을 처리할 수 있는 구조**

즉, 단순 CRUD 웹이 아니라 **사용자별 개인 데이터와 AI 실행 흐름을 일정, 메모, 파일, 연결 서비스로 확장할 수 있도록 구성한 프로젝트**입니다.

---

## 주요 기능

### 1. 개인 AI 비서 홈
- `/`을 기본 앱 홈으로 사용
- 오늘 일정, 최근 메모, 연결된 개인 데이터, 추천 액션을 한 화면에서 확인
- `/portfolio`는 외부 공유용 포트폴리오로 분리
- `/connections`에서 개인 데이터 연결과 권한 상태 관리

### 2. Web UI
- React + Vite 기반 프론트엔드
- API와 연동되는 워크스페이스 화면 제공
- 로컬 실행 및 Docker 실행 지원
- 일정, 메모, 여행 계획, 데이터 연결 접근용 기본 UI 구성

### 3. API 서버
- Spring Boot 기반 백엔드
- 인증 및 워크스페이스 관련 API 제공
- 파일/실행 요청 처리
- 정적 문서(`/docs`) 제공 가능
- 개인별 분석환경과 외부 서비스 연결 시 필요한 설정값 관리

### 4. 개인별 분석환경 구성
- 사용자별 분석환경을 분리해서 구성할 수 있도록 설계
- 워크스페이스 루트, 스냅샷 경로, 실행 경로 등의 환경값 관리
- 분석환경에서 사용할 기본 서비스 주소를 API에서 통합 관리

### 5. 사용자별 AI 연결
- OpenAI/Gemini 키는 서버 공용 키가 아니라 로그인한 사용자별 등록을 기본 정책으로 사용
- 키 원문은 프론트엔드에 장기 보관하지 않고 서버에서 암호화 저장, 마스킹 표시, 삭제 흐름을 제공
- Gmail은 공식 Gmail API OAuth, 네이버 메일은 공식 메일 읽기 Open API 확인 전까지 IMAP/앱 비밀번호 방식으로 연결
- 로컬 메시지는 웹/PWA에서 직접 읽지 않고 Android/iOS 네이티브 권한 기반 후속 기능으로 분리

### 6. Gemini 연동 기반 실행 템플릿
- Gemini를 연동하여 개인별 분석환경 안에서 작업 흐름을 확장할 수 있도록 구성
- 사용자가 요청한 작업에 맞게 **파이썬 파일을 생성**
- 기존 파일 내용을 바탕으로 **코드 수정**
- 필요한 경우 분석환경에서 **파이썬 실행 흐름까지 연결 가능**
- 이후 RAG나 실행 결과 요약 기능과 연결하기 쉬운 구조로 정리

즉, 이 프로젝트는 단순히 “AI 답변”만 붙이는 것이 아니라,  
**AI를 통해 실제 분석환경 안에서 파일 생성/수정/실행 흐름으로 이어질 수 있게 하는 기반 구조**를 목표로 합니다.

### 7. DB 초기화
- MariaDB 기반
- `schema.sql` 로 테이블 생성
- `data.sql` 로 초기 데이터 적재
- Docker 최초 기동 시 DB 초기화 가능

### 8. 실행 인프라 분리
- Web / API / DB 별 실행 구조 분리
- Docker 실행 구성을 중심으로 관리
- 개발 환경과 배포 환경으로 확장 가능한 형태 유지

---

## 디렉터리 구조

```text
.
├── apps
│   ├── web
│   │   ├── src
│   │   ├── package.json
│   │   ├── run-local.sh
│   │   └── .env.example
│   └── api
│       ├── src
│       ├── build.gradle
│       ├── run-local.sh
│       └── .env.example
├── infra
│   ├── web
│   │   └── docker
│   ├── api
│   │   └── docker
│   ├── db
│   │   ├── docker
│   │   │   ├── docker-compose.yml
│   │   │   └── initdb
│   │   │       ├── 01-schema.sql
│   │   │       └── 02-data.sql
├── docs
├── scripts
└── README.md
```

---

## 개인 AI 비서 앱과 LocalTrip AI

ai-assitant의 제품 방향은 `개인 AI 비서`, `개인 데이터 허브`, `일정/메모 중심`입니다. 기본 앱 홈은 `/app`으로 사용하고, 웹 루트 `/`는 `/app`으로 이동합니다. 포트폴리오 공개 화면은 `/portfolio`, 개인 데이터 연결 화면은 `/connections`로 분리합니다.

LocalTrip AI는 이 개인 AI 비서 안에 들어가는 여행 일정 생성 기능입니다. 한국관광공사 TourAPI 연동을 준비한 일정 생성 MVP이며, 기존 분석 워크스페이스는 `/analysisadmin`에 유지합니다.

### 프로젝트 개요

- 사용자가 일정, 메모, 연결된 개인 데이터에서 다음 액션을 확인한다.
- Gmail, 네이버 메일, 파일, 향후 로컬 메시지를 개인 데이터 허브에 연결한다.
- 사용자가 지역, 기간, 이동수단, 여행 스타일, 예산, 메모를 입력해 여행 일정을 만든다.
- Mock 또는 TourAPI 기반 여행지 데이터를 조회한다.
- 초기 버전은 DB 여행지 데이터를 조합해 AI 일정처럼 응답한다.
- 여행 기능은 실제 외부 API 키 없이도 Mock 데이터로 전체 화면과 API가 동작한다.

### 주요 기능

- 개인 AI 비서 홈: 오늘 일정, 메모, 연결 상태, 추천 액션
- 개인 데이터 연결: Gmail OAuth, 네이버 IMAP/앱 비밀번호, 파일, 향후 로컬 메시지 연결
- 사용자별 LLM 키: 로그인 사용자별 OpenAI/Gemini 키 등록과 삭제
- 여행지 목록 조회: 지역, 스타일, 키워드 필터
- Mock 여행지 동기화: 서울, 경주, 부산, 제주 24건
- AI 일정 생성 Mock: 여행 스타일과 지역 조건 기반 일정 저장
- 저장된 일정 목록/상세/삭제
- TourAPI 연동 준비: base URL과 service key는 설정값으로 분리
- 분석 데이터 수집 볼륨: `/workspace-data/analysis/localtrip`

### 기술 스택

- Web: React, Vite
- API: Spring Boot, JDBC/JPA 기반 Repository
- DB: MariaDB
- Deploy: Docker 기반 배포
- Collection: Bash 초기화 스크립트, Python TourAPI collector

### 현재 실행 주소

- 개인 AI 비서 앱: `http://192.168.45.101:31088/app`
- 포트폴리오 Web: `http://192.168.45.101:31088/portfolio`
- 개인 데이터 연결: `http://192.168.45.101:31088/connections`
- LocalTrip AI: `http://192.168.45.101:31088/destinations`
- ai-assitant 분석 워크스페이스: `http://192.168.45.101:31088/analysisadmin`
- API: `http://192.168.45.101:31090`

### 개인 데이터 연결 정책

- Gmail: 공식 Gmail API OAuth로 연결하고, 사용자 동의 범위와 연결 해제 흐름을 명확히 둡니다.
- 네이버 메일: 공식 메일 읽기 Open API가 확인되기 전까지 IMAP/앱 비밀번호 방식으로 설계합니다.
- 로컬 메시지: 웹/PWA 단독으로 SMS, 카카오톡, iMessage 같은 로컬 메시지를 직접 읽을 수 없으므로 Android/iOS 네이티브 권한이 필요한 후속 작업으로 둡니다.
- 파일: 사용자가 업로드하거나 연결한 파일을 일정, 메모, 검색용 개인 데이터로 확장합니다.
- LLM 키: OpenAI/Gemini 키는 서버 공용 키가 아니라 로그인 사용자별로 등록, 암호화 저장, 마스킹 표시, 삭제할 수 있게 합니다.

### 실행 방법

Docker base 이미지(`ai-assitant`) 재배포:

```bash
docker compose -f docker-compose.dev.yml up -d --build
scripts/smoke_test_docker_base.sh
```

배포 후에는 반드시 스모크 테스트를 실행해 실제 서버 HTML/JS 번들에 변경 문구가 포함됐는지, 브라우저 캐시가 `immutable`로 고정되지 않았는지 확인합니다. 로컬 검증 URL은 `localhost` 대신 `127.0.0.1`을 기본으로 사용합니다.

전체 소스 기반 재배포:

```bash
/root/scripts/deploy_jupiter_from_source.sh
```

Web 소스만 빠르게 반영:

```bash
/root/scripts/sync_web_source_to_pod.sh
```

Mock 여행지 데이터 적재:

```bash
curl -fsS -X POST http://192.168.45.101:31090/api/destinations/sync/mock
```

여행지 검색:

```bash
curl -fsS --get \
  --data-urlencode region=경주 \
  --data-urlencode style=역사 \
  --data-urlencode size=3 \
  http://192.168.45.101:31090/api/destinations
```

일정 생성:

```bash
curl -fsS -X POST http://192.168.45.101:31090/api/travel-plans/generate \
  -H 'Content-Type: application/json' \
  --data-binary '{"region":"경주","days":2,"transportType":"PUBLIC_TRANSPORT","travelStyle":["역사","맛집","사진"],"budgetLevel":"NORMAL","memo":"첨성대 야경을 보고 싶다."}'
```

### API 목록

- `GET /api/destinations`
- `GET /api/destinations/{id}`
- `POST /api/destinations/sync/mock`
- `POST /api/travel-plans/generate`
- `GET /api/travel-plans`
- `GET /api/travel-plans/{id}`
- `DELETE /api/travel-plans/{id}`

### 데이터 동기화 구조

TourAPI 설정은 `application.yml`의 `app.tour-api` 아래에서 관리합니다. 실제 키는 커밋하지 않고 `APP_TOUR_API_SERVICE_KEY` 또는 환경별 secret으로 주입합니다.

RAG 코퍼스는 분석 볼륨의 `04_rag`에 지역/섹터/페르소나 순서로 둡니다.

```text
/workspace-data/analysis/localtrip/04_rag/
  regions/
    gyeongju/
      food/
        couple/
        family/
      attractions/
      activities/
```

지역과 섹터는 폴더로 빠르게 나누고, `혼자/커플/남자/여자/가족` 같은 개인화 축은 폴더와 문서 메타데이터를 같이 사용합니다. 사용자별 선호 내역은 공용 RAG에 섞지 않고 계정 폴더 최상단의 `localtrip/preferences.json`과 `localtrip/history.jsonl`에 저장하는 구조입니다.

분석 볼륨 초기화:

```bash
/root/scripts/localtrip_init_analysis_volume.sh
```

TourAPI collector 샘플/Mock export:

```bash
python3 /root/scripts/localtrip_collect_tourapi.py mock-export
```

### AI 일정 생성 구조

현재는 실제 Gemini/OpenAI 호출 대신 DB의 Destination 데이터를 여행 스타일과 지역 조건에 맞게 조합합니다. 이후 실제 LLM 호출부를 붙일 때는 `TravelPlanService`의 생성 흐름을 유지하고, 프롬프트 생성과 응답 파싱 계층만 분리하면 됩니다.

### 향후 확장 계획

- `/connections` 기반 Gmail OAuth 연결
- 네이버 메일 IMAP/앱 비밀번호 연결
- Android/iOS 네이티브 권한 기반 로컬 메시지 수집 검토
- 사용자별 OpenAI/Gemini 키 등록과 관리
- 실제 TourAPI `areaBasedList2`, `searchKeyword2`, `detailCommon2` 연동 강화
- Gemini/OpenAI 기반 일정 생성
- Vector DB 기반 여행지 검색
- 사용자 로그인/찜하기
- Prometheus/Grafana 모니터링


## 🚀 진행 상태 체크리스트

### ✅ 완료된 작업

#### 기본 플랫폼 구성
- [x] React + Vite 기반 Web UI 구성
- [x] Spring Boot 기반 API 서버 구성
- [x] MariaDB 기반 DB 초기화 구조 구성 (`schema.sql`, `data.sql`)
- [x] Web / API / DB 디렉터리 구조 분리
- [x] Docker 실행 구조 구성

#### 실행 환경 및 워크스페이스
- [x] 사용자별 분석환경 생성 구조 설계
- [x] workspace / snapshot / 실행 경로 구조 정의
- [x] API에서 환경 설정값 관리 구조 구성

#### AI 연동 (기초)
- [x] Gemini API 연동
- [x] LLM 호출 → 응답 반환 기능 구현
- [x] 분석환경 내 파일 생성 기능 구현
- [x] 기존 파일 수정 흐름 구현
- [x] Python 실행 흐름 연결 (기초 수준)

#### 프로젝트 구조화
- [x] 재현 가능한 디렉터리 구조 정리
- [x] 실행 흐름 분리 (local / docker)
- [x] README 기반 설명 구조 작성

---

### ⚠️ 진행 중 / 일부 완료

#### 실행 환경 고도화
- [ ] 사용자별 리소스 제한 (CPU / Memory)
- [ ] 실행 환경 격리 강화 (보안 / 권한)
- [x] 실행 로그 수집 및 조회 기능 (API: `/api/workspace/executions`)
- [x] 작업 이력 관리 (최근 실행 100건/사용자 기준)

#### AI 실행 흐름
- [x] 코드 실행 결과 자동 요약 (`/api/workspace/run-python?summarize=true`)
- [x] 실행 실패 시 자동 수정 루프 (`/api/workspace/run-python?autoFix=true`)
- [x] 멀티 파일 컨텍스트 처리 (`/api/workspace/gemini` 요청의 `contextFiles`)

---

### ❌ 아직 안한 작업 (핵심 확장)

#### RAG / Vector DB
- [x] 문서 수집 파이프라인 1차 구축 (멀티도메인 자동 수집 API)
- [ ] Kafka 기반 데이터 처리 흐름 구성
- [ ] 문서 전처리 / 청크 분할 로직 구현
- [ ] Embedding 생성 로직 연결
- [ ] Vector DB 구축 (Milvus / Chroma / FAISS 등)
- [ ] 벡터 + 원문 + 메타데이터 저장 구조 설계
- [x] 질문 → Vector 검색 → 문서 retrieval 구현
- [x] RAG 구조로 LLM 프롬프트 구성 (Gemini 우선, OpenAI fallback)

#### 플랫폼 확장
- [ ] 사용자별 RAG 데이터 분리 구조
- [ ] `/` 개인 AI 비서 홈, `/portfolio` 포트폴리오, `/connections` 개인 데이터 연결 라우팅 정리
- [ ] Gmail 공식 API OAuth 연결
- [ ] 네이버 메일 IMAP/앱 비밀번호 연결
- [ ] 로컬 메시지 Android/iOS 네이티브 권한 검토
- [ ] 사용자별 OpenAI/Gemini 키 등록, 암호화 저장, 삭제 정책 적용
- [ ] 실시간 데이터 반영 파이프라인
- [ ] 검색 정확도 튜닝 (top-k / 필터링)
- [ ] 캐싱 전략 적용

#### DevOps / 운영
- [ ] CI/CD 파이프라인 구성 (Jenkins 등)
- [ ] 모니터링 (Prometheus / Grafana)
- [ ] 로그 수집 (ELK / Loki 등)
- [ ] 장애 대응 자동화

---

### 🔥 한 줄 현재 상태

```text
"AI 호출 + 실행 환경 플랫폼" → 완료  
"데이터 기반 AI (RAG)" → 이제 시작 단계
```


## ✅ 2026-04 업데이트

- `/api/rag/domains/refresh`로 금융/헬스케어/기술/제조/에너지/물류 분야 데이터를 자동 수집해 RAG 소스로 반영합니다.
- RAG 답변 생성은 Gemini를 우선 시도하고, 실패 시 OpenAI(`gpt-4o-mini`)로 자동 fallback 합니다.
- Web UI에서 `Domains` 버튼으로 다분야 데이터 재수집을 바로 실행할 수 있습니다.

## 🔐 사용자별 LLM 키 정책 (OpenAI/Gemini / Codex CLI Session Mode)

개인 AI 비서의 LLM 요청은 **브라우저가 아니라 API 서버**에서 처리하되, 키 소유자는 로그인한 사용자로 둡니다.

- 사용자는 로그인 후 본인 OpenAI/Gemini 키 또는 OAuth 연결을 등록합니다.
- 프론트엔드는 키 원문을 장기 보관하지 않고, 서버 응답에서도 마스킹된 상태만 표시합니다.
- 서버는 사용자별로 암호화 저장된 키를 꺼내 호출하고, 삭제/재등록 흐름을 제공합니다.
- 서버 공용 `OPENAI_API_KEY`, `APP_OPENAI_API_KEY`, `APP_GEMINI_API_KEY`는 운영 사용자 요청의 기본 경로로 쓰지 않습니다.
- 공용 환경변수는 로컬 개발, 관리자 점검, 마이그레이션 fallback처럼 범위가 제한된 경우에만 사용합니다.

### 개발/관리자 fallback 환경변수

```bash
APP_OPENAI_API_KEY=sk-proj-xxxxx
APP_OPENAI_MODEL=gpt-5.2-codex
APP_GEMINI_API_KEY=xxxxx
ENABLE_CODEX_CLI_MODE=false
```

- 사용자별 OpenAI 키가 등록되지 않은 경우 운영 기능은 키 연결 안내를 표시해야 합니다.
- 사용자별 Gemini OAuth 또는 키가 연결되지 않은 경우 Gemini 기능은 연결 안내를 표시해야 합니다.
- `ENABLE_CODEX_CLI_MODE=true`일 때만 Codex CLI Session Mode를 UI에서 활성화합니다.

### Docker Compose 개발 예시

`docker-compose.yml` 또는 실행 셸에서:

```bash
export APP_OPENAI_API_KEY=sk-proj-xxxxx
export APP_OPENAI_MODEL=gpt-5.2-codex
export APP_GEMINI_API_KEY=xxxxx
export ENABLE_CODEX_CLI_MODE=false
docker compose up -d
```

### Codex CLI Session Mode 사전 준비

서버 런타임 사용자 기준으로 아래를 선행해야 합니다.

```bash
npm i -g @openai/codex
codex login
codex exec \"hello\"
```

주의:
- `~/.codex/auth.json`을 웹 서비스 코드에서 읽거나 프론트엔드로 전달하면 안 됩니다.
- 컨테이너에서 Codex CLI 모드를 쓸 때는 해당 런타임 계정의 로그인 세션/홈 디렉터리 마운트 정책을 별도로 설계해야 합니다.

## 보안 하드닝 기록

이번 배포에는 서버 고의 장애, 대용량 업로드, 키 탈취, 서버 정보 노출을 줄이기 위한 1차 방어선을 추가했습니다.

- 업로드 크기 제한
  - Nginx `client_max_body_size`를 `6m`으로 제한합니다.
  - Spring multipart `max-file-size`는 `5MB`, `max-request-size`는 `6MB`입니다.
  - Workspace 업로드 코드에서도 5MB 초과 파일을 거부합니다.

- 민감 파일명 차단
  - 일반 사용자 워크스페이스에서 `.env`, 개인키, credential 파일, `*.pem`, `*.key`, `*.p12`, `*.pfx` 파일을 읽기/쓰기/업로드하지 못하게 차단합니다.
  - 파일명에 `secret`, `api_key`, `apikey`, `access_token`, `refresh_token`, `client_secret`, `private_key` 등이 포함된 경우도 차단합니다.

- 큰 파일 미리보기 제한
  - 워크스페이스 파일 미리보기는 1MB 초과 텍스트 파일을 거부합니다.

- 서버 정보 노출 축소
  - Nginx `server_tokens off`를 설정했습니다.
  - API 예외 응답은 내부 스택트레이스 대신 사용자용 메시지를 반환하는 방향을 유지합니다.

- Python 실행 환경
  - API 이미지에 `python3`, `python3-pip`를 포함합니다.
  - 크롤링/데이터 처리 기본 패키지로 `requests`, `beautifulsoup4`, `lxml`, `pandas`, `openpyxl`, `httpx`를 설치합니다.
  - 기본 `main.py` 샘플은 실행 시 `sample_output.txt`를 실제로 생성합니다.

남은 보완 사항:
- 사용자 Python 실행은 별도 sandbox 컨테이너로 분리하고 CPU, 메모리, 네트워크, 파일시스템 제한을 적용해야 합니다.
- 파일명 기반 민감정보 차단은 1차 방어입니다. 운영 환경에서는 secret을 사용자 워크스페이스 밖에 두고 Secret Manager 또는 Docker secret/env 정책으로 주입해야 합니다.
- 인증, 업로드, LLM 엔드포인트에는 rate limit을 추가해야 합니다.
- 임의 업로드를 운영에서 허용할 경우 실제 백신/콘텐츠 스캐너 연동이 필요합니다.
