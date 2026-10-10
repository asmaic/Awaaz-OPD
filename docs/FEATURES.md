# Add-on features

Four features built on the core intake → triage → queue → prescription flow. They follow the project's main rule: **the LLM drafts or extracts, deterministic code decides, a human confirms.** Everything is logged in the audit trail.

| # | Feature | Where it shows | Decides | AI? |
|---|---------|----------------|---------|-----|
| 1 | Referral and bed finder | Dashboard → **Transfer?** on RED/ORANGE cards; Doctor → **Treat here or transfer?** | `lib/referral.ts` rules | No |
| 2 | Handover letter (SBAR) | Referral dialog → **Call ahead + handover note** | Doctor signs | Gemini drafts; numbers are checked; template fallback |
| 5 | Pharmacy stock and substitutes | Doctor screen, under the prescription table | Doctor taps **Swap** | No |
| 10 | Override transparency | Dashboard → **Priority changes today**; override dialog | Flags only, nothing is blocked | No |

All facility, stock and price data is **mock** (`fixtures/facilities.json`, `fixtures/pharmacy.json`), and the UI says so.

---

## 1. Treat here or transfer: "Can we treat this patient here?"

**Problem.** RED patients at PIMS often wait in a full ER, or get referred by phone to a hospital that is also full.

**How it works** (`lib/referral.ts`, pure and unit-tested):

1. **Needs from the rules that fired** (`needsFor`). Every patient needs an ER. On top of that:
   - R02 (possible heart attack) → cath lab
   - R06 (possible stroke) → stroke unit / CT
   - Pregnancy or R16 → labour room
   - A child under 12 at RED/ORANGE → paediatric ICU
   - Other danger signs (R01, R03, R04, R05, R07, R09) → ICU bed
2. **Live board.** `GET /api/facilities` returns simulated ER load, free beds and busy capabilities for 6 twin-city hospitals: PIMS, Polyclinic, CDA, Holy Family, Benazir Bhutto and RIC. The values drift deterministically each minute (`statusAt`), so every window shows the same numbers. The dialog polls every 30 s.
3. **Origin is always PIMS.** The patient is standing in our OPD, so travel is measured from here, never from their home locality.
4. **Treat here by default.** PIMS keeps the patient unless it has no needed service, that service is busy, or (only for needs that require admission: ICU, PICU, stroke unit, labour room, cath lab) it has no free bed. **A crowded ER alone is never a reason to transfer.** The reasons are returned as `homeGaps`, and `decision` is `treat_here`, `transfer` or `no_option`.
5. **Transfer target score (lower is better).** Only when PIMS can't cover the patient:
   - A hospital missing a needed capability is **excluded**.
   - Otherwise: travel minutes + ER load × 40 + 45 if it has no free beds + 30 per needed capability that is busy.
   - Travel = straight-line km × 1.4 road factor at 30 km/h + 3 min to load. There is no live traffic.
6. **Explanation.** The pick comes with a plain reason, e.g. *"cath lab free · 25 min from PIMS · ER 61% full · 6 beds free"*. The board shows every option, including why each one lost ("cath lab busy", "no cath lab").

**Demo:** the heart-attack patient (c01) → **Transfer?**. PIMS's cath lab is busy, so the dialog says *"Stabilise here, then transfer to Rawalpindi Institute of Cardiology"* with *"Why not PIMS: cath lab busy at PIMS"*. The map shows a dashed route from PIMS.
For any patient PIMS can handle (e.g. the dengue ORANGE case, even with the ER full), the dialog says **"Treat here in the PIMS ER"**.

## 2. AI handover / referral letter (SBAR)

**Problem.** Patients arrive at the next hospital with nothing written, so the history is taken again.

**How it works:**
- `POST /api/handover { patient, prescription?, referral? }` → `{ sbar: { situation, background, assessment, recommendation }, generatedBy: "ai" | "template" }`.
- **Input** (`buildRecord`): clinical facts only. That covers the complaint, the patient's words, symptoms, a readable duration, vitals, red flags, the rules that fired, any override, the doctor-confirmed medicines, interaction alerts and the referral target.
  - Name, token and timestamps are **left out**. The letter header shows them, and leaving them out keeps the cache key stable, so a rehearsed case replays in demo mode.
- **Gemini prompt** (`sbar-v1`): use only facts from the record; describe rules as "meets triage criteria for…", never as a diagnosis; invent no numbers.
- **Number check** (`unsupportedNumbers`): any number in the note that isn't in the record rejects the draft. The fallback chain then moves on: fallback model → **deterministic template** (`templateSbar`). The template needs no network, so the letter always appears.
- **Letter UI** (`components/referral/handover-letter.tsx`):
  - Header with the token check code, the Urdu complaint in Nastaliq, and the four SBAR sections.
  - Labelled **"AI drafted from the record · doctor signs"**, or "(template)".
  - **Sign** with the doctor's name; this is audited.
  - **Print** prints the letter only.
  - **QR code** with a short text summary.
- The call-ahead action is logged as `notify_er`, with the facility and the reason it was chosen.

## 5. Medicine availability and generic substitutes

