// Outbreak explorer — syndromic surveillance. Like WHO / Pakistan IDSR, it groups patients by symptom-based
// CASE DEFINITIONS, never by an AI diagnosis. Pure and deterministic; the AI only drafts the alert text.
import type { Extraction, Symptom, TriageLevel } from "@/types/contracts";
import history from "@/fixtures/surveillance-history.json";

export type SyndromeId = "dengue" | "ili" | "sari" | "awd" | "afi";

/** Minimal case record: a live queue patient or a row of the synthetic history. */
export interface CaseRecord {
  id: string;
  ts: string; // ISO arrival time
  locality?: string;
  age?: number;
  sex?: "M" | "F" | "unknown";
  symptoms: Symptom[];
  durationDays?: number;
  level: TriageLevel;
  ruleIds: string[];
  live?: boolean; // from today's queue (vs synthetic history)
}

export interface Syndrome {
  id: SyndromeId;
  label: string;
  ur: string;
  short: string;
  definition: string; // shown to judges / health officers
  source: string;
  note?: string;
  test: (c: CaseRecord) => boolean;
}

const has = (c: CaseRecord, ...s: Symptom[]) => s.some((x) => c.symptoms.includes(x));
const count = (c: CaseRecord, ...s: Symptom[]) => s.filter((x) => c.symptoms.includes(x)).length;
const DENGUE_SIGNS: Symptom[] = ["headache", "retro_orbital_pain", "body_ache", "rash", "vomiting", "persistent_vomiting", "bleeding_gums", "nosebleed", "abdominal_pain", "lethargy"];

export const SYNDROMES: Syndrome[] = [
  {
    id: "dengue", label: "Suspected dengue", ur: "مشتبہ ڈینگی", short: "Dengue",
    definition: "Fever + 2 or more of: aches and pains, headache, pain behind the eyes, rash, vomiting, bleeding, abdominal pain, lethargy (or a dengue triage rule fired) — and no cough, which points to a respiratory infection instead.",
    source: "WHO 2009 dengue case definition (probable dengue), cough excluded for OPD specificity",
    test: (c) => !has(c, "cough") && (c.ruleIds.some((r) => ["R09", "R10", "R17"].includes(r)) || (has(c, "fever") && count(c, ...DENGUE_SIGNS) >= 2)),
  },
  {
    id: "ili", label: "Influenza-like illness", ur: "فلو جیسی بیماری", short: "Flu-like (ILI)",
    definition: "Fever + cough, onset within the last 10 days. Flu, COVID-19 and other respiratory viruses all present this way.",
    source: "WHO ILI surveillance case definition",
    test: (c) => has(c, "fever") && has(c, "cough") && (c.durationDays === undefined || c.durationDays <= 10),
  },
  {
    id: "sari", label: "Severe acute respiratory infection", ur: "شدید سانس کا انفیکشن", short: "SARI",
    definition: "Influenza-like illness + shortness of breath, low oxygen or RED/ORANGE triage. The syndrome used to track severe COVID-19.",
    source: "WHO SARI surveillance case definition (adapted for OPD)",
    test: (c) => has(c, "fever") && has(c, "cough") && (has(c, "shortness_of_breath", "blue_lips") || c.ruleIds.includes("R01") || c.level === "RED" || c.level === "ORANGE"),
  },
  {
    id: "awd", label: "Acute watery diarrhoea", ur: "پانی جیسے دست", short: "Diarrhoea (AWD)",
    definition: "Diarrhoea, with or without vomiting, of under 14 days. Signals contaminated water (cholera, typhoid season).",
    source: "WHO / Pakistan IDSR AWD case definition",
    test: (c) => has(c, "diarrhoea") && (c.durationDays === undefined || c.durationDays < 14),
  },
  {
    id: "afi", label: "Undifferentiated fever", ur: "نامعلوم بخار", short: "Fever (malaria/typhoid?)",
    definition: "Fever without cough, diarrhoea or dengue signs. Malaria and typhoid sit here: they cannot be told apart by symptoms and need a rapid test.",
    source: "IDSR acute febrile illness",
    note: "Malaria is confirmed by a rapid diagnostic test, not by symptoms — this syndrome flags where to test.",
    test: (c) => has(c, "fever") && !has(c, "cough", "diarrhoea") && count(c, ...DENGUE_SIGNS) < 2 && !c.ruleIds.some((r) => ["R09", "R10", "R17"].includes(r)),
  },
];
export const SYNDROME = Object.fromEntries(SYNDROMES.map((s) => [s.id, s])) as Record<SyndromeId, Syndrome>;

