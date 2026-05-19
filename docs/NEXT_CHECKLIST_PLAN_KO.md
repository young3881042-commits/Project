# 다음 작업 체크리스트

## 기준

- 현재 Web은 Next.js가 아니라 React + Vite 구조다.
- 공개 루트 `/`는 LocalTrip AI가 담당한다.
- 기존 분석 Workspace는 `/analysisadmin`에 유지한다.
- 우선순위는 "사용자가 바로 여행 일정을 만들고 확인할 수 있는 품질"이다.
- 2026-05-19 기준 Web Docker는 `vibecoding-web:latest` 로컬 이미지로 재빌드 후 재배포했다.

## 1. LocalTrip 사용자 화면

- [x] 모바일 화면에서 일정 생성 폼, 일정 카드, 출발/도착 체크 영역이 겹치지 않는지 확인한다.
- [x] 모바일 일정 생성의 긴 일자별 동선 입력은 좌우 슬라이드 방식으로 줄인다.
- [x] 모바일 하단 메뉴와 선택 장소/생성 일정 미리보기는 가로 스크롤로 사용할 수 있게 한다.
- [ ] 빠른 지역 선택에 한국/일본 지역이 명확히 구분되어 보이는지 점검한다.
- [ ] 일정 생성 중 로딩 상태와 실패 메시지를 사용자가 이해하기 쉽게 정리한다.
- [ ] 생성된 일정 상세에서 시간, 장소, 이동 팁, 식당/카페 추천 메뉴가 한눈에 읽히는지 확인한다.
- [ ] 저장된 일정 목록에서 지역, 기간, 생성일, 대표 취향을 빠르게 비교할 수 있게 보강한다.
- [ ] 모바일 실기기에서 `/planner`, `/plans`, `/plans/{id}` 스크롤과 버튼 위치를 다시 확인한다.

## 2. 일정 생성 품질

- [ ] `TravelPlanService.buildPrompt()`의 요청값이 화면 입력과 빠짐없이 연결되는지 확인한다.
- [x] 일정 생성 프롬프트에 LocalTrip RAG 검색 문맥을 붙인다.
- [ ] GPT/Codex 응답 JSON 파싱 실패 시 사용자에게 재시도 가능한 에러로 내려준다.
- [ ] 식당/카페 보정 후 원래 GPT가 만든 일반명보다 실제 장소명이 우선 저장되는지 테스트한다.
- [ ] 지역별 장소 후보가 부족할 때 같은 지역의 기본 관광지와 검증 장소를 섞는 fallback을 정리한다.
- [ ] 시간대가 겹치거나 너무 비는 일정이 저장되지 않도록 서버 검증을 추가한다.

## 3. 데이터와 RAG 준비

- [ ] `3.rag` 원천 데이터 폴더 구조를 admin1 Workspace에 만든다.
- [x] `localtrip_rag_seed.jsonl` 샘플을 한국/일본 각 5건 이상 작성한다.
- [ ] 지역, 동행, 예산, 취향 메타데이터 필드를 문서 형식으로 고정한다.
- [x] RAG seed를 서버 시작 시 기본 RAG source에 자동 생성하고 인덱싱한다.
- [ ] TourAPI 또는 공개 데이터 수집 스크립트는 요청 간격, 출처, 실패 로그를 남기도록 만든다.

## 4. 관리자 Workspace

- [ ] `/analysisadmin` 접근이 admin1 전용으로 유지되는지 API와 UI 양쪽에서 확인한다.
- [ ] 일반 사용자에게 Workspace 링크가 노출되지 않는지 다시 점검한다.
- [ ] admin1 기본 폴더 `1.국내여행지`, `2.일본여행지`, `3.rag` 생성 스크립트를 준비한다.
- [ ] Python 실행 제한, 로그, 실패 메시지가 분석 작업에 충분한지 확인한다.
- [ ] 파일 업로드와 실행 기능은 관리자 API 차단 정책을 계속 통과해야 한다.

## 5. 배포와 검증

- [x] `apps/web`에서 `npm run build`를 실행한다.
- [x] API는 Docker 또는 Gradle 환경에서 Java 컴파일과 `bootJar` 생성을 확인한다.
- [x] `docker compose -f docker-compose.dev.yml build web`로 Web 이미지를 재빌드한다.
- [x] `docker compose -f docker-compose.dev.yml up -d web`로 Web 컨테이너를 재시작한다.
- [x] `http://localhost`에서 Web 응답 `200 OK`를 확인한다.
- [x] 6시간마다 별도 worktree에서 Codex가 다음 체크리스트 작업 1개를 자동 수행하고 Web/API 빌드, Docker 재배포, health check, mock sync, 커밋/푸시까지 수행하는 systemd timer를 추가한다.
- [ ] Mock 여행지 동기화 API를 호출해 기본 데이터가 다시 들어가는지 확인한다.
- [ ] `/api/travel-plans/generate`로 서울, 경주, 도쿄, 교토 각 1건씩 생성 테스트한다.
- [ ] 실제 배포 주소 `http://192.168.45.101:31088/`에서 화면 동작을 최종 확인한다.

검증 메모:

- 2026-05-19 `apps/web`에서 `npm run build` 성공.
- 2026-05-19 `docker compose -f docker-compose.dev.yml build web` 성공.
- 2026-05-19 `docker compose -f docker-compose.dev.yml up -d web` 성공.
- 2026-05-19 `curl -I http://localhost` 응답 `200 OK` 확인.
- 2026-05-19 `scripts/checklist_auto_check.sh`, `scripts/codex_auto_hunt.sh`, `infra/systemd/localtrip-checklist-auto.timer` 추가. 기본 주기는 6시간이며 `/home/lezzs5103/vibeCoding-auto` 별도 worktree에서 Codex가 한 번에 작은 작업 1개만 수행한다.
- 2026-05-17 `apps/web`에서 `npm run build` 성공.
- 2026-05-17 `docker compose -f docker-compose.dev.yml build api` 성공.
- 2026-05-17 LocalTrip RAG seed와 일정 생성 프롬프트 연결 후 `docker compose -f docker-compose.dev.yml build api` 성공.

## 6. 추천 진행 순서

1. 모바일 실기기에서 `/planner` 슬라이드 입력과 하단 메뉴 확인
2. `/api/travel-plans/generate` 서울, 경주, 도쿄, 교토 생성 테스트
3. 일정 생성 실패 처리와 JSON 파싱 안정화
4. 식당/카페 실제 장소 보정 테스트 추가
5. admin1 Workspace 기본 폴더와 RAG seed 작성
6. 배포 후 실제 NodePort 주소에서 최종 확인
