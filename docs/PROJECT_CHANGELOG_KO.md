# 프로젝트 변경 기록

## 2026-09-09 알림 사용처 자동 분류 · v37

- 같은 사용처의 기존 분류를 알림 가져오기에 재사용한다. 이미 정한 카테고리를 반복 카카오페이 정리나 분류 설정 저장이 기타로 되돌리는 경로를 수정했다.
- 결제 저장/ack 뒤 선택 소스의 기타 사용처 최대 8개를 검색한다. 금액·알림 원문·잔액·계좌·이벤트 ID를 검색에 보내지 않는다. 최신 기록 재조회와 ID/사용처/기타 검사로 사용자 수정·삭제·소유자 전환을 보호한다.
- 기존 로컬 서버와 Native 고정 create/poll 액션을 추가했고 여행/대화와 동시 실행을 제한했다. 실제 검색 증거·높은 확신·공개 출처가 있어야 분류하며 미확인은 기타 유지, 결과 캐시와 실패 대기로 반복 검색을 줄인다.
- 웹 288개, 서버/검색/adapter 25개 통과. 실제 공개 테스트 사용처 스타벅스를 웹 검색해 커피로 분류하고 공식 기업 출처를 확인했다. 테스트 과정에서 Markdown 링크를 원시 URL로 해석하지 못하는 문제를 고쳐 회귀 검증했다. 사용자 실제 거래는 이 생성 테스트에 사용하지 않았다.
- production build, Android compile/native smoke, 서명 v1/v2/v3, 민감정보 검사 통과. 경량 SDK의 Android Lint는 제외했으며 실기기 알림 수신부터 자동 분류까지의 화면 왕복은 미실행이다.
- 기존 standby에 최신 코드를 설치·재시작하고 기존 인증과 merchantClassification capability를 확인했다. orbit-web-v55, Android 0.8.6-debug(37), APK 268053 bytes. /sdcard/Download/Orbit-latest.apk와 원본 SHA-256 2ac86e41245325f58cf6c25da7427058309dd14b4fa93c488e2d4aed3525fb5c 일치.


## 2026-09-07 네이버 한국어 여행 자료 우선 · v36

- 여행 생성 검색 지시를 `travel-research.mjs`로 분리했다. 한국어 검색·네이버 통합검색 시도·접근 불가 시 네이버 도메인 검색, 실제 출처만 표시, 공식 자료 교차 확인, 네이버 자료 부족 안내를 명시했다. 검색 API 교체나 별도 인증/서비스 추가는 아니다.
- 일정 입력 안내를 갱신하고 기존 10~22시/이모지/여백을 유지했다. 기존 standby를 유휴 상태에서 교체·재시작하고 인증 유지와 API 200을 확인했다.
- 여행/서버/화면 68개 테스트, production build, Android compile/native smoke/서명 v1/v2/v3/민감정보 검사를 통과했다. 경량 SDK의 Android Lint와 실제 APK 설치/터치 확인은 미실행이다.
- orbit-web-v54, Android 0.8.5-debug(36), APK 268138 bytes, SHA-256 8cc739d903ecbca36f2fb65320e5214128beb5ca81f01918f69dfb000ce50790. /sdcard/Download/Orbit-latest.apk 복사 및 내장된 네이버 검색 지시를 확인했다.


## 2026-09-07 여행 이모지·여백·10~22시 · v35

- 여행 입력/일정 카드에 이모지를 추가하고 필드 간격 22px, 카드 간격 22px, 설명 행간과 이동/비용 구분을 넓혔다.
- 새 여행 생성은 매일 10:00~22:00, 식사·휴식·귀환을 포함하도록 지시한다. 생성 결과 검증이 09:59/22:01을 거부하며 기존 저장 여행은 이전 시간도 그대로 읽는다. 화면에 시간 범위를 표시한다.
- 여행/서버 36개 및 UI·버전 32개 테스트 통과, 최종 생성 지시 수정 후 adapter 4개 재검증 통과. 웹 build, Android compile/native smoke/서명 v1/v2/v3/민감정보 검사를 통과했다. 경량 SDK의 Lint는 제외했으며 실제 Android 화면 터치는 미실행이다.
- 기존 standby 번들을 교체하고 유휴 프로세스를 재시작해 인증 유지와 API 200을 확인했다. APK 안의 새 UI와 10~22시 생성 지시도 확인했다.
- orbit-web-v53, Android 0.8.4-debug(35), APK 268138 bytes. /sdcard/Download/Orbit-latest.apk와 원본 SHA-256 330bfdc8078616a2d70a64afdf5f09400d37867107ff77ca88f43da74eb373aa 일치.
- 실제 Codex로 종로 1일 일정을 생성해 10:00 시작과 22:00 종료를 확인했다. 검증용 일정은 사용자 저장 여행에 추가하지 않았다.


## 2026-09-07 여행 입력·일정 읽기 개선 · v34

- 큰 소개 영역을 제거하고 여행지·날짜/기간·인원을 앞에 모았다. 종료일 안내, 인원 증감, 여행 속도 선택 버튼을 추가하고 취향/요청은 접힌 영역에 유지했다. 연결 도움말은 입력/결과 뒤로 이동했다.
- 생성 중 입력폼을 숨기고 진행·취소를 보여준다. 완료된 미리보기는 일정부터 열리며 조건 수정/결과 돌아가기와 저장 버튼을 제공한다. 기존 초안·저장·인증·RAG 서버를 유지했다.
- 날짜별 일정은 시간·장소를 먼저 보여주고 상세 설명·이동·비용은 개별/전체 펼침으로 읽는다. 이전/다음 날 이동과 상단 저장 동작, 360px 이하 날짜 입력 한 열 배치를 추가했다.
- 웹 전체 281개 통과 후 최종 변경에 여행 관련 12개(결과 복원/생성 중 입력 숨김 추가 포함)를 재검증했다. production build 98 modules, Java/native smoke/서명 v1/v2/v3/민감정보 검사 통과. 경량 SDK의 Android Lint는 제외했으며 실제 기기의 터치·키보드·스크롤은 미확인이다.
- orbit-web-v52, Android 0.8.3-debug(34). /sdcard/Download/Orbit-latest.apk 268138 bytes, SHA-256 1653c20eb746f53a692e90ceb69958eb54f6c311eb7bb96fc71d91f71ea37cd0. 원본과 복사본 일치 및 APK의 새 여행 번들을 확인했다.


## 2026-09-07 같은 폴더의 대화 검색 · v33

- 기존 대기 프로세스에 SQLite FTS5 검색을 추가했다. JSON 원본을 유지하며 질문/AI 답변/출처를 파싱하고 새 메시지만 증분 색인한다. 별도 서비스·임베딩 API·백그라운드 색인 타이머는 없다.
- 질문 시 같은 폴더에서 최대 4개 관련 발췌를 전달하고 최근 20개와 중복되는 항목을 제외한다. 답변의 접힌 출처에서 원문으로 이동한다. 역할 구분, 현재 수정 우선, 검색된 기록의 지시 무시를 생성기에 명시했다.
- SQLite 복구/0600/심볼릭 링크 거부, 증분 쓰기/재시작/폴더 이동·범위/중복 요청/색인 장애 시 일반 채팅 지속을 검증했다. 웹 281/281, 서버·검색·adapter 23/23, production build 98 modules, Android compile/native smoke/민감정보 검사/서명 v1/v2/v3 통과. 경량 SDK의 Android Lint는 제외했다.
- 임시 데이터로 실제 Codex HTTP 생성 테스트를 수행했다. 새 대화에서 이전 사용자 예산 37만원을 검색하고 AI 제안 99만원과 구분하며 [기억 1] 출처 및 JSON 저장을 확인했다. 테스트 데이터는 사용자 대화에 넣지 않았다.
- 기존 private standby bundle을 교체하고 유휴 상태에서 해당 프로세스만 재시작했다. 기존 인증 유지, chat API 200, 검색 DB 생성 및 권한을 확인했다. orbit-web-v51, Android 0.8.2-debug(33), APK 264042 bytes, SHA-256 90ec853caabc98839a6b014a2673795191cc4072945c30bb25d0d1a8169c6a14. /sdcard/Download/Orbit-latest.apk와 원본 일치 및 새 번들 포함 확인.
- 키워드 기반 검색이며 의미 임베딩/이 Codex 대화 자동 가져오기는 포함하지 않는다. 실제 Android 터치·키보드·출처 이동 및 APK 설치는 미실행이다.


## 2026-09-06 AI 채팅 중심 화면 · v32

- 사용자 요청에 따라 큰 안내와 분리된 목록 화면을 없애고, 폴더 탭과 채팅창을 기본 화면으로 구성했다. 폴더별 저장 대화는 제목 선택에서 바꾸며 새 폴더 추가·제목 수정·폴더 이동·파일 내보내기를 지원한다.
- 첫 메시지 전송 시 대화를 자동 생성한다. 생성 직후 전송은 반환된 대화 ID를 명시적으로 사용하고, 마지막 선택·폴더별 새 대화 초안·기존 대화 초안을 로컬 캐시에 보존한다. 관리와 연결은 네이티브 dialog 안에 모았다.
- 웹 280/280, production build 98 modules, Android compile/native smoke, 서명 v1/v2/v3, 민감정보 검사 통과. 경량 SDK에 없는 Android Lint는 제외했다. 실제 Android 화면의 키보드/TalkBack/터치 확인은 미실행이다.
- orbit-web-v50, Android 0.8.1-debug(32). /sdcard/Download/Orbit-latest.apk 264042 bytes, SHA-256 1e30bf2b1d3555830028badd66f8160b5c48e3ba541d79d9a4d2c45387ad341b. 원본과 복사본 일치 및 APK 내 새 AI 번들 포함을 확인했다.


