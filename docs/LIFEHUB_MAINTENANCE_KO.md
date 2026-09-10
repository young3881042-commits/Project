# Orbit LifeHub 유지보수 기준

마지막 갱신: 2026-09-09

이 문서는 같은 요구를 다시 해석하거나 이미 끝난 UI를 되돌리는 일을 막기 위한 현행 기준서다. 작업 전 `AGENTS.md`, 이 문서, `docs/WEB_UI_UX_AUDIT_KO.md`, `git diff` 순서로 읽는다. 오래된 화면 인수인계 문서보다 이 문서의 현재 기준을 우선한다.

## 2026-09-09 알림 거래 기존 분류 재사용·검색 분류 (현행)

- 알림 가져오기는 사용처의 NFKC/공백/대소문자 정규화 후 같은 사용처의 최근 기존 지출 분류를 우선 재사용하고 다음으로 기존 키워드 규칙을 적용한다. 알려진 분류를 설정 변경이나 반복 카카오페이 상호 정리로 기타로 되돌리지 않는다.
- `merchantCategorySearch.js`는 결제 저장/ack 이후 선택한 알림 소스의 기타 거래만 처리한다. 이미 있던 기타도 대상이며, 사용처 최대 8개를 한 번에 검색한다. 사용자별 결과 캐시는 성공 30일/불확실 1일/연결 실패 10분으로 반복 검색을 줄인다. 숨긴 화면에서는 진행 조회를 멈춘다.
- 검색 전후 최신 가계부를 다시 읽고, 요청 당시 대상의 ID·사용처가 그대로이며 아직 기타인 항목만 변경한다. 사용자가 수정한 분류/사용처, 삭제한 거래, 다른 사용자 세션을 늦은 결과가 덮지 않는다. 분류 실패와 별개로 원래 결제는 먼저 저장한다.
- 기존 authenticated loopback 서버의 `merchant/jobs` 경로와 Android 고정 merchant-create/merchant-poll 액션만 추가했다. 검색에는 공개 사용처명과 선택 가능한 분류 이름만 전송하고 금액·알림 원문·잔액·계좌·이벤트 ID는 보내지 않는다. 민감 숫자/연락처처럼 보이는 이름은 제외한다.
- 실제 웹 검색 이벤트, 높은 확신, 허용된 분류와 공개 HTTPS 출처가 있을 때만 적용한다. 원시 URL과 단일 Markdown 링크를 정규화한다. 애매한 사용처는 기타로 유지한다. Codex 검색은 여행·AI 대화와 같은 동시 작업 제한을 공유하며 별도 서버·권한은 없다.
- orbit-web-v55, Android 0.8.6-debug(37). 기존 Termux 인증을 유지하며 서버 번들을 반영했다.

## 2026-09-07 네이버 한국어 자료 우선 (현행)

- `tools/orbit-travel/travel-research.mjs`가 여행 생성의 검색 지시를 소유한다. 한국어 검색으로 네이버 통합검색을 먼저 시도하고 접근이 안 되면 기존 검색 도구의 네이버 지도/플레이스/블로그 도메인 검색을 사용한다. 검색 엔진 자체를 네이버 API로 교체한 것은 아니며 별도 API 키나 서비스는 없다.
- 영업시간·휴무·가격은 공식 자료와 교차 확인하고 네이버 자료가 부족하면 한국어 관광/업체 공식 자료로 보완하며 팁에 확인 한계를 남긴다. 실제 참고 URL만 반환하고 방문하지 않은 페이지를 확인했다고 주장하지 않도록 지시한다. 검색어에는 여행지/공개 장소명만 쓰며 전체 요청·예약번호·개인 기록을 전송하지 않는다.
- 화면 안내도 네이버 한국어 자료 우선으로 갱신했다. 10~22시·기존 일정/인증·로컬 대화 검색은 유지한다. orbit-web-v54, Android 0.8.5-debug(36).

## 2026-09-07 여행 이모지·여백·시간 범위 (현행)

