# Orbit 웹·앱 출시 UI/UX 점검 기록

마지막 갱신: 2026-07-16

이 문서는 같은 화면을 매번 처음부터 다시 분석하지 않기 위한 기준서다. 다음 작업자는 먼저 이 문서와 `git diff`를 읽고 이미 끝난 항목은 재작업하지 않는다.

## 제품 방향

- 목표: 일정, 메모, 운동, 식단, 가계부를 매일 부담 없이 기록하는 생활 앱
- 유지할 큰 틀: 홈 월간 캘린더, 기능별 화면, 하단 6개 탭, 로컬 저장 중심 구조
- 우선순위: 빠른 입력, 명확한 저장 상태, 모바일 한 손 사용, 데이터 신뢰
- 비목표: 정보 구조 전면 개편, 브랜드 컬러 교체, 핵심 기능 삭제

## 분야별 점수

| 분야 | 초기 | 현재 | 현재 판단 |
| --- | ---: | ---: | --- |
| 핵심 기능 완성도 | 8.0 | 8.4 | 핵심 생활 기록, 버전형 복원, 브리핑과 로컬 Bridge 앱 수정 흐름을 실제 연결했다. |
| 일상 입력 속도 | 6.8 | 7.5 | 6개 기능 탭을 유지하면서 AI의 명시적인 한 줄 기록 경로를 더했다. |
| 정보 구조·탐색 | 7.6 | 8.6 | 6개 핵심 탭은 유지하고 앱 수정·설치·백업은 설정으로 분리했다. |
| 모바일 조작성 | 7.5 | 8.2 | 하단 아이콘과 행간, 활동 요약 기간 선택의 터치 영역을 보강했다. |
| 시각 일관성 | 7.3 | 8.1 | 배포 CSS를 LifeHub 전용으로 좁혀 구형 화면 규칙의 충돌 가능성을 줄였다. |
| 접근성 | 8.3 | 8.6 | 전역 포커스, ARIA, 키보드 달력, 모션 감소, 로딩 상태를 유지·추가했다. |
| 피드백·오류 복구 | 7.2 | 8.3 | 저장 실패 복구와 함께 AI 승인·명령·파일·결과 상태를 실시간으로 확인할 수 있다. |
| 데이터 신뢰·개인정보 | 7.8 | 8.4 | 버전형 JSON 백업, 복원 미리보기, 합치기·교체와 실패 rollback을 실제 연결했다. |
| 성능·안정성 | 7.7 | 9.2 | 레거시 번들을 제외하고 무거운 기능을 지연 로딩해 초기 JS와 전체 자산을 크게 줄였다. |
| PWA·로컬 APK 준비 | 7.5 | 8.7 | 경량 공개 자산, v26 캐시, manifest, 오프라인 셸과 Android SAF 백업 경계가 있다. |
| 종합 | **7.6** | **8.7** | 개인용 로컬 앱으로 충분히 사용 가능. 실제 기기 회귀 테스트 후 고정 권장. |

현재 점수는 코드와 자동검증 기준이다. 실제 기기 점검을 통과하면 최종 점수로 확정한다.

## 반영한 변경

### 홈 활동 요약 기간

- 별도 `빠른 기록` 카드는 제거
- 기존 활동 요약 카드에 `주·월·연·전체` 기간 선택 추가
- 완료 일정, 운동 기록, 섭취 합계, 지출 합계를 선택 기간에 맞춰 계산
- 월·연 통계는 주간 합산이 아니라 원본 기록 날짜를 기준으로 계산

### 하단 내비게이션

- 기존 6개 탭과 정보 구조는 유지
- 아이콘을 22px로 키우고 라벨 행간을 고정

### 운동 기록 단순화

- 시작 시간 입력을 제거하고 운동 종류·운동 시간·날짜만으로 저장
- 일정에 함께 등록할 때 임의의 `20:00`을 넣지 않고 종일 완료 기록으로 저장
- 기존 기록의 `startTime` 필드는 읽기 호환성을 위해 데이터 정규화에만 유지

### 설치·백업 진입점 복구

