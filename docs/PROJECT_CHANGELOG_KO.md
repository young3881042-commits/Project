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

## 9. 2026-05-23 포트폴리오 웹과 개인 AI 비서 앱 분리

이번 변경에서는 공개 웹과 실제 앱 사용 흐름을 분리했습니다.
이 섹션은 이전 단계의 변경 기록이며, 이후 제품 방향은 아래 10절과 11절의 `/app` 앱 홈, `/portfolio`, `/connect` 기준으로 다시 정리했습니다.

변경 내용:

- `/`는 외부 공유용 포트폴리오 웹으로 정리했습니다.
- `/app`은 개인 AI 비서 홈으로 분리했습니다.
- 기존 `/scheduler`, `/notes`, `/destinations`, `/planner`, `/plans`, `/analysisadmin` 경로는 유지했습니다.
- 내부 홈 링크는 포트폴리오가 아니라 `/app`으로 이동하도록 정리했습니다.
- PWA manifest, 앱 아이콘, service worker 기본 파일을 추가했습니다.
- `admin1` 메모 보드에 이번 작업 로그가 자동으로 남도록 시드 메모를 추가했습니다.

추가로 확인할 일:

- Docker web 재빌드 후 `/`, `/app`, `/scheduler`, `/notes`, `/destinations` 진입을 확인합니다.
- HTTPS 도메인에서 모바일 홈 화면 추가와 앱 아이콘 표시를 확인합니다.
- Google Play 등록 전 TWA와 Capacitor 중 하나를 선택합니다.

## 10. 2026-05-23 개인 AI 비서와 개인 데이터 허브 방향 정리

앞선 포트폴리오/앱 분리 이후, 제품 방향을 여행 중심 앱이 아니라 실제 개인 AI 비서로 다시 정리했습니다.

문서 기준 제품 모델:

- `개인 AI 비서`: 사용자의 일정, 메모, 메일, 파일, 향후 로컬 메시지를 바탕으로 오늘 할 일과 다음 액션을 제안합니다.
- `개인 데이터 허브`: Gmail, 네이버 메일, 로컬 파일, 모바일 네이티브 권한 데이터 같은 개인 소스를 로그인 사용자별로 연결합니다.
- `일정/메모 중심`: 연결된 데이터는 먼저 일정 후보, 메모, 리마인더, 검색 가능한 기록으로 확장합니다.

문서 기준 경로:

- `/app`: 기본 개인 AI 비서 앱 홈입니다.
- `/`: 별도 메인 화면을 렌더링하지 않고 `/app`으로 이동합니다.
- `/portfolio`: 외부 공유용 포트폴리오 화면입니다.
- `/connect`: 개인 데이터 연결, 권한, 동기화 상태, 해제 액션을 관리하는 화면입니다.

연결 정책:

- Gmail은 공식 Gmail API OAuth 기반 연결로 설계합니다.
- 네이버 메일은 공식 메일 읽기 Open API가 확인되기 전까지 IMAP/앱 비밀번호 방식으로 둡니다.
- 로컬 메시지는 웹/PWA 단독으로 직접 읽을 수 없으므로 Android/iOS 네이티브 권한과 플랫폼 정책 검토가 필요한 후속 작업으로 분리합니다.
- OpenAI/Gemini 키는 서버 공용 키가 아니라 로그인한 사용자별 키 등록, 암호화 저장, 마스킹 표시, 삭제 기능을 기본 정책으로 둡니다.

추가로 확인할 일:

- 실제 라우팅을 문서 기준과 맞춰 `/app` 앱 홈, `/portfolio` 포트폴리오, `/connect` 연결 화면으로 구현합니다.
- 기존 `/` 경로는 별도 메인 화면 없이 `/app`으로 넘깁니다.

## 11. 2026-05-23 ai-assitant 앱 라우트와 설치 파일 정리

요청에 따라 제품 이름과 설치 대상을 `ai-assitant`로 맞췄습니다.

변경 내용:

- PWA manifest, 앱 HTML title, package name, Docker image name을 `ai-assitant` 기준으로 정리했습니다.
- 기본 앱 라우트를 `/app`으로 고정하고 `/`은 클라이언트에서 `/app`으로 이동하게 했습니다.
- 모바일 홈 UI는 큰 배경 히어로 대신 일정, 메모, 여행, 연결 진입 버튼 중심의 앱 홈으로 정리했습니다.
- Android WebView 기반 디버그 APK를 추가했습니다.

생성된 설치 파일:

```text
apps/mobile/android/build/ai-assitant-debug.apk
```

검증:

- `npm --prefix apps/web run build`
- `docker compose -f docker-compose.dev.yml build web`
- `docker compose -f docker-compose.dev.yml up -d --build api web`
- `curl http://127.0.0.1/app`
- `curl http://127.0.0.1/manifest.webmanifest`
- `curl http://127.0.0.1/api/destinations?size=1`

## 12. 2026-05-23 연결 URL과 공통 바로가기 통일

변경 내용:

- 개인 데이터 연결 기본 경로를 `/connect`로 줄였습니다.
- 기존 `/connections` 경로는 호환용으로 받아서 `/connect`로 이동합니다.
- 앱 홈, 워크스페이스 상단 탭, 여행 화면 서비스 스위치의 공통 바로가기를 `내 일정`, `메모`, `장소 찾기`, `연결` 4개로 맞췄습니다.
- 연결 화면의 API 서버 주소 입력은 같은 origin이면 빈 값으로 정리하고, 표시도 `/api` 기준으로 보여주게 했습니다.
- 사용자별 외부 서비스 토큰과 LLM 키의 저장소, 암호화 키 관리, 감사 로그 범위를 별도 설계합니다.

## 13. 2026-05-23 플래너와 연결 화면 단순화

