# LifeHub Bridge

LifeHub Android/WebView 앱과 사용자의 서버에서 실행되는 로컬 Codex를 연결하는 Node.js 18+ / TypeScript 서버다. 일반 대화·프로젝트 작업과 음식 사진 분석 모두 공식 Codex SDK가 서버의 로그인 세션을 사용한다. 모바일은 Bridge가 발급한 기기별 토큰만 보관하며 Codex 인증 캐시를 APK에 넣지 않는다.

## 설치와 실행

저장소 루트에서 다음 명령을 사용한다.

```bash
npm --prefix tools/lifehub-bridge install
codex login

cp tools/lifehub-bridge/.env.example tools/lifehub-bridge/.env
chmod 600 tools/lifehub-bridge/.env
set -a
. tools/lifehub-bridge/.env
set +a

npm run bridge:dev
npm run bridge:build
npm run bridge:start
npm run bridge:pair
npm run bridge:status
```

`bridge:dev`와 `bridge:start`는 주소, 관리자 화면, Codex 로그인 상태, 등록 프로젝트, 연결 기기, LAN 활성 여부를 출력한다. 연결 코드는 관리자 화면이나 `bridge:pair`에서 필요할 때만 만들며, 새 코드를 만들면 이전의 미사용 코드는 즉시 무효화된다. 로그인 상태는 `codex login status`를 별도 프로세스로 확인하며 인증 파일 내용을 직접 열거나 출력하지 않는다.

### user systemd로 자동 시작

서버에서 수동으로 실행한 `bridge:start`는 터미널과 서버 재부팅에 의존한다. 빌드 후
저장소의 user unit을 설치하면 실패 시 5초 후 재시작한다. 기본 unit은 저장소가
`~/Project`에 있다고 가정한다.

```bash
npm run bridge:build
mkdir -p ~/.config/systemd/user
install -m 644 infra/bridge/systemd/lifehub-bridge.service ~/.config/systemd/user/lifehub-bridge.service
systemctl --user daemon-reload
systemctl --user enable --now lifehub-bridge.service
```

기존 `bridge:start`를 수동으로 실행 중이면 먼저 그 프로세스를 정상 종료해 4317
포트 충돌을 피한다.

저장소가 다른 경로에 있으면 unit의 `WorkingDirectory`, `EnvironmentFile`, `ExecStart`를
먼저 수정한다. 서버에서 로그아웃 후에도 실행해야 하면 관리자가 해당 사용자의
systemd linger를 활성화한다. 비밀번호나 토큰은 unit에 넣지 않고 기존 `0600` `.env`와
Bridge 데이터 파일에만 둔다.

휴대폰에서 HTTPS로 연결할 때는 Bridge 전용 hostname의 TLS reverse proxy가 필요하다.
`infra/bridge/caddy/Caddyfile.example`은 `/api/*`와 `/admin/*`를 나누지 않고 전체 요청을
loopback `127.0.0.1:4317`로 전달한다. web Nginx와 같은 hostname을 쓰면 Spring의
`/api/*` route와 충돌하므로 Bridge 전용 hostname을 사용한다.

소스 트리 안에서 전체 CLI를 사용할 때는 다음 형식이 가장 명확하다.

```bash
npm --prefix tools/lifehub-bridge run cli -- status
npm --prefix tools/lifehub-bridge run cli -- pair list
npm --prefix tools/lifehub-bridge run cli -- project add /absolute/path/to/project optional-name
```

`npm run bridge:build` 뒤 이 패키지에서 `npm link`를 실행하면 동일한 명령을 `lifehub-bridge ...` 형식으로 사용할 수도 있다. 빌드된 진입점은 `dist/server-main.js`, CLI bin은 `dist/cli.js`다.

## 관리자 웹

Bridge는 앱과 분리된 `/admin/` 관리자 화면을 제공한다. 여기서 새 6자리 연결 코드를 발급·복사하고, 승인 대기 중인 휴대폰을 승인 또는 거절하며, 연결된 기기의 토큰을 즉시 폐기할 수 있다. 화면은 5초마다 Bridge와 Codex 상태를 갱신한다.

```text
http://127.0.0.1:4317/admin/
```