## 2026-09-06 여행 초안 정리와 Termux Codex 여행 탭

변경 내용:

- 기존 여행 플래너를 기본 입력/접힌 취향/날짜별 결과로 정리하고, 5번째 여행 탭과 `계획 만들기·내 여행`을 추가했습니다. 오래된 `/planner`, `/plans` 링크를 새 화면에 연결했습니다.
- 기존 초안은 사용자가 불러올 때만 복사하며 원본은 보존합니다. 생성 중 탭 이동·취소·재조회, 입력/미리보기 보관, 명시적인 저장과 기존 체크리스트·v2 백업 호환을 추가했습니다.
- `tools/orbit-travel` 전용 Node API가 Termux의 로그인된 Codex를 실행합니다. 일회 코드·bearer 인증·loopback/Host/Origin 제한, 입력/결과 검증, 한 작업 제한, 요청 ID 중복 방지, 타임아웃·프로세스 그룹 취소를 적용했습니다.
- Android는 고정 여행 액션만 제공하며 인증은 private preferences에 보관합니다. 네트워크 예외는 `127.0.0.1` 한 호스트로 제한하고 기존 WebView mixed-content/CSP와 비활성 AI Bridge 경계를 유지했습니다.
- `orbit-web-v46`, Android `0.7.0-debug`(versionCode 28). 로컬 보조 서비스 사용법은 `tools/orbit-travel/README.md`에 정리했습니다.

검증:

- Termux Node 26.3.1 기준 웹 275개, 여행 API/실행기 10개 테스트 통과. 폼/결과 SSR 렌더, 문자열 escaping, 이전 초안/백업 왕복, 인증/만료/입력 제한, 중복 요청과 취소를 포함합니다.
- 실제 로그인된 Codex로 종로 하루 여행 생성 성공(5개 방문 일정, 5개 참고 출처). 앱의 다른 개인 기록은 테스트에 사용하지 않았습니다.
- 실제 HTTP API의 페어링 → 생성 → 진행 조회 → 완료까지 종로 2일 여행으로 확인했습니다. 날짜별 5개 일정과 5개 출처가 검증을 통과했으며 테스트 서버는 종료했습니다.
- production build: 95 modules, 초기 JS 351.54kB(gzip 114.91kB), 여행 지연 청크 17.91kB(gzip 7.46kB), CSS 128.36kB(gzip 21.99kB).
- Android compile, native smoke(여행 액션 정책 포함), 기존 결제 알림/공유 capability, APK 민감정보 검사 및 v1/v2/v3 서명 검증 통과. 현재 경량 SDK 환경에서 Android Lint는 제외했습니다.
- `/sdcard/Download/Orbit-latest.apk`: 243,314바이트, SHA-256 `b24a411580a5db09c2bb91e7da9d2ec2d8b49d562f6eb7b33d4154b817f555d2`.
- 실제 Android 화면 터치·회전·업데이트 설치와 native 페어링은 별도 기기 확인이 필요합니다. 기존 사용자 변경은 보존했고 commit/push는 하지 않았습니다.

## 2026-09-05 홈·가계부 UI 개선과 거래 검색

변경 내용:

- 홈 활동 요약을 두 지표에 맞춘 2열로 정리하고 숫자·브리핑 버튼·하단 탭의 가독성을 높였습니다.
- 월간 지갑에 청록색 금액 영역과 월 예산/지출 비교를 적용했습니다. 예산 미설정 시 이번 달 지출을 먼저 보여주고 예산 초과는 제목과 실제 사용률로 구분합니다.
- 가계부 4개 내부 메뉴에 아이콘을 추가하고 거래의 날짜·메모·긴 금액과 수정/삭제 버튼 배치를 정리했습니다.
- 사용처·메모·분류·날짜·금액 검색과 전체/지출/수입 필터를 추가했습니다. 선택한 날짜·월별 카테고리 범위를 유지하고 검색 결과 수와 초기화를 제공합니다.
- 거래 목록과 검색 계산을 `features/finance/FinanceLedger.jsx`, `financeLedgerSearch.js`로 분리했습니다. 기존 저장·삭제 후 되돌리기·처음 8건/추가 20건 동작은 유지합니다.
- 별도 `styles/lifehub-polish.css`와 `orbit-web-v45` 캐시로 배포하며 기존 데이터와 토스 알림 변경을 보존했습니다.

검증:

- Termux Node 26.3.1에서 웹 전체 테스트 스크립트에 해당하는 265개 테스트 통과. 거래 검색의 범위·금액·문자 정규화·원본 보존 테스트 7개를 추가했습니다.
- React 서버 렌더링으로 홈, 예산 미설정/초과, 거래 8건과 더 보기, 빈 목록, 가계부 4개 메뉴를 확인했습니다.
- 새 주요 글자/배경 5쌍의 명암비는 4.72:1 이상입니다. production build는 88 modules, 초기 JS 351.14kB(gzip 114.77kB), CSS 119.74kB(gzip 20.36kB)입니다.
- Android Java compile·native security smoke·v1/v2/v3 서명·결제 알림 allowlist·파일 공유·민감정보 검사를 통과했습니다. 경량 SDK에 없는 Android Lint는 기존 문서대로 제외했습니다.
- Node 20에서는 기존 아이콘 PNG의 압축 바이트 재생성 비교 1건이 다릅니다. 아이콘 파일은 변경하지 않았으며 현행 Termux Node 26에서는 통과했습니다.
- 360px/430px 실제 브라우저 화면, 기기 키보드·업데이트 설치는 미실행입니다. 설치 파일은 `/sdcard/Download/Orbit-latest.apk`로 전달합니다.
- 최종 APK는 230,859바이트이며 SHA-256은 `cf3ba3a5d36cd4de35f82d97d88a588fd6f3a7a1f62b84a47aa4e8fb459a4e54`입니다. 다운로드 폴더 복사본의 동일성을 확인했습니다.

## 2026-09-05 토스 결제 알림 가져오기

변경 내용:

- 가계부 자동 기록의 선택 소스에 토스를 추가했습니다. Android는 공식 앱의 exact package `viva.republica.toss`만 허용하고 Web/native 공개 source ID는 `toss`로 고정했습니다.
- 토스 알림은 결제 완료·승인 표현, 하나의 원화 금액, 식별 가능한 사용처가 모두 있을 때만 후보로 만듭니다. 송금·입출금·충전·잔액·취소·환불·실패·카드값·결제 예정 알림은 제외합니다.
- 앱 이름을 사용처로 대신 저장하지 않고 알림 원문·계좌·카드번호·잔액을 저장하지 않는 private queue 경계를 유지했습니다. 기존 사용자의 선택 범위도 자동으로 넓히지 않아 토스를 직접 선택해야 합니다.
- 설치형 웹 캐시를 `orbit-web-v44`로 갱신하고 APK의 허용 패키지 보안 검사에도 토스를 추가했습니다.

검증:

- 웹 전체 회귀 258/258 통과
- Vite production build 86 modules 통과: 초기 JS 348.78kB(gzip 113.82kB), CSS 114.52kB(gzip 19.29kB), 메모 지연 청크 28.74kB(gzip 10.06kB)
- Ubuntu PRoot에서 Android Java compile·native security smoke·APK v1/v2/v3 서명·결제 알림 allowlist·grant-only 파일 공유·민감정보 검사 통과
- 경량 SDK에 Android Lint가 없어 문서화된 방식으로 Lint만 제외
- 설치 파일은 `/sdcard/Download/Orbit-latest.apk`, 226,763바이트, SHA-256 `b4cb7565336df4f5b15b208eb8000e3f8be74fea735a7df28b3fea598927a4aa`입니다.
- 실제 Android 기기의 토스 결제·송금·입출금 알림 문구 확인은 이번 자동검증 환경에서 미실행

## 2026-09-02 가계부 수동 입력 분리·월별 카테고리 내역

변경 내용:

- 가계부 내부 메뉴에 `수동 입력`을 추가하고 빠른 수입·지출 입력 폼을 `내역`에서 분리했습니다. 새 거래, 빈 상태 기록, 자동 기록의 수동 입력과 거래 수정은 새 메뉴로 이동합니다.
- `카테고리별 지출` 카드를 버튼으로 바꾸고, 선택한 카테고리의 현재 월 지출만 날짜와 함께 내역에 표시합니다. 선택한 연월과 건수를 표시하고 `전체 내역`으로 필터를 해제할 수 있습니다.
- 월·카테고리 필터를 별도 순수 모델과 단위 테스트로 분리하고 설치형 웹 캐시를 `orbit-web-v43`으로 갱신했습니다.

검증:

- 웹 전체 회귀 257/257 통과
- Vite production build 86 modules 통과: 초기 JS 348.73kB(gzip 113.80kB), CSS 114.52kB(gzip 19.29kB)
- `git diff --check` 통과

## 2026-09-01 홈 기록·가계부 예산 카드 통합

변경 내용:

