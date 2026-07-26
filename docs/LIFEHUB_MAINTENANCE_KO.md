# Orbit LifeHub 유지보수 기준

마지막 갱신: 2026-07-16

이 문서는 같은 요구를 다시 해석하거나 이미 끝난 UI를 되돌리는 일을 막기 위한 현행 기준서다. 작업 전 `AGENTS.md`, 이 문서, `docs/WEB_UI_UX_AUDIT_KO.md`, `git diff` 순서로 읽는다. 오래된 화면 인수인계 문서보다 이 문서의 현재 기준을 우선한다.

## 고정된 제품 방향

- 사용자 표시 이름은 `Orbit`이며 기존 package/APK 파일명은 별도 마이그레이션 전까지 유지한다.
- 기본 진입은 `/app`, 하단 탭은 `홈·일정·메모·운동·식단·가계부` 6개다.
- 홈의 별도 `빠른 기록` 카드는 제거된 상태다. 다시 추가하지 않는다.
- 홈 활동 요약은 `주·월·연·전체`를 같은 카드에서 전환한다.
- 운동 기록에는 시작 시간을 받지 않는다. 종류·운동 시간·날짜 중심으로 유지한다.
- 앱 수정·설치·백업·도움말은 하단 탭이 아니라 상단 설정 버튼의 `/more`에서 연다.
- 큰 정보 구조와 청록색 중심 시각 언어는 유지하고, 일상 입력 횟수와 모바일 조작성을 먼저 개선한다.

## 현재 모듈 경계

새 규칙이나 긴 비동기 흐름을 다시 `LifeHubApp.jsx`나 화면 컴포넌트에 합치지 않는다.

### 홈

- `src/features/home/HomePage.jsx`: 홈 화면 상태와 카드 조립
- `src/features/home/homeActivitySummary.js`: 기간 범위, 반복 일정 확장, 통계 계산
- `src/features/home/homeActivitySummary.test.js`: 주·월·연·전체 계산 단위 테스트
- `src/components/lifehub/LifeHubPackIcon.jsx`: 홈·셸 공용 아이콘
- `src/LifeHubApp.jsx`: 전체 모델과 라우트 조립만 담당하는 방향으로 계속 축소

### Bridge 연결 화면

- `AiPairingPage.jsx`: 화면 조립
- `PairingSecurityNotice.jsx`, `PairedPcList.jsx`: 표시 전용 컴포넌트
- `useAiPairing.js`: 연결·취소·승인 polling·폐기 상태 흐름
- `pairingModel.js`: 개발/배포 endpoint, 권한 목록, 응답·오류 정규화
- `pairingConnection.js`: Bridge 응답을 기존 PC 저장 형식으로 보관
- `bridgeClient.js`: HTTP/native 전송 계약

### 앱 수정 작업 화면

- `/more`의 첫 번째 `앱 수정하기` 행은 `/ai/edit`로 이동한다.
- `AppEditorPage.jsx`는 별도 채팅을 복사하지 않고 `AiAssistantPage`의 `app-edit` 경험을 조립하는 얇은 화면이다.
- `appEditorExperience.js`: 앱 수정 모드의 기본 파일 범위와 테스트·빌드 명령
- `scheduleChatAction.js`: 일정 생성 의도와 한국어 날짜·시간·제목 해석
- `assistantScheduleChange.js`: 중복·재실행을 확인하고 고정 개수 제한 없이 새 항목을 만드는 일정 변경안
- `localScheduleConversation.js`: Bridge를 거치지 않은 일정 대화 기록과 원격 목록 병합
- `appEditorProgress.js`: `todo.updated`, 승인, 명령, 파일 변경, 최종 결과를 순수 상태로 계산
- `AppEditorProgressPanel.jsx`: 실시간 체크리스트, 실제 todo 기반 퍼센트, 결과 개수 표시
- `AiAssistantPage.jsx`: 기존 SSE 대화·승인·재연결을 일반 AI와 앱 수정 화면이 함께 사용
- Android `AppNotificationCoordinator`는 작업 완료 알림의 내부 경로 `/ai/edit`를 허용한다.

