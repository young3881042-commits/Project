# ai-assitant Android wrapper

This directory contains the Android WebView shell for Orbit. The APK embeds the generated `apps/web/dist` output and always opens that bundled build from the private `https://appassets.androidplatform.net` origin.

## Build

### Travel planning connection

Orbit 0.7.0 adds a travel-only Termux Codex client (Android 7+). Run `node tools/orbit-travel/server.mjs` from the repository in Termux, then enter its one-time code under the app's travel connection panel. Re-running the command while the server is active issues a fresh code. See [the local service guide](../../../tools/orbit-travel/README.md).

The native adapter exposes only fixed status/pair/create/poll/cancel actions. Its token stays in private preferences. Network security permits cleartext only for `127.0.0.1`; the WebView's mixed-content prohibition, trusted embedded origin, and CSP remain unchanged. No generic Bridge or remote command proxy is restored.

### APK build

개발할 때 APK를 압축 해제하거나 다시 압축할 필요는 없습니다.

1. 평소 UI 수정은 `apps/web`에서 `npm run dev`로 확인합니다.
2. 기기에서 확인할 시점에만 저장소 루트에서 `bash scripts/build_android_apk.sh`를 실행합니다.
3. 기존 앱 데이터와 서명을 유지하려면 `adb install -r apps/mobile/android/release/ai-assitant-debug.apk`로 업데이트 설치합니다.

웹 빌드를 이미 끝낸 뒤 Android 포장만 다시 확인할 때는 `SKIP_WEB_BUILD=1 bash scripts/build_android_apk.sh`를 사용할 수 있습니다. 빌드 스크립트는 이전 Android 빌드 폴더를 비운 뒤 현재 `apps/web/dist`만 넣으므로 제거된 구형 자산이 APK에 남지 않습니다.

```bash
bash scripts/build_android_apk.sh
```

The script:

1. runs `npm --prefix apps/web run build` (and `npm ci` first when dependencies are missing);
2. embeds the resulting `apps/web/dist` files under the APK assets;
3. compiles Java, runs Android Lint and native notification, finance-parser, finance-share, and backup-document smoke tests;
4. uses a local Android SDK 35 when available, otherwise runs the raw SDK build in the pinned Android container;
5. verifies the debug signature, finance-listener boundary, grant-only finance share provider, and absence of credential-shaped APK content;
6. writes the APK and SHA-256 sidecar under `apps/mobile/android/release/`.

Verify and install the generated build:

```bash
cd apps/mobile/android/release
sha256sum -c ai-assitant-debug.apk.sha256
adb install -r ai-assitant-debug.apk
```

The generated `.debug/` keystore is reused locally so later debug APKs can update the installed app. It is ignored by Git and is not a production signing key. If a release APK already exists, the build refuses to replace it with a differently signed APK unless an intentional key rotation is explicitly allowed. Do not uninstall an existing app before preserving any local data you need.

## Embedded app mode

The APK immediately opens the bundled `/app`; there is no first-launch mode dialog or user-editable server address. Memo, schedule, finance, and recurring-payment data remain scoped to the embedded origin. Removed workout and diet records are left untouched in local storage for compatibility.

The memo screen uses a persistent folder sidebar on wider displays and a focus-trapped folder drawer on mobile. The editor is a single plain-text field; folder, title, tags, archive filters, and per-card actions appear only on demand. `Ctrl/Command+Enter` saves the draft. Legacy rich notes open in a protected reader and can be copied to a new text memo without overwriting the original.

Undone schedules whose date has passed, plus timed schedules whose time has passed today, are labeled `미완료` consistently in the schedule view, home calendar, and morning briefing. All-day items remain upcoming until the day ends. The upcoming list shows both the date and time on its timeline rail.

Finance keeps recurring-payment rules separate from posted ledger rows. A rule can use a numbered billing day or month-end, an optional end month, and optional automatic posting. Missing 29th–31st dates clamp to month-end, a rule/month is posted at most once, and deleting or editing a rule never rewrites historical ledger rows. New JSON backups use format version 2 and include these rules while version 1 backups remain importable.

Finance can also create a one-time ledger snapshot for Android's system share sheet. Orbit JSON supports add-only import with duplicate preview; CSV is view-only. Memo text is excluded unless the sender explicitly opts in, and notification event IDs, owner values, and native queue data are never placed in the file. This does not create a shared account or ongoing synchronization.

The current product does not expose workout or diet tracking, food-photo AI analysis, AI chat, app editing, pairing, or an Orbit Bridge connection. Legacy `/workout`, `/diet`, `/ai`, `/ai/edit`, and `/ai/settings` navigation returns to `/app`. The Android wrapper contains no Bridge HTTP/SSE transport, token store, network-status bridge, or image chooser. JSON backup remains available.

