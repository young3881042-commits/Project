# Orbit 여행 연결 (Termux 대기 방식)

일반 Docker 배포와 별개인 이 휴대폰의 로컬 보조 프로세스입니다. 새로 설치하는 APK는 Orbit 하나입니다. 기존 Termux의 Node와 로그인된 Codex를 그대로 사용합니다.

## 현재 기기 사용

1. 다운로드 폴더의 Orbit-latest.apk를 기존 Orbit 위에 업데이트합니다 (0.8.2-debug, 33).
2. 최초 연결 때만 여행 → Termux 연결에 8자리 코드를 입력합니다. 기존에 페어링했다면 저장된 native 인증을 그대로 사용합니다.
3. 가벼운 loopback HTTP 프로세스만 대기하고 Codex는 여행 생성 요청이 있을 때 실행한 뒤 종료합니다. 별도 API 키나 RUN_COMMAND 권한은 요구하지 않습니다.
4. 재부팅하거나 Android가 Termux를 종료하면 Termux 터미널을 새로 열어주세요. 이 기기는 새 interactive Bash 터미널에서 연결 프로세스를 한 번 확인·재시작하도록 준비했습니다. 필요하면 `~/.local/bin/orbit-travel`을 실행합니다. 이 명령은 새 연결 코드를 보여주지만 기존 인증은 바꾸지 않습니다.

현재 Play스토어 Termux `googleplay.2026.06.21`의 설치 APK를 확인한 결과 RUN_COMMAND 권한과 RunCommandService가 없습니다. v29의 자동 깨우기/권한 안내는 이 기기에서 사용할 수 없어 v30에서 제거했습니다. 앱이 꺼진 Termux를 완전히 자동으로 깨울 수 있다고 안내하지 않습니다.

## 준비 및 유지보수

서버는 Node 내장 모듈만 사용하는 단일 ESM으로 APK의 `assets/orbit-travel-runtime.mjs`에도 포함됩니다. 유지보수 시 저장소에서 빌드·설치합니다:

```sh
node scripts/build_travel_runtime.mjs /data/data/com.termux/files/usr/tmp/orbit-travel-runtime.mjs
node tools/orbit-travel/install-termux.mjs /data/data/com.termux/files/usr/tmp/orbit-travel-runtime.mjs
~/.local/bin/orbit-travel
```

설치기는 Termux private `~/.local/state/orbit-travel/standby.mjs`, `~/.local/bin/orbit-travel` 및 `~/.bashrc`의 명시적인 관리 블록만 준비합니다. 기존 인증 파일·기록·다른 설정은 유지합니다. 새 프로세스는 detached로 시작하며 중복 시작은 인증된 상태 확인과 loopback 포트 바인딩으로 막습니다. helper는 bearer 토큰을 stdout에 출력하지 않습니다.

화면이 숨겨지면 웹 polling을 멈추고 보이면 재개합니다. 주기적인 watchdog, boot 자동 시작, wake lock은 추가하지 않습니다. 대기 프로세스는 메모리를 사용하며 배터리 소모량은 기기 사용 조건에 따라 달라집니다. Android가 생성 도중 프로세스를 종료하면 진행 작업은 다시 생성해야 합니다. 앱에 도착한 미리보기와 저장한 여행은 기기에 남습니다. 결과는 내 여행에 저장해야 백업에 포함됩니다.

## 연결 경계

- 127.0.0.1:4319만 사용하고 socket/Host/Origin 검사, 고정 CORS, bearer 인증을 유지합니다. localhost라는 이유로 인증을 생략하지 않습니다.
- 최초 연결 코드는 8자리·10분·1회용이며 시도 횟수를 제한합니다. 인증은 Termux private auth(0600), Android private preferences에만 보관하고 APK·백업·로그에 넣지 않습니다.
- Android는 status/pair/create/poll/cancel만 HTTP로 호출합니다. availability는 저장된 인증 유무만 확인합니다. 명령·주소·모델·파일 경로를 웹 입력으로 받지 않습니다.
- HTTPS WebView의 신뢰 origin, mixed content 금지, 127.0.0.1 한 호스트의 native HTTP 예외를 유지합니다.
- 생성 입력은 최대 16KiB, 결과는 128KiB, 동시 생성은 1개입니다. 중복 request ID 재시도는 생성기를 다시 실행하지 않습니다. 완료 결과는 다음 요청 시 30분/20개 경계로 정리합니다.
- Codex는 사용자 설정/규칙 무시, 임시 폴더, ephemeral, read-only, 구조화 JSON으로 실행합니다. 여행 입력만 사용하고 shell/파일 변경/apps/MCP/다중 에이전트는 차단하며 공개 웹 검색만 허용합니다. 메모·가계부를 읽거나 예약·결제를 수행하지 않습니다.

