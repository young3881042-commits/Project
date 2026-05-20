# LocalTrip 다음 작업 체크리스트

## 운영 기준

- 현재 Web은 React + Vite 구조다.
- 공개 루트 `/`는 LocalTrip 여행 일정 화면이 담당한다.
- 분석 Workspace는 `/analysisadmin`에 유지한다.
- 실제 사용 기능은 관리자 배치 파일 보유·실행, AI Trip, 개인 스케줄러, AI 메모 보드다.
- 우선순위는 사용자가 바로 관광지를 찾고 AI 일정을 만들 수 있는 품질이다.
- 자동 루틴은 이 문서에서 위에서부터 첫 번째 미완료 `- [ ]` 항목을 선택해 한 번에 하나씩 처리한다.
- 자동 루틴은 코드 수정 후 Web/API 빌드, Docker 재배포, health check, 커밋, push까지 순차 수행한다.
- 자동 커밋 메시지는 한글로 작성한다.
- 자동 Codex 실행은 `CODEX_MODEL`과 `CODEX_REASONING_EFFORT=high`를 systemd 환경값으로 조정한다.

## 실제 사용 기능과 경로

| 기능 | 경로 | 용도 |
| --- | --- | --- |
| AI Trip | `/destinations`, `/planner`, `/plans`, `/mypage` | 관광지 보기, AI 일정 만들기, 저장 일정 확인 |
| 개인 스케줄러 | `/scheduler` | 할 일, 반복 일정, AI Trip에서 생성된 일정 확인 |
| AI 메모 보드 | `/notes` | 메모 블록, 보드, 파일 저장, 스케줄러 연동 |
| 관리자 배치/파일 실행 | `/analysisadmin` | 관리자용 배치 파일 보유, 업로드, Python 실행, RAG/파일 관리 |

## 자동 실행 큐

- [x] 메인, AI Trip, 개인 스케줄러, AI 메모 보드, 관리자 화면의 바로가기 명칭과 이동 경로를 일관되게 정리한다.
- [x] 메인 화면의 `AI Trip` CTA는 장소 보기(`/destinations`)로, `Scheduler` CTA는 AI 일정 만들기(`/planner`)로 이동하게 정리한다.
- [x] 메인 문구는 "내 여행 일정을 한 번에 정리하세요" 흐름을 유지하되 스케줄러 화면을 더 단순하고 보기 좋게 만든다.
- [x] PC 화면에서 불필요한 큰 공백을 줄이고, 본문 폭과 카드 밀도를 조정한다.
- [x] 모바일 화면에서 상단/하단 내비게이션, CTA, 입력 폼이 화면 밖으로 밀리지 않는지 확인한다.
- [x] 장소 보기에서 추가 데이터가 50개까지만 보이는 원인을 수정한다. 현재 원인은 `/api/destinations` 기본 size가 50이고 프론트가 size를 지정하지 않는 구조로 확인됨.
- [x] 장소 보기에서 전체 장소 수가 50개를 초과해 표시되는지 API 응답과 UI 양쪽에서 확인한다.
- [x] AI 메모 보드는 파일명 대신 메모 제목을 보여주고, 단일 화면에서 작성/미리보기를 전환하며, 더블클릭 시 연결된 파일 편집기로 이동하게 정리한다.
- [ ] 빠른 지역 선택에 한국/일본 지역이 명확히 구분되어 보이는지 점검한다.
- [ ] 일정 생성 중 로딩 상태와 실패 메시지를 사용자가 이해하기 쉽게 정리한다.
- [ ] 생성된 일정 상세에서 시간, 장소, 이동 팁, 식당/카페 추천 메뉴가 한눈에 읽히는지 확인한다.
- [ ] 저장된 일정 목록에서 지역, 기간, 생성일, 대표 취향을 빠르게 비교할 수 있게 보강한다.
- [ ] 모바일 실기기에서 `/planner`, `/plans`, `/plans/{id}` 스크롤과 버튼 위치를 다시 확인한다.

## 일정 생성 품질

- [ ] `TravelPlanService.buildPrompt()`의 요청값이 화면 입력과 빠짐없이 연결되는지 확인한다.
- [x] 일정 생성 프롬프트에 LocalTrip RAG 검색 문맥을 붙인다.
- [ ] GPT/Codex 응답 JSON 파싱 실패 시 사용자에게 재시도 가능한 에러로 내려준다.
- [ ] 식당/카페 보정 후 원래 GPT가 만든 일반명보다 실제 장소명이 우선 저장되는지 테스트한다.
- [ ] 지역별 장소 후보가 부족할 때 같은 지역의 기본 관광지와 검증 장소를 섞는 fallback을 정리한다.
- [ ] 시간대가 겹치거나 너무 비는 일정이 저장되지 않도록 서버 검증을 추가한다.

## 데이터와 RAG

- [ ] `3.rag` 원천 데이터 폴더 구조를 admin1 Workspace에 만든다.
- [x] `localtrip_rag_seed.jsonl` 샘플을 한국/일본 각 5건 이상 작성한다.
- [ ] 지역, 동행, 예산, 취향 메타데이터 필드를 문서 형식으로 고정한다.
- [x] RAG seed를 서버 시작 시 기본 RAG source에 자동 생성하고 인덱싱한다.
- [ ] TourAPI 또는 공개 데이터 수집 스크립트는 요청 간격, 출처, 실패 로그를 남기도록 만든다.