퍼센트는 Bridge가 실제 `todo.updated` 목록을 보낸 경우에만 완료 항목 수로 계산한다. todo가 없을 때는 추정 숫자를 만들지 않고 현재 단계와 이벤트 흐름만 표시한다. AI 답변과 작업 상태는 실시간 스트리밍되지만, 실행 중인 같은 thread에 새 요청을 동시에 끼워 넣지는 않는다. 작업 중 다음 문장을 입력해 둘 수 있고 완료 후 전송하는 순차 대화가 현행 계약이다.

### AI 로컬 생활 기록

- `features/life-records/lifeRecordAction.js`: `메모: ...`, 지출, 수입, 운동, 식단의 명시적인 한 줄만 보수적으로 초안으로 변환
- `features/life-records/saveLifeRecordAction.js`: 현재 owner의 메모·가계부·운동·식단 저장소에 종류별로 저장하고 같은 request ID의 재실행만 중복 차단
- `AiAssistantPage.jsx`: 일반 assistant에서 일정 파서를 먼저 실행한 뒤 생활 기록을 미리보기로 보여주고, 사용자가 `저장` 또는 `취소`를 입력해야 다음 단계로 진행
- `bridgeStorage.js`: 로컬 thread의 `pendingLifeRecordRequest`를 종류별 허용 필드만 캐시하고 화면 복귀 때 복원
- `LifeHubApp.jsx`: `onCreateLifeRecord(action, requestId)` prop을 통해 현재 session의 저장 함수를 주입

생활 기록 인식과 저장은 Bridge 연결 여부와 무관하다. 앱 수정 모드와 Codex 모드에서는 생활 기록 파서를 실행하지 않으며, 실패하면 같은 request ID로 다시 `저장`할 수 있도록 미리보기 상태를 유지한다.

### 버전형 백업과 복원

- `features/backup/lifeHubBackupCodec.js`: 제품명·`formatVersion`·생성 시각·owner·컬렉션 수를 가진 JSON 스냅샷 검증과 `merge`/`replace` 계획 계산
- `features/backup/LifeHubBackupPanel.jsx`: 내보내기, 가져오기, 종류별 개수 미리보기, 합치기와 전체 교체의 명시적 선택
- `features/backup/lifeHubBackupRestore.js`: 모든 컬렉션을 먼저 정규화한 뒤 쓰고, 일부 쓰기라도 실패하면 이전 스냅샷 전체를 자동 rollback
- `features/backup/browserBackupDocuments.js`: 브라우저 파일 입력의 strict UTF-8 해석과 실제 ArrayBuffer 8 MiB 상한 재검증
- `features/backup/nativeBackupDocuments.js`: 웹과 Android 문서 선택기 사이의 request ID, 8 MiB 크기, 결과 이벤트 계약
- Android `LifeHubBackupDocumentCoordinator.java`와 `LifeHubBackupDocumentPolicy.java`: Storage Access Framework의 `ACTION_CREATE_DOCUMENT`/`ACTION_OPEN_DOCUMENT`, JSON MIME, 8 MiB 이중 상한, strict UTF-8·JSON, 회전·재생성 상태 복구 경계

백업에는 일정·메모·운동·식단·가계부·여행·신체정보와 브리핑 설정만 넣는다. Bridge 토큰, 승인, 대화, thread 상태는 내보내지 않는다. `merge`는 복원 버튼을 누른 시점의 최신 데이터를 다시 읽어 같은 ID의 백업 항목을 우선하고 나머지 현재 기록을 유지한다. `replace`는 미리보기와 경고 뒤 백업 내용으로 전체 교체한다. 두 방식 모두 신체정보나 브리핑 설정이 달라지면 미리보기에서 별도로 알린다.