## 검증

```sh
node --test tools/orbit-travel/*.test.mjs
node --test apps/web/src/features/travel/*.test.js
```

일반 테스트는 가짜 생성기를 사용합니다. 실제 사용에는 Codex 계정 사용 한도가 적용되며 로그인 자체가 만료되면 Termux에서 다시 로그인해야 합니다. 일반 HTTPS/PWA는 로컬 생성 연결을 제공하지 않습니다. 같은 기기의 Vite 개발 origin은 기존 sessionStorage 인증을 사용합니다.

## AI 대화

Orbit 0.8.2-debug(33)의 AI 탭은 여행과 같은 인증을 사용합니다. 목적별로 대화를 만들고 제목·목적을 수정하거나 이전 대화를 이어갈 수 있습니다. 현재 대화의 최근 20개 메시지와 같은 폴더에서 찾은 관련 과거 대화 최대 4개가 AI에 전달됩니다. 생성은 여행/대화를 합쳐 한 번에 하나입니다.

대화는 Termux의 ~/.local/share/orbit/chats/에 UUID별 JSON과 Markdown으로 자동 저장됩니다 (디렉터리 0700, 파일 0600). JSON이 원본이며 Markdown은 재시작 시 원본에서 복구합니다. 앱에서 파일 내보내기를 누르면 Android 문서 저장 창으로 원하는 위치에 .md 사본을 만들 수 있습니다. 생활 기록 백업과는 별도입니다.

최대 200개 대화, 대화당 100개 메시지/140KB, 입력 4,000자, 답변 8,000자입니다. 대화가 길어지면 새 대화를 만듭니다. 실패/중단/재시작 후 마지막 메시지 다시 시도는 이미 저장한 사용자 메시지를 중복 추가하지 않습니다. 오프라인에서는 기기에 캐시된 대화를 읽을 수 있고 새 답변은 연결이 필요합니다.

### 대화 검색 패치

별도 서버나 임베딩 API 없이 기존 프로세스의 `node:sqlite`로 검색합니다. Node 22.13 이상과 FTS5 지원이 필요합니다 (이 기기: Node 26.3.1). 검색용 파일은 `~/.local/share/orbit/chats/search-v1.sqlite`이며 JSON 원본에서 복구할 수 있습니다. SQLite 파일을 공개 저장소에 넣지 마세요.

초기 실행 시 기존 대화를 색인하고, 이후 메시지를 저장할 때 바뀐 질문·답변만 반영합니다. 조회/대기 중에는 재색인하지 않고 검색은 질문할 때만 합니다. 한국어 단어와 2음절 토큰을 사용하는 키워드 검색이므로 표현이 완전히 다른 동의어의 의미 검색은 지원하지 않습니다. 사용자 발언과 AI 제안은 별도 필드로 유지합니다. 같은 폴더만 검색하며 답변의 출처 버튼으로 원문을 열 수 있습니다.

런타임 번들을 교체한 뒤에는 진행 중 생성이 없을 때 기존 연결 프로세스를 재시작해야 반영됩니다. 인증 파일은 유지합니다. APK만 업데이트하면 이미 실행 중인 Termux 코드가 자동 교체되지는 않습니다. 이번 기기 패치는 번들 교체와 서버 재시작까지 적용했습니다.

참고: [Node SQLite](https://nodejs.org/api/sqlite.html), [SQLite FTS5](https://www.sqlite.org/fts5.html).

## 알림 사용처 검색 분류

가계부 알림 가져오기는 기존 사용처 분류를 먼저 재사용하고 기타만 merchant/jobs에 요청합니다. 검색에는 사용처 이름과 분류 목록만 포함하며 금액/원문/계좌는 보내지 않습니다. 실제 검색과 공개 출처가 확인된 높은 확신 결과만 적용하고 불확실하면 기타로 남깁니다. 동시 실행은 여행/대화/분류 전체 한 개입니다. 새 API 키나 Termux 실행 권한은 필요하지 않습니다. 결제를 먼저 저장한 뒤 분류를 보완하므로 연결이 없어도 결제는 보관됩니다.