- 여행 입력에 위치/날짜/인원/취향 이모지, 일정에 장소/이동/비용 이모지를 넣고 입력 간격·카드 사이·설명 행간을 넓혔다. 장식 이모지는 가능한 곳에서 접근성 이름에 중복되지 않게 처리한다.
- 새 여행은 매일 현지 시간 10:00~22:00 범위로 생성한다. 생성 지시에 10시 시작·22시 귀환/휴식, 식사·휴식·실제 이동시간을 명시한다. `validateGeneratedTravelPlan`이 시간 범위 밖 결과를 거부하며 기존 `validateTravelPlan`은 저장된 과거 여행과 백업의 호환성을 유지한다.
- 입력 화면에 고정 시간 범위를 안내한다. 기존 대기 서버의 번들을 교체하고 인증을 유지하며 재시작했다. 별도 프로세스나 권한은 추가하지 않는다.
- orbit-web-v53, Android 0.8.4-debug(35).

## 2026-09-07 여행 입력·일정 읽기 개선 (현행)

- 여행 만들기는 큰 홍보 헤더 없이 입력부터 시작한다. 여행지, 출발일·기간, 종료일 안내, 인원 증감, 여행 속도 버튼을 제공하고 취향·요청과 이전 초안 가져오기는 보조 동작으로 둔다. 연결 도움말은 작업 영역 아래에 둔다.
- 생성 중에는 진행 안내·취소를 보여주고 입력폼을 숨긴다. 완료하면 결과 화면으로 전환한다. 조건 수정으로 기존 입력을 다시 열고, 재생성하지 않고 결과로 돌아갈 수 있다. 초안/미리보기/저장 데이터 형식과 기존 재생성 확인은 유지한다.
- 결과 상단에 저장·조건 수정 버튼을 모으고 날짜별 버튼과 이전/다음 날 이동을 제공한다. 시간·제목·장소를 먼저 보여주며 설명·이동·비용은 장소별 펼침 또는 모두 펼치기로 읽는다. 긴 전체 소개도 접는다. 같은 일정 컴포넌트를 내 여행에서도 사용한다.
- orbit-web-v52, Android 0.8.3-debug(34). 기존 AI 검색과 Termux 서버를 변경하거나 재시작하지 않는다.

## 2026-09-07 로컬 대화 검색 (현행)

- `tools/orbit-travel/chat-memory.mjs`가 기존 연결 프로세스 안에서 Node 내장 SQLite FTS5를 사용한다. 별도 DB 서버/임베딩 API/상시 색인 타이머는 없다. Node 22.13+와 FTS5가 필요하며 현재 기기 Node 26.3.1에서 확인했다.
- 기존 JSON은 원본으로 유지하고 같은 private chats 폴더의 `search-v1.sqlite`(0600)에 질문·이어진 AI 답변·원본 메시지 ID·날짜를 구분해 저장한다. 한국어 단어/2음절 토큰으로 검색한다. 의미 임베딩 검색이나 자동 사실 추출은 아니다.
- 최초 사용/재시작 시 원본과 색인을 대조한다. 평소에는 바뀐 질문·답변만 갱신하고 단순 조회/진행 상태 변경은 재색인하지 않는다. 폴더 이동·제목 변경은 메타데이터만 갱신한다. 손상된 검색 DB는 private 사본을 보존하고 JSON에서 재구축한다. 색인 실패 시 원본 저장/일반 대화를 유지하며 답변에 검색 미사용 안내를 붙인다.
- 질문 시 같은 폴더에서 최대 4개 질문·답변 발췌(각 사용자/AI 700자)를 검색한다. 최근 20개 메시지와 겹치는 현재 대화 항목은 제외하고 그보다 오래된 현재 대화는 포함한다. 다른 폴더와 생활 기록은 검색하지 않는다.
- assistant 메시지의 `memorySources`에 원문 참조를 저장하고 답변 아래 접힌 출처에서 원문으로 이동한다. UI는 폴더 탭+채팅 형태를 유지한다. API 경로·Android 권한·인증 경계는 기존과 같다.

## 2026-09-06 목적별 AI 대화 (현행)

