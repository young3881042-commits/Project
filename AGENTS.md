# Codex Instructions For ai-assitant

- At the start of a Codex session, inspect `/data/ai-assitant` first if it exists. Prioritize `/data/ai-assitant/conversations`, `/data/ai-assitant/context`, and `/data/ai-assitant/workspace` for durable user context before making repo changes.
- If only `/data/jupiter-assistant` exists, treat it as legacy runtime context and inspect it before changing repo files.
- Treat `/data/ai-assitant` and `/data/jupiter-assistant` as local runtime data, not source. Do not commit secrets or raw personal exports copied from those paths.
- Before changing this repo, read `docs/NEXT_CHECKLIST_PLAN_KO.md` and align the work with its operating rules, task queue, and validation list.
- The default app route is `/app`; `/` should not render a separate main screen.
- Keep `docs/NEXT_CHECKLIST_PLAN_KO.md` updated when a task changes UI behavior, routing, deployment steps, or follow-up work.
- Check `docs/PROJECT_CHANGELOG_KO.md` for recent context before changing travel, notes, scheduler, login, or admin behavior.
- Every completed work item should also leave an `admin1` memo-board entry. Prefer adding/updating a seeded `ADMIN1_MEMO_LOGS` item in `apps/web/src/App.jsx` so the log appears in `/notes` for `admin1`.
- Prefer updating the existing checklist and changelog instead of creating duplicate planning documents.
- Keep the project documentation Docker-first. Do not add other deployment instructions or examples.
- For normal implementation requests in this repo, finish with validation, an intentional commit, and a push unless the user explicitly says not to. Inspect `git status` first and stage only files that belong to the current task.