The top-level page stays on the bundled origin. Main-frame navigation to other origins is blocked, TLS errors are cancelled, mixed content is disabled, and cleartext traffic is disabled. The asset responder injects a restrictive CSP that permits local scripts while disabling frames and objects.

## Native JSON backup document contract

The trusted embedded page can export and import a LifeHub JSON backup through Android's system document UI. Export uses `ACTION_CREATE_DOCUMENT`; import uses `ACTION_OPEN_DOCUMENT`. Both use `application/json` and require no broad storage or media permission.

Payloads are capped at 8 MiB, decoded as strict UTF-8, and must be a strict top-level JSON object. Suggested filenames are bounded and cannot contain path separators or control characters. Only one native or browser-fallback JSON picker may be active at a time. Results are delivered through `lifehub:native-backup-result`; document URIs, contents, exceptions, and private paths are not logged.

## Native finance file share contract

The trusted embedded page may pass one validated JSON or CSV snapshot, capped at 8 MiB, to Android's `ACTION_SEND` chooser. Orbit writes it to a tokenized file under the app-private cache and exposes it through a non-exported `ContentProvider`. The chosen receiver gets temporary read permission only; write, delete, arbitrary paths, broad storage access, and direct URI access are rejected. Managed files older than 24 hours are removed on a later share or app start.

Bluetooth and Quick Share appear through Android's chooser when the device supports them. Orbit does not scan for nearby devices, establish a Bluetooth connection itself, or request a Bluetooth permission. A successful native return means the chooser opened, not that a receiver completed delivery.

## Native interface

Native methods are accepted only from the committed top-level `appassets.androidplatform.net` page; subframes and other origins are rejected. `AiAssistantNative` is retained as the historical JavaScript object name for compatibility, but it no longer exposes any AI or Bridge transport.

```ts
interface AiAssistantNative {
  exportLifeHubBackup(requestId: string, fileName: string, json: string): boolean
  importLifeHubBackup(requestId: string): boolean
  shareFinanceFile(fileName: string, mimeType: 'application/json' | 'text/csv', content: string): boolean
  getNotificationCapabilities(): string | null
  getNotificationPermission(): 'granted' | 'default' | 'denied' | null
  getExactAlarmPermission(): 'granted' | 'default' | 'unsupported' | null
  requestNotificationPermission(requestId: string): boolean
  requestExactAlarmPermission(requestId: string): boolean
  replaceScheduledNotifications(payload: string): boolean
  showNotification(id: string, title: string, body: string, path: string): boolean
  getCardImportCapabilities(): string | null
  configureCardImport(owner: string, sourcesJson: string): boolean
  openCardNotificationAccessSettings(): boolean
  openAppDetailsSettings(): boolean
  requestPendingCardTransactions(requestId: string, owner: string, sourcesJson: string): boolean
  resolvePendingCardTransactions(requestId: string, owner: string, decisionsJson: string): boolean
}
```

## Scheduled notifications

On Android 13 and newer, notification display permission is requested only after an in-app action. Schedule and daily-briefing reminders are validated, stored in private preferences, and registered with `AlarmManager`. Android 12 and newer use exact alarms only when the user grants “Alarms & reminders”; otherwise Orbit safely uses an inexact fallback.

Notification paths are restricted to `/app` and `/schedule`. The wrapper restores eligible reminders after boot, time/timezone changes, app replacement, and app launch. A force-stopped app cannot receive alarms until the user launches it again, as required by Android.

## Approved payment-notification import

Orbit can import new purchase approvals after the user explicitly enables Android **Notification access** and selects supported sources:

- Samsung Wallet: source `samsung-wallet`, exact package `com.samsung.android.spay`
- standalone KakaoPay: source `kakao-pay`, exact package `com.kakaopay.app`
- Toss: source `toss`, exact package `viva.republica.toss`

KakaoTalk (`com.kakao.talk`), Tmoney apps, and every unknown package are rejected before notification text is read. Each source uses conservative approval wording and requires one unambiguous won amount. KakaoPay and Toss also require an identifiable merchant instead of using the app name as a fallback. Transfers, deposits, withdrawals, top-ups, balances, cancellations, refunds, declines, failures, rewards, promotions, and future billing notices are rejected. Because payment apps do not publish a stable notification schema, wording changes or Android sensitive-content redaction can leave some purchases for manual entry.