- 사용자 명시 요청으로 여행 옆 AI 탭(/ai)을 추가한다. 하단은 홈·일정·메모·가계부·여행·AI 6개다. 보관 중인 AiAssistantPage/앱 수정/PC Bridge/운동·식단은 계속 비활성이고 /ai/edit, /ai/settings는 홈으로 간다.
- features/ai-chat의 화면·hook·파일 adapter가 목적 선택/직접 입력, 제목 수정, 대화 목록, 메시지 재시도·중단, 오프라인 열람용 캐시, Markdown 내보내기를 담당한다. LifeHubApp은 lazy route 조립만 담당하며 CSS는 orbit-chat.css다.
- AI 기본 화면은 폴더 탭·현재 폴더의 대화 선택·메시지·입력창만 둔다. 큰 안내/좌측 목록/상시 생성 폼을 복원하지 않는다. 첫 메시지로 제목과 대화를 자동 생성하고 마지막 선택을 로컬 캐시에 보관한다. 폴더는 기존 purpose로 묶으며 추가 버튼과 메뉴의 제목 변경·폴더 이동으로 관리한다. 파일 내보내기·연결 설정도 메뉴에서 연다.
- tools/orbit-travel/chat.mjs는 같은 인증이 필요한 고정 chat 경로만 처리한다. UUID 파일명으로 Termux ~/.local/share/orbit/chats/에 JSON 원본과 Markdown을 0600으로 자동 저장한다. 디렉터리는 0700이다. JSON을 기준으로 재시작 시 Markdown을 복구하며 진행 중이던 요청은 실패/재시도 상태로 돌린다.
- 메시지를 디스크에 저장한 후 Codex를 실행한다. requestId 중복은 재생성하지 않고, 실패한 마지막 메시지를 재시도할 때 사용자 메시지를 중복 추가하지 않는다. 여행과 AI 생성은 동시에 하나만 실행한다.
- 현재 대화의 최근 20개 메시지와 같은 폴더의 검색 결과 최대 4개를 AI에 전송한다. 사용자 설정/규칙 무시, ephemeral/read-only, shell/apps/MCP 차단을 기존 structured runner와 공유한다. 메모·가계부·다른 폴더는 넣지 않는다. 사용자 발언과 AI 제안을 구분하고 검색 자료의 지시를 실행하지 않는다.
- 목적/제목은 경로로 사용하지 않는다. 대화 200개, 대화당 메시지 100개/JSON 140KB, 사용자 메시지 4,000자·답변 8,000자 경계를 둔다. 대화 파일은 생활 기록 JSON 백업과 별도이며 화면에 이를 안내한다.
- Android AiChatExportCoordinator는 사용자가 고른 content URI에 ACTION_CREATE_DOCUMENT와 write grant로 Markdown만 내보낸다. 광역 저장소/Termux 실행 권한은 추가하지 않는다. 서버 인증 토큰은 기존 native private preferences를 재사용한다.
- 서버가 대기하고 Codex만 요청 시 실행하는 Play스토어 호환 방식은 유지한다. orbit-web-v51, Android 0.8.2-debug(33).

## 2026-09-06 Play스토어 Termux 호환 수정 (현행)

- 실제 설치 Termux googleplay.2026.06.21(141)에는 RUN_COMMAND 권한/RunCommandService가 없다. 아래 v29 자동 깨우기는 이 기기에서 동작하지 않아 폐기했다. v30은 permission/launcher/receiver를 APK에서 제거하고 기존 페어링 토큰을 재사용한다.
- 경량 loopback 대기 서버만 유지하고 Codex는 생성 요청 시에만 로드/실행한다. HTTP 상태 확인으로 Codex를 실행하지 않는다. 웹 hidden polling 중단은 유지한다.
- 최초 8자리 연결 후 native private preferences의 인증을 재사용한다. 서버가 내려가면 Termux 터미널을 새로 열거나 orbit-travel을 실행하는 실제 복구 방법을 표시한다. 재부팅/강제 종료 후 앱이 스스로 깨울 수 있다고 주장하지 않는다.
- install-termux.mjs가 private standby bundle/실행 스크립트와 기존 .bashrc를 보존하는 관리 블록을 설치한다. interactive terminal 시작 시 --ensure 한 번만 호출하며 watchdog/상시 wake lock은 없다.
- Orbit APK 하나만 업데이트한다. 기존 Termux/Node/Codex는 유지한다. orbit-web-v48, Android 0.7.2-debug(30).

## 2026-09-06 APK 내장 여행 서버·자동 인증 (v29 이력, 현행에서는 폐기)