- 구현되어 있었지만 라우터에서 홈으로 되돌려 보내던 `/more` 화면을 정상 연결
- 모든 주요 화면 상단에 44px 설정 버튼을 추가
- 설치 상태, 로컬 저장 안내, 데이터 JSON 백업·복원, 도움말에 실제로 접근 가능
- 백업 파일을 먼저 검증하고 컬렉션별 결과 개수를 보여준 뒤 `합치기` 또는 `전체 교체`를 선택
- 복원 중 일부 저장이 실패하면 작업 전 스냅샷으로 자동 rollback하고, Android는 Storage Access Framework 문서 선택기를 사용
- 하단 6개 핵심 기록 탭은 유지해 기존 사용 습관을 바꾸지 않음

### 로컬 Bridge 개발 연결

- Vite 개발 화면은 별도 설정 없이 `http://127.0.0.1:4317` Bridge를 사용
- 같은 PC의 loopback 웹에서는 `로컬 Bridge 바로 사용` 버튼 한 번으로 코드·관리자 승인 없이 연결
- 로컬 자동 연결은 socket·Host·Origin이 모두 loopback이고 proxy header가 없는 경우로 제한
- 연결 기기에는 전체 권한을 부여하고 `/ai/edit` 일반 작업은 승인 대기를 생략하되, 선택 프로젝트 경계는 유지하고 삭제·위험 작업만 마지막 확인
- 관리자 화면과 원격 접속은 기존 인증·6자리 페어링을 유지
- APK 프로덕션 빌드는 기존 고정 HTTPS Bridge를 유지
- 필요하면 `VITE_LIFEHUB_BRIDGE_ADDRESS`와 `VITE_LIFEHUB_BRIDGE_PORT`로 개발 주소를 명시 가능

### 대화형 앱 수정 작업 화면

- 설정의 첫 행에 `앱 수정하기`를 추가하고 `/ai/edit` 전용 화면으로 연결
- 기존 Codex SSE·승인·이어받기 로직을 그대로 공유해 새 채팅 구현을 복제하지 않음
- 데스크톱은 채팅과 실시간 진행·결과 보드를 2열로, 좁은 화면은 1열로 표시
- Bridge의 `todo.updated`가 있으면 실제 완료 개수로 퍼센트를 계산하고, 없으면 추정 퍼센트 대신 현재 단계만 표시
- 승인 대기, 실행 중 명령, 변경 파일, 명령 성공·실패 수, 최종 결과를 같은 보드에서 갱신
- 앱 수정 모드는 선택 프로젝트 전체와 기본 테스트·빌드 범위를 미리 채운다. 로컬 일반 작업은 승인 대기를 생략하고 경로 검사는 유지하며, 삭제·초기화 같은 위험 작업만 마지막 1회 확인한다.
- 답변과 작업 이벤트는 실시간이며, 실행 도중 추가 메시지는 작성만 해두고 현재 turn 완료 후 순서대로 전송

### AI 한 줄 생활 기록

- 일반 AI에 `메모: ...`, 지출, 수입, 운동 시간, 식사 열량처럼 의도가 명확한 한 줄 입력을 추가
- 일정 생성 파서를 먼저 실행하고 생활 기록은 Bridge 연결 확인보다 먼저 처리해 오프라인에서도 동작
- 첫 입력에서는 메모·가계부·운동·식단 미리보기만 보여주고 후속 `저장` 또는 `취소`를 받아 2단계로 확정
- 같은 request ID의 재실행만 중복 차단하고 정규화 fingerprint는 origin 추적에 남겨, 새 요청의 동일한 실제 지출·운동·식사는 각각 보존. 저장 실패 때 pending 초안을 유지해 같은 요청을 안전하게 재시도
- 앱 수정/Codex 대화와 모호한 문장은 로컬 기록으로 오인하지 않음

### 아침·저녁 브리핑과 알림

- 홈 인사말 다음에 아침·저녁 전환이 가능한 브리핑 카드를 배치하고 기존 월 캘린더·활동 요약 순서를 유지
- 아침에는 오늘·놓친 일정과 월 지출, 저녁에는 완료 일정·운동·식단·오늘 지출을 요약
- `/more`에서 시간대별 사용 여부와 시각을 owner별로 저장
- 기존 일정 알림과 브리핑 알림을 가장 이른 시각순으로 함께 예약하고 foreground 복귀 때 재동기화
- 알림의 `?briefing=morning|evening`을 홈 카드 선택에 반영
- 브리핑 카드는 권한 없이 볼 수 있으며, 예약 알림은 사용자가 별도로 허용한 경우에만 사용

### 버전형 로컬 백업과 Android SAF