**Problem.** The patient is prescribed a brand the hospital pharmacy doesn't stock, then buys an expensive one outside or skips it.

**How it works** (`lib/pharmacy.ts`):
- **Stock check.** Each medicine is checked against `fixtures/pharmacy.json` by brand + generic + strength. The result is in stock, out of stock, or not on the hospital list.
- **Substitutes.** Only the **same generic and same strength**, in stock, cheapest first.
- **Saving.** Per course: (price difference per tablet) × doses per day × days, worked out from the normalised frequency and duration. It is shown only when the course length is known; an `[UNCLEAR]` duration shows no saving.
- **Swap.** The doctor taps **Swap**. This changes the matched brand but keeps the drug name *as written* as evidence. It is logged in the audit, e.g. *"Substituted Klaricid → Claritek (clarithromycin 500mg): out of stock, saves Rs 644"*. The Urdu instructions then use the new brand.

**Demo:** sample prescription → the Klaricid line turns amber, "Out of stock → Clarithromycin (Claritek) in stock · saves Rs 644" → **Swap**.

## 10. Fraud and queue-jumping protection

**Problem.** People with connections skip the line while sick patients wait.

**How it works** (`lib/overrides.ts`):
- **Name and reason.** Every override needs a reason (as before) and now the **staff member's name**, shown publicly.
- **Flags** (`flagsFor`, `reviewOverrides`):
  - **Vague reason** (medium): under 15 characters, or non-clinical words (VIP, sifarish, relative, friend, staff, MNA, officer…). Clinical phrasing such as "known diabetic" or "family history of MI" is deliberately *not* flagged.
  - **Unsupported jump** (high): raised 2+ levels above what the **rules** decided, e.g. GREEN → RED.
  - **Urgent downgrade** (high): a RED or ORANGE patient lowered.
  - **Staff pattern** (high): the same person raised 3 or more GREEN patients on the same day.
- **Before saving.** The override dialog previews the flags ("This change will be flagged on the public panel"). Nothing is blocked.
- **"Priority changes today" panel** (dashboard): every override with time, token, from → to, who, the reason, what the rules said, and its flags.
- **Token check code.** A 4-character code (`tokenCode`) is printed on the token slip and shown on the queue card, so a slip can't be reused or swapped. It is tamper-evident, not cryptographic (see the `ponytail:` note).

**Demo:** override a GREEN patient to RED with the reason "VIP patient". The panel shows *Reason doesn't describe a clinical finding* and *Raised 3 levels above what the rules found (GREEN → RED)*. Make two more GREEN upgrades as the same nurse, and the third shows *"Nurse X has raised 3 GREEN patients today"*.

> The dialog requires at least 5 characters, so type "VIP patient", not "VIP".

---

## Files

| Area | Files |
|------|-------|
| Types (shared, alongside the frozen contracts) | `types/features.ts` |
| Logic (A) | `lib/referral.ts`, `lib/handover.ts`, `lib/pharmacy.ts`, `lib/overrides.ts`, plus `runHandover` in `lib/pipeline.ts` and `handoverNote` in `lib/ai/gemini.ts` |
| API (A) | `app/api/facilities/route.ts` (GET), `app/api/handover/route.ts` (POST) |
| Client (shared) | `lib/mock.ts`: `api.handover`, `api.facilities` (mock versions use the same pure logic) |
| Data (mock) | `fixtures/facilities.json`, `fixtures/pharmacy.json` |
| UI (B's folders) | New: `components/referral/*`, `components/dashboard/transparency-panel.tsx`, `components/doctor/stock-panel.tsx`. Edited: `patient-card.tsx` (Transfer?, check code), `override-dialog.tsx` (name, flag preview), `token-card.tsx` (check code), dashboard and doctor pages (wiring), `store/queue.ts` (override payload), `voice-back.tsx` (see below) |
| Tests | `lib/__tests__/{referral,handover,pharmacy,overrides}.test.ts`, 31 new tests |

## Related fix

`components/doctor/voice-back.tsx` plays `public/fallback/rx-demo.wav` **only if** the Urdu text exactly matches what that recording says (`fixtures/golden/rx-demo.instructions.json`, now aligned with the WAV). This stops a doctor-edited dose from being read out with the old recording. Otherwise it falls back to the browser voice or the on-screen text.

## Testing

```bash
pnpm test            # all unit tests (98)
pnpm dev             # then:
curl localhost:3000/api/facilities | jq '.data.facilities[] | [.short, .erLoad, .freeBeds, .busy]'
```

Manual check (verified in Chrome on 10 Oct 2026):
1. **Dashboard:** RED card → **Transfer?**. RIC is recommended, PIMS shows "cath lab busy". Press **Call ahead**: the AI letter appears, the number check passes, and the QR code renders. Enter a name, then **Sign**.
2. **Override** token 41 GREEN → RED, "VIP patient". The dialog previews 2 flags and the panel shows them. After two more GREEN upgrades by the same nurse, the pattern flag appears.
3. **Doctor:** sample prescription → Klaricid out of stock → **Swap** to Claritek (saves Rs 644). The table and audit update.

In demo mode (Alt+Shift+D) the facility board and pharmacy need no network at all. The handover note serves a cached rehearsal or the template.