### 아침·저녁 브리핑

- `features/automation/dailyBriefing.js`: owner별 설정, 아침·저녁 요약 계산, 향후 알림 계획을 담당하는 순수 모델
- `features/automation/DailyBriefingCard.jsx`: 홈에서 아침·저녁을 전환해 일정·운동·식단·지출 요약을 표시하고 알림의 `?briefing=` 선택을 반영
- `features/automation/DailyBriefingSettings.jsx`: `/more`에서 사용 여부와 시각을 저장하고 알림 권한을 요청
- `LifeHubApp.jsx`: 기존 일정 알림과 브리핑 알림을 합쳐 foreground 복귀와 설정 변경 때 다시 예약

브리핑 카드는 알림 권한 없이도 볼 수 있다. 백그라운드 알림은 사용자가 해당 시간대를 켜고 Android 또는 브라우저 알림 권한을 허용한 경우에만 예약한다. Android APK는 native 예약을 사용해 앱 화면이 닫혀도 전달할 수 있지만, 일반 브라우저의 timer fallback은 페이지 프로세스가 살아 있는 동안만 동작하며 절전 정책에 따라 늦어질 수 있다.

### 로컬 Bridge

- `local-request-policy.ts`: loopback socket·Host·Origin과 proxy header 판정
- `http-server.ts`: HTTP 순서와 route 조립
- `service.ts#connectLocalWebDevice`: 로컬 웹 전용 기기 발급·토큰 회전
- 일반 관리자 인증, 원격 페어링, 기기 인증은 로컬 원클릭 연결과 섞지 않는다.

`LifeHubApp.jsx`, `http-server.ts`, `service.ts`는 아직 크다. 다음 분리는 한 번에 재작성하지 말고 일정 draft/store → 화면, HTTP route 그룹, BridgeService facade 내부 도메인 서비스 순서로 진행한다. 기존 공개 함수와 저장 형식을 유지하면서 단위 테스트를 먼저 만든다.

## 로컬 개발 사용법

```bash
npm --prefix tools/lifehub-bridge run dev
npm --prefix apps/web run dev
```

1. `http://localhost:5173/ai/settings`를 연다.
2. `로컬 Bridge 바로 사용 · 전체 권한`을 한 번 누른다.
3. 같은 PC의 직접 loopback 접속은 6자리 코드와 관리자 승인이 필요 없다.
4. 상단 설정 → `앱 수정하기` 또는 `http://localhost:5173/ai/edit`를 연다.
5. `Orbit` 프로젝트가 선택됐는지 확인하고 평소 말하듯 수정 요청을 보낸다.

Bridge에 프로젝트가 아직 없다면 최초 한 번만 다음 명령으로 등록한다.

```bash
npm --prefix tools/lifehub-bridge run cli -- project add "$(pwd)" Orbit
```

앱 수정 모드는 파일 수정·명령·빌드·Git 네 권한과 선택 프로젝트 전체 범위 `.`을 매 대화에 미리 채운다. `device_local_web`로 연결한 `/ai/edit` 요청은 `localWorkspaceAccess: true`를 매 turn 전송하므로 일반 작업은 별도 승인 대기 없이 실행된다. 프로젝트 밖 경로·외부 심볼릭 링크·MCP/web/network 호출은 계속 차단하고, 삭제·초기화 같은 위험 작업만 마지막 1회 확인을 받는다. 원격 페어링과 일반 Codex 화면은 기존 turn 승인 계약을 유지한다.