Parsing happens in native memory. Only an opaque event ID, amount, sanitized merchant, source ID, and timestamp enter the owner-hashed private queue. Notification text, card/account numbers, and balances are never persisted, logged, sent to the WebView, or transmitted over a network. Unknown or unselected sources are checked again before enqueue and dequeue. Disabling a source purges its unprocessed rows so old purchases do not appear after re-enabling it.

LifeHub imports queued purchases when the app opens or returns to the foreground, saves the ledger first, and acknowledges native rows only after a successful save. Event IDs make notification redelivery and repeated imports idempotent. Existing Samsung Wallet selection and ledger rows remain compatible.

Notification access is a broad special permission. Sideloaded Android 13+ builds may also require **Allow restricted settings** from Orbit's app-info menu. Orbit cannot grant or bypass either setting, cannot recover notifications that are no longer active, and has no access to private in-app transaction history.

## Embedded-mode limits

- Personal records remain in the embedded origin's device storage and are not automatically synchronized to another device.
- A finance share is a point-in-time file copy. Later edits, deletions, and new transactions do not propagate to the receiver.
- Schedule reminders retain only the native synchronization window; reopening the app refreshes it.
- Optional payment import covers only new, parseable notifications from selected supported apps.
- The APK is debug-signed for direct testing. A store release requires a protected release key, managed versions, store assets, and policy review.

### 여행 대기 연결 (0.7.2-debug)

Play스토어 Termux의 미지원 RUN_COMMAND 권한을 제거했습니다. 기존 Termux에서 가벼운 연결만 대기하고 Codex는 요청 시 실행합니다. 최초 페어링 뒤 인증은 재사용하며 새로 설치할 APK는 Orbit 하나입니다. [준비·복구 안내](../../../tools/orbit-travel/README.md)를 따릅니다.

### AI 대화 (0.8.0-debug)

여행 옆 AI 탭에서 목적별 대화를 저장하고 이어갑니다. JSON/Markdown은 기존 Termux에 자동 저장하며, Markdown 내보내기는 Android 문서 저장 창을 사용합니다. 추가 권한이나 앱 설치는 필요하지 않습니다.

### APK 내장 Codex (0.8.7-debug)

내장 AI 빌드는 Android 11 이상 arm64용 Node·Codex ELF와 의존 라이브러리를 APK의
`lib/arm64-v8a`에 포함한다. 사용 시 별도 Termux 설치나 API 키는 필요하지 않다.
`AI → AI 사용하기 → 앱 안에서 AI 사용하기 → ChatGPT 로그인`에서 기기 인증 코드를
받아 브라우저에서 로그인한다. 앱으로 돌아오면 완료 여부를 확인한다.
기존 Termux 연결이 있으면 업데이트 후에도 그 모드를 유지하며 사용자가 전환한다.

- 인증과 대화는 앱 전용 `files/orbit-ai` 아래에 저장한다. 인증 토큰은 WebView에 전달하지 않는다.
- 기존 Termux 로그인·대화는 복사하거나 삭제하지 않는다. 연결 설정에서 이전 모드로 돌아갈 수 있다.
- 내장 서버는 고정 loopback 4320 포트에 bearer/Host/Origin 검사를 적용한다. 외부 프록시나 임의 명령 API는 없다.
- 질문마다 Codex를 실행/종료한다. 서버는 유휴 60초 후 종료하고 다음 요청에 재시작한다.
  로그인 중, 실행 중, 확인하지 않은 여행 결과가 있을 때는 종료를 지연한다.
- 로그인·진행 중인 작업의 지속은 Android 프로세스 생존에 의존한다. 강제 종료 뒤 로그인은 다시 시작할 수 있다.
- 대화와 SQLite 검색 색인은 재시작 후 유지된다. 앱 삭제 전 필요한 대화는 파일 내보내기로 보관한다.

빌드 준비(산출물은 Git 외부 디렉터리 사용):

```sh
python scripts/prepare_android_codex.py "$STAGING_DIR" "$TERMUX_PREFIX" "$CODEX_PACKAGE_DIR"
ORBIT_NATIVE_RUNTIME_DIR="$STAGING_DIR" bash scripts/build_android_apk.sh
```

준비 스크립트는 `patchelf`로 의존 라이브러리 이름/SONAME/RPATH를 APK 전용으로 변경하고
런타임 해시 목록, CA 인증서 및 라이선스 고지를 포함한다. Codex 패키지의 설정이나
개인 HOME/인증 파일은 패키징 대상이 아니다. 실행에는 Android의 고정 시스템 링커와
설치된 APK의 nativeLibraryDir만 사용한다. 런타임 다운로드/자동 업데이트는 하지 않는다.