- 홈의 별도 `바로 남기기` 카드와 브리핑 하단 추가 영역은 제거했습니다. 대신 월간 캘린더의 `오늘 · 선택됨` 상세에서만 일정 추가·메모 작성 버튼을 독립된 2열 행으로 표시해 거래 목록과 겹치지 않게 했습니다.
- 가계부의 별도 월 예산 카드를 없애고 월간 지갑 안에서 예산을 설정·변경하도록 합쳤습니다. 큰 금액은 수입-지출이 아니라 월 예산-지출의 남은 금액을 보여주며 월 예산 행에는 사용 퍼센트를 표시합니다.
- 설치형 웹 캐시를 `orbit-web-v42`로 갱신했습니다.
- 설치 화면에서 새 파일을 명확히 구분하고 기존 설치를 업데이트할 수 있도록 Android를 `0.6.1-debug` (`versionCode 27`)로 올렸습니다.

검증:

- 웹 전체 회귀 254/254, Vite production build 85 modules, `git diff --check` 통과
- Android Java compile·native security smoke·APK v1/v2/v3 서명·민감정보 검사 통과
- 설치 파일은 `/sdcard/Download/Orbit-0.6.1.apk`, `/sdcard/Download/Orbit-latest.apk`, 226,763바이트, SHA-256 `09074b67d67412971116d11c8967b5635f24c5504d803c42c12dcf641c618bf9`입니다.

## 2026-09-01 IndexedDB 호환 저장·빠른 기록·가계부 복구

변경 내용:

- 기존 동기식 화면을 깨지 않도록 `localStorage`를 즉시 읽기 캐시로 유지하면서 생활 기록을 기기 내부 IndexedDB에도 보관하는 호환 저장 계층을 추가했습니다. 첫 실행에는 기존 기록을 IndexedDB로 옮기고, 캐시가 비어 있으면 데이터베이스 기록을 복원합니다. 로그인·클라우드 동기화나 서버 전송은 추가하지 않았습니다.
- 가계부 거래를 수정할 수 있고 삭제 직후 7초 동안 되돌릴 수 있습니다. 사용자가 정한 월 예산만 표시하며 임의 기본 예산은 만들지 않습니다.
- 홈에 일정·메모·지출 바로 남기기를 추가하고, 월 달력의 날짜별 메모 표시와 선택 날짜 메모 목록을 연결했습니다.
- 설정에서 IndexedDB 동기화 상태와 대략적인 저장 사용량을 보여주고, 마지막 백업 시각 및 14일 기준 백업 권장을 안내합니다. 백업 파일명과 화면 브랜드는 Orbit으로 통일했습니다.
- 설치형 웹 캐시를 `orbit-web-v38`로 갱신하고 저장 계층·월 예산·백업 상태·홈 날짜 메모 회귀 테스트를 전체 테스트 명령에 연결했습니다.

검증:

- 웹 전체 회귀 254/254 통과: LifeHub AI 61, 데이터 91, IndexedDB 저장 2, UI 구조·접근성 32, 일정 알림·상태 13, 메모 11, 식단 22, 신체정보 5, 홈 달력·요약 17
- Vite production build 85 modules 통과: 초기 JS 348.40kB(gzip 113.56kB), CSS 115.08kB(gzip 19.44kB), 메모 지연 청크 28.74kB(gzip 10.06kB), dist 535,865바이트
- git diff --check 통과
- Ubuntu PRoot에서 Android Java compile·native security smoke·APK v1/v2/v3 서명·결제 알림·grant-only 파일 공유·민감정보 검사를 통과했습니다.
- 설치 파일은 `/sdcard/Download/Orbit-latest.apk`와 `/sdcard/Download/Orbit-2026-09-01.apk`, 226,763바이트, SHA-256 `cd925c5f68901ad1b8f89f531159b49f72a34a88383c08a0ac2879e21db93a57`입니다.
- 실제 Android 기기에서 기존 설치 업데이트·오프라인 재실행·백업 파일 왕복은 자동검증 환경에서 미실행

## 2026-08-30 가계부 내부 메뉴와 기존 카카오페이 상호명 보정

변경 내용:

- 월 지갑은 항상 보이게 유지하고 긴 가계부 본문을 `내역`, `자동 기록`, `분류·공유` 3개 내부 메뉴로 정리했습니다.
- 카카오페이 native parser가 `상호명을~ 값`, 조사 포함 라벨, 라벨과 상호명이 서로 다른 알림 필드에 있는 형식을 처리합니다. `사용`이 `사용처명`보다 먼저 지워져 `처명` 같은 조각이 남던 정제 순서도 고쳤습니다.
- Web에서 새 카카오페이 후보를 한 번 더 정제하고, 기존 자동 기록에 실제 상호가 남아 있으면 라벨·결제 문구·이전 parser 조각을 자동으로 제거한 뒤 현재 분류 규칙을 다시 적용합니다.
- 과거 버전이 앱 이름 `카카오페이`만 저장한 거래는 알림 원문을 저장하지 않았으므로 추측하거나 삭제하지 않습니다. `자동 기록` 메뉴에서 날짜·금액을 확인한 뒤 실제 상호명을 직접 입력할 수 있습니다.
- 3개 메뉴와 이전 상호명 확인 폼을 별도 finance 컴포넌트·scoped CSS로 분리하고 서비스 워커를 `orbit-web-v37`로 갱신했습니다.

검증:

- 웹 전체 회귀 245/245 통과: LifeHub AI 보관 모듈 61, 데이터 87, UI 구조·접근성 31, 일정 알림·상태 13, 메모 11, 식단 22, 신체정보 5, 홈 달력·요약 15
- Vite production build 81 modules 통과: 초기 JS 335.90kB(gzip 109.99kB), CSS 109.70kB(gzip 18.71kB), `dist` 517,249바이트
- Ubuntu PRoot에서 Android Java compile·native security smoke·APK v1/v2/v3 서명·결제 알림·파일 공유 경계 검증 통과. Android Lint만 경량 SDK 부재로 제외했습니다.
- 설치용 APK는 `/sdcard/Download/Orbit-latest.apk`, 222,667바이트, SHA-256 `5e69cbe5f1fd0f7f628b6bd67b62805c0ac923cd77fc1737b157423462274360`입니다.

## 2026-08-30 카카오페이 상호명과 사용자 가계부 분류

변경 내용:

- 카카오페이 알림은 상호명이 안전하게 추출될 때만 가계부 후보로 보냅니다. 상호명이 없으면 `카카오페이` 앱 이름을 사용처로 대신 저장하지 않습니다.
- 자동 분류를 정제한 상호명 기준으로 단순화했습니다. `코레일`·`티머니`는 `교통`, `커피`가 포함되면 `커피`, `다이소`와 나머지는 `기타`로 기록합니다.
- 가계부의 `분류 관리`에서 새 분류와 사용처 키워드를 추가할 수 있습니다. 새 분류는 빠른 입력·정기 결제 선택지·이후 자동 가져오기에 바로 보이며, 저장하면 기존 자동 가져오기 기록도 다시 분류합니다.
- 사용자 키워드는 기본 규칙보다 먼저 적용되고, native 알림이 임의의 category나 원문을 전달할 수 없다는 기존 경계는 유지했습니다.
- 설치형 웹 캐시를 `orbit-web-v36`으로 올려 이미 설치한 PWA도 새 분류 화면을 갱신합니다.

검증:

- 웹 전체 회귀 240/240 통과: LifeHub AI 보관 모듈 61, 데이터 83, UI 구조·접근성 30, 일정 알림·상태 13, 메모 11, 식단 22, 신체정보 5, 홈 달력·요약 15
- Vite production build 78 modules 통과
- Ubuntu PRoot에서 Android Java compile·native security smoke·APK v1/v2/v3 서명·결제 알림 경계 검증 통과 (검증 APK는 임시 경로만 사용)

## 2026-08-23 가계부 일회성 파일 공유와 가져오기

변경 내용:

- 가계부에 이번 달·전체·직접 선택 기간을 보내는 관리 sheet를 추가했습니다. Orbit 간 전달용 JSON과 사람이 확인하는 CSV를 제공하며 메모는 명시적으로 켜기 전까지 제외합니다.
- 공유 스키마를 `OrbitFinance` v1 공개 필드로 고정했습니다. 카드 알림 event ID, owner, native queue·origin 원본은 제외하고 내부 ID는 안정된 공유 ID로 바꿉니다.
- 받은 JSON은 새 거래, 이미 있는 거래, 수입·지출 합계를 먼저 보여준 뒤 새 거래만 추가합니다. 기존 거래를 지우거나 덮어쓰지 않으며 같은 파일과 재공유 파일도 중복 추가하지 않습니다.
- Android는 `ACTION_SEND` 시스템 공유 창을 열어 Bluetooth·Quick Share·메신저 중 설치된 대상을 선택하게 합니다. 광역 Bluetooth·저장소 권한은 추가하지 않았고, private cache의 tokenized 파일을 non-exported Provider로 임시 읽기만 허용합니다.
- 브라우저는 Web Share 파일 기능을 우선하고 지원하지 않으면 다운로드합니다. JSON 가져오기는 strict UTF-8과 실제 8 MiB 상한을 다시 검사합니다.
- 최근 거래는 8건을 먼저 표시하고 20건씩 더 볼 수 있게 했으며, 제거된 운동·식단 문구가 남아 있던 HTML 설명도 현재 4탭 범위로 맞췄습니다.
- 서비스 워커를 `orbit-web-v35`, APK를 `0.5.9-debug` (`versionCode 25`)로 갱신했습니다.

