# Awaaz OPD — *Har awaaz suni jaye* (every voice heard)

**Urdu voice triage, a live queue and a prescription reader for overcrowded government OPDs.**
AICON'26 · Build With AI · **Health Operations** · NUST SEECS, Islamabad

| | |
|---|---|
| **Live demo** | `<deployed link>` — no login. Demo mode (Alt+Shift+D) replays saved AI answers, so it works without API keys or Wi-Fi. |
| **Repository** | https://github.com/asmaic/Awaaz-OPD |
| **Try it in 2 minutes** | [Walkthrough for judges](#try-it-judges-walkthrough) |

---

## The problem
PIMS Islamabad was built for 2,000–3,000 outpatients a day and now receives **8,000+**. At the OPD counter:
- **Queue order is arrival order.** A man with heart-attack symptoms waits behind a prescription refill, because nobody has time to assess everyone.
- **Many patients can't fill a form.** They explain their problem in Urdu or Urdu–English, often to a stranger in a noisy hall.
- **Handwritten prescriptions** with brand names and abbreviations (`BD`, `1+0+1`, `x 5/7`) are misread, and dangerous drug combinations are missed.
- **Dengue season** (Sept–Nov) brings clusters from specific twin-city neighbourhoods that nobody is mapping in real time.

## What it does: Problem → Input → AI → Output → Impact

| Step | Input | AI component | Output |
|---|---|---|---|
| **1. Voice intake** | Patient speaks Urdu / Urdu–English into a laptop mic (or a sample case) | **Gemini** transcribes the audio *and* extracts a structured intake form in one call: symptoms from a fixed list, duration, vitals, red flags, locality. Groq Whisper is the backup. | Urdu transcript (Nastaliq) + English translation + structured form |
| **2. Triage** | The extracted form | **None, on purpose.** A deterministic rules engine (20 rules from WHO ETAT, WHO 2009 dengue guidelines, ESI v4, FAST) decides RED/ORANGE/YELLOW/GREEN and shows *which rule fired and why*. Missing or uncertain data can only raise priority. | Level + explanation + "nurse, please ask" questions |
| **3. Live queue** | Triaged patients | — | Colour-coded board; RED slides to the top and the ER is notified; estimated waits; dengue map |
| **4. Prescription reader** | Photo of a handwritten prescription | **Gemini vision** reads each medicine with a confidence per field and writes `[UNCLEAR]` instead of guessing; brand names are fuzzy-matched to generics | Editable table, drug-interaction alerts, pharmacy stock and cheaper same-generic substitutes. The doctor must confirm any unclear field. |
| **5. Urdu voice-back** | Doctor-confirmed medicines only | **Gemini** writes simple Urdu instructions; **Gemini TTS** speaks them | Spoken + on-screen Urdu instructions |
| **6. Referral + handover** | RED/ORANGE patient | Rules pick the hospital (needed service, travel, load, beds); **Gemini** drafts an SBAR handover letter, rejected if it adds any number not in the record | Recommended facility + route + signed, printable letter with QR |
| **7. Accountability** | Every AI output, rule, override and confirmation | — | Audit log; a public "Priority changes today" panel flags queue-jumping |

**Design principle: the LLM extracts and drafts, rules decide, a clinician confirms.** The model never assigns the triage level, never picks the hospital and never finalises a prescription.

## Where AI is used (and how we keep it safe)
- **Models** are read from environment variables: `gemini-3.5-flash-lite` (extraction, vision, Urdu text, SBAR), `gemini-3.1-flash-lite` (fallback), `gemini-3.8-flash-lite-tts` (speech), Groq `whisper-large-v3` + `gpt-oss-120b` (backup). Prompts are versioned in `lib/ai/prompts.ts` and `lib/handover.ts`.
- **Structured output:** every AI response must match a JSON schema and is validated with Zod; anything malformed is rejected.
- **Guards we added after testing on live output:**
  - Retry if Urdu comes back in Devanagari (Hindi) script.
  - Treat a placeholder `age: 0` as "not stated". The model did this live, and it would have turned a heart-attack patient into an "infant".
  - Treat `null` fields as missing.
  - A backup rule catches poisoning when the model quotes the phrase but forgets the tag.
  - The handover letter is rejected if it contains any number that is not in the patient record.
- **Fallback chain on every AI call:** cache → primary model → fallback model → Groq → saved answer → (for instructions and letters) a fixed-phrase template. Each call times out at 6 s (15 s for vision and speech).
- **Audit:** every AI output, cache hit, fallback, rule hit, override and doctor confirmation is logged (`/audit`).

## Measured results
Run `pnpm eval` over **20 synthetic Urdu cases** (6 RED, 6 ORANGE, 4 YELLOW, 4 GREEN, including tricky negatives such as chest pain after the gym), with live Gemini extraction followed by the rules:

| Metric | Result |
|---|---|
| Triage level matches expected | **20 / 20** |
| RED/ORANGE patients triaged lower than expected | **0** (the target that matters) |
| Symptom extraction precision / recall | **98% / 98%** |
| Urdu returned in the wrong script | 0 retries needed |
| Live latency (one call each) | voice/text → triage ≈ 1.5–2 s · prescription read < 10 s · Urdu speech ≈ 6–8 s · handover letter ≈ 3 s |
| Automated tests | **95** (`pnpm test`): every triage rule with boundary cases, all 20 cases, drug matching, referral, handover, pharmacy, override flags |

*Caveat:* the cases are synthetic scripts written by the team and run as text. Recorded-audio accuracy has been spot-checked live, not benchmarked.

### Expected impact (not yet measured in a hospital)
- **Patient safety:** the sickest patients are seen first, not the earliest arrivals, and the ER is notified automatically for RED.
- **Staff time:** one spoken sentence produces a structured intake form plus the nurse's next questions.
- **Medication safety and cost:** unreadable fields are flagged instead of guessed, interactions are caught (e.g. clarithromycin + atorvastatin), and in-stock generics are suggested (demo: *Klaricid → Claritek saves Rs 644 per course*).
- **Fair queues:** every override is public, with a name and a reason; vague reasons and patterns get flagged.
- **Public health:** live dengue clusters by neighbourhood during the season.
- **SDGs:** **3** (good health, universal health coverage), **10** (reduced inequalities: Urdu speakers and patients who can't fill forms), **16** (accountable institutions: transparent queues).
- **Adoption:** runs in a browser on one laptop per counter, with free-tier APIs. Saved answers keep it working through Wi-Fi drops.

## Try it (judges' walkthrough)
Open the live demo. Use two browser windows side by side: **/intake** and **/dashboard**.
1. **Intake →** pick *C07 · Dengue Dhok Hassu* → **Play sample case** → ORANGE with rule R10 and its WHO source → **Add to queue**. A pin drops on the dengue map.
2. **Intake →** *C01 · Heart Attack* → RED, R02 → **Add to queue**. On the dashboard the card **slides to the top** and the "ER notified" alert appears.
3. **Dashboard →** **Find bed** on the RED card → recommended facility with route → **Call ahead + handover note** → **Sign**.
4. **Dashboard →** **Override** a GREEN patient to RED with the reason *"VIP patient"*. It is flagged on **Priority changes today**.
5. **Doctor →** **Call in** the RED patient → **Use the sample prescription** → type **14 days** for the unclear Risek field → note the interaction alert → **Swap** Klaricid for Claritek → **Confirm** → **Play in Urdu**.
6. **Audit →** the full chain from voice to signed letter.

Shortcuts: **Alt+Shift+D** demo mode (tiny dot in the footer), **Alt+Shift+R** reset the queue. The mic also works: hold the button and speak Urdu.

## Run locally
```bash
pnpm install
cp .env.example .env.local      # add GEMINI_API_KEY (and optionally GROQ_API_KEY)
pnpm dev                        # http://localhost:3000
pnpm test                       # 95 unit tests
pnpm eval                       # 20-case triage evaluation
pnpm check-cache                # confirms the demo works offline
```
**Deploying:** set `GEMINI_API_KEY`, the four `GEMINI_*` model variables and `DEMO_MODE=true` (keyless replay) or `false`. On Vercel, runtime cache and audit go to `/tmp` automatically (`AWAAZ_WRITE_DIR` overrides). The committed `.cache/golden` ships with the build.

## Responsible AI and data
- **Synthetic data only.** All patients, cases, prescriptions, facility status and pharmacy stock are invented for the demo. No real patient data is used.
- API keys stay on the server (`.env.local`, git-ignored); none are in the repository or its history.
- This is a **decision-support prototype, not a medical device**. A nurse or doctor makes every clinical decision, and every AI suggestion can be overridden (with a reason, publicly logged).

## Built during AICON'26 and disclosures
- The repository was created on 9 Oct 2026 (first commit `b06189f`). Every step since is in the commit history.
- **Pre-existing material used:**
  - The `create-next-app` scaffold and generated shadcn/ui components (standard boilerplate).
  - Open-source libraries (below).
  - Public clinical guidelines that the triage rules encode: WHO ETAT, WHO 2009 dengue guidelines, ESI v4, AHA heart-attack warning signs, FAST stroke signs.
- **Everything else was written during the event:**
  - The AI pipeline, prompts, rules engine and evaluation.
  - The caching and fallback system.
  - All screens and the add-on features.
  - The synthetic Urdu cases.
- **Team:**
  - **Asma Imran:** AI pipeline, prompts, rules engine, evaluation, backend, caching and demo mode, and the logic for the referral, handover, pharmacy and transparency features.
  - **`<teammate name>`:** UI/UX and all screens, queue store and animations, demo and pitch.

## Acknowledgements and licences
- **AI services:**
  - Google Gemini API (Gemini models and TTS), under the Gemini API terms.
  - Groq API (Whisper large-v3, gpt-oss-120b), under the Groq terms.
- **Libraries:**
  - Next.js, React, Tailwind CSS, shadcn/ui, Base UI, motion, Zustand, Zod, sonner, qrcode, next-themes: MIT.
  - lucide-react: ISC.
  - Fuse.js, @google/genai, groq-sdk: Apache-2.0.
  - Leaflet: BSD-2-Clause.
  - react-leaflet: Hippocratic License 2.1.
- **Maps:** © OpenStreetMap contributors (ODbL), with tiles from tile.openstreetmap.org, attributed on every map.
- **Fonts:** Inter and Noto Nastaliq Urdu, under the SIL Open Font License 1.1.
- **Locality coordinates and hospital capabilities** in `fixtures/` are approximate and illustrative.

---
Developer docs: `CLAUDE.md` (project rules, structure, commands) · `docs/FEATURES.md` (referral, handover, pharmacy, transparency) · `types/contracts.ts` (API contracts).
