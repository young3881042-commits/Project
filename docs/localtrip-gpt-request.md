# LocalTrip GPT 요청/응답 구조

## 현재 흐름

LocalTrip 일정 생성은 RAG DB를 먼저 조회하는 구조가 아닙니다.

1. 사용자가 지역, 기간, 동행, 취향, 이동수단, 예산, 메모를 입력합니다.
2. 서버가 `TravelPlanService.buildPrompt()`에서 프롬프트를 만듭니다.
3. Codex CLI 모드가 켜져 있으면 `/opt/jupiter-cli/bin/codex exec`로 요청합니다.
4. Codex CLI가 실패하거나 꺼져 있으면 OpenAI Chat Completions API로 요청합니다.
5. 응답은 JSON 문자열이어야 하며, 서버가 `parseGeneratedItems()`에서 바로 파싱합니다.
6. 파싱된 항목은 `TravelPlanItem`으로 변환되어 DB에 저장됩니다.
7. 식당/카페 항목은 `VerifiedLocalPlaceCatalog`의 실제 장소 카탈로그로 한 번 더 보정됩니다.

즉, 여기서 “응답 파싱”은 GPT 응답 JSON을 Java 객체로 바꾸는 작업입니다. RAG처럼 문서를 벡터 DB에 넣고 검색해서 꺼내 쓰는 의미가 아닙니다.

## GPT에 보내는 핵심 지시

서버는 다음 성격의 프롬프트를 보냅니다.

```text
너는 한국과 일본 현지 여행 전문 가이드 AI다.
한국 또는 일본 여행 일정을 JSON 배열로 생성해줘.

- 지역
- 기간
- 동행
- 선호
- 속도
- 이동수단
- 예산
- 메모
- 우선 사용할 장소 후보

각 날짜는 관광, 점심 식당, 오후 관광, 카페/휴식, 저녁 식당, 야경/산책 중 6~8개 블록으로 구성한다.
timeSlot은 09:30-10:50 같은 시간 범위로 쓰고, 같은 날 시간이 겹치면 안 된다.
식당/카페는 이름이 확인 가능한 실제 영업 장소명만 쓴다.
note에는 이전 장소 출발 시간, 이번 장소 도착 시간, 이동 팁, 식당/카페 추천 메뉴를 포함한다.
```

응답 형식은 아래 JSON 배열입니다.

```json
[
  {
    "dayNumber": 1,
    "timeSlot": "09:30-10:50",
    "destinationName": "센소지",
    "note": "아사쿠사역에서 09:20 출발, 09:30 도착. 나카미세 거리와 함께 걷기 좋습니다.",
    "primaryStyle": "관광지",
    "durationMinutes": 80
  }
]
```

## RAG를 붙일 때 권장 구조

`3.rag` 폴더는 벡터 DB 자체가 아니라, 벡터 DB에 넣을 원천 데이터와 전처리 스크립트 공간으로 두는 편이 맞습니다.

권장 메타데이터:

- `country`: `KR`, `JP`
- `region`: 서울, 경주, 도쿄, 교토 등
- `ageGroup`: `20s`, `30s`, `40s`, `family`, `senior`
- `gender`: `any`, `female`, `male`
- `travelerType`: 혼자, 커플, 가족, 친구
- `budgetLevel`: 낮음, 보통, 높음
- `pace`: 여유, 보통, 빡빡
- `interests`: 맛집, 자연, 역사, 카페, 사진

이렇게 문서를 만들어두면 나중에 RAG 조회 시 “30대 커플, 도쿄, 카페/사진, 보통 예산” 같은 조건으로 먼저 필터링하고, 그 안에서 유사도 검색을 할 수 있습니다.

## 관련 코드

- GPT 요청 생성: `apps/api/src/main/java/com/platform/jupiter/localtrip/TravelPlanService.java`
- 응답 파싱: `TravelPlanService.parseGeneratedItems()`
- 식당/카페 실제 장소 보정: `apps/api/src/main/java/com/platform/jupiter/localtrip/VerifiedLocalPlaceCatalog.java`
- 화면 일정 카드: `apps/web/src/LocalTripApp.jsx`
