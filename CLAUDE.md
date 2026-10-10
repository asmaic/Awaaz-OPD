@AGENTS.md

# Awaaz OPD — "Har awaaz suni jaye"

AICON'26 "Build With AI" hackathon, Health Operations track (NUST SEECS, Islamabad).

## Product
Awaaz OPD is an outpatient triage and queue system for overcrowded Pakistani government hospitals (PIMS Islamabad was designed for 2,000–3,000 outpatients a day and now gets 8,000+). A patient speaks their complaint in Urdu or Urdu–English into the laptop mic; Gemini transcribes it (Urdu in Nastaliq plus an English translation) and extracts a structured intake form in one call. A deterministic TypeScript rules engine, not the LLM, assigns RED / ORANGE / YELLOW / GREEN and shows which rule fired and why. A live, colour-coded queue board animates urgent patients to the top, shows estimated waits and raises an "ER notified" toast for RED; suspected dengue patients from twin-city localities drop a pin on a small map.

In the doctor's room, a photo of a handwritten prescription is read by Gemini vision into drug / strength / frequency / duration with per-field confidence ("[UNCLEAR]" when unsure), brand names are fuzzy-matched to generics, drug interactions are checked, and the doctor confirms. The confirmed prescription becomes simple Urdu instructions spoken aloud via Gemini TTS. Every AI output, rule fired, cache hit, fallback, confirmation and override goes to an audit log. Every AI response is cached by input hash, and a hidden demo mode (Ctrl+Shift+D) replays only cached/golden responses so the live demo survives bad Wi-Fi or exhausted quotas.

## Stack
Next.js 16 (App Router, read AGENTS.md) + TypeScript strict + pnpm · Tailwind v4 + shadcn/ui · `motion` (import from `motion/react`) · Zustand with `persist` + BroadcastChannel `"awaaz-queue"` (no database) · react-leaflet via `next/dynamic` with `ssr: false` · `@google/genai` (Gemini) with `groq-sdk` fallback · `zod` for all AI output · `fuse.js` for drug matching · `vitest` · Inter + Noto Nastaliq Urdu via `next/font` (self-hosted). Localhost only, no auth.

## Rules
- `types/contracts.ts` is the single source of truth. NEVER modify it unless the user explicitly asks. Import types from it; never redefine them.
- Add-on features (referral, handover letter, pharmacy, override transparency) keep their types in `types/features.ts` — same rules. See `docs/FEATURES.md`.
- Ownership:
  - **Person A** edits only `lib/**`, `app/api/**`, `scripts/**`, `fixtures/golden/**`.
  - **Person B** edits only `app/(screens)/**`, `components/**`, `store/**`, `public/**`.
  - Anything else (`types/`, `fixtures/` outside golden, `lib/mock.ts`, `lib/utils.ts`, `app/layout.tsx`, `app/globals.css`, `app/page.tsx`, configs, this file) is shared: both must agree before changing it.
- The UI calls the backend only through `api` from `lib/mock.ts` (`NEXT_PUBLIC_USE_MOCK=true` → fixtures; otherwise `/api/*`). Demo mode: `setDemoMode(true)` makes it send header `x-awaaz-demo: 1`.
- All AI calls live in `lib/ai/*`, always go through `lib/cache.ts`, and always write an `AuditEntry` via `lib/audit.ts`.
- The LLM extracts; `lib/rules` decides triage. Never put triage logic in prompts or UI.
- Read model IDs only from env (`GEMINI_MODEL`, `GEMINI_FALLBACK_MODEL`, `GEMINI_VISION_MODEL`, `GEMINI_TTS_MODEL`). Never call a "flash" (non-lite) model in loops — its free quota is ~20 requests/day.
- Urdu output must be Perso-Arabic (Nastaliq) script; reject any Indic script with `/[\u0900-\u0DFF]/` (Devanagari through Sinhala; the model has mixed in Malayalam/Bengali letters).
- Synthetic patient data only. Never log API keys.
- Triage colours: RED `#DC2626`, ORANGE `#EA580C`, YELLOW `#CA8A04`, GREEN `#16A34A` (Tailwind: `bg-triage-red` etc.). Always pair colour with an icon and a text label.
- Urdu text: use the `urdu` utility class (Nastaliq font, RTL, tall line-height).
- Before saying a task is done: `pnpm typecheck && pnpm lint && pnpm test`.
- Keep commits small; commit message prefix `A:` or `B:`.

## Layout
```
types/contracts.ts        shared, FROZEN
fixtures/                 cases.json (20 cases), localities.json, seed-patients.json, facilities.json + pharmacy.json (mock), golden/, audio/, rx/
lib/ai/*                  gemini, groq, prompts, schemas                       (A)
lib/rules/*               engine, rules, __tests__                             (A)
lib/{cache,audit,drugs,interactions,wav}.ts                                    (A)
lib/mock.ts               `api` client, mock ↔ real switch                     (shared)
lib/{referral,handover,pharmacy,overrides}.ts  add-on feature logic, pure      (A) — docs/FEATURES.md
lib/{surveillance,sitrep}.ts  outbreak explorer                             (A) — docs/FEATURES.md §11
types/features.ts         add-on feature types                                 (shared)
app/api/*/route.ts        extract, transcribe, prescription, instructions, tts, audit, handover, facilities   (A)
app/(screens)/*           intake, dashboard, doctor, audit                     (B)
components/, store/, public/                                                   (B)
scripts/                  eval, warm-cache, check-cache                        (A)
.cache/ (golden/ committed), .data/audit.jsonl, public/generated/  — runtime output
```

## Commands
`pnpm dev` · `pnpm demo` (production build, no hot reload: use for the live demo) · `pnpm typecheck` · `pnpm lint` · `pnpm test` · `pnpm build` · `pnpm eval` · `pnpm warm` · `pnpm check-cache`
After a browser rehearsal: `pnpm warm --from-audit` promotes every AI answer it used into `fixtures/golden-cache` (commit it) so demo mode replays it offline.

## Tools
- Use Context7 for library docs whenever touching `@google/genai`, `groq-sdk`, `motion`, `react-leaflet`, `zustand` or Next.js APIs. Don't rely on memory for these; their APIs changed recently. For Next.js, `node_modules/next/dist/docs/` is authoritative.
- UI work: use the frontend-design skill and the shadcn MCP when available.
- Testing: use the Playwright MCP to open http://localhost:3000, click through flows and take screenshots when available.
