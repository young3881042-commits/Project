# ai-assitant Android wrapper

This directory contains the Android WebView shell for Orbit. The APK embeds the generated `apps/web/dist` output and always opens that bundled build from the private `https://appassets.androidplatform.net` origin.

## Build

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

Orbit can import new purchase approvals after the user explicitly enables Android **Notification access** and selects one or both supported sources:

- Samsung Wallet: source `samsung-wallet`, exact package `com.samsung.android.spay`
- standalone KakaoPay: source `kakao-pay`, exact package `com.kakaopay.app`

KakaoTalk (`com.kakao.talk`), Tmoney apps, and every unknown package are rejected before notification text is read. Each source uses conservative approval wording and requires one unambiguous won amount. Transfers, deposits, withdrawals, top-ups, balances, cancellations, refunds, declines, failures, rewards, and promotions are rejected. Because payment apps do not publish a stable notification schema, wording changes or Android sensitive-content redaction can leave some purchases for manual entry.

Parsing happens in native memory. Only an opaque event ID, amount, sanitized merchant, source ID, and timestamp enter the owner-hashed private queue. Notification text, card/account numbers, and balances are never persisted, logged, sent to the WebView, or transmitted over a network. Unknown or unselected sources are checked again before enqueue and dequeue. Disabling a source purges its unprocessed rows so old purchases do not appear after re-enabling it.

LifeHub imports queued purchases when the app opens or returns to the foreground, saves the ledger first, and acknowledges native rows only after a successful save. Event IDs make notification redelivery and repeated imports idempotent. Existing Samsung Wallet selection and ledger rows remain compatible.

Notification access is a broad special permission. Sideloaded Android 13+ builds may also require **Allow restricted settings** from Orbit's app-info menu. Orbit cannot grant or bypass either setting, cannot recover notifications that are no longer active, and has no access to private in-app transaction history.

## Embedded-mode limits

- Personal records remain in the embedded origin's device storage and are not automatically synchronized to another device.
- A finance share is a point-in-time file copy. Later edits, deletions, and new transactions do not propagate to the receiver.
- Schedule reminders retain only the native synchronization window; reopening the app refreshes it.
- Optional payment import covers only new, parseable notifications from selected supported apps.
- The APK is debug-signed for direct testing. A store release requires a protected release key, managed versions, store assets, and policy review.
