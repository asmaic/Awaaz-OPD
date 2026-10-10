// pnpm tsx scripts/gen-surveillance.ts — writes fixtures/surveillance-history.json (SYNTHETIC, seeded, reproducible).
// Each case goes through the real rules engine so its level and rule ids match the rest of the app.
// Scenarios: a dengue outbreak growing in Dhok Hassu / Pirwadhai (Rawalpindi), a flu-like wave in Islamabad's
// G-sectors with a few severe (SARI) cases, a diarrhoea cluster in Tench Bhata that has already subsided,
// and steady background fever everywhere.
import { writeFileSync } from "node:fs";
import type { Extraction, Symptom } from "@/types/contracts";
import { evaluate } from "@/lib/rules/engine";

let seed = 20261010;
const rnd = () => { seed = (seed + 0x6d2b79f5) | 0; let t = seed; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const poisson = (lambda: number) => { let k = 0, p = 1; const L = Math.exp(-lambda); do { k++; p *= rnd(); } while (p > L); return k - 1; };
const some = (xs: Symptom[], n: number) => [...xs].sort(() => rnd() - 0.5).slice(0, n);

const ALL = ["Dhok Hassu", "Pirwadhai", "Raja Bazaar", "Satellite Town", "Chaklala", "Saddar", "Tench Bhata", "Westridge", "Murree Road",
  "G-6", "G-7", "G-9", "G-10", "G-11", "F-6", "F-8", "I-8", "I-9", "I-10", "Bhara Kahu", "Tarlai"];

type Gen = { symptoms: () => Symptom[]; duration: () => number; age: () => number };
const adult = () => 15 + Math.floor(rnd() * 55);
const anyAge = () => (rnd() < 0.25 ? 1 + Math.floor(rnd() * 13) : adult());
const GEN: Record<string, Gen> = {
  dengue: { symptoms: () => ["fever", ...some(["headache", "body_ache", "retro_orbital_pain", "rash", "vomiting"], 2 + Math.floor(rnd() * 2)), ...(rnd() < 0.25 ? some(["abdominal_pain", "bleeding_gums", "nosebleed", "persistent_vomiting", "lethargy"], 1) : [])], duration: () => 2 + Math.floor(rnd() * 5), age: anyAge },
  ili: { symptoms: () => ["fever", "cough", ...some(["headache", "body_ache"], Math.floor(rnd() * 2))], duration: () => 1 + Math.floor(rnd() * 5), age: anyAge },
  sari: { symptoms: () => ["fever", "cough", "shortness_of_breath"], duration: () => 3 + Math.floor(rnd() * 5), age: () => 50 + Math.floor(rnd() * 30) },
  awd: { symptoms: () => ["diarrhoea", ...(rnd() < 0.5 ? ["vomiting" as Symptom] : []), ...(rnd() < 0.15 ? some(["lethargy", "sunken_eyes"], 2) : [])], duration: () => 1 + Math.floor(rnd() * 3), age: anyAge },
  afi: { symptoms: () => ["fever", ...(rnd() < 0.4 ? ["headache" as Symptom] : [])], duration: () => 1 + Math.floor(rnd() * 6), age: anyAge },
};

/** Expected cases per day for a (kind, locality, daysAgo). */
function rate(kind: string, loc: string, d: number): number {
  const recent = (start: number, peak: number) => (d <= start ? peak * (1 - d / (start + 1)) + 0.15 : 0.12);
  switch (kind) {
    case "dengue": // October: background dengue across Rawalpindi, an outbreak growing over the last ~10 days
      if (loc === "Dhok Hassu") return d <= 9 ? 0.4 + (9 - d) * 0.32 : 0.2;
      if (loc === "Pirwadhai") return d <= 8 ? 0.3 + (8 - d) * 0.14 : 0.15;
      return ["Raja Bazaar", "Satellite Town", "Chaklala", "Saddar"].includes(loc) ? 0.18 : 0.06;
    case "ili": // flu-like wave in Islamabad G-sectors, peaking now
      if (["G-9", "G-10"].includes(loc)) return recent(12, 2.2);
      if (["G-11", "I-8", "G-7"].includes(loc)) return recent(10, 0.9);
      return 0.12;
    case "sari": return ["G-9", "G-10"].includes(loc) && d <= 8 ? 0.22 : 0.01;
    case "awd": // cluster 2–3 weeks ago in Tench Bhata, now over
      if (loc === "Tench Bhata") return d >= 14 && d <= 20 ? 1.4 : 0.1;
      return 0.08;
    default: return 0.18; // afi
  }
}

const cases: object[] = [];
let n = 0;
for (let d = 27; d >= 0; d--) {
  for (const loc of ALL) {
    for (const kind of Object.keys(GEN)) {
      for (let i = poisson(rate(kind, loc, d)); i > 0; i--) {
        const g = GEN[kind];
        const symptoms = [...new Set(g.symptoms())];
        const age = g.age();
        const sex = rnd() < 0.5 ? "M" : "F";
        const durationDays = g.duration();
        const e: Extraction = { transcript_ur: "", translation_en: "", chief_complaint: "", symptoms, duration_days: durationDays, red_flags_mentioned: [],
          age_years: age, sex, vitals: {}, locality: loc, suggested_department: "Medicine", missing_info: [], confidence: 0.9 };
        const t = evaluate(e, new Date("2026-10-10T09:00:00+05:00"));
        cases.push({ id: `h${(n++).toString(36)}`, daysAgo: d, hour: 8 + Math.floor(rnd() * 6), locality: loc, age, sex, symptoms, durationDays, level: t.level, ruleIds: t.hits.map((h) => h.id) });
      }
    }
  }
}
writeFileSync("fixtures/surveillance-history.json", JSON.stringify({ _note: "SYNTHETIC surveillance history for the demo (scripts/gen-surveillance.ts, seeded). Not real patients.", cases }) + "\n");
console.log(`${cases.length} synthetic cases written`);
