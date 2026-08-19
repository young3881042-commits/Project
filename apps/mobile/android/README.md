# ai-assitant Android wrapper

This directory contains the Android WebView shell for Orbit. The APK embeds the generated `apps/web/dist` output and always opens that bundled build from the private `https://appassets.androidplatform.net` origin.

## Build

### 로컬에서 가장 가볍게 작업하는 방법

개발할 때 APK를 압축 해제하거나 다시 압축할 필요는 없습니다.

1. 평소 UI 수정은 `apps/web`에서 `npm run dev`로 바로 확인합니다.
2. 기기에서 확인할 시점에만 저장소 루트에서 `bash scripts/build_android_apk.sh`를 한 번 실행합니다.
3. 기존 앱 데이터와 서명을 유지하려면 `adb install -r apps/mobile/android/release/ai-assitant-debug.apk`로 업데이트 설치합니다.

웹 빌드를 이미 끝낸 뒤 Android 포장만 다시 확인할 때는 `SKIP_WEB_BUILD=1 bash scripts/build_android_apk.sh`를 사용할 수 있습니다. 빌드 스크립트는 이전 Android 빌드 폴더를 비운 뒤 현재 `apps/web/dist`만 넣으므로 제거된 구형 자산이 APK에 남지 않습니다.

From the repository root:

```bash
bash scripts/build_android_apk.sh
```

The script:

1. runs `npm --prefix apps/web run build` (and `npm ci` first when dependencies are missing);
2. embeds the resulting `apps/web/dist` files under the APK assets;
3. compiles the Java sources, runs Android Lint and the native URL/address, notification, image, and backup-document policy smoke tests;
4. uses a local Android SDK 35 when available, otherwise runs the raw SDK build in a digest-pinned `ghcr.io/cirruslabs/android-sdk` image;
5. verifies the debug signature, rejects sensitive filenames or credential-shaped values inside the APK, and writes the APK plus SHA-256 sidecar under `apps/mobile/android/release/`.

Docker and Node/npm are required when the host does not already have Android SDK 35. The Android container is deliberately only responsible for the raw SDK stage because it does not include Node/npm.

To run the Android stage directly after building the web app:

```bash
npm --prefix apps/web run build
docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/android-home \
  -e SKIP_WEB_BUILD=1 \
  -v "$PWD:/workspace" \
  -w /workspace \
  ghcr.io/cirruslabs/android-sdk@sha256:c724009e305b4607157287624033ab97f319af44c244bfc9f73b6293f3bb01b9 \
  bash scripts/build_android_apk.sh
```

Install or update the debug build on a connected Android device:

```bash
adb install -r apps/mobile/android/release/ai-assitant-debug.apk
```

Verify the locally generated APK before installing:

```bash
cd apps/mobile/android/release
sha256sum -c ai-assitant-debug.apk.sha256
```

The generated `.debug/` keystore is reused locally so subsequent debug APKs can update the previous installation. It is ignored by Git and is not a production signing key.

If a local release APK already exists, the build compares its signing certificate
and refuses to replace it when the certificates differ. Android would reject that
result as an update. Use the original `ANDROID_KEYSTORE` for delivery builds.
`ALLOW_ANDROID_SIGNING_KEY_ROTATION=1` is only for an intentional rotation where
users must uninstall the old app, which removes its local app data.

If Android says the app was not installed while an older Orbit is present, a
different signature may be the cause. Preserve any needed data before removing
the old app. Do not uninstall when its local data has not been preserved.

## Embedded app mode

The APK has one top-level app mode. It immediately opens the bundled web build at `https://appassets.androidplatform.net/app`; there is no first-launch mode dialog or user-editable top-level server address. Memo, schedule, workout, diet, and finance data use storage scoped to this embedded origin.

Food-photo analysis and the app's Codex features connect from that embedded page to the HTTPS Orbit Bridge configured when the Web bundle is built. This is an API endpoint, not a remotely loaded WebView page. Set the endpoint before building an APK; do not commit an operator address in the source tree.

```bash
VITE_LIFEHUB_BRIDGE_ADDRESS=https://bridge.example.com \
VITE_LIFEHUB_BRIDGE_PORT=443 \
bash scripts/build_android_apk.sh
```

The app does not offer a runtime Bridge-address field. It only receives the pairing code and device name, so a physical phone needs an HTTPS Bridge or a trusted VPN/LAN endpoint rather than the PC's loopback address.

Keeping the top-level page on the bundled embedded origin is part of the native trust boundary: Android Keystore token storage, the restricted Bridge transport, document selection, and native notifications are not granted to arbitrary network-delivered pages.