관리자 사용자 이름은 `orbit`이고 비밀번호는 Bridge가 최초 실행 때 `~/.lifehub-bridge/admin-token`에 무작위로 생성한다. 파일과 상위 디렉터리는 각각 `0600`/`0700`이며 이 값을 저장소, APK, HTML, JavaScript, URL query에 넣지 않는다. 관리자 페이지는 로컬에서 열어도 이 인증을 유지하며, 원격에서 열 때는 반드시 사용자가 관리하는 HTTPS reverse proxy 뒤에서만 제공한다.

관리자 HTML·CSS·JavaScript와 API에는 `no-store`, `nosniff`, frame 차단, 외부 script/style을 막는 CSP를 적용한다. 관리자 API는 실제 Bridge socket peer가 loopback이고 관리자 비밀번호가 일치할 때만 실행된다. 상태 응답은 기기 token hash, pairing secret, 관리자 비밀번호와 프로젝트 실제 경로를 포함하지 않는다. 외부 Origin 요청과 JSON이 아닌 변경 요청도 거부한다.

### 로컬 웹 한 번 연결

같은 PC에서 `localhost`, `127.0.0.1` 또는 `::1`로 연 Orbit 웹은 6자리 코드 대신 `POST /api/local/connect`로 바로 연결할 수 있다. 이 예외는 관리자 권한을 열지 않는다. 실제 socket peer, Bridge 요청의 `Host`, 브라우저의 `Origin`이 모두 loopback이고 `Forwarded`/`X-Forwarded-*` 같은 proxy 전달 헤더가 없을 때만 전용 `Orbit 로컬 웹` 기기 토큰을 발급하며, 이후 인증된 API 요청에도 같은 로컬 Origin을 허용한다.

로컬 웹 기기 레코드는 Bridge 상태에 유지되고 모든 기기 권한을 갖는다. 다시 연결하면 같은 기기 ID의 토큰을 회전해 이전 토큰을 즉시 무효화하며, 상태 파일에는 새 토큰의 hash만 저장한다.

`/ai/edit`는 이 전용 기기의 Codex thread에만 매 메시지 `localWorkspaceAccess: true`를 보낼 수 있다. 메시지 요청 자체와 위험 작업 최종 승인 모두 socket peer·Host·Origin의 직접 loopback 조건을 다시 통과해야 한다. 이때 클라이언트가 요청한 `file:write`, `command:execute`, `build:execute`, `git` 권한을 의도 추정으로 줄이지 않고, 일반 작업은 turn 승인 대기와 정확한 명령 문자열 비교 없이 실행한다. 쓰기 가능한 로컬 turn의 파일 범위는 선택 프로젝트 전체를 뜻하는 `.`으로 고정한다. 프로젝트 밖 경로·외부 심볼릭 링크·MCP/web/network 호출과 검사 불가능한 shell/interpreter는 차단하고, 삭제·초기화 같은 위험 요청은 마지막 1회 승인을 받은 뒤에만 실행한다. 플래그를 보내지 않은 화면, 일반 AI thread, 원격 페어링 기기는 기존 turn별 승인 계약을 유지한다. 별도 원격 명령 API의 `LIFEHUB_BRIDGE_REMOTE_COMMANDS=1` opt-in도 바뀌지 않는다.

이 경로는 LAN·VPN·Android WebView Origin에서는 사용할 수 없다. 알려진 proxy 전달 헤더와 외부 Origin도 거부하지만, proxy가 요청 헤더를 제거하거나 다시 쓸 수 있으므로 이를 외부 보안 경계로 간주하지 않는다. `/api/local/connect`를 reverse proxy나 port forwarding으로 외부에 노출하지 않는다. 브라우저가 보내는 JSON 요청과 CORS preflight만 허용하며 Origin이 없거나 `null`인 요청도 거부한다.

### Codex 실행 파일 선택 (Android/Termux 포함)

Bridge는 Linux/macOS/Windows의 지원 아키텍처에서 현재 패키지에 고정된 `@openai/codex` JS와 해당 플랫폼 native binary가 모두 있으면 이를 우선한다. Android/Termux이거나 optional native package가 빠진 설치에서는 `PATH`의 절대 디렉터리에서 실행 가능한 `codex` standalone/global binary를 찾는다. `node_modules/.bin`, 상대 경로, world-writable 디렉터리·파일, Bridge wrapper나 작동하지 않는 local JS로 되돌아가는 링크는 후보에서 제외하며 shell이나 요청 본문의 실행 경로는 사용하지 않는다.