- 명시적인 사용자 후속 요청으로 여행 서버 코드를 APK asset에 포함한다. `scripts/build_travel_runtime.mjs`가 Node 내장 모듈만 쓰는 단일 ESM으로 묶는다. Codex와 Node 실행 환경은 기존 Termux를 사용한다.
- `TravelRuntimeLauncher`는 APK 소스만 stdin으로 넘기는 고정 RUN_COMMAND 호출을 담당한다. 웹으로부터 명령/경로/인증값을 받지 않는다. `TravelRuntimeReceiver`는 non-exported이며 일회용 PendingIntent 응답의 토큰만 검증한다. 자동 인증값은 기존 native private preferences에 저장한다.
- 처음 한 번 Android RUN_COMMAND 허용과 Termux allow-external-apps 설정이 필요하다. 여행 탭 진입은 로컬 availability만 확인한다. 실제 요청 시 서버가 꺼져 있거나 인증이 없으면 자동 시작·복구하고, 인증 거절/접속 거부에 한해 한 번 재시도한다. 전송 후 timeout인 생성 요청을 임의로 중복 실행하지 않는다.
- 앱에 결과가 조회된 뒤 2분간 요청이 없으면 자동 실행 서버를 종료한다. active 생성과 아직 조회하지 않은 30분 내 결과는 유지한다. 웹은 hidden 중 polling을 중단한다. boot 자동 실행/상시 wake lock은 없다.
- `orbit-web-v47`, Android `0.7.1-debug`(29). 기존 8자리 수동 연결은 접힌 도움말에 유지한다. 실제 설치 후 시스템 권한 승인과 앱→Termux PendingIntent 왕복은 기기에서 확인해야 한다.

## 2026-09-06 여행 초안 정리·Termux Codex 연결

- 명시적인 사용자 요청으로 여행에 한해 기능 범위를 확장한다. 하단은 `홈·일정·메모·가계부·여행` 5탭이며 `/travel`로 진입한다. `/planner`, `/plans`는 새 여행 화면으로 연결한다. 기존 AI 채팅/앱 수정/운동·식단은 계속 비활성이다.
- 기존 `components/travel/TravelPlannerPage.jsx`를 간결한 입력 화면으로 고쳤다. 기본 정보와 접힌 취향 입력, 생성 미리보기, 별도 내 여행 목록으로 구분한다. `LocalTripApp`과 대형 검색·샘플 데이터 화면은 APK에 가져오지 않는다.
- `features/travel`이 입력/결과 검증, owner별 초안·진행 작업·미리보기, 연결/취소/재조회, 일차별 결과를 담당한다. 이전 `localtrip-planner-draft`는 명시적으로 불러오고 원본은 삭제하지 않는다. 기존 여행 체크리스트와 새 일정은 `readTrips/saveTrips`와 기존 v2 백업을 그대로 이용한다.
- `tools/orbit-travel`은 이 휴대폰의 로그인된 Codex를 실행하는 별도 loopback 서비스다. 입력 여행 정보만 전송하고 shell/apps/MCP/파일 변경은 허용하지 않는다. 생성 일수·시간 순서·중복·크기·출처를 저장 전에 검증하며 실패/사용 한도/취소를 표시한다.
- Android는 고정 여행 API만 호출하는 `TravelApiCoordinator`와 `TravelApiPolicy`를 사용한다. 평문 예외는 `127.0.0.1` 한 호스트만, WebView mixed content/CSP와 기존 Bridge 제거 경계는 유지한다. 연결 토큰은 private preferences에 보관하고 웹 결과/백업에는 내보내지 않는다.
- `orbit-web-v46`, Android `0.7.0-debug`(28). 실행/재연결/한도/보안 설명은 `tools/orbit-travel/README.md`를 따른다. 일반 Docker 배포에는 이 로컬 서비스를 자동으로 노출하지 않는다.

## 2026-08-23 세션 인수인계 (아래는 당시 완료 기록)

- 완료 범위: 운동·식단 제외와 4탭 구조를 유지한 채, IndexedDB 호환 저장, 월별 정기 결제, 삼성월렛·카카오페이·토스 결제 알림, 가계부 JSON/CSV 공유·거래 수정·월 예산, 날짜별 메모, 일반 텍스트 메모와 `orbit-web-v44`·`0.6.1-debug` APK까지 반영한다.
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

## 2026-09-05 토스 결제 알림 가져오기

