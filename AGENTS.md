# Codex Instructions For ai-assistant

- Default app route: `/app`. The root route `/` should redirect or hand off to `/app`.
- Keep the public repository focused on Jenkins, Docker, `apps/api`, `apps/web`, and the top-level project documentation.
- Android/APK sources and generated mobile binaries are intentionally not part of this repository.
- Before changing this repo, read `docs/NEXT_CHECKLIST_PLAN_KO.md`.
- If `/data/ai-assistant` exists, inspect it for durable runtime context before changing source. Treat `/data/ai-assistant` as local runtime data, not source.
- Do not commit secrets, raw personal exports, private IPs, or internal service addresses.
- Keep private endpoints in local `.env` files or placeholder examples only.
- Keep documentation Docker-first.
- Workspace execution features are for local development/admin use. Production deployments should keep them disabled unless explicitly reviewed.