따라서 Android/Termux에서 Bridge를 함께 실행하는 휴대폰마다 호환되는 Codex CLI를 설치하고 로그인한 뒤 다음 항목을 확인해야 한다. SDK와 CLI의 호환성을 위해 이 패키지에 고정된 Codex 버전과 같은 버전을 사용하는 것이 좋다.

```bash
command -v codex
codex --version
codex login
codex login status
```

`command -v codex` 결과가 `node_modules/.bin`뿐이면 Android fallback으로 사용할 수 없다. standalone/global binary가 안전한 절대 `PATH` 디렉터리에 있어야 한다. 공용 대화 wrapper, 음식 분석 전용 wrapper와 로그인 상태 확인은 같은 resolver를 거치며 `shell: false`로 실행된다. 로그인 상태 확인은 결과를 `logged-in`, `not-logged-in`, `unavailable`로만 정규화하고 CLI 원문이나 인증 값을 앱에 전달하지 않는다.

## 프로젝트 공개

모바일에는 PC에서 명시적으로 등록한 프로젝트의 ID와 표시 이름만 보인다. 절대 경로는 API 응답에 포함하지 않는다.

```bash
npm --prefix tools/lifehub-bridge run cli -- project add /absolute/path/to/vibeCoding vibeCoding
npm --prefix tools/lifehub-bridge run cli -- project list
npm --prefix tools/lifehub-bridge run cli -- project remove vibeCoding
```

파일시스템 루트, Codex 데이터 디렉터리, Bridge 데이터 디렉터리 및 이를 포함하는 상위 경로는 등록할 수 없다. 프로젝트 API 경로는 상대 경로만 허용하며 `..`, 절대 경로, NUL, 프로젝트 밖 심볼릭 링크를 거부한다. 등록 뒤 프로젝트 루트 자체가 심볼릭 링크로 교체된 경우에도 실행과 diff 조회를 차단한다. `GET /api/projects`도 `project:read` 권한이 있어야 한다.

## 휴대폰 페어링

1. 관리자 웹의 `새 코드 발급`을 누르거나 `npm run bridge:pair`로 6자리 일회용 코드를 만든다.
2. 휴대폰에서 PC 주소, 포트, 코드, 기기 이름과 요청 권한을 입력한다.
3. 관리자 웹의 `페어링 요청`에서 기기 이름과 권한을 확인하고 `승인`을 누른다. CLI를 사용할 수도 있다.

   ```bash
   npm --prefix tools/lifehub-bridge run cli -- pair list
   npm --prefix tools/lifehub-bridge run cli -- pair approve pair_request_id chat,project:read --yes
   ```

   `--yes`를 생략하면 대화형 터미널에서 정확히 `ALLOW`를 입력해야 한다.

4. 휴대폰은 승인 상태를 조회해 해당 기기 전용 토큰을 한 번만 받는다. Android 래퍼는 이 토큰을 Android Keystore 기반 저장소에 넣으며 일반 `localStorage`에는 저장하지 않는다.
5. 폐기할 때는 휴대폰에서 연결 해제를 요청하거나 PC에서 다음 명령을 실행한다.

   ```bash
   npm --prefix tools/lifehub-bridge run cli -- pair revoke device_id --yes
   ```

   폐기 즉시 새 요청 인증이 실패하고 해당 기기의 실행 중 turn과 열린 SSE도 중단된다.

기기 권한은 `chat`, `project:read`, `file:write`, `command:execute`, `build:execute`, `git`이다. 일반 AI 대화는 등록 프로젝트와 분리된 전용 작업 디렉터리에서 항상 읽기 전용으로 실행된다. Codex 모드는 `project:read` 권한과 등록 프로젝트가 모두 있어야 열린다.

## 원격 명령과 Git push (명시적 opt-in)

웹 클라이언트의 Codex 개발 모드에는 등록 프로젝트를 대상으로 한 원격 명령 패널이 있다.
이 기능은 로컬 개발/관리용이며 기본값은 비활성화다. 전용 OS 계정 또는 격리된 실행 환경과
신뢰하는 HTTPS/VPN 경계를 준비한 뒤 Bridge 환경 파일에서만 켠다.

```env
LIFEHUB_BRIDGE_REMOTE_COMMANDS=1
LIFEHUB_GIT_PUSH_HOSTS=github.com
```

- `project:read`와 명령 종류에 맞는 `command:execute`, `build:execute`, `git` 기기 권한을
  확인한다. 일반적인 파일 변경 명령은 `file:write`도 함께 필요하다.