- `formatVersion`이 있는 LifeHub JSON만 정규화하고, Bridge token·승인·대화·thread 상태는 백업에서 거부
- 같은 ID의 백업 항목이 우선하는 `merge`와 백업 내용만 남기는 `replace`를 복원 전 개수로 비교하고, 신체정보·브리핑 설정 변경도 별도 경고
- 모든 데이터를 먼저 검증하고 쓰기 실패 시 이전 스냅샷 전체를 되돌려 부분 복원을 피함
- 복원 확정 직전 최신 저장소를 다시 읽어 외부에서 추가된 기록을 merge가 누락하지 않게 함
- 웹과 Android 모두 strict UTF-8·JSON 객체와 8 MiB 단일 상한을 검증. Android 내보내기·가져오기는 `ACTION_CREATE_DOCUMENT`/`ACTION_OPEN_DOCUMENT`와 `application/json` MIME을 사용하는 SAF 흐름으로 분리
- 복원 미리보기에 live announcement와 포커스 이동을 연결하고 주요 버튼 44px, 보조 글자 AA 대비를 적용

### 유지보수 구조 분리

- 홈 화면과 기간 통계 계산을 `features/home`의 화면·순수 모델로 분리
- AI 연결 화면을 표시 컴포넌트, 상태 훅, 설정/오류 모델, 저장 변환으로 분리
- Bridge의 로컬 신뢰 판정을 `local-request-policy.ts`로 분리해 일반 관리자 인증과 섞이지 않게 함
- 생활 기록의 파싱과 실제 저장을 `features/life-records`로 분리하고 AI 화면에는 2단계 대화 상태만 유지
- 백업 codec·복원 transaction·native document adapter·패널을 `features/backup`으로 분리
- 브리핑 계산·설정·카드를 `features/automation`으로 분리하고 일정 알림 예약과 조립
- 새 데이터 모듈 단위 테스트는 `test:lifehub-data`, 화면·prop·SAF·6탭 회귀는 `lifeHubUiStructure.test.mjs`에서 검증
- 다음 작업 기준과 검증 순서를 `LIFEHUB_MAINTENANCE_KO.md`에 기록

## 변경 파일

- `apps/web/src/features/home/HomePage.jsx`: 홈 활동 요약 기간 전환 UI
- `apps/web/src/features/home/homeActivitySummary.js`: 주·월·연·전체 통계 계산
- `apps/web/src/features/lifehub-ai/*Pairing*`, `useAiPairing.js`: 연결 UI와 상태 흐름 분리
- `apps/web/src/features/lifehub-ai/AppEditorPage.jsx`, `appEditorExperience.js`: 앱 수정 전용 진입과 반복 승인 범위 기본값
- `apps/web/src/features/lifehub-ai/appEditorProgress.js`, `AppEditorProgressPanel.jsx`: 실시간 진행 계산과 결과 보드
- `apps/web/src/features/life-records/lifeRecordAction.js`, `saveLifeRecordAction.js`: 한 줄 기록 파싱, 종류별 저장과 중복 방지
- `apps/web/src/features/backup/*`: 버전형 codec, merge/replace 계획, rollback 복원, 웹·Android 문서 adapter와 패널
- `apps/web/src/features/automation/*`: 아침·저녁 브리핑 모델, 홈 카드와 설정
- `apps/mobile/android/src/com/platform/aiassitant/LifeHubBackupDocumentCoordinator.java`, `LifeHubBackupDocumentPolicy.java`: Android SAF 백업 경계
- `tools/lifehub-bridge/src/local-request-policy.ts`: 로컬 원클릭 연결 신뢰 경계
- `apps/web/src/styles/lifehub-reference.css`: 하단 탭 보정
- `apps/web/src/styles/lifehub-ai.css`: 상단 데이터 관리 버튼이 마지막 CSS에서도 2열을 유지하도록 보정
- `apps/web/src/routes/AppRouter.jsx`: `/more` 접근 복구
- `apps/web/tests/lifeHubUiStructure.test.mjs`: 6개 핵심 탭·빠른 기록 미복귀, 새 prop·패널·브리핑·SAF·v26 경계를 함께 검증
- `docs/WEB_UI_UX_AUDIT_KO.md`: 분야별 평가, 변경, 검증, 후속 기준

## 다음 작업 전 확인 순서

