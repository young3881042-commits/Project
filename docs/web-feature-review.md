# Web Feature Review

Review scope: current web app experience for home, schedule, notepad/memo board, AI Trip destinations, planner, generated travel plan output, and admin1 visibility.

## Top Priority Fixes

1. Clarify the app model and navigation labels.
   The product currently mixes "AI 개인일정 관리", "Travel Schedule", "여행 일정", "AI Trip", "Scheduler", "일정", "내일정", and "개인 스케줄러". A first-time user cannot easily tell whether this is a personal workspace, a travel planner, or an admin console. Pick one primary product frame, then align route labels, page titles, buttons, and empty states around it.

2. Make the planner flow less brittle.
   The planner requires full start/end places, addresses, dates, daily route rows, and times before users can move to preferences. This is too much required input before seeing value. Allow a lightweight path with destination, dates, and travel style, then mark detailed addresses as optional refinements.

3. Add visible editing/export actions to travel plan output.
   Generated plans can be viewed, but the output page does not clearly offer edit, regenerate, duplicate, share, export PDF/Excel, send to schedule, or delete. The planner has an "내보내기" option, but users do not see an obvious exported artifact or download action after generation.

4. Fix data trust messaging.
   Destination cards show ratings, review counts, "누적 반응", and "현재 노출 가능" without explaining source, freshness, or whether fallback/sample data is being shown. Label the data source and last sync time, especially for travel recommendations and admin/partner metrics.

5. Do not use Google scraping.
   Google scraping should not be part of the destination, review, image, or map data pipeline. Use official APIs and permitted pipelines instead: Korea TourAPI for domestic tourism data, Kakao/Naver/Google Places APIs where licensed, OpenStreetMap/Nominatim within usage policy, Wikimedia Commons with attribution handling, and first-party/admin seed pipelines for curated inventory.

## Home

- The root home is very minimal and mostly acts as a launcher. It gives little product confidence before asking users to choose "일정", "노트", or "여행 추천".
- The LocalTrip home exists in code but the main root path is handled by the workspace home, so travel-specific home content may be unreachable or inconsistent depending on routing.
- Button labels mix Korean and English: "AI Trip", "Scheduler", "AI 메모 보드". Use user-task labels such as "여행지 찾기", "여행 일정 만들기", "내 일정", "메모".
- Admin-only or workspace concepts should not leak into consumer travel flows unless the user is actually an admin.

## Schedule

- The scheduler has useful basics: quick add, calendar, today timeline, weekly view, recurrence, completion tracking, and delete.
- Missing expected functionality: edit an existing item inline, duplicate, drag/drop calendar movement, all-day events, reminders/notifications, timezone handling, recurring-series editing choices, import/export, and sync beyond localStorage.
- Filtering includes "메모" and "완료", but travel-plan items are type "여행" and may not be filterable.
- Completion statistics may become misleading because recurring items are expanded across visible ranges.
- Mobile risk: the scheduler combines stats, quick add, calendar, weekly slots, today timeline, filters, and table-style rows. It likely needs stronger mobile prioritization, collapsible sections, and sticky primary add controls.

## Notepad / Memo Board

- The memo board is feature-rich but difficult to understand: boards, project columns, freeform blocks, markdown preview, checklist blocks, file-backed notes, context menu actions, and scheduler sync all exist in one surface.
- "AI" is in the feature name, but the visible flow is mostly manual note editing. If AI assistance is planned, expose a concrete action; if not, remove "AI" from the copy.
- Schedule extraction from notes is hidden. Users need explicit syntax help, a preview of detected schedule items, and conflict/error feedback before syncing to the scheduler.
- File-backed behavior depends on login/session state. The app should clearly distinguish local-only notes from workspace-saved files.
- admin1-specific seeded tasks appearing in the note board are useful for operations, but they should be labeled as admin review tasks and hidden from non-admin users.

## AI Trip Destinations

- Destination discovery has search, region/style filters, cards, images, ratings, and "일정에 담기", which is a solid start.
- Copy says "국내 여행지" while the product includes Japan options in planner and quick links. Align countries across discovery and planner.
- Filters are inside a collapsed details panel by default. For a discovery page, search should be immediately prominent.
- Cards do not show source, address, freshness, opening hours, price level, distance, or why the destination matches the user's query.
- If image loading fails, the UI hides the image but does not explain missing media or provide attribution. Wikimedia/official-source images need attribution and quality checks.

## Planner

- The three-step structure is clear, but the required route detail makes step 2 feel like a logistics form instead of an AI planner.
- "내보내기: 텍스트/엑셀/PDF" appears before generation, but no matching output action is obvious later. This creates a false promise.
- Destination selection defaults to the first available place, which can surprise users. Empty selection with a clear search prompt is safer.
- Japan support appears to be inferred from keywords rather than a complete country-specific dataset and routing pipeline. Make coverage explicit.
- Address search currently uses official map/search APIs or OpenStreetMap fallback in code; keep it that way. Avoid scraping search result pages.

## Travel Plan Output

- The day cards are readable and useful: cover image, route check, timeline, food/cafe highlighting, recommended menu, tags, and route facts.
- The output lacks action controls: regenerate, edit stop, reorder stops, replace place, add rest/meal, view on map, export, share, save to personal schedule, and delete.
- Route checks are local UI state and may not travel with the plan across devices or sessions.
- "출발 완료" / "도착 완료" on every day is operationally useful, but it feels more like a trip-day checklist than a planning review. Consider separating "planning view" and "travel day mode".
- Fallback itinerary behavior should be transparent. Users should know when the plan is AI/generated, curated fallback, or partially filled from static templates.

## Admin1 Visibility

- admin1 gets extra memo board tasks based on hardcoded project-board goals. That is useful for internal validation but should be visibly scoped as "admin1 운영 점검" and not resemble user-created notes.
- The admin workspace route is only shown in one editor header for ADMIN users, while travel operations use `/partners`. Consolidate admin entry points or clearly distinguish "admin workspace" from "partner center".
- The My Page profile shows "분석 워크스페이스: 비공개", but does not explain how admin users access it.
- Admin/partner metrics need source and sync status, including TourAPI sync status, seed/batch status, failed image counts, and stale data warnings.

## Suggested Priority Order

1. Rename navigation and core copy for one coherent product story.
2. Relax planner required fields and add a simple generate path.
3. Add output actions for edit, regenerate, export, share, delete, and schedule sync.
4. Add source/freshness labels to destination and admin metrics.
5. Separate admin1 operational content from normal user notes.
6. Rework mobile scheduler/planner layouts around progressive disclosure.