- 한 번에 한 명령만 준비하며, 서버가 계산한 프로젝트·정확한 명령·권한·위험도·만료
  시간을 클라이언트가 다시 확인한 뒤 일회성 승인 ID로 실행한다. 승인 ID는 2분 뒤
  만료되고 재사용할 수 없다.
- shell 파이프, redirection, 변수/명령 치환, 절대·상위 경로, 외부 심볼릭 링크,
  inline interpreter 코드와 시스템 관리/삭제 명령은 거부한다. interpreter는 선행 옵션 없이
  프로젝트 안 스크립트를 직접 지정할 때만 허용한다. 파일 인자는 실행 직전에도 다시 검사하고,
  실행 파일은 명시된 allowlist와 안전한 절대 `PATH`에서만 찾는다.
- 프로젝트별·기기별 동시 실행은 하나로 제한하며, 일반 명령은 60초, Git push는 120초,
  빌드 명령은 180초 제한을 적용한다. stdout/stderr도 각각 128 KiB까지만 반환하고
  Bridge·사용자 홈·원격 URL과 일반적인 credential 형식은 응답에서 가린다.
- 자식 프로세스에는 API key나 Bridge token을 전달하지 않는다. 다만 빌드 도구, interpreter,
  Git hook과 프로젝트 스크립트는 다시 하위 프로그램을 실행할 수 있는 프로젝트 코드다.
  따라서 명령별 권한과 아래 Git 제한은 악성 프로젝트 코드를 가두는 OS sandbox가 아니다.
  신뢰한 프로젝트만 실행하고, 강한 격리나 credential 분리가 필요하면 Bridge 자체를 전용
  비권한 OS 계정 또는 container/VM에서 실행해야 한다.

입력창에서 직접 준비한 `git push`는 `git push`, `git push <remote> <현재-branch>`, `git push -u <remote>
<현재-branch>`만 지원한다. force/mirror/tag/refspec/다른 branch/임의 URL은 허용하지 않으며,
준비 후 HEAD·현재 branch·원격 URL 중 하나라도 바뀌면 실행을 취소한다. 원격 host는
`LIFEHUB_GIT_PUSH_HOSTS`의 정확한 allowlist와 일치해야 한다. Git 인증은 서버에 미리 준비한
repo 전용 deploy key 또는 짧은 수명의 GitHub App credential을 사용하고 앱 입력창, URL,
저장소 파일에 token을 넣지 않는다. 실행은 `GIT_TERMINAL_PROMPT=0`으로 비대화형이며 인증이
없으면 안전하게 실패한다. 프로젝트 스크립트가 내부에서 실행하는 Git까지 이 argv 정책이
중개하지는 않으므로, credential이 있는 Bridge에서는 검토되지 않은 build/interpreter 명령을
승인하지 않는다.

## 네트워크 설정

기본 bind는 `127.0.0.1:4317`이다. LAN 또는 사용자가 관리하는 Tailscale/VPN 주소로 열 때만 `LIFEHUB_BRIDGE_LAN=1`과 명시적인 host를 함께 설정한다.

```bash
LIFEHUB_BRIDGE_LAN=1 \
LIFEHUB_BRIDGE_HOST=192.0.2.10 \
LIFEHUB_BRIDGE_ALLOWED_ORIGINS=capacitor://localhost,https://appassets.androidplatform.net \
npm run bridge:start
```

`192.0.2.10`은 예시 주소다. 실제 사설/VPN 주소는 소스나 커밋에 넣지 않는다. `0.0.0.0`은 필요한 경우에만 사용하고 OS 방화벽에서 휴대폰/VPN 대역으로 제한한다. Bridge 자체는 TLS 종료를 제공하지 않으므로 신뢰하지 않는 Wi-Fi나 인터넷에 직접 노출하지 말고 Tailscale/VPN 또는 사용자가 관리하는 TLS reverse proxy를 사용한다.