export const syndromesOf = (c: CaseRecord): SyndromeId[] => SYNDROMES.filter((s) => s.test(c)).map((s) => s.id);

/** Live queue patient → CaseRecord. */
export function fromPatient(p: { id: string; arrivedAt: string; extraction: Extraction; triage: { level: TriageLevel; hits: { id: string }[] }; override?: { level: TriageLevel } }): CaseRecord {
  const e = p.extraction;
  return {
    id: p.id, ts: p.arrivedAt, locality: e.locality, age: e.age_years, sex: e.sex, symptoms: e.symptoms, durationDays: e.duration_days,
    level: p.override?.level ?? p.triage.level, ruleIds: p.triage.hits.map((h) => h.id), live: true,
  };
}

// ---------- analysis ----------

const DAY = 86_400_000;
/** Local calendar day index (days since epoch in local time) so "today" means today in Islamabad. */
const dayIndex = (t: number) => {
  const d = new Date(t);
  return Math.floor((t - d.getTimezoneOffset() * 60_000) / DAY);
};

export interface LocalityStat {
  locality: string;
  thisWeek: number; // last 7 days incl. today
  baselineWeekly: number; // mean weekly count over the 3 weeks before
  pValue: number; // P(≥ this week's count | usual rate), Poisson
  growth: number | null; // thisWeek / previous week (null if previous week was 0)
  alert: "alert" | "watch" | null;
  why: string;
}

export interface Analysis {
  syndrome: Syndrome;
  cases: CaseRecord[]; // matching cases in the window, newest first
  daily: { day: number; date: string; count: number }[]; // oldest → newest, `windowDays` long
  total: number;
  thisWeek: number;
  prevWeek: number;
  growth: number | null;
  doublingDays: number | null; // only when growing
  byLocality: LocalityStat[]; // alerts first, then by this week's count
  alerts: LocalityStat[];
  ageBands: { band: string; count: number }[];
  share: { female: number; male: number; unknown: number };
}

/** P(X ≥ k) for X ~ Poisson(λ). */
export function poissonTail(k: number, lambda: number): number {
  let term = Math.exp(-lambda), cdf = 0;
  for (let i = 0; i < k; i++) { cdf += term; term *= lambda / (i + 1); }
  return Math.max(0, 1 - cdf);
}

/** Usual weekly rate is floored here: small-area baselines of 0–1 cases make any blip look extreme. */
export const MIN_WEEKLY_BASELINE = 1.5;

/**
 * Outbreak detection per locality: this week's count vs the mean of the 3 weeks before, as a Poisson test.
 * ALERT: ≥ 4 cases and p < 0.005. WATCH: ≥ 3 cases and p < 0.05.
 * ponytail: weekly bins + fixed thresholds; use a proper CUSUM/Farrington when real multi-year baselines exist.
 */
