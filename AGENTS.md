# Codex Instructions For ai-assitant

- At the start of a Codex session, inspect `/data/ai-assitant` first if it exists. Prioritize `/data/ai-assitant/conversations`, `/data/ai-assitant/context`, and `/data/ai-assitant/workspace` for durable user context before making repo changes.
- If only `/data/jupiter-assistant` exists, treat it as legacy runtime context and inspect it before changing repo files.
- Treat `/data/ai-assitant` and `/data/jupiter-assistant` as local runtime data, not source. Do not commit secrets or raw personal exports copied from those paths.
- Before changing this repo, read `docs/NEXT_CHECKLIST_PLAN_KO.md` and align the work with its operating rules, task queue, and validation list.
- Current product direction: this is not yet a finished AI assistant service. Treat it as a mobile-first personal workspace and AI schedule assistant by default. Travel planning is one selectable `Plan` type, not the default app identity.
- Home UX rule: `/app` must default to `개인 워크스페이스 / AI 일정 도우미`. The top of the home screen should let users choose plan modes such as `general`, `travel`, `work`, `study`, and `fitness`; travel-specific copy and actions should appear only when the travel mode or an active travel plan is selected.
- Long-term target: after mobile UI and server APIs are stable, expand toward a phone-based personal AI assistant that can use user-granted access to messages, mail, local files, weather, nearby travel spots, and nearby restaurants. Web/PWA alone cannot read phone-local SMS/mail/files; native Android/iOS permissions or a native wrapper will be needed.
- Avoid generic platform-operations work unless the user specifically asks for it. Keep the main work queue focused on mobile workspace usability, AI-assisted schedule/memo flows, selectable plan types, routing/deployment stability, and real app API integrations.
- The default app route is `/app`; `/` should not render a separate main screen.
- Treat external web access for this deployment as port `80`. For Docker deploy/validation, use `DB_PORT=13306 API_PORT=18080 WEB_HTTP_PORT=80 WEB_HTTPS_PORT=443 docker compose -f docker-compose.dev.yml up -d --build api web` or the same command without `--build`; do not leave the web container mapped to `18000`.
- Only use `WEB_HTTP_PORT=18000` as a temporary fallback when port `80` is genuinely unavailable, and switch back to `80` before handing work back to the user.
- Keep `docs/NEXT_CHECKLIST_PLAN_KO.md` updated when a task changes UI behavior, routing, deployment steps, or follow-up work.
- Check `docs/PROJECT_CHANGELOG_KO.md` for recent context before changing travel, notes, scheduler, login, or admin behavior.
- Every completed work item should also leave an `admin1` memo-board entry. Prefer adding/updating a seeded `ADMIN1_MEMO_LOGS` item in `apps/web/src/App.jsx` so the log appears in `/notes` for `admin1`.
- Do not keep growing `apps/web/src/App.jsx` for UI work. When touching shared navigation, app home, notes, scheduler, or other sizeable UI surfaces, split reusable pieces into `apps/web/src/components/` or feature-scoped files and keep `App.jsx` focused on routing, state wiring, and legacy glue.
- Prefer updating the existing checklist and changelog instead of creating duplicate planning documents.
- Keep the project documentation Docker-first. Do not add other deployment instructions or examples.
- For normal implementation requests in this repo, finish with validation, an intentional commit, and a push unless the user explicitly says not to. Inspect `git status` first and stage only files that belong to the current task.