| 환경 변수 | 기본값 / 의미 |
| --- | --- |
| `LIFEHUB_BRIDGE_HOST` | `127.0.0.1` |
| `LIFEHUB_BRIDGE_PORT` | `4317` |
| `LIFEHUB_BRIDGE_LAN` | `1`일 때만 loopback 밖 bind 허용 |
| `LIFEHUB_BRIDGE_ALLOWED_ORIGINS` | Android WebView origin 두 개, 쉼표 구분 |
| `LIFEHUB_BRIDGE_REMOTE_COMMANDS` | `1`일 때만 등록 프로젝트 원격 명령 활성화 |
| `LIFEHUB_GIT_PUSH_HOSTS` | push를 허용할 정확한 Git host, 기본 `github.com` |
| `LIFEHUB_BRIDGE_NAME` | PC hostname 대신 표시할 이름 |
| `LIFEHUB_BRIDGE_DATA_DIR` | 기본 `~/.lifehub-bridge` |
| `LIFEHUB_BRIDGE_BODY_LIMIT` | 기본 64 KiB, 최대 1 MiB |
| `LIFEHUB_BRIDGE_RATE_WINDOW_MS` | 기본 60초 |
| `LIFEHUB_BRIDGE_RATE_MAX` | 기본 IP당 120회/창 |
| `LIFEHUB_PAIR_CODE_TTL_MS` | 기본 5분, 최대 15분 |
| `LIFEHUB_PAIR_REQUEST_TTL_MS` | 기본 10분, 최대 30분 |

## API와 인증

페어링과 엄격히 제한된 로컬 웹 연결 bootstrap을 제외한 API는 `Authorization: Bearer <device-token>`이 필요하다. 페어링 코드는 토큰이 아니며, 코드 제출 뒤에도 관리자의 명시 승인이 있어야 기기 토큰이 발급된다. 관리자 웹과 전용 관리 API는 loopback reverse proxy 요청과 별도 관리자 Basic 인증을 모두 요구한다. 기존 CLI 호환용 로컬 관리자 header 인증도 유지한다.

- `GET /admin/` (관리자 웹)
- `GET /admin/api/status`
- `POST /admin/api/pair-code`
- `POST /admin/api/pair/approve`
- `POST /admin/api/pair/reject`
- `POST /admin/api/device/revoke`

- `GET /api/health`
- `GET /api/device/status`
- `POST /api/food/analyze`
- `POST /api/local/connect` (직접 연 loopback 브라우저 전용)
- `POST /api/pair/request`
- `POST /api/pair/approve`
- `POST /api/pair/revoke`
- `GET /api/projects`
- `POST /api/projects/register` (loopback PC 관리자 전용)
- `POST /api/projects/:id/commands/prepare` (원격 명령 opt-in, 일회성 확인 생성)
- `POST /api/projects/:id/commands/execute` (확인된 정확한 명령 실행)
- `GET /api/threads`
- `POST /api/threads`
- `GET /api/threads/:id`
- `POST /api/threads/:id/messages`
- `POST /api/threads/:id/cancel`
- `GET /api/threads/:id/events` (SSE, `Last-Event-ID` 재개)
- `GET /api/threads/:id/changes`
- `POST /api/threads/:id/approve`
- `POST /api/threads/:id/reject`

앱 대화 ID와 SDK thread ID는 Bridge 상태에 함께 저장된다. 앱을 닫았다 열어도 SDK thread를 `resumeThread()`로 이어간다. Bridge가 실행 도중 재시작되면 남아 있던 `running` 메시지는 실패 상태로 복구되어 재전송할 수 있다. 대화 목록 API는 큰 native 응답을 피하려고 요약만 반환하고, 단일 대화 API는 최근 메시지/이벤트를 약 1.5 MiB 이내로 제한해 반환한다.

## 음식 사진 분석 API

음식 사진 분석은 서버에서 이미 로그인된 Codex 세션을 공식 SDK로 호출한다. APK와 웹 요청에는 Codex 인증 정보나 모델 설정이 들어가지 않으며, 연결 기기의 Bearer token과 `chat` 권한만 사용한다.

```http
POST /api/food/analyze
Authorization: Bearer <device-token>
Content-Type: application/json

{"imageDataUrl":"data:image/jpeg;base64,..."}
```

성공 응답은 다음 일곱 필드만 포함한다.

```json
{
  "foodName": "김치볶음밥",
  "caloriesKcal": 620,
  "carbohydratesGrams": 88,
  "proteinGrams": 18,
  "fatGrams": 22,
  "confidence": 0.82,
  "notes": "사진 전체 1인분 기준 추정치"
}
```