로컬 원클릭 연결은 실제 socket peer, Bridge 요청 Host, 웹 Origin이 모두 `localhost`, `127.0.0.1`, `::1` 계열이고 proxy 전달 header가 없을 때만 허용한다. 여기서 발급한 기기에는 전체 기기 권한을 주며, 승인 생략 플래그는 이 기기의 Codex thread이면서 해당 메시지 요청도 같은 직접 loopback 조건을 만족할 때만 받을 수 있다. 위험 작업의 최종 승인 요청도 같은 loopback 조건을 다시 검사한다. LAN·VPN·Android·reverse proxy는 기존 6자리 페어링을 사용한다. `/admin/` 자체는 계속 관리자 인증이 필요하다.

개발 웹을 새로고침하면 브라우저 메모리의 토큰이 사라질 수 있다. 그때 같은 버튼을 다시 누르면 동일한 로컬 기기의 토큰만 회전하고 중복 기기를 만들지 않는다.

## AI 일정 생성 계약

- `일정` 또는 `약속`을 실제로 추가·등록·생성해 달라는 문장은 Bridge에 보내지 않고 현재 LifeHub owner의 `codex-personal-scheduler-items:<owner>`에 직접 저장한다.
- 저장 성공 뒤에만 `일정을 추가했어요`라고 표시한다. 저장 실패와 같은 제목·날짜·시간 중복은 성공으로 말하지 않는다. 일정에는 고정 개수 제한을 두지 않는다.
- 날짜가 없으면 오늘 종일 일정으로 만든다. `3시`처럼 오전·오후가 모호하면 같은 로컬 대화에서 한 번 더 묻는다.
- 오전·오후/제목 재질문 초안은 로컬 대화 캐시에 함께 보관해 화면을 나갔다 돌아와도 이어간다. 일정 저장 자체는 Bridge 연결 없이도 동작한다.
- 인식하지 못한 시간 표기와 `매일·매주·매월·반복` 요청은 오늘 종일 1회 일정으로 조용히 바꾸지 않는다. 반복 조건은 일정 화면에서 설정하도록 안내한다.
- `일정 추가 버튼 고쳐줘`, `일정 추가 기능 수정해줘`, 부정문은 생활 일정으로 오인하지 않고 Codex 요청으로 보낸다.
- 생성 기본값은 반복·알림 없음, `source: ai-chat`, `origin.requestId`이며 동일 요청 재실행을 중복 차단한다.
- 일정 저장은 `LifeHubApp`이 현재 session을 캡처한 콜백에서 기존 `readSchedules`·`normalizeSchedule`·`saveSchedules`를 사용한다. AI 화면에서 owner key를 따로 계산하지 않는다.
- 기존에 실패한 일정 대화의 `다시 시도`를 누르면 새 경로로 실제 저장된다.

## AI 생활 기록 계약

- 지원 입력은 `메모: 여행 준비`, `커피 4500원 지출`, `월급 300만원 수입`, `러닝 30분`, `점심 김밥 650kcal`처럼 종류와 필수 값이 한 줄에 명확한 경우다.
- 첫 메시지는 저장하지 않고 종류별 미리보기만 만든다. 정확히 확인한 사용자가 후속으로 `저장`해야 실제 데이터가 바뀌며 `취소`는 초안을 폐기한다.
- 일정 생성 의도가 함께 보이면 기존 일정 파서가 우선한다. 부정문, 사용법 질문, 앱 기능 수정 요청, 여러 기록이 섞인 문장은 자동 저장하지 않는다.
- 저장 실패는 성공으로 표시하지 않고 pending 초안을 유지한다. 같은 request ID의 재시도만 중복 저장하지 않으며, 새 요청에서 내용이 같은 지출·운동·식단·메모는 실제 반복 기록으로 보존한다. fingerprint는 origin 추적과 입력 정규화 검증에 사용한다.
- thread 전환과 새 대화에서는 현재 pending 상태를 정리하고, 보관된 로컬 thread를 다시 열면 허용 필드만 검증해 복원한다.

## 웹과 APK 확인 방식

