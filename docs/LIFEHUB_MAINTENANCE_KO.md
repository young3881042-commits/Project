# Orbit LifeHub 유지보수 기준

마지막 갱신: 2026-08-19

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

### 현재 비활성인 AI 기능

- 음식 사진 AI 분석, AI 대화, 앱 수정, PC 페어링과 Bridge 연결은 현재 제품에서 제공하지 않는다. 홈·식단·더보기에는 해당 진입점을 두지 않는다.
- `/ai`, `/ai/edit`, `/ai/settings`는 오래된 링크 호환을 위해 `/app`으로 돌려보내며, Android 알림도 이 경로를 허용하지 않는다.
- 식단은 음식명·칼로리·영양값을 직접 입력하는 흐름만 제공한다. WebView 이미지 파일 선택 capability도 제거하고 JSON 백업 선택기만 유지한다.
- Android APK에는 Bridge HTTP/SSE proxy, token store, network-status API, 음식 분석 endpoint가 포함되면 안 된다. cleartext traffic도 허용하지 않는다.
- `features/lifehub-ai`와 `features/life-records` 아래 일부 과거 순수 모듈은 향후 판단을 위해 저장소에 남을 수 있지만 현행 route에서 import하거나 production bundle에 포함하지 않는다.
- 명시적인 새 제품 요구 없이 이 기능이나 홈 카드를 다시 켜지 않는다.

### 결제 알림 가져오기

- Android `NotificationListenerService`는 사용자가 시스템의 알림 접근을 직접 허용한 뒤에만 동작한다. 이 권한은 전체 알림을 볼 수 있는 넓은 특수 접근임을 가계부 화면에서 먼저 고지한다.
- 허용 소스와 exact package는 `samsung-wallet`=`com.samsung.android.spay`, `kakao-pay`=`com.kakaopay.app` 두 가지다. 사용자가 고른 소스만 본문을 읽으며, 카카오톡·토스·은행·문자 등 다른 앱은 해석 전에 버린다.
- 소스별 결제·승인 문구와 명확한 원화 금액이 있는 새 알림만 후보로 만들고, 입금·출금·송금·이체·충전·잔액·취소·환불·거절·실패·적립·광고는 제외한다.
- 선택 소스 집합은 native private preferences에 보관한다. 이전 `collection-enabled=true` 설치는 삼성월렛 하나를 선택한 것으로 마이그레이션하며, 소스를 끄면 그 소스의 미처리 대기열도 제거한다.
- native private queue에는 owner hash, opaque event ID, 금액, 정제한 사용처, 시각만 보관한다. 알림 원문, 카드·계좌번호, 잔액은 저장·로그·WebView 전달·네트워크 전송하지 않는다.
- `features/finance/nativeCardTransactions.js`는 native 응답을 fail-closed로 검증하고, `cardTransactionImport.js`는 앱 실행·foreground 복귀 때 `peek → 가계부 저장 성공 → ack` 순서를 지킨다. 저장 실패 시 ack하지 않고, 이미 저장한 event ID는 재저장 없이 ack한다.
- 알림 접근을 허용하기 전 과거 내역은 가져오지 못한다. 삼성월렛·카카오페이 알림 문구 변경이나 Android의 민감 정보 가림 때문에 파싱하지 못한 결제는 기존 수동 입력으로 보완한다.

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

## 로컬 개발 사용법

```bash
npm --prefix apps/web run dev
```

브라우저에서 `http://127.0.0.1:5173/app`을 열어 홈·일정·메모·운동·식단·가계부와 `/more`를 확인한다. `/ai`, `/ai/edit`, `/ai/settings`는 `/app`으로 돌아와야 하며 음식 사진 입력이나 Bridge 연결 버튼이 나타나면 회귀다.

## 웹과 APK 확인 방식

- UI 수정 중에는 Vite 웹에서 확인한다. 매번 APK를 풀고 다시 묶지 않는다.
- APK에는 빌드된 정적 웹을 한 번 포함하므로 기기 반영이 필요할 때만 `scripts/build_android_apk.sh`를 실행한다.
- 설치형 웹의 현재 서비스 워커 경계는 `orbit-web-v28`이다. 카카오페이 소스 선택과 AI 진입점 제거를 포함하므로 기능 변경 없이 캐시 번호만 되돌리지 않는다.
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