- 기존 삼성월렛·카카오페이에 토스 앱을 세 번째 선택 소스로 추가했다. exact package는 `viva.republica.toss`, 공개 source ID는 `toss`다.
- 토스는 송금·입출금·충전·잔액·카드값·결제 예정이 함께 있는 알림을 제외하고, 결제 완료/승인 표현·단일 원화 금액·식별 가능한 사용처가 모두 있을 때만 후보로 만든다.
- 앱 이름 `토스`를 대체 사용처로 저장하지 않으며 알림 원문, 계좌·카드번호, 잔액을 저장하지 않는 기존 native queue 경계를 유지한다.
- 기존 사용자의 선택 소스는 자동으로 넓히지 않는다. 가계부의 `자동 기록`에서 토스를 직접 선택한 이후의 새 알림만 가져온다.
- 설치형 웹 캐시는 `orbit-web-v44`로 갱신한다.
- 웹 전체 회귀 258/258과 86-module production build를 통과했다. Android는 Java compile·native security smoke·exact package allowlist·APK v1/v2/v3 서명·민감정보 검사를 통과했으며, 경량 SDK에 없는 Lint만 문서화된 방식으로 제외했다.
- 설치 파일은 `/sdcard/Download/Orbit-latest.apk`, 226,763바이트, SHA-256 `b4cb7565336df4f5b15b208eb8000e3f8be74fea735a7df28b3fea598927a4aa`다.
- 실제 Android 기기의 토스 결제·송금·입출금 알림 문구는 출시 전 별도로 확인한다.

## 2026-09-05 홈·가계부 가독성과 거래 검색

- 홈 활동 요약은 실제 두 지표에 맞춰 모든 너비에서 2열로 표시하며, 긴 금액을 말줄임하지 않는다. 기간 선택은 `aria-pressed` 버튼 그룹으로 제공한다.
- 월간 지갑은 청록색 금액 영역과 월 예산·지출 비교 영역을 분리한다. 예산이 없으면 이번 달 지출을 먼저 표시하고 진행률은 만들지 않는다. 예산 초과 상태는 제목과 실제 사용률로 표시한다.
- 가계부 4개 내부 메뉴에 기존 공용 아이콘을 추가하고, 거래 제목·날짜·금액·수정/삭제의 표시 순서를 정리한다.
- `features/finance/FinanceLedger.jsx`가 검색·유형 필터·처음 8건/추가 20건 표시를 맡고, `financeLedgerSearch.js`는 사용처·메모·분류·날짜·정확한 금액 검색만 계산한다. 월/카테고리·선택 날짜로 제한된 목록을 전달받으므로 검색이 해당 범위를 넓히지 않는다.
- 검색은 대소문자·전각 입력과 금액의 쉼표/원 단위를 정규화하고, 여러 단어는 모두 일치해야 한다. 내부 알림 식별자를 검색하거나 저장 데이터를 변경하지 않는다.
- 시각 보정은 `styles/lifehub-polish.css`에 두고 production/legacy CSS 진입점에서 함께 불러온다. 설치형 웹 캐시는 `orbit-web-v45`다.

## 2026-09-02 가계부 수동 입력·월별 카테고리 내역

- 월 지갑 아래 내부 메뉴는 `내역(조회)`, `수동 입력(수입·지출)`, `자동 기록(결제 알림·정기 결제)`, `분류·공유(분류 설정·파일)` 4개다. 빠른 입력 폼은 `내역`에 중복 노출하지 않는다.
- 날짜 딥링크는 `내역`을 열고, 새 거래 딥링크·자동 기록의 수동 입력·빈 상태 기록 버튼·거래 수정은 `수동 입력`을 연다.
- `내역`의 카테고리별 지출은 버튼으로 동작한다. 카테고리를 선택하면 현재 연월과 일치하는 해당 카테고리 지출만 거래 날짜와 함께 표시하고, 같은 버튼을 다시 누르거나 `전체 내역`을 누르면 필터를 해제한다.
- 월·카테고리 필터와 연월 표시는 `features/finance/financeCategoryLedger.js`의 순수 함수로 유지하고 단위 테스트한다.
- 자동검증은 웹 전체 테스트 257/257와 Vite production build 86 modules를 통과했다. 초기 JS는 348.73kB(gzip 113.80kB), CSS는 114.52kB(gzip 19.29kB)다.

## 2026-08-30 카카오페이 상호명·가계부 내부 메뉴/분류