- JPEG, PNG, WEBP Base64 data URL만 허용하며 MIME, 실제 magic bytes, 이미지 크기와 총 픽셀 수를 검증한다.
- 디코딩된 이미지는 최대 1.5 MiB다. 이 endpoint만 약 2.2 MiB의 고정 JSON body 제한을 사용하며 일반 `LIFEHUB_BRIDGE_BODY_LIMIT`을 늘리지 않는다.
- `foodName`은 1~80자, `caloriesKcal`은 정수 1~10000, 탄수화물·단백질·지방은 각각 유한한 0~2000, `confidence`는 0~1, `notes`는 0~300자다.
- 사진에 음식이 없거나 식별할 수 없으면 내부 structured output의 `status: "not_food"`와 0 sentinel을 검증한 뒤 외부에는 수치를 반환하지 않고 `422 FOOD_NOT_RECOGNIZED`로 처리한다. 결과는 사진 기반 추정치이며 의료 진단이나 확정 영양성분이 아니다.
- 같은 기기에서 이미 분석 중이면 `409 FOOD_ANALYSIS_IN_PROGRESS`를 반환하고, 기기별 분당 10회로 제한한다. 내부 분석 제한은 75초이며 timeout은 `504 FOOD_ANALYSIS_TIMEOUT`이다. HTTP client 연결 종료나 기기 token 폐기는 진행 중 Codex turn을 abort하고 늦게 도착한 결과도 폐기한다.
- SDK에는 임시 `0700` 디렉터리의 `0600` 이미지 파일만 `local_image`로 전달한다. 음식 전용 wrapper는 `--ignore-user-config --ignore-rules --ephemeral`을 강제한다. 전용 thread는 read-only이고 shell/unified-exec, MCP/apps, web search, network, image generation, multi-agent를 끈다. 전체 스트림에서 추론·최종 응답 이외의 item이 시작되면 fail-closed 처리한다.
- 성공·실패·timeout 뒤 임시 이미지를 삭제하고, 한 시간 이상 남은 전용 임시 디렉터리도 정리한다. 인증·사용량·실행 오류는 `CODEX_LOGIN_REQUIRED`, `CODEX_USAGE_LIMIT`, `CODEX_UNAVAILABLE`, `FOOD_ANALYSIS_MODEL_FAILED` 계열로 안전하게 매핑하며 원문이나 인증 정보를 앱에 반환하지 않는다.

## 승인과 보안 경계

