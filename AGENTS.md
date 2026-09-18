# Codex Instructions For Orbit

- Treat the installable user-facing web/mobile app name as `Orbit`. Keep legacy package and artifact identifiers such as `com.platform.aiassitant` and `ai-assitant-debug.apk` stable unless a migration is explicitly planned.
- Default app route: `/app`. The root route `/` should redirect or hand off to `/app`.
- Keep the repository focused on Jenkins, Docker, `apps/api`, `apps/web`, the minimal Android wrapper, and project documentation.
- The public repository keeps Android wrapper sources only. Generated APKs, checksum files, rollback bundles, and signing material are delivered through GitHub Release or a separate private channel, never Git.
- When working inside Android/Termux, copy the installable APK to the phone-visible path `/sdcard/Download/Orbit-latest.apk`; `/root/Downloads` is not the Android shared Download folder.
- Standard Orbit APK builds require `ORBIT_NATIVE_RUNTIME_DIR` with staged Node/Codex, dependencies, TLS certificates and licenses. Run the embedded-runtime stage/APK verification; a Java compile or signature pass alone does not verify AI availability. `ORBIT_WITHOUT_NATIVE_RUNTIME=1` is only for an explicitly intended legacy-only build.
- Never commit Android build directories, keystores, release signing credentials, private endpoints, or personal data.
- Before changing this repo, read `docs/NEXT_CHECKLIST_PLAN_KO.md` and `docs/LIFEHUB_MAINTENANCE_KO.md`. For the current LifeHub UI, the maintenance guide and `docs/WEB_UI_UX_AUDIT_KO.md` override older historical screen handoffs.
- If `/data/ai-assistant` exists, inspect it for durable runtime context before changing source. Treat `/data/ai-assistant` as local runtime data, not source.
- Do not commit secrets, raw personal exports, private IPs, or internal service addresses.
- Keep private endpoints in local `.env` files or placeholder examples only.
- Keep documentation Docker-first.
- Workspace execution features are for local development/admin use. Production deployments should keep them disabled unless explicitly reviewed.

## Maintainability Rules

- Keep route files such as `apps/web/src/App.jsx` and `apps/web/src/LocalTripApp.jsx` as orchestration shells. Do not add new domain rules, large constants, or long helper blocks there when a feature folder can own them.
- Put shared frontend rules in a small module near the owning domain, for example `apps/web/src/components/notes/*Rules.js`, and import that module from route shells or sibling components.
- Put visual overrides in a scoped CSS file under `apps/web/src/styles/` and import it from `apps/web/src/styles.css`; avoid appending large feature-specific CSS blocks directly to `styles.css`.
- Keep `apps/web/src/LifeHubApp.jsx` as an orchestration shell. Home calculations belong in `features/home`, Bridge pairing state belongs in `features/lifehub-ai/useAiPairing.js`, and request trust checks belong in `tools/lifehub-bridge/src/local-request-policy.ts`.
- A local no-code Bridge connection must remain a dedicated loopback-only endpoint. Do not turn generic API authentication or administrator authorization into a localhost bypass.
- Keep `/ai/edit` as a thin app-edit experience over the shared `AiAssistantPage` stream. Do not copy the chat, approval, reconnect, or diff flow into a second implementation. Derive progress from real `todo.updated`, command, file, and terminal events; never invent a percentage when no todo list exists.
- Keep chat-created schedules as a local LifeHub domain action: parse in `features/lifehub-ai/scheduleChatAction.js`, apply duplicate/capacity rules in `assistantScheduleChange.js`, and persist only through the current-session callback in `LifeHubApp.jsx`. Never claim success before `saveSchedules` succeeds, and do not route schedule UI/code-edit requests into personal data.
- `localWorkspaceAccess` is a per-turn privilege reserved for authenticated `device_local_web` Codex threads whose message request also passes the direct loopback socket/Host/Origin policy. It may skip ordinary approval waiting and exact command matching only inside the selected project-wide `.` scope. Keep path/symlink and external MCP/web/network checks fail-closed, reject uninspectable shell/interpreter forms, and require one final approval for delete/critical operations.
- For notes, keep the default directory model centralized in `apps/web/src/components/notes/notesDirectoryRules.js`. If the directory policy changes, update that file first and then adjust callers.
- For travel plan generation, keep itinerary quality rules in the API service layer before persistence so web views and memo sync receive already-normalized data.