- 당시 월 지갑 아래를 3개 메뉴로 나눈 구조는 2026-09-02에 `수동 입력`을 분리한 4개 메뉴로 갱신했다.
- 카카오페이 알림은 `상호명을~ 값`, 조사 포함 라벨, 라벨과 값이 분리된 extras까지 정제한 뒤 상호명을 얻을 수 있을 때만 후보로 만든다. `사용`이 `사용처명`보다 먼저 제거되던 부분 문자열 순서도 바로잡았다.
- Web은 새 native 후보를 다시 정제하고, 기존 카카오페이 자동 기록에 남은 라벨·결제 문구·과거 parser 조각(`처명`, 조사 등)을 앱 시작 시 비파괴적으로 보정한 뒤 현재 분류 규칙을 다시 적용한다.
- 이전 버전이 앱 이름 `카카오페이`만 저장한 거래는 알림 원문을 보관하지 않아 상호명을 추측하거나 삭제하지 않는다. `자동 기록`의 확인 목록에서 날짜·금액을 보고 사용자가 실제 상호명을 입력한다.
- 자동 분류는 native 알림이 전달한 값이 아니라 Web의 정제한 상호명으로만 계산한다. 기본 규칙은 `코레일·티머니 → 교통`, `커피 포함 → 커피`, `다이소·그 외 → 기타`다.
- 가계부의 `분류·공유` 메뉴에서 owner별 사용자 분류와 선택 키워드를 추가할 수 있다. 사용자 키워드는 기본 규칙보다 먼저 적용하며, 저장 시 기존 카드 알림 자동 가져오기 기록도 다시 분류한다. 수동 거래·정기 결제는 사용자가 고른 기존 분류를 바꾸지 않는다.
- 설정은 `features/finance/financeCategories.js`의 owner별 로컬 저장소에 보관한다. 새 분류는 빠른 지출 입력·정기 결제 선택지와 이후 카드 알림 가져오기에 즉시 반영한다.

## 고정된 제품 방향

- 사용자 표시 이름은 `Orbit`이며 기존 package/APK 파일명은 별도 마이그레이션 전까지 유지한다.
- 기본 진입은 `/app`, 하단 탭은 `홈·일정·메모·가계부·여행` 5개다.
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
- Android APK에는 범용 Bridge HTTP/SSE proxy, 과거 Bridge token store, network-status API, 음식 분석 endpoint가 포함되면 안 된다. 평문은 기본 금지하고 위 여행 전용 `127.0.0.1` 예외만 허용한다.
- `features/lifehub-ai`와 `features/life-records` 아래 일부 과거 순수 모듈은 향후 판단을 위해 저장소에 남을 수 있지만 현행 route에서 import하거나 production bundle에 포함하지 않는다.
- 명시적인 새 제품 요구 없이 이 기능이나 홈 카드를 다시 켜지 않는다.

### 결제 알림 가져오기

- Android `NotificationListenerService`는 사용자가 시스템의 알림 접근을 직접 허용한 뒤에만 동작한다. 이 권한은 전체 알림을 볼 수 있는 넓은 특수 접근임을 가계부 화면에서 먼저 고지한다.
- 허용 소스와 exact package는 `samsung-wallet`=`com.samsung.android.spay`, `kakao-pay`=`com.kakaopay.app`, `toss`=`viva.republica.toss` 세 가지다. 사용자가 고른 소스만 본문을 읽으며, 카카오톡·다른 은행·문자 등 다른 앱은 해석 전에 버린다.
- 소스별 결제·승인 문구와 명확한 원화 금액이 있는 새 알림만 후보로 만들고, 입금·출금·송금·이체·충전·잔액·취소·환불·거절·실패·적립·광고는 제외한다.
- 선택 소스 집합은 native private preferences에 보관한다. 이전 `collection-enabled=true` 설치는 삼성월렛 하나를 선택한 것으로 마이그레이션하며, 소스를 끄면 그 소스의 미처리 대기열도 제거한다.
- native private queue에는 owner hash, opaque event ID, 금액, 정제한 사용처, 시각만 보관한다. 알림 원문, 카드·계좌번호, 잔액은 저장·로그·WebView 전달·네트워크 전송하지 않는다.
- 카카오페이는 상호명을 확인할 수 있는 결제만 대기열에 넣는다. 앱 이름을 대체 상호로 기록하지 않는다.
- `features/finance/nativeCardTransactions.js`는 native 응답을 fail-closed로 검증하고, `cardTransactionImport.js`는 앱 실행·foreground 복귀 때 `peek → 가계부 저장 성공 → ack` 순서를 지킨다. 저장 실패 시 ack하지 않고, 이미 저장한 event ID는 재저장 없이 ack한다.
- 알림 접근을 허용하기 전 과거 내역은 가져오지 못한다. 삼성월렛·카카오페이·토스 알림 문구 변경이나 Android의 민감 정보 가림 때문에 파싱하지 못한 결제는 기존 수동 입력으로 보완한다.

### 가계부 분류