### WebView document selection

WebView file inputs can open Android's system document picker for one image at a time. The wrapper requests only `image/jpeg`, `image/png`, or `image/webp`, verifies the returned content URI, MIME type, and file signature, and returns cancellation for other formats or multiple selections. It decodes image bounds without allocating pixels and accepts only positive dimensions up to 16,384 pixels per side and 40,000,000 total pixels; when the provider reports a file length, values over 20 MiB are also rejected. Direct camera capture and camera permission are intentionally not included.

The LifeHub browser-fallback input is also recognized only when every requested
accept type is `application/json` or `.json`. It opens one read-only
`ACTION_OPEN_DOCUMENT` request and returns the URI to the WebView only after the
same exact MIME, 8 MiB reported/streamed, strict UTF-8, and strict JSON-object
checks used by native import pass. Image, JSON fallback, and native backup
pickers share one lock and cannot overlap.

### Native interfaces

The native methods are usable only while the committed top-level page is the embedded `appassets.androidplatform.net` app. Subframes and every other top-level origin are denied access to privileged document, Bridge, token, and notification capabilities.

```ts
interface AiAssistantNative {
  exportLifeHubBackup(requestId: string, fileName: string, json: string): boolean
  importLifeHubBackup(requestId: string): boolean
  hasSecureValue(key: string): boolean
  removeSecureValue(key: string): boolean
  getSecureValueMetadata(key: string): string | null
  getBridgeCapabilities(): string | null
  getNetworkStatus(): string | null
  getNotificationCapabilities(): string | null
  getNotificationPermission(): 'granted' | 'default' | 'denied' | null
  requestNotificationPermission(requestId: string): boolean
  replaceScheduledNotifications(payload: string): boolean
  showNotification(id: string, title: string, body: string, path: string): boolean
  bridgeRequest(requestId: string, url: string, method: 'GET' | 'POST', body: string, tokenKey: string): boolean
  bridgeStream(requestId: string, url: string, tokenKey: string, lastEventId: string): boolean
  bridgeCancel(requestId: string): boolean
}
```

### Native JSON backup document contract

The embedded Orbit page can save and open a LifeHub JSON backup with Android's
system document UI. Both methods are available only while the committed
top-level page is the trusted `appassets.androidplatform.net` app; subframes and
other origins are rejected. The wrapper uses `ACTION_CREATE_DOCUMENT` for
export and `ACTION_OPEN_DOCUMENT` for import, fixes the requested MIME type to
`application/json`, and does not request broad storage or media permissions.

`exportLifeHubBackup(requestId, fileName, json)` accepts one UTF-8 JSON object up
to 8 MiB. The suggested leaf filename is limited to 128 characters, cannot
contain path separators or control characters, and receives a `.json` suffix
when needed. `importLifeHubBackup(requestId)` accepts exactly one
`content://` document whose provider reports `application/json`; the reported
and streamed sizes are both bounded to 8 MiB, UTF-8 is decoded strictly, and the
content must parse with strict JSON syntax as a top-level object with at most
128 nested object/array containers. Native code only returns the
validated JSON to the trusted page—the web layer remains responsible for
schema/version validation and applying or merging records.

Only one native backup picker may be pending at a time, and it cannot overlap
the WebView image or JSON-fallback picker. A `true` return value means the request was validated,
claimed, and queued for the system picker. Completion, cancellation, or an I/O
error arrives through the result event. A `false` return value is a synchronous
rejection and no event follows. Request IDs use the same 1–128 character
letters/digits/dot/underscore/hyphen/colon format as other native operations.

```js
window.addEventListener('lifehub:native-backup-result', ({ detail }) => {
  // detail: {
  //   requestId: string,
  //   operation: 'export' | 'import',
  //   ok: boolean,
  //   cancelled: boolean,
  //   bytes: number,
  //   fileName?: string, // export suggestion only; never a URI or filesystem path
  //   json?: string,     // import success only
  //   error: null | { code: string, message: string }
  // }
})
```

An export payload or deferred import result is held only in a private cache
file while the picker/activity is being recreated. The small non-secret request
metadata is saved in the Activity instance state, the private payload is
restored after configuration/process recreation, and temporary files are
deleted after success, cancellation, failure, or a final Activity close. URI,
JSON, exception details, and document contents are not logged or persisted in
preferences.

### Native secure-token and Bridge transport contract

