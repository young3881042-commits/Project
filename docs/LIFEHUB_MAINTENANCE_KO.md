# Orbit LifeHub 유지보수 기준

마지막 갱신: 2026-08-23

이 문서는 같은 요구를 다시 해석하거나 이미 끝난 UI를 되돌리는 일을 막기 위한 현행 기준서다. 작업 전 `AGENTS.md`, 이 문서, `docs/WEB_UI_UX_AUDIT_KO.md`, `git diff` 순서로 읽는다. 오래된 화면 인수인계 문서보다 이 문서의 현재 기준을 우선한다.

## 2026-08-23 세션 인수인계

- 완료 범위: 운동·식단 제외와 4탭 구조를 유지한 채, 월별 정기 결제, 가계부 JSON/CSV 일회성 공유·새 거래 가져오기, 일정 예정 목록의 날짜·시간 표시, 일반 텍스트 메모, 폴더 사이드바/모바일 서랍, 1,040px 본문·하단 너비, v35 캐시와 `0.5.9-debug` APK까지 반영한다.
- 일정 상태: 완료하지 않은 지난 날짜는 `미완료`, 오늘 시간이 지난 일정도 `미완료`, 오늘 종일 일정은 날이 끝나기 전까지 `예정`으로 두며 1분마다 화면 상태를 갱신한다. 홈 달력과 아침 브리핑도 같은 표현을 쓴다. 일정 화면의 `예정` 필터는 레일에 날짜와 시간을 함께 표시하고 설명 줄의 날짜 중복은 제거한다.
- 메모 폴더: 기본 `개인·여행`과 사용자 폴더를 owner별 `codex-ai-note-boards` 호환 키에 보존한다. 삭제한 폴더의 메모는 자동 삭제하지 않고 `개인`으로 이동하며, 중복 ID·부모 순환·없어진 예전 폴더를 읽기 시 복구한다.
- 일반 텍스트 메모: Markdown 툴바, `/` 명령, 작성·미리보기 전환과 Markdown 렌더러를 제거했다. 작성란 하나와 `Ctrl/Command+Enter` 저장만 유지하며 카드·이전 rich 메모 사본도 HTML 해석 없이 일반 텍스트로 표시한다. 저장된 기존 본문은 자동 변환하거나 삭제하지 않는다.
- 정기 결제: 이름·금액·결제일/말일·카테고리·시작월·선택 종료월·자동 반영·사용 상태를 owner별 로컬 규칙으로 저장한다. 29~31일이 없는 달은 말일로 보정하고, 예정액과 실제 거래를 분리하며 규칙·월 고정 ID와 처리월 이력으로 중복 및 사용자가 삭제한 거래의 자동 재생성을 막는다.
- 결제 충돌 경계: 카드 알림 가져오기가 켜져 있으면 새 규칙의 자동 반영 기본값을 끄고, 둘을 함께 켤 때 중복 가능성을 안내한다. 규칙 수정·삭제는 이미 기록한 가계부 거래를 바꾸거나 삭제하지 않는다.
- 가계부 파일 공유: 월간·전체·직접 선택 기간을 일회성 사본으로 만든다. Orbit용 JSON은 가져오기 전 새 거래/중복/수입/지출을 보여주고 기존 거래를 덮지 않으며, CSV는 보기 전용이다. 메모는 기본 제외하고 카드 알림 ID·owner·native 원본은 넣지 않는다. Android는 별도 Bluetooth 권한 없이 시스템 공유 창을 사용하고, private cache의 24시간 한시 파일을 비공개 Provider로 읽기만 허용한다.
- 가계부 목록: 최근 8건을 먼저 표시하고 20건씩 더 볼 수 있어 기록이 많아져도 첫 화면 길이가 과도하게 늘어나지 않는다.
- 백업: 새 백업은 `formatVersion: 2`로 정기 결제 규칙까지 포함한다. canonical v1과 legacy 백업은 정기 결제 빈 목록을 보완해 v2로 승격한 뒤 기존 검증·merge·replace·rollback 흐름을 그대로 사용한다.
- 성능: 76 modules, CSS 103.79kB(gzip 17.86kB), 초기 JS 323.10kB(gzip 104.69kB), 메모 지연 청크 28.66kB(gzip 10.04kB), `dist` 497,184바이트다.
- 자동검증: 웹 234/234, production build, Android compile/native smoke/security scan, 결제 알림·grant-only 파일 공유 경계, APK 민감정보 검사와 v1/v2/v3 서명이 통과했다. Android Lint만 현재 경량 SDK 부재로 제외했다.
- 산출물: `apps/mobile/android/release/ai-assitant-debug.apk`, 214,475바이트, SHA-256 `9f38a29623caa2367a61f69f73d65a9e0d580dc708bb3f59ad3b079806e54538`
- 시간이 걸린 이유: 공유 파일의 공개 필드를 별도 스키마로 고정하고 재공유까지 중복 안전하게 만든 뒤, 브라우저·Web Share·Android URI 권한·APK manifest/DEX 경계를 각각 검증했기 때문이다. 같은 범위를 다시 처음부터 분석하지 않는다.
- 검증 참고: 자동검증에는 실제 두 기기 간 Bluetooth/Quick Share 전송과 받은 파일 왕복, 기존 설치 업데이트가 포함되지 않았다. APK 안의 공유 경계와 서명은 통과했지만 실제 기기 확인 전에는 전송 완료로 간주하지 않는다.