- UI 수정 중에는 Vite 웹에서 확인한다. 매번 APK를 풀고 다시 묶지 않는다.
- APK에는 빌드된 정적 웹을 한 번 포함하므로 기기 반영이 필요할 때만 `scripts/build_android_apk.sh`를 실행한다.
- 설치형 웹의 현재 서비스 워커 경계는 `orbit-web-v26`이다. 자동 브리핑·백업 UI 스타일과 새 지연 로딩 모듈을 포함하므로 기능 변경 없이 캐시 번호만 되돌리지 않는다.
- 로컬 원클릭 버튼은 Vite 개발 + loopback 화면에서만 보인다. APK/배포 빌드는 기존 원격 Bridge 페어링을 유지한다.
- Android SDK가 불완전하면 기존 APK를 덮어쓰지 말고 문서에 blocker를 남긴다.

현재 Termux PRoot 경량 SDK에서 웹 빌드를 마친 뒤 APK만 포장할 때는 아래 검증된 명령을 사용한다. 이 SDK에는 Android Lint가 없으므로 Lint만 명시적으로 건너뛰며, Java API 35 컴파일·네이티브 smoke test·서명·APK 민감정보 검사는 계속 실행된다.

```bash
REAL_ROOT=/data/data/com.termux/files/usr/var/lib/proot-distro/containers/ubuntu/rootfs
ANDROID_SDK_ROOT="$REAL_ROOT/root/.android-sdk" \
ANDROID_BUILD_TOOLS_DIR=/root/.android-sdk/build-tools/35.0.1-arm64 \
ANDROID_RESOURCE_JAR=/data/data/com.termux/files/home/android-platform-33/android.jar \
SKIP_WEB_BUILD=1 SKIP_ANDROID_LINT=1 \
bash "$REAL_ROOT/root/Project/scripts/build_android_apk.sh"
```

## 필수 검증

```bash
npm --prefix apps/web test
npm --prefix apps/web run test:lifehub-data
npm --prefix apps/web run build
npm --prefix tools/lifehub-bridge test
npm --prefix tools/lifehub-bridge run build
git diff --check
```

로컬 연결 변경에는 최소한 다음을 직접 검증한다.

- loopback Origin의 `/api/local/connect` 성공
- Origin 누락·외부 Origin·proxy 전달 header 거부
- 재연결 시 기존 토큰 무효화와 기기 ID 유지
- 연결 뒤 `/api/device/status` 등 인증 API의 로컬 CORS 허용
- 관리자 인증과 원격 6자리 페어링 회귀 없음
- 로컬 앱 수정 turn은 승인 이벤트 없이 시작되고 요청한 네 권한을 유지함
- 로컬 모드에서도 프로젝트 밖 경로·외부 도구·검사 불가능한 shell/interpreter가 차단되고, 삭제·위험 명령은 마지막 1회 확인을 받음

일정 대화 변경에는 `테스트로 일정 하나만 등록해줘`, 상대·절대 날짜, 오전·오후 확인, 중복, 고정 한도 없음, 저장 실패, 기능 수정 오인 방지 테스트를 함께 실행한다. 생활 기록 변경에는 다섯 종류의 정상 입력, 부정·혼합 입력 거부, `저장`/`취소`, 같은 request ID 재시도 차단, 별도 request ID의 동일 내용 보존, pending cache 복원을 함께 확인한다. 백업·브리핑 변경에는 codec·merge·replace·rollback·native/browser document adapter·아침/저녁 알림 모델 테스트와 `lifeHubUiStructure.test.mjs`를 실행한다.

## 문서 갱신 규칙

- 완료한 UI/성능 평가는 `WEB_UI_UX_AUDIT_KO.md`에 누적한다.
- 구조를 분리하거나 저장 형식을 바꾸면 이 문서의 모듈 경계를 함께 갱신한다.
- 과거 요청을 보존한 `APP_HANDOFF_KO.md`의 낡은 4탭·빠른 기록 지시를 현행 요구로 오해하지 않는다.