- `features/finance/financeCategories.js`: owner별 사용자 분류·키워드 저장, 기본 분류와 우선순위를 담당하는 순수 모델
- `features/finance/FinanceCategorySettingsPanel.jsx`: 분류·키워드 추가와 삭제, 기존 자동 가져오기 기록 반영 결과를 표시
- `features/finance/cardTransactionImport.js`: 정제 상호명으로만 기본/사용자 분류를 계산하며 native category·원문은 받지 않음
- 사용자 키워드는 기본 규칙보다 우선한다. 같은 상호명이 여러 키워드와 맞으면 더 긴 키워드를 우선하며, 분류를 삭제하면 그 분류의 키워드도 함께 제거한다.

### 가계부 내부 메뉴·상호명 보정

- `features/finance/FinanceSectionTabs.jsx`: 월 지갑 아래 4개 내부 메뉴와 좌우 방향키 이동을 담당하는 표시 컴포넌트
- `features/finance/financeCategoryLedger.js`: 선택한 카테고리의 현재 월 지출 필터와 연월 표시를 담당하는 순수 모델
- `styles/lifehub-finance-navigation.css`: 메뉴별 기존 패널 노출, 52px 조작 영역, 350px 이하 축약, 이전 상호명 확인 폼을 담당하는 scoped 스타일
- `features/finance/kakaoPayMerchant.js`: 새 후보 방어 정제, 기존 자동 기록의 결정 가능한 보정, 원문 없는 placeholder 판별과 사용자 교체를 담당하는 순수 모델
- `features/finance/KakaoPayMerchantReviewPanel.jsx`: `카카오페이` 앱 이름만 남은 이전 거래를 날짜·금액과 함께 확인하고 실제 상호명을 입력
- `features/finance/useCardTransactionImport.js`: 앱 시작 시 기존 카카오페이 자동 기록을 최신 정제/분류 규칙으로 한 번 더 저장

### 정기 결제

- `features/finance/recurringPayments.js`: owner별 저장, 규칙 정규화, 월말 날짜 보정, 현재월 발생, 고정 거래 ID, 처리월 이력과 자동·수동 반영을 담당하는 순수 모델
- `features/finance/RecurringPaymentsPanel.jsx`: `자동 기록` 메뉴의 예정/실제 요약, 데스크톱 대화상자·모바일 bottom sheet, 규칙 생성·수정·삭제와 이번 달 수동 반영
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

## 2026-09-01 로컬 저장과 기록 흐름

- 생활 기록은 `localStorage` 호환 캐시와 `orbit-local-data` IndexedDB에 함께 보관한다. 앱 시작 전에 기존 캐시를 데이터베이스로 이관하며, 데이터베이스에만 남은 기록은 캐시로 복원한다.
- 인증 토큰과 Bridge 자격 증명은 IndexedDB 생활 기록 대상에서 제외한다. 이 구조는 기기 내부 보관이며 계정 동기화나 클라우드 백업이 아니다.
- 가계부 거래 수정·삭제 후 7초 되돌리기와 사용자가 직접 정하는 월 예산을 제공한다. 예산이 없을 때 임의 금액을 진행률로 표시하지 않는다.
- 홈의 바로 남기기는 기존 일정·메모·가계부 입력 화면으로 이동한다. 월 달력은 선택 날짜의 일정과 메모를 함께 보여준다.
- 설정은 IndexedDB 상태·대략적인 사용량·마지막 백업 시각을 표시한다. 기록이 있고 14일 이상 백업하지 않았으면 백업을 권장한다.

## 로컬 개발 사용법

```bash
npm --prefix apps/web run dev
```

브라우저에서 `http://127.0.0.1:5173/app`을 열어 홈·일정·메모·가계부와 `/more`를 확인한다. `/workout`, `/diet`, `/ai`, `/ai/edit`, `/ai/settings`는 `/app`으로 돌아와야 하며 운동·식단·음식 사진 입력이나 Bridge 연결 버튼이 나타나면 회귀다.

## 웹과 APK 확인 방식

- UI 수정 중에는 Vite 웹에서 확인한다. 매번 APK를 풀고 다시 묶지 않는다.
- APK에는 빌드된 정적 웹을 한 번 포함하므로 기기 반영이 필요할 때만 `scripts/build_android_apk.sh`를 실행한다.
- 설치형 웹의 현재 서비스 워커 경계는 `orbit-web-v45`다. 홈·가계부 가독성 개선과 거래 검색, 토스 결제 알림 가져오기, 수동 입력 분리·월별 카테고리 내역을 포함하므로 캐시 번호를 되돌리지 않는다.
- Android SDK가 불완전하면 기존 APK를 덮어쓰지 말고 문서에 blocker를 남긴다.