Only keys matching `lifehub.bridge.token:<deviceId>` are accepted. `<deviceId>` is 1–128 ASCII letters, digits, dots, underscores, or hyphens. A successful native `/api/pair/approve` response is intercepted before JavaScript sees it: the proxy extracts the device token, encrypts it with AES-GCM, removes token fields from the response, and forwards only `tokenStored`, `tokenKey`, and non-secret pairing metadata. The non-exportable AES key is created by Android Keystore and only ciphertext is stored in private app preferences. The exact Bridge scheme, host, and effective port are authenticated as AES-GCM associated data, so a token saved for one origin cannot be attached to another origin. `removeSecureValue` returns `true` only when an existing value was deleted.

There is deliberately no token-write or token-read JavaScript method. `hasSecureValue` and `getSecureValueMetadata` expose only presence and non-secret metadata; neither decrypts nor returns the device token. `getBridgeCapabilities` reports that native HTTP/HTTPS transport and Android Keystore storage are available and that tokens are non-exportable to JavaScript.

For Bridge traffic, use `bridgeRequest` and `bridgeStream` instead of reading the token. The native transport reads the device token from Android Keystore and attaches `Authorization: Bearer ...` without returning it to JavaScript. A `true` return value only means that the asynchronous operation passed validation and was registered; completion arrives through a native event. A `false` return value means the request was rejected synchronously and no completion event will follow.

`requestId` is 1–128 ASCII letters, digits, dots, underscores, hyphens, or colons and must be unique among active native operations. Requests accept only `GET` and `POST`, only unescaped URL paths starting with `/api/`, no path percent escapes, URL credentials, or fragments, and normally at most 64 KiB of UTF-8 request body. The exact authenticated `POST /api/food/analyze` route alone permits up to 2.25 MiB and a 90-second read timeout for its image JSON payload; other one-shot routes retain the 64 KiB limit and 30-second read timeout. `GET` bodies are rejected. An empty `tokenKey` is accepted only for `POST` to the exact `/api/pair/request` and `/api/pair/approve` paths. Every other request requires a valid `lifehub.bridge.token:<pcId>` entry bound to the request origin.

The one-shot response event has this exact shape:

```ts
window.addEventListener('lifehub:native-bridge-response', ({ detail }) => {
  // detail: {
  //   requestId: string,
  //   ok: boolean,
  //   status: number, // 0 for transport, timeout, or cancellation failures
  //   body: string,
  //   contentType: string,
  //   error: null | { code: string, message: string }
  // }
})
```

SSE uses `lifehub:native-bridge-stream` with a discriminated `type`:

```ts
type NativeBridgeStreamDetail =
  | { requestId: string; type: 'open'; status: number; contentType: string }
  | { requestId: string; type: 'event'; event: string; data: string; id: string; retry: number | null }
  | { requestId: string; type: 'end' }
  | { requestId: string; type: 'error'; status: number; error: { code: string; message: string } }
  | { requestId: string; type: 'cancelled' }
```

`bridgeCancel(requestId)` returns `true` only when it claims and cancels an active operation from the current trusted top-level origin. A normal request then emits a response with `error.code === 'cancelled'`; a stream emits `{ type: 'cancelled' }`.

Native Bridge HTTP is allowed only for loopback, RFC1918 private addresses, link-local addresses, Tailscale's `100.64.0.0/10`, IPv6 ULA, or hostnames whose complete DNS result contains only those address classes. A cleartext connection is pinned to the address that passed this check so it is not resolved again after validation. Native Bridge calls bypass ambient HTTP proxy settings and connect directly. HTTPS may use public or private hosts but always uses Android's normal system trust and hostname validation. An authenticated request must match the origin cryptographically bound to its device token. Redirects are never followed, TLS errors are never bypassed, responses and SSE events are size-limited, timeouts are enforced, and all active work is cancelled on navigation or when the activity is destroyed. Neither request URLs nor headers, bodies, tokens, or network exceptions are logged.

The wrapper also emits network changes without exposing credentials:

```js
window.addEventListener('lifehub:native-network-status', ({ detail }) => {
  // detail: { connected: boolean, type: 'wifi' | 'mobile' | 'ethernet' | 'none' | string }
})

const current = JSON.parse(window.AiAssistantNative?.getNetworkStatus?.() ?? 'null')
```

### Native notification contract

Native notification APIs are available only to the committed embedded-app origin. Other top-level origins and subframes cannot request permission, post a system notification, or replace the saved reminder schedule.

On Android 13 and newer, notification permission is requested only after a user presses an in-app notification button. The asynchronous result is correlated by `requestId`:

```js
window.addEventListener('lifehub:native-notification-permission', ({ detail }) => {
  // detail: { requestId: string, permission: 'granted' | 'default' | 'denied' }
})
```