검증:

- 웹 전체 회귀 234/234 통과: LifeHub AI 보관 모듈 61, 데이터 77, 구조·모바일·브랜드 30, 일정 알림·상태 13, 메모 11, 식단 보관 모델 22, 신체정보 보관 모델 5, 홈 달력·요약 15
- production build 76 modules, 초기 JS 323.10kB(gzip 104.69kB), CSS 103.79kB(gzip 17.86kB), 메모 지연 청크 28.66kB(gzip 10.04kB), `dist` 497,184바이트
- Android Java/API compile, native security smoke test, 결제 알림·grant-only 공유 Provider 경계, APK credential scan과 v1/v2/v3 서명 검증 통과. 경량 SDK에 Android Lint가 없어 명시적으로 제외
- APK 214,475바이트, SHA-256 `9f38a29623caa2367a61f69f73d65a9e0d580dc708bb3f59ad3b079806e54538`
- 실제 두 기기 Bluetooth/Quick Share 왕복, 키보드·오프라인·기존 설치 업데이트는 이번 자동검증 환경에서 미실행

## 2026-08-23 정기 결제·일반 텍스트 메모·예정 날짜/시간

변경 내용:

- 가계부 월간 지갑 바로 아래에 `정기 결제` 요약을 추가했습니다. 이름·금액·매월 1~31일 또는 말일·카테고리·시작/종료월·자동 반영·사용 상태를 관리하며, 작은 화면에서는 bottom sheet로 엽니다.
- 29~31일이 없는 달은 말일로 보정합니다. 예정 금액과 실제 거래를 분리하고, 규칙·월 고정 ID와 처리월 이력으로 같은 달 중복 및 사용자가 삭제한 자동 거래의 즉시 재생성을 막았습니다.
- 카드 알림 가져오기가 켜져 있으면 새 규칙의 자동 반영 기본값을 끕니다. 두 자동화를 함께 켤 때 중복 가능성을 경고하며, 규칙 수정·삭제는 과거 거래를 변경하지 않습니다.
- 정기 결제를 owner별 저장소와 JSON 백업에 연결했습니다. 새 백업은 `formatVersion: 2`이고, canonical v1·legacy 백업은 정기 결제 빈 목록을 보완해 계속 복원할 수 있습니다.
- 메모의 Markdown 툴바, `/` 명령, 미리보기, GFM 렌더러를 제거하고 일반 텍스트 작성란 하나로 정리했습니다. 폴더·제목·태그와 `Ctrl/Command+Enter` 저장, 이전 rich 메모의 비파괴 텍스트 사본은 유지합니다.
- 일정의 `예정` 필터는 타임라인 레일에 날짜와 시간을 함께 표시하고 설명 줄의 중복 날짜를 제거했습니다.
- 서비스 워커를 `orbit-web-v34`, APK를 `0.5.8-debug` (`versionCode 24`)로 갱신했습니다.

검증:

- 정기 결제·백업·메모·일정 표적 테스트와 Vite production build 통과
- 웹 전체 회귀 224/224 통과: LifeHub AI 보관 모듈 61, 데이터 68, 구조·모바일·브랜드 29, 일정 알림·상태 13, 메모 11, 식단 보관 모델 22, 신체정보 보관 모델 5, 홈 달력·요약 15
- production build 73 modules, 초기 JS 303.12kB(gzip 98.77kB), CSS 96.80kB(gzip 17.17kB), 메모 지연 청크 28.66kB(gzip 10.04kB), `dist` 468,052바이트
- Android Java/API compile, native security smoke test, 결제 알림 경계, APK credential scan과 v1/v2/v3 서명 검증 통과. 경량 SDK에 Android Lint가 없어 명시적으로 제외
- APK 206,283바이트, SHA-256 `761e92fe8fcc87d27df685481b790b1b25b9e6f671bffb6776361cc711274a50`
- 설치 파일: `/sdcard/Download/Orbit-2026-08-23.apk`, `/sdcard/Download/Orbit-latest.apk`
- 실제 기기의 키보드·오프라인·백업 왕복·기존 설치 업데이트는 이번 자동검증 환경에서 미실행

## 2026-08-23 미완료 일정·메모 폴더·/ Markdown 명령

변경 내용:

- 완료하지 않은 지난 일정과 오늘 시간이 지난 일정을 `미완료`로 분류하고, 예정·미완료·완료 필터와 1분 자동 갱신을 연결했습니다. 같은 상태를 홈 월 달력과 아침 브리핑에도 반영했습니다.
- 메모 화면을 데스크톱의 좌측 폴더 사이드바와 모바일 포커스 트랩 서랍으로 구성했습니다. 폴더 생성·이름 변경·삭제·메모 이동을 제공하며, 폴더 삭제 시 메모는 삭제하지 않고 `개인`으로 이동합니다.
- 빈 줄에서 `/`를 입력하면 제목·체크박스·글머리·번호·인용·굵게·링크·코드 명령을 검색하는 가이드를 추가했습니다. 키보드 방향키·Enter와 터치 선택을 모두 지원합니다.
- 중복 폴더 ID, 부모 순환, `all` 예약 ID를 비파괴적으로 복구하고, 자동 제목 파생 시 첫 줄의 Markdown 링크·코드가 사라지지 않도록 본문을 보존했습니다.
- 메모 라우트와 하단 내비게이션의 최대 너비를 1,040px로 같게 맞추고, 메모 카드는 남는 너비에 맞게 자동 배치하여 빈 열을 줄였습니다.
- 설치형 web cache를 `orbit-web-v33`, APK를 `0.5.7-debug` (`versionCode 23`)로 갱신했습니다.

검증:

- 웹 전체 테스트 221/221 통과, Vite production build 326 modules 통과
- 초기 JS 287.35kB(gzip 93.45kB), CSS 93.82kB(gzip 16.94kB), 메모 지연 청크 196.16kB(gzip 60.55kB), `dist` 616,073바이트
- Android Java/API compile, native security smoke test, finance-listener 경계, APK credential scan, v1/v2/v3 서명 검증 통과. 경량 SDK에 Android Lint가 없어 Lint만 명시적으로 제외
- APK 251,339바이트, SHA-256 `1c2d403ad0079a403c04d0be5a8218de7c364a443b0489269487035cab45ce5b`
- 설치 파일: `/sdcard/Download/Orbit-2026-08-23.apk`, `/sdcard/Download/Orbit-latest.apk`
- 실제 기기의 키보드·오프라인·기존 설치 업데이트 왕복은 이번 자동검증 환경에서 미실행

## 2026-08-23 운동·식단 제외와 간결한 Markdown 메모 UX

변경 내용:

- 사용자 화면을 홈·일정·메모·가계부 4개 탭으로 정리하고 하단 메뉴를 정확히 4등분했습니다. `/workout`, `/diet`는 `/app`으로 이동하며 운동·식단 화면과 production import는 제거했습니다. 기존 로컬 운동·식단 데이터와 백업 v1 호환 필드는 자동 삭제하지 않습니다.
- 홈 월 달력·활동 요약·아침/저녁 브리핑에서 운동·식단 노출을 제거하고 현재 제공하는 일정·가계부만 집계하도록 정리했습니다.
- 메모에 작성/미리보기 전환과 제목·굵게·기울임·취소선·체크·글머리·번호·인용·코드·링크 바로가기를 추가했습니다. `Ctrl/⌘+B/I/K`, `Ctrl/⌘+Shift+7/8/9`, `Ctrl/⌘+Enter`와 Enter 목록 이어쓰기를 지원합니다.
- 메모 상단의 날짜 인사·기록 통계·설명 문구와 중복 작성 버튼을 제거했습니다. 작성 중에는 자주 쓰는 서식 4개만 바로 표시하고 추가 서식, 제목·태그, 검색·필터는 필요할 때 펼치도록 바꿨습니다.
- 각 메모 카드에 반복되던 편집·고정·삭제 버튼은 바깥 탭과 Escape로 닫히는 작업 메뉴 하나로 합쳤습니다. 모바일 터치 영역은 44px 이상으로 맞추고, 900px 이상에서 작성 카드 옆에 생기던 빈 열도 제거했습니다.
- GFM을 저장 카드와 읽기 화면에서 렌더링하되 raw HTML과 외부 이미지 자동 로딩을 막았습니다. 이전 BlockNote·연결 메모는 원본 보호 읽기 화면으로 열고, 필요한 경우 원본을 덮지 않는 Markdown 사본을 만듭니다.
- 체크리스트처럼 구조가 있는 첫 줄을 제목으로 파생해도 다시 편집할 때 본문이 사라지거나 제목이 중복되지 않도록 왕복 모델을 보강했습니다. 링크 주소·코드 안의 `#`가 태그로 잘못 잡히는 문제와 ID 없는 이전 메모의 불안정한 수정 대상을 함께 수정했습니다.
- 현행 홈/더보기 규칙을 `lifehub-home.css`로 분리하고 보관용 `lifehub-ai.css`를 production 진입점에서 제외했습니다. 서비스 워커 캐시는 `orbit-web-v32`, APK는 `0.5.6-debug` (`versionCode 22`)로 갱신했습니다.

검증:

- 웹 전체 테스트 210/210 통과, Vite production build 323 modules 통과
- 초기 JS 282.49kB(gzip 91.89kB), CSS 85.73kB(gzip 15.53kB), 메모 지연 청크 183.12kB(gzip 56.63kB), `dist` 파일 합계 589,175바이트
- Android Java/API compile, native security smoke test, finance-listener 경계, APK credential scan과 v1/v2/v3 서명 검증 통과. 현재 Termux 경량 SDK에는 Android Lint가 없어 Lint만 명시적으로 제외
- APK 243,147바이트, SHA-256 `f37d9fa4cff348f81f6f55944e2ef251c7f067a79d3a35ea12efaa3310454253`
- 설치 파일: `/sdcard/Download/Orbit-2026-08-23.apk`, `/sdcard/Download/Orbit-latest.apk`
- 실제 기기에서 키보드·오프라인·기존 설치 업데이트 왕복은 이번 자동검증 환경에서 미실행

## 2026-08-19 음식 사진 AI·Bridge 연결 비활성화

변경 내용:

- 홈 AI 카드, 더보기의 앱 수정 진입, 식단의 음식 사진 분석 UI를 제거하고 식단 직접 입력·6개 생활 기록 탭·백업 기능은 유지했습니다.
- `/ai`, `/ai/edit`, `/ai/settings`는 `/app`으로 이동하며 AI 대화·페어링·앱 수정 청크를 production bundle에서 제외했습니다.
- Android의 Bridge HTTP/SSE proxy, token store, network-status API와 이미지 chooser를 제거했습니다. JSON 백업 chooser와 일정·브리핑 알림, 결제 알림 가져오기는 유지합니다.
- `ACCESS_NETWORK_STATE` 및 cleartext 예외를 제거하고 APK의 cleartext traffic을 명시적으로 차단했습니다.
- APK 검사에 Bridge class/event, 음식 분석 endpoint와 제거된 UI 문구가 다시 포함되지 않는 회귀 검사를 추가했습니다.

호환:

- 기존 로컬 생활 기록과 식단 기록은 삭제하거나 변환하지 않습니다. 과거 기록의 분석 출처 메타데이터는 읽기 호환성을 위해 허용하지만 새 사진 분석은 시작할 수 없습니다.
- `AiAssistantNative` JavaScript 객체 이름은 기존 백업·일정 알림·결제 가져오기 adapter 호환을 위해 유지하며, AI 또는 Bridge 전송 메서드는 더 이상 제공하지 않습니다.

## 2026-08-19 카카오페이 결제 알림 가져오기

변경 내용:

- 기존 삼성월렛에 독립 카카오페이 앱(`com.kakaopay.app`)을 추가하고, 가계부에서 두 소스를 개별 선택할 수 있게 했습니다.
- 카카오톡 일반 알림은 대상에서 제외했습니다. 각 앱의 결제·승인 표현만 보수적으로 허용하며 송금·충전·잔액·취소·환불·실패·적립·광고는 거절합니다.
- 선택하지 않은 앱은 알림 본문을 읽기 전에 버리고 대기열 저장·조회에서도 다시 검사합니다. 소스를 끄면 해당 미처리 건을 제거하며, 기존 삼성월렛 사용 설정은 자동으로 이어받습니다.
- APK 버전을 `0.5.4-debug` (`versionCode 20`)로, 설치형 web cache를 `orbit-web-v28`로 올렸습니다.

제약:

- 결제 앱의 알림 형식은 공개 API 계약이 아니므로 문구 변경이나 민감 정보 가림이 있으면 일부 거래가 누락될 수 있습니다. 오탐보다 누락을 우선하는 fail-closed 정책이며 수동 입력은 계속 제공합니다.
- 권한을 허용하기 전의 과거 결제는 가져올 수 없습니다.

## 2026-08-19 삼성월렛 결제 알림 일괄 가져오기

변경 내용:

- 소비자 결제내역 조회용 Samsung Wallet 공개 API가 없는 경계 안에서, 사용자가 Android 알림 접근을 직접 허용하면 이후 삼성월렛 결제 승인 알림을 가계부로 가져오도록 복원했습니다.
- 소스는 `com.samsung.android.spay` 하나로 고정하고 결제·승인만 보수적으로 인식합니다. 입출금·송금·이체·취소·환불·거절·실패·광고는 제외합니다.
- 알림 원문, 카드·계좌번호, 잔액은 저장·로그·WebView 전달·네트워크 전송하지 않고, owner hash별 private queue에는 opaque event ID, 금액, 정제한 사용처와 시각만 보관합니다.
- 앱 실행·foreground 복귀 때 대기열을 일괄 처리하며 `peek → 가계부 저장 성공 → ack` 순서와 event ID 중복 방지로 저장 실패 유실과 재실행 중복을 막습니다.
- APK 버전을 `0.5.3-debug` (`versionCode 19`)로 올리고, 기존 package와 debug signing key를 유지해 이후 설치가 데이터 보존 업데이트가 되도록 했습니다.

제약:

- 권한 허용 전 과거 거래는 소급할 수 없고 삼성월렛 알림 문구나 Android 민감 정보 가림에 따라 일부 거래는 수동 입력이 필요합니다.
- 알림 접근은 Android상 넓은 특수 권한이며 사이드로드 환경에서는 사용자가 앱 정보에서 제한된 설정을 별도로 허용해야 할 수 있습니다.

## 2026-07-16 생활 기록·브리핑·버전형 백업

변경 내용:

- 일반 AI가 `메모: ...`, 지출, 수입, 운동, 식단의 명시적인 한 줄을 일정 파서 다음 순서로 해석하고, 미리보기 뒤 `저장` 또는 `취소`를 받는 2단계 로컬 기록 흐름을 추가했습니다.
- 생활 기록은 Bridge가 끊겨도 현재 owner의 메모·가계부·운동·식단 저장소에 반영됩니다. 같은 request ID의 저장 재시도만 중복 차단하고 fingerprint는 origin 추적에 남겨, 같은 날 같은 금액·운동·식사를 새 요청으로 다시 기록할 수 있습니다. pending 초안은 로컬 thread 캐시에 허용 필드만 보관합니다.
- 홈에 아침·저녁 브리핑 카드를 추가하고, `/more`에서 각 시간대와 알림 사용 여부를 설정하도록 연결했습니다. 브리핑 알림은 기존 일정 알림과 시간순으로 함께 예약하고 foreground 복귀 때 재동기화하며, 알림의 아침·저녁 query를 카드 선택에 반영합니다.
- `formatVersion`을 가진 LifeHub JSON 백업, 컬렉션별 복원 미리보기, `merge`·`replace`, 일부 쓰기 실패 시 전체 rollback을 추가했습니다. 복원 직전 최신 데이터를 다시 읽고, 신체정보·브리핑 설정 변경도 미리 알립니다. Bridge 토큰·승인·대화·thread 상태는 백업하지 않습니다.
- Android 백업 파일 선택을 Storage Access Framework의 문서 생성·열기와 JSON MIME으로 구현하고, WebView adapter와 native coordinator/policy 경계를 분리했습니다. 웹과 Android 모두 strict UTF-8·JSON 객체 검증과 8 MiB 단일 상한을 사용하며, native 시작 전 실패용 WebView JSON 선택도 같은 검증 경로를 재사용합니다.
- 서비스 워커 캐시를 `orbit-web-v26`으로 갱신하고 브리핑·백업 전용 스타일과 `features/automation`, `features/backup`, `features/life-records` 단위 테스트 경계를 추가했습니다.
- 하단 `홈·일정·메모·운동·식단·가계부` 6개 탭은 그대로 유지하고, 제거했던 홈 `빠른 기록` 카드는 다시 추가하지 않았습니다. 일정·식단·가계부·운동·여행 저장소의 예전 고정 개수 제한도 제거했습니다.

검증 기준:

- 웹 전체 테스트 203/203 통과, Vite production build 348 modules 통과
- 생활 기록·백업·브리핑 데이터 테스트 45/45, LifeHub 구조·모바일·브랜드 테스트 40/40, LifeHub AI 테스트 61/61 통과
- Bridge 테스트 66개 중 65개 통과, opt-in 공식 SDK 실연동 1개 제외, 실패 0; TypeScript build 통과
- Android Java/API compile, SAF static/native smoke test, v1/v2/v3 서명, source·manifest·DEX·credential 검사 통과. 현재 경량 SDK에 Android Lint가 없어 명시적으로 제외
- 생성 APK `0.5.2-debug` (`versionCode 18`), 305,021 bytes, SHA-256 `b3e0a8764983c597bf34561b1d626a2f2a61f2cadf8c88499460af8febd40fd4`
- 실제 기기 백업 왕복·merge/replace/rollback·아침/저녁 알림·오프라인 회귀는 이번 환경에서 미실행

## 2026-07-14 Play Protect 대응과 삼성월렛 수동 기록

변경 내용:

- Play Protect가 인터넷에서 직접 설치한 앱의 민감 기능으로 분류하는 Android
  `NotificationListenerService`와 카드 승인 알림 자동 수집 기능을 완전히 제거했습니다.
- 가계부에는 삼성월렛 결제 알림에서 금액과 사용처를 확인한 뒤 바로 지출 입력으로 이동하는
  안내를 추가했습니다. Orbit은 다른 앱의 알림이나 삼성월렛 내부 사용내역을 읽지 않습니다.