1. 이 문서의 완료 항목과 `git diff`를 먼저 확인한다.
2. `apps/web/src/styles.css`의 import 순서를 확인한다. 뒤 CSS가 앞 규칙을 덮어쓸 수 있다.
3. `/app`, `/schedule`, `/memo`, `/workout`, `/diet`, `/finance`를 360px과 430px 너비에서 확인한다.
4. 새 기능보다 기존 입력의 탭 수, 날짜 재입력, 저장 피드백을 먼저 줄인다.
5. 큰 틀 변경은 제품 방향과 충돌 여부를 사용자에게 먼저 알린다.

## 출시 전 남은 필수 점검

- Android 실제 기기에서 키보드가 열린 상태의 입력·저장·하단 탭 확인
- 앱 업데이트 후 기존 로컬 데이터 유지 확인
- 비행기 모드 재실행과 오프라인 기본 화면 확인
- 알림 권한 거절·재허용 및 정확한 알람 권한 흐름 확인
- 식단 사진 권한 거절·대용량 이미지·분석 실패 흐름 확인
- TalkBack 또는 VoiceOver로 홈부터 일정 저장까지 1회 완주

## 성능 메모

아래 값은 2026-07-16 v26 최종 production build 기준이다.

- 프로덕션 빌드는 성공하며 대형 청크 경고가 사라졌다.
- 변환 모듈: 1,245개 → 348개
- 공용 CSS: 706.97kB(gzip 116.22kB) → 151.05kB(gzip 26.67kB)
- 초기 JS: 518.22kB(gzip 165.26kB) → 310.05kB(gzip 100.96kB)
- 최종 `dist` 웹 파일 합계: 794,703바이트(디스크 사용량 815KiB). 기존 약 8.8MB 대비 약 91% 작음
- AI·앱 수정 227.31kB(gzip 72.54kB), 식단 23.70kB, 메모 17.02kB, AI 연결 12.97kB는 해당 화면을 열 때만 로드한다.

### 로컬 개인용 경량 빌드

- `main.jsx`는 전체 레거시 `styles.css` 대신 `lifehub-entry.css`만 불러온다.
- 구형 워크스페이스 CSS 파일은 삭제하지 않고 소스에 보존하되 APK 빌드에서는 제외한다.
- LifeHub, 일정, 일일 메모, 운동, 식단, AI, 신체정보, 홈 캘린더에 필요한 CSS만 포함한다.
- 앱 사용 중에는 APK를 풀고 다시 묶지 않는다. 웹 개발은 브라우저에서 확인하고, 기기에 반영할 때 `build_android_apk.sh`로 웹 빌드와 APK 생성을 한 번 수행한다.
- 구형 워크스페이스 라우트는 `/app`으로 보내고 배포 라우터에서 import하지 않는다. 소스 파일은 보존되지만 BlockNote, CodeEditor, 구형 스케줄러 자산은 APK에 포함되지 않는다.
- 일일 메모, 식단, AI, AI 연결 화면은 탭을 열 때만 로드해 홈 첫 실행의 JS 파싱과 메모리 부담을 줄인다.
- Vite 프로덕션 빌드는 `public` 전체를 복사하지 않고 실제 앱이 쓰는 6개 파일만 포함한다. 약 4.6MB의 구형 로봇·여행·홈 PNG는 소스에 남고 APK에서는 빠진다.
- 서비스 워커 캐시는 AI 생활 기록, 브리핑, 백업·복원 모듈과 전용 스타일 경계를 반영해 `orbit-web-v26`으로 갱신한다.

## 검증 기록

- 웹 전체 테스트 203/203 통과. 그중 `test:lifehub-data` 45/45, LifeHub 구조·모바일·브랜드 40/40, LifeHub AI 61/61 통과
- Vite production build 348 modules 통과. 초기 JS 310.05kB(gzip 100.96kB), CSS 151.05kB(gzip 26.67kB), `dist` 794,703바이트
- Bridge 테스트 66개 중 65개 통과, opt-in 공식 SDK 실연동 1개 제외, 실패 0. TypeScript build 통과
- Android Java/API compile, SAF static/native smoke test, v1/v2/v3 서명, source·manifest·DEX·credential 검사 통과. 경량 SDK에 Android Lint가 없어 명시적으로 제외
- APK: `apps/mobile/android/release/ai-assitant-debug.apk`, `0.5.2-debug` (`versionCode 18`), 305,021바이트, SHA-256 `b3e0a8764983c597bf34561b1d626a2f2a61f2cadf8c88499460af8febd40fd4`
- `git diff --check` 통과. 실제 기기 오프라인·알림·백업 왕복·merge/replace/rollback은 이번 환경에서 미실행