검증: 별도 빈 HOME·시스템 PATH·APK용 라이브러리만으로 서버, SQLite 및 Codex
미로그인 상태 조회를 확인했다. 실제 Orbit 앱 UID에서 실행, 브라우저 로그인 완료 및
실제 AI 답변은 사용자 기기 실행으로 확인해야 한다. 현재 경량 SDK에는 Android Lint가 없어
명시적으로 건너뛰며 Java 컴파일·네이티브 정책 테스트·APK 서명 검증은 수행한다.


## 2026-09-10 — 0.9.0-debug AI 첨부·모델·사용 한도

AI 채팅에 PDF/TXT/Markdown/CSV/JSON/LOG 첨부와 추출 내용 미리보기·삭제를 추가했다.
한 메시지 3개, 텍스트 파일 200KB/PDF 5MB, 파일당 추출 12,000자/합계 24,000자로 제한하며
PDF는 최대 30쪽의 텍스트만 읽는다. 스캔/OCR·암호 PDF는 지원하지 않는다. 일부 추출은 UI에 표시한다.
추출 내용은 대화 JSON/Markdown과 같은 폴더 검색 색인에 남고, 전송 시 AI에 제공된다.
원본 파일을 복제 보관하지 않으며 Android 파일 선택은 사용자가 고른 문서 URI만 허용한다.
PDF.js 워커·CMap·기본 글꼴과 라이선스를 APK에 포함하여 외부 CDN 없이 읽는다.

로그인한 Codex의 model/list 결과로 모델을 선택하고 실제 요청에 반영한다. 자동 모델은 기존 설정을 따른다.
account/rateLimits/read의 잔여율·초기화 시각·조회 시각을 표시한다. 정확한 잔여 토큰 수는 제공되지 않으므로
추정하지 않는다. 한도는 계정 기준이며 선택 모델의 별도 한도와 다를 수 있다.
화면 진입·답변 완료·수동 새로고침 때만 조회하고 주기적인 폴링은 하지 않는다.
기존 대화·인증을 유지하며, 첨부/모델을 지원하지 않는 구형 실행 환경은 전송 전에 안내한다.

검증: 웹/로컬 서버 회귀 테스트, 실제 PDF와 번들 글꼴 추출, 로그인된 Codex의 모델/한도 조회.
Android 파일 선택 및 업데이트 APK의 실제 화면·전송은 설치 후 기기 확인이 필요하다.


## 2026-09-10 — 0.9.2-debug 날짜별 지도·일정 이미지와 중복 확인

여행 결과/저장된 여행의 날짜 탭에 지도·방문 번호·방향 화살표·시간표를 한 장으로 생성한다.
선택하여 화면에 보이는 날짜만 장소를 검색하고 현재 지도 영역만 로드한다. 배터리 상시 작업이나
별도 이미지 생성 모델/API 키는 필요 없다. PNG 저장은 Android 문서 저장 창에서 사용자가 고른 URI에만 쓴다.

Photon 공개 검색(고정 HTTPS 호스트, 요청 간격 1.1초, 6.5초 제한, 128KB 응답 상한, 7일 위치 캐시)을 사용한다.
조회는 장소명만 보내며, 처음 검색된 후보의 주소를 사용자가 확인하고 다른 후보 선택/직접 재검색/제외할 수 있다.
위치 미확인 장소는 좌표를 생성하지 않는다. 지도 점선은 방문 순서이며 실제 도로 길찾기가 아니다.
OpenStreetMap 현재 화면 타일만 사용하고 HTTP 캐시·앱 User-Agent·Referer·출처를 유지한다.
지도 장애 시 일정 이미지와 확인된 지점은 유지하고 배경 누락을 알린다. 지도 공개 서비스는 가용성을 보장하지 않는다.
정책/문서: https://github.com/komoot/photon/blob/master/README.md 및 https://operations.osmfoundation.org/policies/tiles/

새 일정은 정규화한 장소명 기준으로 날짜 간 중복을 확인하고 1회 재생성한다. 그래도 반복되면 완료 결과로 저장하지 않는다.
숙소 복귀·공항 등 이동 거점과 지역만 적힌 모호한 장소는 중복 판정에서 제외한다. 별칭/다른 주소 표기는 완전히 판별할 수 없다.
기존 저장 일정은 자동으로 삭제하거나 변경하지 않는다.

검증: 웹 관련 테스트 109개, 서버 37개 통과. 실제 공개 장소 검색, 지도 타일을 포함한 720px PNG 생성과
한글 배치를 확인했다. Android 파일 저장 UI/실제 설치 화면은 사용자 기기 확인 대상이다.