`replaceScheduledNotifications` accepts a JSON array of at most 128 validated reminders and replaces the entire native reminder set. Each row has `{ id, title, body, path, triggerAt }`; the payload is limited to 64 KiB, `triggerAt` must be within the supported future horizon, and `path` must remain inside `/app`, `/schedule`, `/ai`, `/ai/edit`, or `/ai/settings`. Schedule notes, Bridge URLs, tokens, and private exports are never persisted in notification state. Valid reminders are retained even while notification display permission is off, so granting that permission before the trigger does not require recreating the schedule.

The wrapper stores validated reminders in private preferences and registers the next reminder with `AlarmManager`. Android 12 and newer can grant the app's user-facing “Alarms & reminders” special access: when granted, the wrapper uses `setExactAndAllowWhileIdle`; otherwise it safely falls back to `setAndAllowWhileIdle` and tells the user that delivery may be delayed. The app reschedules after the permission changes, boot, time or timezone changes, app replacement, and app launch. Reminders missed by no more than six hours during those transitions are delivered once during recovery. A force-stopped app still cannot receive alarms until the user launches it again, as required by Android.

LifeHub synchronizes upcoming schedule reminders to this native store, so those reminders can appear after the WebView closes. AI approval/completion/failure alerts are immediate native notifications when the AI page is backgrounded and still receiving Bridge events; Android may suspend or kill that WebView connection, so guaranteed remote AI delivery would require a separate push or foreground-service design.

Tapping a notification opens its validated embedded `/schedule`, `/ai`, or `/ai/edit` route. Notification content uses private lock-screen visibility and generic AI summaries instead of commands, file paths, model output, or credentials.

### Samsung Wallet payment entry

Orbit can import new Samsung Wallet purchase approvals after the user explicitly enables the Android **Notification access** special permission. This is a broad system permission, so the finance screen discloses its scope before opening Settings. Sideloaded Android 13+ builds may also require the user to allow restricted settings from Orbit's app-info screen. Orbit cannot grant or bypass either setting itself.

The listener accepts only the exact Samsung Wallet package (`com.samsung.android.spay`) and conservatively recognizes purchase/approval wording. Transfers, deposits, ordinary withdrawals, cancellations, refunds, declines, failures, and promotional notifications are rejected. Notifications received before access is enabled and private transaction history inside Samsung Wallet cannot be recovered.

Parsing happens in native memory. Only an opaque event ID, amount, sanitized merchant, source ID, and timestamp enter an owner-hashed private queue; notification text, card/account numbers, and balances are never persisted or sent to the WebView or network. LifeHub imports queued purchases in a batch when the app opens or regains focus, saves the ledger first, and acknowledges native items only after a successful save. Exact notification redelivery and repeated imports are therefore safe without losing failed writes. Existing ledger rows and the retired `ai-assitant-card-import-v1` cleanup remain compatible.

The legacy JavaScript-interface mechanism is available to every frame in a top-level document. The Android asset responder therefore injects a restrictive CSP into embedded HTML: scripts are local-only, frames and objects are disabled, and framing the app is denied. Privileged calls additionally require the committed local-app origin. Main-frame navigation to any other origin is blocked.

The configured HTTPS Orbit Bridge address is compiled into the embedded web app. No device token, account credential, administrator secret, Codex login cache, or API key is compiled into the APK. Android uses normal system trust and hostname validation for the configured endpoint and never bypasses certificate errors.

`android:windowSoftInputMode="adjustResize"` keeps the WebView input area above the software keyboard. Cleartext support remains enabled at the Android network-policy layer only for the restricted native Bridge transport's explicitly permitted private-network development endpoints; the fixed Orbit Bridge uses HTTPS. WebView mixed-content mode remains `MIXED_CONTENT_NEVER_ALLOW`.

## Embedded-mode limits

- Ordinary personal records remain in the embedded origin's device storage and are not automatically synchronized to a separate web origin.
- The only configured AI backend is the Bridge selected at build time; unrelated account sync, RAG, live travel, and general server APIs are not enabled by a mode switch.
- Remote images, the configured HTTPS Bridge, and external links still require network access even though the app UI is bundled in the APK.
- Scheduled notifications retain only the upcoming native synchronization window; reopening the app refreshes it. Exact timing requires Android's “Alarms & reminders” special access, otherwise the wrapper uses an inexact fallback.
- Orbit has no public Samsung Wallet API for consumer transaction history. Its optional import covers only new, parseable Samsung Wallet purchase notifications received after the user grants Notification access; wording changes or Android sensitive-content redaction can leave some purchases for manual entry.
- The output is debug-signed for direct testing and email/download installation. A store release needs a protected release keystore, version management, store assets, and a release review.