- 이전 버전에서 이미 가계부에 저장한 거래는 유지하고, 업데이트 후 첫 실행에서 더 이상
  사용하지 않는 native 카드 가져오기 대기열만 삭제합니다.
- APK 버전을 `0.4.9-debug` (`versionCode 15`)로, 설치형 web cache를 v22로 올렸습니다.

검증 기준:

- web 전체 테스트와 production build
- Android manifest/DEX에서 알림 리스너 및 카드 자동 수집 코드 부재 확인
- Android Lint/native smoke test, APK 서명·credential scan
- `git diff --check`
- 배포 APK SHA-256: `f33f743c374cb3896479ee361668463a8fe2524aeacaeb9a02d089cdb34fa9ab`

## 2026-07-14 등록 프로젝트 원격 명령과 제한된 Git push

변경 내용:

- 웹 Codex 개발 모드에서 등록 프로젝트의 정확한 한 명령을 준비하고 최종 확인 뒤 한 번
  실행하는 원격 명령 패널을 추가했습니다.
- Bridge 원격 명령은 기본 비활성화하고 기기·프로젝트 권한, 2분 일회성 승인, 실행 allowlist,
  프로젝트 경로 검증, 동시 실행·시간·출력 제한을 적용했습니다.
- 직접 입력한 `git push`는 현재 branch와 설정된 remote만 허용하고 force/refspec/임의 URL을
  차단하며, 준비 후 HEAD·branch·remote 변경을 다시 검사합니다.
- Git 원격 host는 `LIFEHUB_GIT_PUSH_HOSTS`로 제한하고 인증 prompt와 앱 credential 입력을
  막았습니다. 서버에는 repo 전용 deploy key 또는 짧은 수명 credential을 별도로 준비해야
  합니다.
- 파일 인자는 실행 직전 다시 검사하고, build/interpreter 프로젝트 코드는 OS sandbox가
  아니라는 운영 경계를 문서화했습니다.
- APK 버전을 `0.4.8-debug` (`versionCode 14`)로, 설치형 web cache를 v21로 올렸습니다.

검증 기준:

- Bridge TypeScript 빌드와 원격 명령 정책/API 자동 테스트
- 웹 LifeHub 구조 테스트와 production build
- Android Lint/native smoke test, APK 서명·credential scan
- `git diff --check`
- 배포 APK SHA-256: `32d0e011ec6b3d3242492fda140a036663e51742993053c7163cf6d572e00eea`

## 2026-07-14 카드 결제 자동 기록과 Orbit O 아이콘

변경 내용:

- Android 알림 접근을 사용자가 직접 허용하면 카드 승인 알림에서 금액·사용처·시각과 중복 방지용 알림 앱 식별자를 판별해 가계부 지출로 자동 등록합니다.
- 알림 원문, 카드번호와 잔액은 저장하지 않고, 취소·환불·거절·입출금·광고 알림은 자동 등록에서 제외했습니다.
- 앱이 닫힌 동안 받은 거래도 해시된 LifeHub 소유자별 private native 대기열에 보관한 뒤 `peek → 가계부 저장 → ack` 순서로 반영해 계정 혼입과 저장 실패 유실을 막았습니다.
- 같은 알림의 정확한 재전송과 카드 앱·문자 앱의 교차 알림을 중복 방지하되, 같은 가게·같은 금액의 연속 실결제는 각각 보존합니다.
- 가계부 240건 한도에서는 기존 기록을 삭제하지 않고 남은 용량만 저장·ack하며, React StrictMode에서도 import 작업을 직렬화합니다.
- Android 13+ 사이드로드의 제한된 설정 안내와 앱 정보 바로가기를 제공하고, low-RAM Android Q 이하는 지원하지 않는 상태로 표시합니다.
- Android 런처와 web/PWA 아이콘을 남색 바탕의 중앙 청록색 `O`로 통일하고, 의존성 없는 재현 가능한 PNG 생성기를 추가했습니다.
- APK 버전을 `0.4.7-debug` (`versionCode 13`)로, 설치형 web cache를 v20으로 올렸습니다.

검증:

- 카드 승인 파서, native 대기열 경계, 권한 Bridge, web 정규화·중복 방지·2단계 저장 테스트
- web 전체 테스트와 production build, Android Lint/native smoke test, APK 서명·credential scan
- 배포 APK SHA-256: `a542aec24eef11f5f905c9af467cc8e91c184f9142dabff4d633619839123dee`

## 2026-07-13 Orbit 페어링 연결 복구

변경 내용:

- Android native transport가 일시적인 `status 0` 네트워크·timeout 오류를 반환해도 승인 claim을 5초 간격으로 다시 확인하도록 수정했습니다.
- Bridge가 claim을 저장한 직후 응답이 유실돼도 60초 안에는 같은 기기와 토큰을 안전하게 복구하도록 claim을 멱등화했습니다.
- 복구 토큰은 서버 전용 비밀과 일회성 요청 비밀을 함께 사용한 HMAC으로 파생하며, 토큰 원문과 요청 비밀 원문은 상태 파일에 저장하지 않습니다.
- APK 버전을 `0.4.6-debug` (`versionCode 12`)로 올리고 수정된 내장 웹을 새 APK에 포함했습니다.

검증:

- LifeHub AI 테스트 31개와 UI 테스트 27개 통과
- Bridge 테스트 52개 중 50개 통과(환경 의존 2개 제외), TypeScript 빌드 통과
- Android Lint 오류 0, native security smoke test, v1/v2/v3 서명 검증과 APK credential scan 통과
- 기존 배포 APK와 새 APK의 signing certificate SHA-256 일치 확인
- 배포 APK SHA-256: `8d3b64f3a9a0ea28bf675ac6979135c37956cacae7c5b8b70152057438362b53`

## 2026-07-13 페어링 자동 연결·모바일 UX 개선

변경 내용:

- 휴대폰에서 6자리 코드를 한 번만 제출하면 관리자 승인 뒤 자동으로 claim해 연결을 완료하도록 개선했습니다.
- 관리자 화면에 접속 허용 후 휴대폰 등록을 기다리는 상태를 별도로 표시하고, claim이 끝난 기기만 연결 완료 목록에 노출합니다.
- 모바일 페어링 단계와 필수·선택 권한을 명확히 안내하고, 연결 진행 중에는 입력을 잠가 중복 요청을 방지합니다.
- APK 버전을 `0.4.5-debug` (`versionCode 11`)로, 설치형 web cache를 v18로 갱신했습니다.

검증:

- 웹 전체 테스트와 production 빌드, Bridge 전체 테스트 52개 중 50개 통과(환경 의존 2개 제외), TypeScript 빌드 통과
- 공개 HTTPS에서 연결 요청 → 관리자 승인 → 5초 자동 claim → 접속 허용 기기 등록 → 토큰 인증을 확인하고 검증 기기를 폐기
- Wikimedia Commons 비빔밥 JPEG를 공개 Bridge에 업로드해 `산채비빔밥의 보이는 나물·달걀 토핑`, `299kcal` 분석 결과 수신 확인
- Android Lint 오류 0, native security smoke test, v1/v2/v3 서명 검증, APK credential scan 통과
- 배포 APK SHA-256: `25d941193bebb3b1d6e58f35267e69f675c2c0184aef408958016706ef0140c6`

## 2026-07-13 다이어리 아이콘·음식 사진 분석 안정화

변경 내용:

- Android 런처 아이콘을 헤드셋 Agent에서 링·책갈피·체크 표시가 있는 다이어리로 교체했습니다.
- APK 버전을 `0.4.4-debug` (`versionCode 10`)로 올렸습니다.
- 음식별 보이는 양(g)과 100g당 열량을 서버에서 한 번만 합산해 최종 칼로리로 사용하고, 1kcal 미만 항목을 강제로 1kcal로 올리던 과대 계산을 제거했습니다.
- 손상된 `Infinity`·`NaN`·음수 칼로리 기록이 일일 섭취·운동 합계를 오염시키지 않도록 제외했습니다.
- 15초 Bridge 상태 확인 중의 일시적인 `checking` 상태가 진행 중인 최대 90초 사진 분석을 취소하지 않도록 수정했습니다.
- APK native transport의 사진 data URL 전송부터 결과 정규화와 `ready` 화면 상태까지 회귀 테스트를 추가했습니다.

검증:

- Bridge 전체 테스트 52개 중 50개 통과, 환경 의존 테스트 2개 제외, 실패 0
- 웹 전체 테스트, Bridge TypeScript 빌드, Vite production 빌드 통과
- 공개 HTTPS Bridge에 Wikimedia Commons 비빔밥 JPEG를 업로드해 약 26초 뒤 `돌솥비빔밥`, `487kcal`과 영양 결과 수신 확인
- Android Lint 오류 0, native security smoke test, v1/v2/v3 서명 검증, APK credential scan 통과
- 배포 APK SHA-256: `888c7fcc5d04989e6daf218acc7ebf1538c7d42d3319afad58ecf39bded28974`

## 2026-07-13 Notebook·Bridge 실행 경로 복구

변경 내용:

