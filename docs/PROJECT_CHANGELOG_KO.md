# 프로젝트 변경 상세 문서

## 1. Workspace 접근 정책

Workspace는 파일 읽기/쓰기, Python 실행, LLM 자동 수정, 업로드 기능을 포함하기 때문에 일반 사용자에게 열어두면 위험합니다.

이번 변경에서는 다음 원칙으로 정리했습니다.

- Workspace 화면 `/analysisadmin`은 관리자 전용으로 사용합니다.
- 기본 관리자 계정은 `admin1`입니다.
- 기본 비밀번호는 기존 운영 방식과 동일하게 `admin123`입니다.
- 일반 사용자나 게스트 계정은 Workspace API를 호출해도 서버에서 `403 Admin only`로 차단됩니다.
- 공개 서비스 이동 링크에서는 Workspace 링크를 제거했습니다.

서버에서 관리자 전용으로 막은 API:

- `GET /api/workspace/tree`
- `GET /api/workspace/file`
- `GET /api/workspace/download`
- `POST /api/workspace/file`
- `POST /api/workspace/folder`
- `DELETE /api/workspace/item`
- `POST /api/workspace/rename`
- `POST /api/workspace/upload`
- `POST /api/workspace/run-python`
- `POST /api/workspace/gemini`
- `GET /api/workspace/llm/config`
- `GET /api/workspace/executions`
- `POST /api/workspace-sessions`

## 2. Docker Analysis Python 실행 개선

기존 Python 실행 제한은 코드에 20초로 고정되어 있어, pandas/openpyxl/httpx 등을 쓰는 분석 스크립트가 오래 걸리면 중간에 끊길 수 있었습니다.

변경 내용:

- 기본 Python 실행 제한을 120초로 늘렸습니다.
- dev compose에서는 `APP_PYTHON_TIMEOUT_SECONDS=180`으로 설정했습니다.
- 환경변수로 최대 900초까지 조정할 수 있습니다.
- API 컨테이너 리소스는 현재 Docker 환경에서 허용되는 최대 CPU 2개로 설정했습니다.
- 메모리 제한은 6GiB, 예약은 2GiB로 설정했습니다.

관련 파일:

- `docker-compose.dev.yml`
- `apps/api/src/main/resources/application.yml`
- `apps/api/src/main/java/com/platform/jupiter/files/WorkspaceExecutionService.java`
- `apps/api/src/main/java/com/platform/jupiter/config/AppProperties.java`

## 3. LocalTrip 일정 생성 개선

### 3.1 GPT 요청 구조

일정 생성은 RAG DB에서 꺼내 쓰는 구조가 아닙니다.

현재 흐름:

1. 사용자가 지역, 여행일수, 동행, 취향, 이동수단, 예산, 메모를 입력합니다.
2. 서버가 GPT/Codex용 프롬프트를 만듭니다.
3. GPT/Codex가 JSON 배열을 반환합니다.
4. 서버가 JSON을 파싱해 `TravelPlanItem`으로 변환합니다.
5. 식당/카페 항목은 실제 장소 카탈로그로 보정합니다.
6. 보정된 일정이 DB에 저장됩니다.

더 자세한 GPT 요청 형식은 `docs/localtrip-gpt-request.md`에 정리했습니다.

### 3.2 실제 식당/카페 검증

LLM이 `"로컬 식당"`, `"카페 추천"` 같은 일반명을 만들면 실제 장소가 아니므로 일정 품질이 떨어집니다.

이번 변경에서는 `VerifiedLocalPlaceCatalog`를 추가해 식당/카페 슬롯을 실제 장소로 보정합니다.

지원 지역:

- 한국: 서울, 경주, 부산, 제주
- 일본: 도쿄, 교토, 오사카, 후쿠오카

보정 결과에는 다음 정보가 note에 들어갑니다.

- 실제 장소명
- 주소 또는 위치 힌트
- 추천 메뉴
- 검증 출처 라벨

예시:

```text
도쿄도 주오구 츠키지 4초메 일대 · 추천 메뉴: 스시, 해산물 덮밥, 계란말이 · 츠키지 공식 사이트가 소개하는 도쿄 푸드타운 · 검증: Tsukiji Outer Market
```

### 3.3 일본 여행 확장

기존 프롬프트는 “한국 여행”으로 고정되어 있었습니다.

이번 변경에서는 다음처럼 확장했습니다.

- GPT 시스템 메시지를 “한국과 일본 현지 여행 전문 가이드”로 변경했습니다.
- 사용자 프롬프트를 “한국 또는 일본 여행 일정”으로 변경했습니다.
- 일본 지역 빠른 선택에 도쿄, 오사카, 교토, 후쿠오카를 추가했습니다.
- 일본 후보 여행지를 mock destination seed에 추가했습니다.
- 일본 식당/카페 검증 카탈로그도 추가했습니다.

## 4. 일정별 출발/도착 체크

일자별 일정 카드에 출발/도착 체크 영역을 추가했습니다.

기능:

- 각 일자 첫 번째 일정의 시작 시간과 위치를 “출발”로 표시합니다.
- 각 일자 마지막 일정의 종료 시간과 위치를 “도착”으로 표시합니다.
- 사용자가 체크박스로 출발/도착 상태를 체크할 수 있습니다.
- 체크 상태는 브라우저 `localStorage`에 저장됩니다.

저장 키:

```text
localtrip-day-route-checks
```

## 5. RAG 폴더 설계

`3.rag` 폴더는 벡터 DB 그 자체가 아니라, RAG에 넣을 원천 데이터와 전처리 스크립트를 관리하는 폴더로 설계하는 것이 맞습니다.

권장 구조:

```text
3.rag/
  data/
    localtrip_rag_seed.jsonl
  scripts/
    build_rag_seed.py
    filter_rag_seed.py
  README.md
```

RAG 문서 메타데이터 예시:

```json
{
  "country": "JP",
  "region": "도쿄",
  "ageGroup": "30s",
  "gender": "any",
  "travelerType": "커플",
  "budgetLevel": "보통",
  "pace": "보통",
  "interests": ["맛집", "카페", "사진"],
  "text": "도쿄 30대 커플에게는 츠키지 장외시장 오전 식사 후 시부야 스카이 야경 예약 동선이 적합하다."
}
```

이 구조를 쓰면 나중에 Qdrant 같은 벡터 DB에 넣을 때 `country`, `region`, `ageGroup`, `gender`, `travelerType` 같은 값을 메타데이터 필터로 사용할 수 있습니다.

## 6. admin1 Workspace 스크립트 폴더

관리자 Workspace에는 아래 폴더를 만들 예정입니다.

```text
1.국내여행지/
  scrape_korea_destinations.py

2.일본여행지/
  scrape_japan_destinations.py

3.rag/
  README.md
  data/localtrip_rag_seed.jsonl
  scripts/build_rag_seed.py
  scripts/filter_rag_seed.py
```

스크립트는 처음부터 공격적으로 크롤링하지 않고, 공식/공개 페이지를 대상으로 요청 간격을 두고 수집할 수 있게 구성합니다.

## 7. 검증한 내용

이번 변경 중 확인한 항목:

- 프론트엔드 `npm run build` 성공
- API Docker 이미지 `bootJar` 빌드 성공
- Docker compose 설정에서 API 컨테이너 리소스 설정 파싱 확인

주의:

- 로컬 환경에는 `gradle` CLI가 없어 `gradle test`는 직접 실행하지 못했습니다.
- 대신 Docker 이미지 빌드 과정에서 Java 컴파일과 `bootJar` 생성은 검증했습니다.