변경 내용:

- `/planner`의 날짜·동선 단계는 클릭한 항목 하나만 펼쳐지는 보강 카드 구조로 정리했습니다.
- 여행 계획 생성은 장소, 출발일, 여행 일수만으로 다음 단계로 넘어갈 수 있게 하고, 주소/시간/일자별 동선은 선택 입력으로 낮췄습니다.
- `/connect`는 첫 화면을 `이메일`과 `문자` 두 선택지로 단순화했습니다.
- API 서버와 OpenAI 키 입력은 기본 화면에서 빼고 `고급 설정`으로 접었습니다.

검증할 내용:

- 모바일에서 `/planner` 단계 카드가 한 번에 하나씩 열리는지 확인합니다.
- `/connect`에서 이메일/문자 선택이 좁은 화면에서도 겹치지 않는지 확인합니다.

## 14. 2026-05-23 일정 생성 상태 메시지 개선

변경 내용:

- `/planner`의 AI 일정 생성 중 상태를 버튼 텍스트만 바꾸지 않고 별도 진행 카드로 보여주게 했습니다.
- 생성 중에는 장소 후보 확인, 시간표 구성, 일정 저장 단계를 안내합니다.
- 실패 시 원문 에러를 그대로 노출하지 않고 API 키 필요, 서버 지연 등 사용자가 이해할 수 있는 메시지로 정리합니다.
- 실패 후에도 입력값은 유지하고 같은 버튼에서 다시 생성할 수 있게 했습니다.

## 15. 2026-05-24 메모 우선 연결과 Android APK 갱신

변경 내용:

- `/connect`의 첫 선택지를 메모 보드로 바꾸고, 이메일과 문자는 후속 연결로 이동했습니다.
- Android WebView 앱의 시작 URL을 `/notes`로 바꿔 설치 후 바로 메모 보드가 열리게 했습니다.
- Docker Android SDK 이미지에서도 `scripts/build_android_apk.sh`를 실행할 수 있도록 SDK 기본 경로와 release 복사 흐름을 보강했습니다.
- 새 APK를 `apps/mobile/android/release/ai-assitant-debug.apk`에 생성하고, Docker 웹에서 받을 수 있도록 `/downloads/ai-assitant-debug.apk` 공개 경로에도 배치합니다.

검증:

- `npm --prefix apps/web run build`
- `scripts/build_android_apk.sh`
- Docker web 재배포 후 `/connect`, `/notes`, `/downloads/ai-assitant-debug.apk` 확인

## 16. 2026-05-24 홈 화면 메모 중심 개편과 APK 갱신

변경 내용:

- `/app` 홈 왼쪽 빠른 액션에서 `연결`을 제거하고 `내 일정`, `메모`, `여행 코스` 3개로 정리했습니다.
- `연결` 액션은 오른쪽 메모 카드 내부의 소형 버튼으로 이동했습니다.
- 오른쪽 기능 카드는 메모를 가장 큰 주 카드로 두고, 일정과 여행 코스는 보조 카드로 배치해 시각적 서열을 만들었습니다.
- 복잡한 노트북 사진 배경과 화면 하단 이미지 출처 텍스트를 제거하고, 밝은 그리드 그라데이션 배경으로 교체했습니다.
- Android WebView 앱 시작 URL을 `/app`으로 맞춰 설치 후 수정된 홈 화면이 열리도록 했습니다.
- 새 APK를 `apps/mobile/android/release/ai-assitant-debug.apk`에 생성하고 `/downloads/ai-assitant-debug.apk` 공개 경로에 다시 배치했습니다.

검증:

- `npm --prefix apps/web run build`
- `docker compose -f docker-compose.dev.yml build web`
- `docker compose -f docker-compose.dev.yml up -d --build api web`
- Docker web `nginx -t`, `/app`, `/manifest.webmanifest`, `/downloads/ai-assitant-debug.apk` 확인
- Docker web에서 API `/api/destinations?size=1` 응답 확인
- Docker Android SDK 이미지에서 `scripts/build_android_apk.sh` 실행
- APK 내부 WebView URL이 `http://192.168.45.101/app`인지 확인

## 8. 2026-05-21 노트와 문서 정리

이번 변경에서는 노트 보드 흐름을 더 가볍게 만들고, 작업 문서를 Docker 기준으로 정리했습니다.

변경 내용:

- `/notes` 보드 선택 화면에서 설명 문구를 제거하고 보드 카드와 `보드 추가`만 남겼습니다.
- Markdown 메모는 기본적으로 미리보기로 보이고, 마우스를 올린 줄만 입력창으로 바뀌게 했습니다.
- 메모 보드와 선택한 메모를 화면에서 바로 삭제할 수 있게 했습니다.
- 세션이 없거나 guest 상태일 때 계정/로그인 버튼이 `/mypage`나 여행 추천 화면으로 우회하지 않고 `/login`으로 이동하게 했습니다.
- `AGENTS.md`를 추가해 Codex가 작업 전에 `docs/NEXT_CHECKLIST_PLAN_KO.md`를 확인하도록 했습니다.
- README와 실행 가이드는 Docker 실행 기준만 남기고, 사용하지 않는 배포 매니페스트 파일을 제거했습니다.
- `admin1`의 메모 보드에 이번 작업 로그가 자동으로 남도록 시드 메모를 추가했습니다.

추가로 확인할 일:

- 모바일에서 `/notes`의 줄 hover 편집이 손가락 터치에서도 충분히 자연스러운지 확인합니다.
- `admin1` 운영 점검 카드가 일반 사용자 메모와 시각적으로 더 구분되어야 하는지 점검합니다.
- 로그인 성공 후 `/mypage` 이동과 guest 계정 버튼의 `/login` 이동을 Docker web에서 한 번 더 확인합니다.