- 앱 홈에 Bridge 연결 상태와 AI Assistant 진입 카드를 다시 노출했습니다.
- `/ai`를 홈으로 돌려보내던 redirect를 제거하고 기존 LifeHub shell 안에 Bridge 대화 화면을 복구했습니다.
- 신규 페어링에서 대화 외에 프로젝트 읽기·수정, 명령·빌드, Git 권한을 명시적으로 요청할 수 있게 복구했습니다.
- 설치형 web cache를 v17로 갱신해 이전 app shell이 Bridge 진입점을 가리지 않게 했습니다.
- 기본 Docker Compose에 loopback 전용 JupyterLab과 영구 `notebook_data` volume을 추가했습니다.
- 수동 Bridge 프로세스 대신 재부팅·실패 후 재시작할 수 있는 user systemd unit과 설치 안내를 추가했습니다.
- Bridge 전용 HTTPS hostname을 loopback runtime에 연결하는 Caddy reverse proxy 예제를 추가했습니다.
- 승인된 Android Agent 아이콘은 변경하지 않았습니다.

검증:

- 초기 소스 커밋에서는 사용자 요청에 따라 서비스 실행과 빌드를 수행하지 않았습니다.
- 호스트 상태를 읽기 전용으로 확인한 결과, 수동 Bridge는 `127.0.0.1:4317`에 실행 중이었고 Notebook listener와 Bridge user service는 없었습니다.
- 후속 요청으로 `scripts/build_android_apk.sh`를 실행해 web production build, Android Lint,
  native security smoke test, v1/v2/v3 서명 검증과 APK credential scan을 통과했습니다.
- 이전 배포 APK와 재빌드 APK의 signing certificate SHA-256이 일치하고,
  배포 파일 SHA-256이 sidecar와 일치함을 확인했습니다.

## 2026-07-12 식단 사진 분석 UX 리팩터링

변경 내용:

- 558줄이던 식단 화면에서 사진 요청 훅, 에너지 카드, 입력 폼, 기록 목록과 표시 helper를 분리했습니다.
- 사진 선택 → 양 확인 → 기록의 3단계 안내와 재분석·사진 제거·분석 중 상태를 추가했습니다.
- 분석 결과는 현재 식사 시간대로 바로 기록하거나 입력칸에서 수정할 수 있습니다.
- AI 결과를 수동 수정하면 더 이상 예전 탄수화물·단백질·지방과 신뢰도 정보가 함께 저장되지 않습니다.
- BMR + 오늘 운동 값을 추천 섭취 목표처럼 보이지 않는 단순 비교 기준으로 명확히 표시합니다.
- 라일락·민트·피치 색상 토큰, 44px 터치 영역, 2열 양 선택, 모션 감소와 접근성 상태를 적용했습니다.

검증 기준:

- 사진 요청 취소·미리보기 URL 정리·재시도 흐름과 양 보정이 한 훅에서 관리되는지 확인
- 시간대별 기본 식사와 수동 수정 시 AI 메타데이터 제거 테스트
- 웹 전체 테스트와 프로덕션 빌드 통과

## 2026-07-12 Orbit Android 내장 웹 단일 모드

변경 내용:

- APK가 실행 즉시 `https://appassets.androidplatform.net/app`의 내장 웹 빌드를 열도록 단일 모드로 정리했습니다.
- 첫 실행 로컬/서버 선택, 사용자가 입력하는 상단 WebView 서버 주소, 모드 전환 설정을 제거했습니다.
- 음식 사진 분석과 Codex 기능은 내장 화면에서 빌드 시 설정한 HTTPS Orbit Bridge로 요청합니다.
- Bridge 주소는 분석 API endpoint일 뿐 원격 웹 화면 주소가 아니며, 기기 토큰은 기존처럼 Android Keystore에 암호화해 보관합니다.
- 이전 설치에 남은 모드·서버 URL 설정만 폐기하고, 내장 웹 빌드 cache busting, 기기 데이터, Keystore 토큰과 예약 알림은 업데이트 후에도 유지합니다.
- 외부 상단 navigation 차단, 내장 origin 전용 native capability, TLS 검증, 제한된 Bridge transport와 이미지 검증을 그대로 유지합니다.
- APK 버전을 `0.4.3-debug` (`versionCode 9`)로 올렸습니다.

검증 기준:

- 신규 설치와 기존 서버 모드 설정이 남은 업데이트 설치 모두 선택 화면 없이 내장 `/app` 진입
- 외부 상단 navigation 차단과 내장 origin 전용 Keystore·Bridge·알림 capability 확인
- `adb install -r` 뒤 기기 데이터·페어링 토큰·예약 알림 보존 및 새 embedded web build 반영

## 2026-07-12 개인 칼로리 비율과 Agent 아이콘

변경 내용:

- 음식 사진 분석 결과에 해당 음식 칼로리가 사용자의 하루 참고 칼로리에서 차지하는 비율을 `%`와 진행 막대로 표시했습니다.
- 하루 참고 칼로리는 앱에 이미 저장된 나이·성별·키·몸무게로 계산한 BMR과 오늘 기록된 운동 소모량만 사용합니다.
- 신체정보는 사진이나 Bridge 요청에 포함하지 않고 기기 안에서만 계산합니다. 신체정보가 없으면 기존 분석값을 유지하고 비율 안내만 숨깁니다.
- 복잡한 탄수화물·단백질·지방 권장 비율 기능은 추가하지 않고 기존 g 추정 표시만 유지했습니다.
- Android 아이콘에서 궤도 모양을 제거하고 사람형 AI Agent, 헤드셋, 자동화 스파크, 완료 체크 배지로 교체했습니다.
- APK 버전을 `0.4.2-debug` (`versionCode 8`)로 올렸습니다.

검증:

- 0%, 1% 미만, 31%, 100% 초과와 신체정보 미입력 경계 계산 테스트
- 식단 UI 계약 및 Agent 벡터 아이콘 정적 검사

## 2026-07-12 Orbit 관리자 웹

변경 내용:

- Bridge가 직접 제공하는 `/admin/` 화면에서 6자리 페어링 코드 발급·복사, 요청 승인·거절, 연결 기기 해제를 클릭으로 처리하도록 했습니다.
- 관리자 화면은 모바일 React/APK 번들과 분리해 관리자 인증 정보가 앱 패키지에 들어가지 않도록 했습니다.
- HTTPS Basic 인증, loopback backend, same-origin 검사, JSON content type, rate limit, `no-store`와 엄격한 CSP를 적용했습니다.
- 기기 이름은 HTML로 삽입하지 않고 DOM `textContent`로만 렌더링하며, 관리자 상태 응답에서 token hash, pairing secret, 실제 프로젝트 경로를 제외했습니다.
- 서버 시작 때 자동으로 연결 코드를 만들고 로그에 출력하던 동작을 제거하고, 필요할 때 관리자 화면에서만 생성하도록 했습니다.

검증:

- 관리자 미인증·오인증·기기 Bearer 접근 거부, 악성 Origin 거부, JSON 이외 변경 요청 거부
- 관리자 정적 자산의 CSP/no-store와 비밀값 비노출 확인
- 관리자 웹 API로 코드 생성 → 휴대폰 요청 → 승인 → token claim → 기기 폐기까지 HTTP 통합 테스트
- LifeHub Bridge 자동 테스트 51개 중 49개 통과, 환경 의존 테스트 2개 선택 실행으로 제외

## 2026-07-12 Codex 음식 사진 영양 분석

변경 내용:

- 별도 OpenAI API 키 없이 서버에 로그인된 ChatGPT Codex 세션을 공식 SDK로 호출하도록 했습니다.
- 기기 Bearer 인증과 `chat` 권한이 필요한 `POST /api/food/analyze` JSON API를 추가했습니다.
- JPEG·PNG·WebP 사진의 MIME, 매직 바이트, 파일 크기와 픽셀 수를 검증하고 전송 전 1280px·1.5MiB 이하 JPEG data URL로 줄입니다.
- 음식명, 칼로리, 탄수화물, 단백질, 지방, 신뢰도와 추정 설명을 strict JSON schema로 받고 서버에서 다시 검증합니다.
- 음식이 없거나 식별할 수 없는 사진은 수치를 지어내지 않고 `422 FOOD_NOT_RECOGNIZED`로 처리합니다.
- `local_image`, strict output schema와 음식 전용 고정 프롬프트로 분석 범위를 제한했습니다.
- 음식 전용 Codex 실행은 read-only·ephemeral이며 사용자 설정·규칙, shell, MCP/apps, web/network, 이미지 생성과 multi-agent를 비활성화했습니다.
- 클라이언트 이탈, 기기 페어링 폐기, 75초 제한 시 진행 중 분석을 중단하고 늦게 도착한 결과를 폐기합니다.
- 식단 화면에서 사진을 선택해 결과를 확인한 뒤 명시적으로 기존 식단 기록에 반영하도록 했고, 예전 식단 데이터도 그대로 읽습니다.
- Android WebView에 단일 이미지 선택기를 연결하고 음식 API 경로에만 2.25MiB·90초 전송 한도를 허용했습니다.
- 다른 휴대폰도 각 기기에서 별도로 페어링하면 같은 서버의 음식 분석 API를 사용할 수 있습니다.

검증:

- LifeHub Bridge TypeScript 빌드 통과, 자동 테스트 50개 중 48개 통과 및 환경 의존 테스트 2개는 선택 실행으로 제외
- Codex 이미지·schema 실행 계약, 로그인 오류, 사용량 제한, timeout, 취소, 금지 도구 이벤트와 비정상 structured output의 안전 매핑 확인
- 웹 자동 테스트 74개와 Vite production build 통과
- Android API 35 Java 컴파일, 네이티브 정적 보안 테스트, Android Lint 0 errors
- DEX 생성, APK 자격증명 스캔, v1/v2/v3 서명 및 SHA-256 검증
- APK 내부 음식 분석 UI와 `/api/food/analyze` 경로 포함 확인
- APK 표시 이름 `Orbit`, 새 궤도 아이콘, versionCode 7 포함 확인
- `git diff --check`