- 일반·원격 기기에 부여된 권한은 상한일 뿐 이번 turn의 권한으로 자동 승격하지 않는다. Bridge는 메시지 의도와 `approvalContext`의 파일/명령을 교차 확인해 최소 turn 권한만 만든다. 유일한 예외는 위에서 설명한 `device_local_web` Codex의 명시적 `localWorkspaceAccess` turn이며, 이 경우에도 클라이언트가 요청하지 않은 권한은 추가하지 않는다.
- 일반 승인 흐름의 비승인 turn은 SDK `read-only` sandbox와 `approvalPolicy: "untrusted"`를 사용한다. `command:execute`만 승인한 turn도 파일을 쓸 수 없도록 `read-only`를 유지한다. `file:write`, `build:execute`, `git` 중 하나가 승인되었거나 로컬 작업공간 turn에 명시된 경우에만 `workspace-write`를 사용한다.
- `file:write`에는 항상 비어 있지 않은 프로젝트 상대 파일/디렉터리 목록이 필요하다. 일반 turn의 `command:execute`/`build:execute`/`git`에는 비어 있지 않은 정확한 명령 목록도 필수다. 로컬 작업공간 turn은 명령 목록과 정확히 비교하지 않지만 권한 분류·프로젝트 경로·위험 명령 검사는 유지한다.
- `이 작업 동안` 승인은 권한만 저장하지 않고 정확한 파일과 명령 범위를 함께 저장한다. 이후 요청이 그 범위의 부분집합일 때만 재사용하며, 구형 범위 없는 grant는 시작 시 폐기한다.
- 일반 흐름과 로컬 작업공간의 위험/삭제 요청은 항상 `critical`/이번만 승인이 되며, task 범위 승인을 요청해도 `once`로 축소된다. 모델이 비삭제 요청에서 예고하지 않은 파일 삭제 event를 내보내면 별도 critical 승인이 없으므로 중단한다.
- 일반 흐름에서 승인된 명령은 단순 argv로 해석 가능한 개별 명령만 허용한다. 절대 경로, `..`, 홈 확장, 외부 심볼릭 링크, 복합 shell/interpreter 표현은 승인 전에 거부한다. `/bin/bash -c '…'`와 `-lc` SDK event는 내부 단일 명령으로 canonicalize해 정확히 비교한다. 로컬 작업공간 turn은 정확한 문자열 비교만 생략한다.
- runtime SDK event가 승인 파일·권한 범위를 벗어나거나 MCP/app/web 도구를 호출하면 즉시 중단한다. 일반 turn은 승인 명령의 정확한 범위도 검사한다.
- Bridge 자체 Git 조회는 `spawn("git", args, { shell: false })`처럼 인자 배열을 사용한다. 클라이언트 문자열을 shell 명령으로 직접 결합하지 않는다.
- 상태/관리자 파일과 디렉터리는 각각 `0600`/`0700`, 기기 토큰·페어링 secret은 해시로 저장한다. 새 기기 토큰 평문은 승인 claim 응답에서 한 번만 반환한다.
- 요청 크기, IP rate limit, 페어링 전용 강화 rate limit, CORS origin allowlist, 보안 응답 헤더, 페어링 만료/폐기, 민감 문자열 redaction을 적용한다.
- SDK 자식 프로세스에는 `HOME`, `CODEX_HOME`, `PATH` 등 최소 환경만 전달하고 API key/access token/refresh token 및 다른 애플리케이션 secret 환경 변수를 상속하지 않는다.
- SDK 원문 오류는 앱이나 상태 파일에 복사하지 않는다. 사용량/크레딧 한도는 `CODEX_USAGE_LIMIT`, 인증 실패는 `CODEX_LOGIN_REQUIRED`, 나머지는 일반 실행 오류로 안전하게 분류한다.
- SDK용 wrapper는 `codex exec --ignore-user-config`를 강제하되 `CODEX_HOME`의 로그인 캐시는 그대로 사용한다. 공통 config로 web search, hooks, apps, browser/computer use, remote plugin, skill-MCP dependency install을 끄고 관련 event도 fail-closed 처리한다.
- `command:execute`/`build:execute`/`git`이 없는 turn은 shell/unified-exec 기능도 끈다. 공식 SDK 실제 E2E에서 이 상태의 `file:write`가 별도 file-change 도구로 정상 동작함을 확인한다.

현재 공식 TypeScript SDK는 실행 중 개별 shell/file 도구 요청을 모바일로 전달하고 승인 결과를 다시 주입하는 per-tool callback을 노출하지 않는다. 따라서 Bridge는 **정확한 turn 범위의 사전 승인**과 SDK event 기반 검증을 결합한다. command event는 명령이 시작된 뒤, file-change event는 변경 적용 뒤 도착할 수 있으므로 event 검증만으로 완전한 사전 차단을 보장할 수 없다. 이 때문에 범위 없는 변경 승인은 허용하지 않고, shell을 켜는 turn도 정확한 명령을 필수로 한다.

또한 SDK sandbox의 읽기 루트 자체를 Bridge가 별도 OS 정책으로 축소하는 API는 없다. 쓰기는 선택 프로젝트 workspace로 제한하지만, 다른 로컬 파일에 대한 강한 기밀성 격리가 필요하면 전용 OS 계정이나 컨테이너/VM 안에서 Bridge와 Codex를 실행한다. 이 제한 때문에 Bridge를 무인증으로 외부 인터넷에 노출해서는 안 된다.

## 검증

```bash
npm run bridge:build
npm run bridge:test
npm test

# 로컬 로그인된 공식 SDK로 임시 프로젝트 E2E (명시적으로 선택한 경우만)
LIFEHUB_REAL_CODEX_E2E=1 npm run bridge:test
```

기본 테스트는 잘못되거나 만료된 코드, 관리자 웹 인증·CSP·Origin·secret 비노출, 웹 기반 코드 발급·승인·폐기, 기기 토큰 폐기와 실행 중단, traversal/외부 심볼릭 링크와 루트 교체, 최소 turn 권한, 정확한 task 범위, 승인/거부, 삭제/MCP/web 위험 범위 위반, 전체 HTTP API, 스트리밍/SSE 재연결, SDK thread 재개, Bridge 재시작 복구, CORS/본문 제한을 포함한다. Opt-in E2E는 인증 내용을 출력하지 않고 임시 Git 프로젝트에서 실제 SDK thread ID 재개와 승인된 단일 파일 생성을 검증한다.