현재 Termux PRoot 경량 SDK에서 웹 빌드를 마친 뒤 APK만 포장할 때는 아래 명령을 사용한다. 현재 출시 경계는 `0.6.1-debug` (`versionCode 27`)이다. 이 SDK에는 Android Lint가 없으므로 Lint만 명시적으로 건너뛰며, Java 컴파일·네이티브 smoke test·서명·APK 민감정보 검사는 계속 실행된다.

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

### 2026-09-09 — APK 내장 Codex 시험 빌드

- 0.8.7-debug/38, 웹 캐시 v56. AI/여행의 공용 `features/ai-runtime/CodexConnection.jsx`에서
  내장 AI 선택, ChatGPT 기기 코드 로그인, 상태 확인, 취소 및 기존 Termux 모드 복귀를 제공한다.
- `EmbeddedAiRuntime`은 APK의 Node/Codex를 앱 전용 HOME에서 요청 시 실행한다.
  고정 4320 loopback과 앱 전용 bearer를 사용하며 기존 4319 인증을 덮어쓰지 않는다.
- `tools/orbit-travel/embedded-auth.mjs`는 app-server의 제한된 인증 메서드만 사용한다.
  토큰·계정 식별자는 WebView로 보내지 않고 공개 상태·사용자 인증 코드만 반환한다.
- 앱 내 채팅과 기존 Termux 채팅의 파일 및 웹 캐시는 분리한다. 자동 이관은 하지 않는다.
- ARM64 Android 11+ 런타임. 실제 APK에서 로그인 및 AI 답변 확인은 사용자 실행 단계로 남긴다.

### 2026-09-09 — 0.8.8-debug 버튼 정리

AI 상단 진입 버튼에 전용 스타일을 적용해 아이콘용 22px 글꼴 상속을 제거했다.
AI/여행 공용 연결 화면은 주요 로그인 버튼, 보조 동작, 연결 상태, 인증 코드 카드를
녹색 계열로 통일하고 44~48px 터치 영역과 키보드 포커스를 유지한다. 인증 동작은 유지한다.
웹 캐시 v57, Android 버전 39.

### 2026-09-09 — 0.8.9-debug 공통 UI 개선

버전 40 / 웹 캐시 v58. 새 공통 마감 스타일 `orbit-refinements.css`는 프로덕션 엔트리와
개발 엔트리 양쪽에서 마지막에 불러온다. 홈 빠른 기록은 `HomeQuickActions.jsx`가 소유하고
기존 `new=schedule`, `new=memo`, `new=entry` 작성 경로를 그대로 사용한다.
일정·메모·가계부·여행·AI·설정의 간격/버튼/글자 및 좁은 화면 대응을 정리했다.
저장, 로그인, 가져오기, 삭제 확인 로직은 그대로 유지한다.


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


## 2026-09-10 — 0.9.1-debug 모델별 추론 강도·두 사용 한도

모델 옆에서 실제 model/list가 제공한 추론 강도를 선택한다. GPT-6 Astra 연결에서
Low/Medium/High/Extra High/Max/Ultra 6단계를 확인했다. 모델을 바꾸면 강도는 기본으로
돌아가며 선택값은 초안·대화·재시도에 보존된다. 전송 전 해당 모델의 지원 여부를 확인하고
Codex의 model_reasoning_effort에 선택값을 전달한다. 도구 접근 제한은 기존 정책을 따른다.

채팅 상단에서 5시간·주간 잔여율을 함께 보여준다. 실제 300분/10080분 응답만 대응시키며
조회 실패·누락을 0%로 표시하지 않고 다른 한도 그룹의 값을 섞지 않는다. 상세에서
초기화 시각·조회 시각과 수동 새로고침을 제공한다. 정확한 잔여 토큰 개수는 추정하지 않는다.
공식 API 구조: https://learn.chatgpt.com/docs/app-server

검증: 웹 관련 테스트 105개, 서버 테스트 34개 통과. 모델별 옵션 정제, CLI 인수 전달,
저장/재시도, 한도 구분을 포함한다. APK 화면·실제 응답은 설치 후 기기 확인 대상이다.


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