## 2026-07-12 Android 휴대폰 알림 연동

변경 내용:

- Android 13 이상의 `POST_NOTIFICATIONS` 런타임 권한 요청을 로컬 내장 화면에만 허용했습니다.
- LifeHub 일정을 Android `AlarmManager`에 동기화해 앱 화면이 닫혀도 시스템 알림을 받을 수 있게 했습니다.
- 알림 표시 권한이 아직 없어도 예약 시각은 보존하고, 권한을 나중에 켜면 기존 일정을 다시 만들 필요가 없도록 했습니다.
- Android 12 이상에서는 “알람 및 리마인더” 권한이 있을 때 정각 알람을 사용하고, 없으면 지연 가능한 알람으로 안전하게 대체합니다.
- 이미 지난 알림과 14일 밖 알림을 실제 예약 개수에서 제외하고 그 이유를 일정 저장 결과에 표시합니다.
- 재부팅, 앱 업데이트, 시간대 변경 뒤 남은 일정 알림을 다시 등록합니다.
- 앱 재실행 시에도 예약을 복구하고, 복구 시점 기준 6시간 안에 놓친 알림은 전달합니다.
- AI 화면이 백그라운드에서 Bridge 이벤트를 받고 있을 때 승인 요청과 작업 완료·실패를 휴대폰 알림으로 표시합니다.
- 알림을 누르면 검증된 `/schedule` 또는 `/ai` 내부 경로만 열리도록 제한했습니다.
- 다른 Android 앱의 알림을 읽는 권한이나 서비스는 추가하지 않았습니다.

검증:

- `npm --prefix apps/web test`
- `npm --prefix apps/web run build`
- 정시·5분·10분·30분 전, 과거 시각, 14일 경계, 반복 일정 알림 단위 테스트
- Android Java 컴파일 및 네이티브 보안 스모크 테스트
- DEX 생성, APK 자격증명 스캔, `apksigner verify --verbose`
- `git diff --check`

## 2026-06-06 공개 포트폴리오 정리

변경 내용:

- 앱 표기를 `ai-assistant`로 정리했습니다.
- Android/APK 소스, 다운로드 APK, Android 빌드 스크립트를 Git 대상에서 제거했습니다.
- Gradle의 내부 Maven 주소 기본값을 제거하고 `MAVEN_REPO_URL` 환경 변수로만 사설 저장소를 연결하게 했습니다.
- API 설정의 내부 IP 기본값을 localhost 또는 placeholder로 교체했습니다.
- 웹 로그인 경로의 외부 IP 하드코딩을 제거하고 `/login` 기본값과 `VITE_LOGIN_URL` 옵션으로 정리했습니다.
- README를 프로젝트 목적, 주요 기능, 아키텍처, 기술 스택, 실행 방법, 배포 구조, 트러블슈팅 경험, 향후 개선 계획 중심으로 다시 작성했습니다.

검증 예정:

- `git diff --check`
- `npm --prefix apps/web run build`
- API Gradle build 또는 Docker build
- 내부 IP/오타 잔여 검색

## 2026-09-06 여행 서버 APK 내장·자동 인증·요청 시 실행

- 서버 단일 ESM(약 22KB)을 APK에 포함하고 고정 Termux RUN_COMMAND + non-exported 일회용 PendingIntent로 준비·시작·인증을 처리한다. 최초 시스템 권한 이후 연결 코드 입력은 자동 경로에서 필요 없다. Codex/Node는 기존 Termux 환경을 사용한다.
- 탭 진입은 로컬 상태만 확인하고 실제 요청 때 서버를 깨운다. active 작업·미조회 결과를 보호하고, 조회 후 2분 유휴 시 종료한다. 웹 hidden polling을 멈추고 복귀 시 재개한다.
- 웹 276/276, 여행 서버/Codex adapter 12/12, production build 95 modules, Java compile/native smoke, APK 민감정보 검사와 v1/v2/v3 서명 통과. 경량 SDK에 없는 Android Lint만 제외했다.
- APK가 사용하는 실제 stdin 설치 코드 → 번들 서버 시작 → 인증 HTTP 200 → 실제 123초 대기 후 종료 → 재시작 시 같은 인증값 유지까지 확인했다. 현재 Codex 로그인도 확인했다.
- Android 0.7.1-debug(29), orbit-web-v47. 설치 파일 /sdcard/Download/Orbit-latest.apk, 255679 bytes, SHA-256 efea25794ac72a451895483dc380bd26d89ce2e0bb6d78ca0851f1dd2bab9a2f.
- 실제 APK 업데이트 설치·시스템 권한 승인·Android 앱과 Termux 간 PendingIntent 왕복·배터리 계측은 미실행이다. 이 기기의 Termux allow-external-apps 설정은 반영했다.

## 2026-09-06 Play스토어 Termux 호환 대기 연결 (v30)

- 실제 설치 Termux googleplay.2026.06.21(141)에 RUN_COMMAND 권한과 RunCommandService가 없음을 확인했다. v29의 해당 권한·launcher·receiver를 제거하고 8자리 최초 연결 뒤 기존 native 인증을 재사용한다.
- 별도 APK를 추가하지 않는다. 기존 Termux에 경량 loopback 서버만 대기시키고 실제 생성 때 Codex를 실행한다. 상태 조회는 Codex를 실행하지 않는다. private bundle/helper와 interactive Bash 시작 시 --ensure 한 번을 준비했다.
- 웹 276/276, 여행 서버/Codex adapter 12/12, production build, Android native smoke와 v1/v2/v3 서명·민감정보 검사 통과. 실제 대기 25초 CPU 증가 0틱을 확인했다 (배터리 계측은 아님). 실제 Codex 요청으로 1일·5개 방문 일정 생성 완료와 서버 busy=false 복귀를 확인했다.
- orbit-web-v48, Android 0.7.2-debug(30), APK 251583 bytes. /sdcard/Download/Orbit-latest.apk와 원본 SHA-256 8d49c94ea1cead3b4d3bd579ee9f36df4d0edcd60e6593e5131dff8ee159b569 일치.
- APK 업데이트 설치와 WebView 최초 페어링은 사용자 기기 화면에서 남아 있다. 재부팅/Android의 Termux 종료 후에는 새 Termux 터미널 또는 orbit-travel 실행으로 연결을 복구하며 인증은 유지된다.

## 2026-09-06 목적별 AI 대화 · v31

- 여행 옆 AI 탭, 목적별 대화 목록·사용자 목적·제목 변경·저장한 대화 이어가기·중단/재시도를 추가했다. 보관 앱 수정/PC Bridge는 재활성화하지 않았다.
- Termux private chats 폴더에 UUID별 JSON·Markdown 자동 저장, 재시작 복구, 원본 파일 보존 및 idempotent 메시지 재시도를 검증했다. Android의 명시적인 문서 저장 창으로 Markdown을 내보낸다. 대화 파일은 생활 기록 백업과 별도다.
- 웹 280/280, 서버/adapter 17/17, 98-module production build, Android compile/native smoke, v1/v2/v3 서명과 민감정보 검사를 통과했다. 경량 SDK의 Android Lint만 제외했다.
- 실제 Codex로 두 번 대화해 이전 단어를 기억하는 응답을 확인했고, 사용자/AI 메시지 4개와 Markdown 저장도 확인했다. 실제 테스트 파일은 임시 폴더에서 정리했다. 현재 기기의 대기 서버를 업데이트하고 기존 인증으로 status/chat 목록 HTTP 200을 확인했다.
- orbit-web-v49, 0.8.0-debug(31), APK 264042 bytes. /sdcard/Download/Orbit-latest.apk와 원본 SHA-256 4a9e8769411c0538e09fa341c5f0c01540f05dd5e14539ce70e1c89bf82647dd 일치.
- 실제 APK 업데이트 설치·Android 키보드/TalkBack·문서 선택기 저장 왕복은 기기 화면에서 확인해야 한다.

## 2026-09-09 — 0.8.7-debug: APK 내장 AI 연결

- 서버·Codex·SQLite 실행 환경을 APK에 포함하는 선택 빌드 추가.
- AI/여행에서 ChatGPT 로그인과 저장된 인증 사용, 유휴 서버 종료, 기존 Termux 모드 복귀 제공.
- 개인 인증 파일을 포함하지 않는 패키징과 앱 전용 저장소를 적용.
- 빈 HOME의 패키지 실행 환경 및 인증 상태/취소/만료/라우팅 테스트 확인.
  실제 설치·로그인·응답은 사용자 기기 검증 대상.

## 2026-09-09 — 0.8.9-debug 전체 화면 정리

공통 버튼·입력창·섹션 간격과 작은 화면 줄바꿈 개선. 홈 빠른 기록으로 일정·메모·지출
작성에 직접 진입하고, AI 연결 오류 원인을 바로 보여준다. 일정 동작의 접근성 이름과
메모 검색 지우기 후 포커스를 보완했다. 기록/인증 데이터 형식은 변경하지 않는다.


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