## 고정된 제품 방향

- 사용자 표시 이름은 `Orbit`이며 기존 package/APK 파일명은 별도 마이그레이션 전까지 유지한다.
- 기본 진입은 `/app`, 하단 탭은 `홈·일정·메모·가계부` 4개다.
- 홈의 별도 `빠른 기록` 카드는 제거된 상태다. 다시 추가하지 않는다.
- 홈 활동 요약은 일정 완료와 지출을 대상으로 `주·월·연·전체`를 같은 카드에서 전환한다.
- 운동·식단 기록 기능은 제품 범위에서 제외한다. `/workout`, `/diet`는 `/app`으로 돌려보내고 기존 로컬 기록은 자동 삭제하지 않는다.
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
- `src/styles/lifehub-home.css`: 현행 홈 요약과 더보기의 로컬 저장 안내만 포함하는 production 스타일. 보관된 `lifehub-ai.css`를 앱 진입점에 다시 연결하지 않는다.

### 메모

- `components/notes/daily/DailyMemoPage.jsx`: owner별 메모·폴더 상태를 조립하고 생성·이름 변경·삭제·메모 이동의 저장 성공 후 UI를 갱신
- `components/notes/daily/DailyMemoFolders.jsx`: 데스크톱 좌측 사이드바, 모바일 포커스 트랩 서랍, 폴더 트리·작업 메뉴
- `components/notes/daily/DailyMemoComposer.jsx`: 일반 텍스트 작성란, 접힌 폴더·제목·태그, `Ctrl/Command+Enter` 저장
- `components/notes/daily/DailyMemoCard.jsx`: 제목·본문 요약·날짜를 먼저 표시하고 편집·고정·폴더 이동·삭제를 하나의 작업 메뉴에서 제공
- `components/notes/daily/DailyMemoReader.jsx`: 이전 rich/연결 메모의 포커스 트랩이 있는 원본 보호 읽기와 비파괴 텍스트 사본 진입
- `components/notes/daily/dailyMemoModel.js`: 기존 본문과 폴더 호환 필드를 보존하고 표시 제목을 평문으로 파생하며, 폴더 중복·순환·누락을 읽기 시 수선한다.

### 현재 비활성인 기능

- 운동·식단, 음식 사진 AI 분석, AI 대화, 앱 수정, PC 페어링과 Bridge 연결은 현재 제품에서 제공하지 않는다. 홈·하단 메뉴·더보기에는 해당 진입점을 두지 않는다.
- `/workout`, `/diet`, `/ai`, `/ai/edit`, `/ai/settings`는 오래된 링크 호환을 위해 `/app`으로 돌려보내며, Android 알림도 이 경로를 허용하지 않는다.
- WebView 이미지 파일 선택 capability는 제거된 상태이며 백업·가계부 가져오기용 JSON 문서 선택기만 유지한다.
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

### 정기 결제

- `features/finance/recurringPayments.js`: owner별 저장, 규칙 정규화, 월말 날짜 보정, 현재월 발생, 고정 거래 ID, 처리월 이력과 자동·수동 반영을 담당하는 순수 모델
- `features/finance/RecurringPaymentsPanel.jsx`: 월간 지갑 바로 아래의 예정/실제 요약, 데스크톱 대화상자·모바일 bottom sheet, 규칙 생성·수정·삭제와 이번 달 수동 반영
- `styles/lifehub-finance.css`: 44px 조작 영역, 440px 단일열 폼, 699px 이하 bottom sheet와 전체 너비 관리 버튼

자동 반영은 앱을 연 시점에 현재 달의 결제일이 지난 규칙만 처리한다. 같은 규칙·월은 최대 한 건이며 다음 달부터 새로 발생한다. 카드 알림 자동 가져오기와 함께 사용할 수는 있지만 같은 결제를 두 경로에서 생성할 수 있으므로 한쪽 자동화만 켜는 것이 기본이다.

### 가계부 파일 공유

