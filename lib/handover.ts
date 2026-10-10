// Feature 2 — handover / referral letter in SBAR form. The AI drafts, the doctor signs.
// Client-safe (no server imports): the template is also used by the mock API.
import type { Patient, Prescription } from "@/types/contracts";
import type { HandoverReq, Sbar } from "@/types/features";

/**
 * Clinical facts only. No name, token, ids or timestamps: the letter header shows those, and leaving them out
 * keeps the AI cache key stable across rehearsals (same case → same cached note in demo mode).
 */
export function buildRecord(req: HandoverReq) {
  const { patient: p, prescription, referral } = req;
  const e = p.extraction;
  return {
    age_years: e.age_years, sex: e.sex,
    chief_complaint: e.chief_complaint, patient_words_en: e.translation_en,
    symptoms: e.symptoms.map((s) => s.replaceAll("_", " ")), duration: humanDuration(e.duration_days), vitals: e.vitals,
    red_flags_mentioned: e.red_flags_mentioned, locality: e.locality,
    triage: {
      level: p.override?.level ?? p.triage.level,
      rules: p.triage.hits.map((h) => ({ id: h.id, title: h.title, why: h.why })),
      override: p.override ? { level: p.override.level, reason: p.override.reason } : undefined,
      er_notified: !!p.erNotifiedAt,
    },
    medicines: confirmedMeds(prescription),
    interactions: prescription?.interactions.map((i) => ({ pair: i.pair, severity: i.severity, note: i.note })) ?? [],
    referral,
  };
}
export type HandoverRecord = ReturnType<typeof buildRecord>;

/** 0.02 → "about 30 minutes", 0.25 → "about 6 hours", 4 → "4 days". Models store short durations as day fractions. */
export function humanDuration(days?: number): string | undefined {
  if (days === undefined) return undefined;
  if (days >= 1) return `${Math.round(days)} day${Math.round(days) === 1 ? "" : "s"}`;
  const hours = days * 24;
  if (hours >= 1) return `about ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  return `about ${Math.max(5, Math.round((hours * 60) / 5) * 5)} minutes`;
}

const confirmedMeds = (rx?: Prescription) =>
  rx?.items.filter((i) => i.confirmedByDoctor).map((i) => ({
    name: i.brand_match ?? i.drug_raw.value, generic: i.generic, strength: i.strength.value,
    frequency: i.frequency.value, duration: i.duration.value,
  })) ?? [];

export const HANDOVER_PROMPT_VERSION = "sbar-v1";
export const HANDOVER_PROMPT = `You write a short clinical handover note in SBAR format (Situation, Background, Assessment, Recommendation) for the doctor receiving a patient referred from a Pakistani government hospital OPD. Input is a JSON record.
Rules:
- Use ONLY facts in the record. Do not add diagnoses, test results, examination findings, doses, times or treatments that are not in it.
- "triage.rules" are triage criteria, not diagnoses: write "meets triage criteria for possible heart attack", never "has a heart attack".
- Do not invent numbers. Every number you write must appear in the record. If age is missing, say "age not recorded".
- English, plain and brief: 1–3 sentences per section.
- Situation: who, triage level and the main complaint in the patient's own words.
- Background: symptoms, duration, vitals and red flags that were reported.
- Assessment: which triage rules fired and why, any clinician override, interaction alerts.
- Recommendation: the referral destination and capability needed if given, and medicines already prescribed.
Return JSON {"situation","background","assessment","recommendation"}.`;

/** Numbers in the note that are not in the record (a cheap hallucination check). */
export function unsupportedNumbers(sbar: Sbar, record: HandoverRecord): string[] {
  const source = JSON.stringify(record);
  const nums = Object.values(sbar).join(" ").match(/\d+(?:\.\d+)?/g) ?? [];
  return [...new Set(nums)].filter((n) => !source.includes(n));
}

/**
 * The patient's words without greeting / "where I'm from" openers, which the letter reports separately
 * (English counterpart of firstClause in components/dashboard/patient-card.tsx).
 */
export function complaintWords(en: string): string {
  const sentences = en.trim().replace(/^[“"']|[”"']$/g, "").split(/(?<=[.!?])\s+/);
  const opener = /^(doctor( sahib| sahab)?[,.!]?$|(i('ve| have) come|i('m| am)|i live|i'm coming) (here )?(from|in) )/i;
  const kept = sentences.map((x) => x.replace(/^doctor( sahib| sahab)?,\s*/i, "")).filter((x) => x && !opener.test(x));
  return (kept.length ? kept : sentences).join(" ");
}

const list = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(", ")} and ${xs.at(-1)}` : xs[0] ?? "");

/** Deterministic SBAR from the record — used when no AI answer is available, and in mock mode. */
export function templateSbar(r: HandoverRecord): Sbar {
  const sex = r.sex === "M" ? "male" : r.sex === "F" ? "female" : "patient";
  const who = r.age_years !== undefined ? `${r.age_years}-year-old ${sex}` : `${sex[0].toUpperCase()}${sex.slice(1)} (age not recorded)`;
  const v = r.vitals;
  const vitals = [v.spo2 !== undefined && `SpO2 ${v.spo2}%`, v.tempC !== undefined && `temperature ${v.tempC}°C`, v.hr !== undefined && `heart rate ${v.hr}`,
    v.sbp !== undefined && `systolic BP ${v.sbp}`, v.rr !== undefined && `respiratory rate ${v.rr}`].filter(Boolean) as string[];
  const rules = r.triage.rules.filter((h) => h.id !== "R19");
  return {
    situation: `${who}, triaged ${r.triage.level} at OPD. Main complaint: ${r.chief_complaint}. In their words: "${complaintWords(r.patient_words_en)}"`,
    background: [
      r.symptoms.length && `Reported symptoms: ${list(r.symptoms)}${r.duration ? ` for ${r.duration}` : ""}.`,
      vitals.length ? `Vitals recorded: ${list(vitals)}.` : "No vitals recorded at intake.",
      r.red_flags_mentioned.length && `Red flags mentioned: ${r.red_flags_mentioned.map((f) => `"${f}"`).join(", ")}.`,
      r.locality && `From ${r.locality}.`,
    ].filter(Boolean).join(" "),
    assessment: [
      rules.length ? `Meets triage criteria: ${rules.map((h) => `${h.id} ${h.title} (${h.why})`).join("; ")}.` : "No urgent triage criteria met.",
      r.triage.override && `Clinician override to ${r.triage.override.level}: ${r.triage.override.reason}.`,
      r.triage.er_notified && "ER was notified.",
      ...r.interactions.map((i) => `${i.severity === "major" ? "Major" : "Moderate"} interaction alert: ${i.pair.join(" + ")}.`),
    ].filter(Boolean).join(" "),
    recommendation: [
      r.referral ? `To be stabilised in our ER, then transferred to ${r.referral.facility}${r.referral.needs.length ? ` for ${list(r.referral.needs)}` : ""}.` : "Please assess on arrival.",
      r.medicines.length ? `Prescribed: ${r.medicines.map((m) => `${m.name} ${m.strength} ${m.frequency} for ${m.duration}`).join("; ")}.` : "No medicines prescribed yet.",
    ].join(" "),
  };
}

/** One-line plain text for the QR code (kept short so the code stays scannable). */
export function handoverQrText(p: Patient, sbar: Sbar, facility?: string): string {
  return [`AWAAZ OPD HANDOVER · Token ${p.token} · ${p.name}`, facility && `To: ${facility}`,
    `S: ${sbar.situation}`, `A: ${sbar.assessment}`].filter(Boolean).join("\n").slice(0, 900);
}