export function analyse(all: CaseRecord[], syndromeId: SyndromeId, now: number, windowDays = 28): Analysis {
  const syndrome = SYNDROME[syndromeId];
  const today = dayIndex(now);
  const ageDays = (c: CaseRecord) => today - dayIndex(Date.parse(c.ts));
  const cases = all.filter((c) => { const a = ageDays(c); return a >= 0 && a < windowDays && syndrome.test(c); })
    .sort((a, b) => b.ts.localeCompare(a.ts));

  const daily = Array.from({ length: windowDays }, (_, i) => {
    const back = windowDays - 1 - i;
    return { day: today - back, date: new Date(now - back * DAY).toLocaleDateString("en-CA"), count: 0 };
  });
  for (const c of cases) daily[windowDays - 1 - ageDays(c)].count++;

  const week = (c: CaseRecord) => Math.floor(ageDays(c) / 7); // 0 = this week (last 7 days)
  const thisWeek = cases.filter((c) => week(c) === 0).length;
  const prevWeek = cases.filter((c) => week(c) === 1).length;
  const growth = prevWeek ? thisWeek / prevWeek : null;
  const doublingDays = growth && growth > 1 ? Math.round((7 * Math.LN2) / Math.log(growth) * 10) / 10 : null;

  const groups = new Map<string, CaseRecord[]>();
  for (const c of cases) {
    const k = c.locality?.trim() || "Unknown";
    groups.set(k, [...(groups.get(k) ?? []), c]);
  }
  const byLocality: LocalityStat[] = [...groups].map(([locality, cs]) => {
    const w = [0, 1, 2, 3].map((n) => cs.filter((c) => week(c) === n).length);
    const mean = (w[1] + w[2] + w[3]) / 3;
    const pValue = poissonTail(w[0], Math.max(mean, MIN_WEEKLY_BASELINE));
    const known = locality !== "Unknown";
    const isAlert = known && w[0] >= 4 && pValue < 0.005;
    const isWatch = !isAlert && known && w[0] >= 3 && pValue < 0.05;
    const g = w[1] ? w[0] / w[1] : null;
    const why = `${w[0]} this week vs ${mean.toFixed(1)}/week usual (3-week baseline), p = ${pValue < 0.001 ? "<0.001" : pValue.toFixed(3)}`;
    return { locality, thisWeek: w[0], baselineWeekly: Math.round(mean * 10) / 10, pValue, growth: g, alert: isAlert ? ("alert" as const) : isWatch ? ("watch" as const) : null, why };
  }).sort((a, b) => (a.alert === "alert" ? 0 : a.alert === "watch" ? 1 : 2) - (b.alert === "alert" ? 0 : b.alert === "watch" ? 1 : 2) || b.thisWeek - a.thisWeek);

  const bands: [string, number, number][] = [["<5", 0, 5], ["5–14", 5, 15], ["15–44", 15, 45], ["45–64", 45, 65], ["65+", 65, 200]];
  const ageBands = bands.map(([band, lo, hi]) => ({ band, count: cases.filter((c) => c.age !== undefined && c.age >= lo && c.age < hi).length }));
  const share = {
    female: cases.filter((c) => c.sex === "F").length,
    male: cases.filter((c) => c.sex === "M").length,
    unknown: cases.filter((c) => c.sex !== "F" && c.sex !== "M").length,
  };

  return { syndrome, cases, daily, total: cases.length, thisWeek, prevWeek, growth, doublingDays, byLocality, alerts: byLocality.filter((l) => l.alert), ageBands, share };
}

/** Plain-number summary the AI may use (and the number check enforces). */
export function sitrepFacts(a: Analysis) {
  return {
    syndrome: a.syndrome.label, case_definition: a.syndrome.definition, source: a.syndrome.source, note: a.syndrome.note,
    window_days: a.daily.length, total_cases: a.total, cases_this_week: a.thisWeek, cases_previous_week: a.prevWeek,
    week_on_week_ratio: a.growth === null ? null : Math.round(a.growth * 100) / 100, doubling_time_days: a.doublingDays,
    alerts: a.alerts.map((l) => ({ locality: l.locality, level: l.alert, this_week: l.thisWeek, usual_per_week: l.baselineWeekly })),
    top_localities: a.byLocality.slice(0, 5).map((l) => ({ locality: l.locality, this_week: l.thisWeek })),
    age_bands: a.ageBands, sex: a.share,
    data_note: "Synthetic demo data: 28-day simulated history plus today's live queue.",
  };
}
export type SitrepFacts = ReturnType<typeof sitrepFacts>;

// ---------- synthetic history ----------

/** The committed synthetic 28-day history, anchored to `now` (rows store "days ago", so the demo never goes stale). */
export function historyCases(now: number): CaseRecord[] {
  return (history.cases as (Omit<CaseRecord, "ts" | "live"> & { daysAgo: number; hour: number })[]).map(({ daysAgo, hour, ...c }) => {
    const d = new Date(now - daysAgo * DAY);
    d.setHours(hour, (c.id.charCodeAt(c.id.length - 1) * 7) % 60, 0, 0);
    return { ...c, ts: d.toISOString() };
  });
}