- `features/finance/financeShare.js`: `OrbitFinance` v1 공개 스키마, 기간·날짜·금액·문자열 검증, 안정된 공유 ID, CSV 직렬화와 add-only 중복 계획
- `features/finance/financeShareDocuments.js`: JSON/CSV MIME·파일명·strict UTF-8·실제 8 MiB 상한, Android native → Web Share → 다운로드 fallback
- `features/finance/FinanceSharePanel.jsx`: 기간·메모 선택, 전송 합계, JSON/CSV 공유, 받은 JSON의 새 거래/중복/수입/지출 미리보기
- Android `FinanceShareCoordinator.java`, `FinanceShareFileProvider.java`, `FinanceSharePolicy.java`: 신뢰 origin 확인, private cache, 무작위 URI token, 비공개·읽기 전용 Provider와 24시간 정리

공유는 계정·동기화 기능이 아니라 시점이 고정된 파일 복사다. 이후 수정은 상대에게 전달되지 않는다. JSON 가져오기는 기존 항목을 삭제·수정하지 않으며 공유 ID가 없는 새 항목만 저장한다. CSV는 다시 가져올 수 없다. Android는 `ACTION_SEND` chooser만 열고 주변 기기를 직접 검색하지 않으므로 Bluetooth 권한을 manifest에 추가하지 않는다.

### 버전형 백업과 복원

- `features/backup/lifeHubBackupCodec.js`: 제품명·`formatVersion`·생성 시각·owner·컬렉션 수를 가진 JSON 스냅샷 검증과 `merge`/`replace` 계획 계산
- `features/backup/LifeHubBackupPanel.jsx`: 내보내기, 가져오기, 종류별 개수 미리보기, 합치기와 전체 교체의 명시적 선택
- `features/backup/lifeHubBackupRestore.js`: 모든 컬렉션을 먼저 정규화한 뒤 쓰고, 일부 쓰기라도 실패하면 이전 스냅샷 전체를 자동 rollback
- `features/backup/browserBackupDocuments.js`: 브라우저 파일 입력의 strict UTF-8 해석과 실제 ArrayBuffer 8 MiB 상한 재검증
- `features/backup/nativeBackupDocuments.js`: 웹과 Android 문서 선택기 사이의 request ID, 8 MiB 크기, 결과 이벤트 계약
- Android `LifeHubBackupDocumentCoordinator.java`와 `LifeHubBackupDocumentPolicy.java`: Storage Access Framework의 `ACTION_CREATE_DOCUMENT`/`ACTION_OPEN_DOCUMENT`, JSON MIME, 8 MiB 이중 상한, strict UTF-8·JSON, 회전·재생성 상태 복구 경계

백업 화면에는 일정·메모·가계부·정기 결제·여행과 브리핑 설정을 표시한다. 기존 백업과 로컬 기록의 호환을 위해 운동·식단·신체정보 필드는 v2 JSON 스키마 안에서도 보존하지만 앱 화면에는 노출하지 않는다. Bridge 토큰, 승인, 대화, thread 상태는 내보내지 않는다. `merge`는 복원 버튼을 누른 시점의 최신 데이터를 다시 읽어 같은 ID의 백업 항목을 우선하고 나머지 현재 기록을 유지한다. `replace`는 미리보기와 경고 뒤 백업 내용으로 전체 교체한다.

### 아침·저녁 브리핑

- `features/automation/dailyBriefing.js`: owner별 설정, 아침·저녁 요약 계산, 향후 알림 계획을 담당하는 순수 모델
- `features/automation/DailyBriefingCard.jsx`: 홈에서 아침·저녁을 전환해 일정·지출 요약을 표시하고 알림의 `?briefing=` 선택을 반영
- `features/automation/DailyBriefingSettings.jsx`: `/more`에서 사용 여부와 시각을 저장하고 알림 권한을 요청
- `LifeHubApp.jsx`: 기존 일정 알림과 브리핑 알림을 합쳐 foreground 복귀와 설정 변경 때 다시 예약

브리핑 카드는 알림 권한 없이도 볼 수 있다. 백그라운드 알림은 사용자가 해당 시간대를 켜고 Android 또는 브라우저 알림 권한을 허용한 경우에만 예약한다. Android APK는 native 예약을 사용해 앱 화면이 닫혀도 전달할 수 있지만, 일반 브라우저의 timer fallback은 페이지 프로세스가 살아 있는 동안만 동작하며 절전 정책에 따라 늦어질 수 있다.

## 로컬 개발 사용법

```bash
npm --prefix apps/web run dev
```

브라우저에서 `http://127.0.0.1:5173/app`을 열어 홈·일정·메모·가계부와 `/more`를 확인한다. `/workout`, `/diet`, `/ai`, `/ai/edit`, `/ai/settings`는 `/app`으로 돌아와야 하며 운동·식단·음식 사진 입력이나 Bridge 연결 버튼이 나타나면 회귀다.

## 웹과 APK 확인 방식