## 관리자 Workspace

- [ ] `/analysisadmin` 접근이 admin1 전용으로 유지되는지 API와 UI 양쪽에서 확인한다.
- [ ] 일반 사용자에게 Workspace 링크가 노출되지 않는지 다시 점검한다.
- [ ] admin1 기본 폴더 `1.국내여행지`, `2.일본여행지`, `3.rag` 생성 스크립트를 준비한다.
- [ ] Python 실행 제한, 로그, 실패 메시지가 분석 작업에 충분한지 확인한다.
- [ ] 파일 업로드와 실행 기능은 관리자 API 차단 정책을 계속 통과해야 한다.

## 배포 검증

- [x] `apps/web`에서 `npm run build`를 실행한다.
- [x] API는 Docker 또는 Gradle 환경에서 Java 컴파일과 `bootJar` 생성을 확인한다.
- [x] `docker compose -f docker-compose.dev.yml build web`로 Web 이미지를 재빌드한다.
- [x] `docker compose -f docker-compose.dev.yml up -d web`로 Web 컨테이너를 재시작한다.
- [x] `http://localhost`에서 Web 응답 `200 OK`를 확인한다.
- [x] `/` 기본 진입과 LocalTrip 내부 홈 클릭이 같은 LocalTrip 화면으로 이어지도록 라우팅을 정리한다.
- [x] 매일 00:00, 06:00, 12:00, 18:00에 체크리스트 자동 루틴을 실행하는 systemd timer를 추가한다.
- [x] README에 자동 작업 루틴 실행 시각, 설치, 상태 확인 명령을 추가한다.
- [ ] Mock 여행지 동기화 API를 호출해 기본 데이터가 다시 들어가는지 확인한다.
- [ ] `/api/travel-plans/generate`로 서울, 경주, 도쿄, 교토 각 1건씩 생성 테스트한다.
- [ ] 실제 배포 주소 `http://192.168.45.101:31088/`에서 화면 동작을 최종 확인한다.

## 자동 루틴 명령

```bash
sudo systemctl status localtrip-checklist-auto.timer
sudo systemctl list-timers localtrip-checklist-auto.timer
sudo journalctl -u localtrip-checklist-auto.service -n 100 --no-pager
```

수동 1회 실행:

```bash
sudo systemctl start localtrip-checklist-auto.service
```

## 검증 로그

- 2026-05-20: 이번 문서를 자동 실행 큐 중심으로 재정리했다.
- 2026-05-20: 바로가기 명칭을 실제 사용 기능 기준으로 정리하고, AI Trip은 `/destinations`, Scheduler는 `/planner`로 연결했다.
- 2026-05-20: 장소 보기 기본 조회를 500개로 늘려 50개 제한을 해소했다.
- 2026-05-20: 자동 Codex 실행은 첫 미완료 큐 항목만 처리하고 `CODEX_REASONING_EFFORT=high`로 실행하도록 수정했다.
- 2026-05-20: AI 메모 보드는 단일 화면 편집/미리보기와 더블클릭 파일 연결 동작으로 정리했다.
- 2026-05-20: `npm --prefix apps/web run build`, `git diff --check`, `docker compose -f docker-compose.dev.yml build web api` 성공.
- 2026-05-20: 검증 포트 `127.0.0.1:18000` Web 응답 `200 OK`, `127.0.0.1:18080/api/destinations?size=500` API 응답 확인.
- 2026-05-19: `apps/web`에서 `npm run build` 성공.
- 2026-05-19: `docker compose -f docker-compose.dev.yml build web` 성공.
- 2026-05-19: `docker compose -f docker-compose.dev.yml up -d web` 성공.
- 2026-05-19: `curl -I http://localhost` 응답 `200 OK` 확인.
- 2026-05-19: `scripts/checklist_auto_check.sh`, `scripts/codex_auto_hunt.sh`, `infra/systemd/localtrip-checklist-auto.timer` 추가.
- 2026-05-19: 자동 루틴 실행 시각은 매일 00:00, 06:00, 12:00, 18:00 UTC다.
- 2026-05-19: 자동 루틴은 `/home/lezzs5103/vibeCoding-auto` worktree에서 작은 작업 1개만 수행하도록 설계했다.
- 2026-05-19: README에 자동 작업 루틴 내용을 추가하고, `/` 기본 진입이 LocalTrip 앱 홈으로 열리도록 수정했다.
- 2026-05-19: 별도 worktree web 의존성 자동 설치, 실패 exit code 전파, GitHub push 사용자 SSH 키 사용, compose 포트 충돌 방지 설정을 추가했다.
- 2026-05-17: `apps/web`에서 `npm run build` 성공.
- 2026-05-17: `docker compose -f docker-compose.dev.yml build api` 성공.
- 2026-05-17: LocalTrip RAG seed와 일정 생성 프롬프트 연결 후 `docker compose -f docker-compose.dev.yml build api` 성공.