- UI 수정 중에는 Vite 웹에서 확인한다. 매번 APK를 풀고 다시 묶지 않는다.
- APK에는 빌드된 정적 웹을 한 번 포함하므로 기기 반영이 필요할 때만 `scripts/build_android_apk.sh`를 실행한다.
- 설치형 웹의 현재 서비스 워커 경계는 `orbit-web-v35`다. 가계부 파일 공유, 운동·식단 제외, 4탭, 날짜·시간 예정 목록, 일반 텍스트 메모, 정기 결제와 반응형 너비를 포함하므로 기능 변경 없이 캐시 번호만 되돌리지 않는다.
- Android SDK가 불완전하면 기존 APK를 덮어쓰지 말고 문서에 blocker를 남긴다.

현재 Termux PRoot 경량 SDK에서 웹 빌드를 마친 뒤 APK만 포장할 때는 아래 명령을 사용한다. 2026-08-23에 `0.5.9-debug` 서명 APK 생성까지 검증한다. 이 SDK에는 Android Lint가 없으므로 Lint만 명시적으로 건너뛰며, Java 컴파일·네이티브 smoke test·서명·APK 민감정보 검사는 계속 실행된다.

```bash
proot-distro login ubuntu -- bash -lc \
  'cd /data/data/com.termux/files/home/Project && \
  ANDROID_HOME=/data/data/com.termux/files/home/.android-sdk-termux \
  ANDROID_SDK_ROOT=/data/data/com.termux/files/home/.android-sdk-termux \
  ANDROID_BUILD_TOOLS_DIR=/data/data/com.termux/files/usr/bin \
  ANDROID_D8_BIN=/data/data/com.termux/files/home/.android-sdk-termux/official-35.0.1/android-15/d8 \
  ANDROID_RESOURCE_JAR=/data/data/com.termux/files/home/.android-sdk-termux/platforms/android-13/android.jar \
  SKIP_WEB_BUILD=1 SKIP_ANDROID_LINT=1 \
  bash scripts/build_android_apk.sh'
```

호스트 Termux에서 스크립트를 바로 실행하면 현재 `javac`가 API 35 boot classpath를 읽는 과정에서 Perfetto native registration 오류로 중단된다. 반드시 Ubuntu PRoot 안에서 실행한다. 또한 Termux용 `aapt2`는 현재 API 35 resource JAR의 일부 값을 해석하지 못하므로 리소스 링크에는 정상 확인된 API 33 JAR를 사용하고, D8은 Java 21 class file을 처리할 수 있는 공식 35.0.1 번들을 명시한다. 이 세 경로를 임의로 생략하면 실행 형식 오류, `illegal map type`, 또는 구형 D8 NPE가 재발할 수 있다.

## 필수 검증

```bash
npm --prefix apps/web test
npm --prefix apps/web run test:lifehub-data
npm --prefix apps/web run build
git diff --check
```

현재 비활성인 보관 AI/Bridge 코드를 별도 요구로 수정할 때만 최소한 다음을 직접 검증한다.

- loopback Origin의 `/api/local/connect` 성공
- Origin 누락·외부 Origin·proxy 전달 header 거부
- 재연결 시 기존 토큰 무효화와 기기 ID 유지
- 연결 뒤 `/api/device/status` 등 인증 API의 로컬 CORS 허용
- 관리자 인증과 원격 6자리 페어링 회귀 없음
- 로컬 앱 수정 turn은 승인 이벤트 없이 시작되고 요청한 네 권한을 유지함
- 로컬 모드에서도 프로젝트 밖 경로·외부 도구·검사 불가능한 shell/interpreter가 차단되고, 삭제·위험 명령은 마지막 1회 확인을 받음

보관 AI 일정 대화나 생활 기록 파서를 별도 요구로 수정할 때는 상대·절대 날짜, 중복, 저장 실패, 부정·혼합 입력 거부와 request ID 재시도 테스트를 함께 실행한다. 백업·브리핑 변경에는 codec·merge·replace·rollback·native/browser document adapter·아침/저녁 알림 모델 테스트와 `lifeHubUiStructure.test.mjs`를 실행한다.

가계부 공유 변경에는 공개 필드 allowlist, 메모 기본 제외, 기간·개수 일치, 재공유 중복, strict UTF-8·8 MiB, add-only 저장 실패, Android 신뢰 origin·읽기 전용 Provider·manifest·APK DEX 검사를 함께 실행한다.

## 문서 갱신 규칙

- 완료한 UI/성능 평가는 `WEB_UI_UX_AUDIT_KO.md`에 누적한다.
- 구조를 분리하거나 저장 형식을 바꾸면 이 문서의 모듈 경계를 함께 갱신한다.
- 과거 요청을 보존한 `APP_HANDOFF_KO.md`의 낡은 제품 범위·빠른 기록 지시를 현행 요구로 오해하지 않는다.
