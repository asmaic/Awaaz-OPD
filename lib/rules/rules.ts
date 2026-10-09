import type { Extraction, Symptom, TriageLevel } from "@/types/contracts";
import { findLocality } from "@/lib/localities";

export interface Ctx { now: Date }
export interface Rule { id: string; level: TriageLevel; title: string; source: string; test: (e: Extraction, ctx: Ctx) => string | null }
export const RULES_VERSION = "rules-v1";

const label = (s: Symptom) => s.replaceAll("_", " ");
/** Symptoms from `list` that are present. */
const present = (e: Extraction, ...list: Symptom[]) => list.filter((s) => e.symptoms.includes(s));
const has = (e: Extraction, ...list: Symptom[]) => present(e, ...list).length > 0;
const ageTxt = (e: Extraction) => (e.age_years === undefined ? "age unknown" : `age ${e.age_years}`);
const flagMatches = (e: Extraction, re: RegExp) => e.red_flags_mentioned.some((f) => re.test(f));

export const DENGUE_WARNING: Symptom[] = ["abdominal_pain", "persistent_vomiting", "bleeding_gums", "nosebleed", "lethargy", "restlessness"];
const SEVERE_BREATHING = /severe|can'?t breathe|cannot breathe|not breathing|bilkul nahi|saans nahi|بالکل نہیں|سانس نہیں/i;
const BLEEDING = /bleed|blood|khoon|خون/i;

/** Dengue season (Sept–Nov) and patient from the twin cities or locality unknown. */
export const dengueContext = (e: Extraction, now: Date) => {
  const m = now.getMonth(); // 8 = Sept, 10 = Nov
  return m >= 8 && m <= 10 && (!e.locality || findLocality(e.locality) !== null);
};

export const rules: Rule[] = [
  {
    id: "R01", level: "RED", title: "Low oxygen saturation", source: "ESI v4 danger-zone vital signs",
    test: (e) => (e.vitals.spo2 !== undefined && e.vitals.spo2 < 92 ? `SpO2 ${e.vitals.spo2}% (< 92%)` : null),
  },
  {
    id: "R02", level: "RED", title: "Possible heart attack", source: "ESI v4 high-risk chest pain / AHA ACS warning signs",
    test: (e) => {
      const assoc = present(e, "sweating", "arm_jaw_pain", "shortness_of_breath");
      const ageOk = e.age_years === undefined || e.age_years >= 30;
      return has(e, "chest_pain") && assoc.length && ageOk ? `chest pain + ${assoc.map(label).join(" + ")}, ${ageTxt(e)}` : null;
    },
  },
  {
    id: "R03", level: "RED", title: "Convulsion / unconscious", source: "WHO ETAT emergency signs",
    test: (e) => { const p = present(e, "unconscious", "convulsion"); return p.length ? p.map(label).join(" + ") : null; },
  },
  {
    id: "R04", level: "RED", title: "Severe breathing difficulty", source: "WHO ETAT emergency signs",
    test: (e) => {
      if (has(e, "blue_lips")) return "blue lips (central cyanosis)";
      const flag = e.red_flags_mentioned.find((f) => SEVERE_BREATHING.test(f));
      return has(e, "shortness_of_breath") && flag ? `shortness of breath, patient said “${flag}”` : null;
    },
  },
  {
    id: "R05", level: "RED", title: "Possible shock", source: "WHO ETAT / ESI v4",
    test: (e) => {
      if (!has(e, "cold_clammy_skin")) return null;
      if (has(e, "dizziness")) return "cold clammy skin + dizziness";
      return e.vitals.sbp !== undefined && e.vitals.sbp < 90 ? `cold clammy skin + systolic BP ${e.vitals.sbp}` : null;
    },
  },
  {
    id: "R06", level: "RED", title: "Possible stroke", source: "FAST stroke warning signs",
    test: (e) => { const p = present(e, "one_sided_weakness", "slurred_speech"); return p.length ? p.map(label).join(" + ") : null; },
  },
  {
    id: "R07", level: "RED", title: "GI bleeding with dizziness", source: "ESI v4",
    test: (e) => (has(e, "blood_in_vomit_or_stool") && has(e, "dizziness") ? "blood in vomit/stool + dizziness" : null),
  },
  {
    id: "R08", level: "RED", title: "Severe dehydration (child)", source: "WHO ETAT severe dehydration",
    test: (e) => {
      const signs = present(e, "lethargy", "unconscious", "sunken_eyes");
      return e.age_years !== undefined && e.age_years < 12 && has(e, "diarrhoea") && signs.length >= 2
        ? `diarrhoea + ${signs.map(label).join(" + ")}, ${ageTxt(e)}` : null;
    },
  },
  {
    id: "R09", level: "RED", title: "Severe dengue", source: "WHO 2009 dengue guidelines (severe dengue)",
    test: (e, { now }) => {
      const p = present(e, "cold_clammy_skin", "confusion", "unconscious", "blood_in_vomit_or_stool");
      return has(e, "fever") && dengueContext(e, now) && p.length ? `fever in dengue season + ${p.map(label).join(" + ")}` : null;
    },
  },
  {
    id: "R10", level: "ORANGE", title: "Dengue with warning signs", source: "WHO 2009 dengue guidelines (warning signs)",
    test: (e) => {
      const d = e.duration_days;
      const p = present(e, ...DENGUE_WARNING);
      return has(e, "fever") && (d === undefined || (d >= 2 && d <= 7)) && p.length
        ? `fever${d === undefined ? "" : ` for ${d} days`} + ${p.map(label).join(" + ")}` : null;
    },
  },
  {
    id: "R11", level: "ORANGE", title: "Young infant (< 2 months)", source: "WHO IMCI young infant",
    test: (e) => (e.age_years !== undefined && e.age_years < 0.17 ? `${ageTxt(e)} (under 2 months)` : null),
  },
  {
    id: "R12", level: "ORANGE", title: "High fever in a child", source: "ESI v4 paediatric fever",
    test: (e) => (e.age_years !== undefined && e.age_years < 12 && (e.vitals.tempC ?? 0) >= 39.5
      ? `temperature ${e.vitals.tempC}°C, ${ageTxt(e)}` : null),
  },
  { id: "R13", level: "ORANGE", title: "Poisoning", source: "WHO ETAT priority signs", test: (e) => (has(e, "poisoning") ? "poisoning reported" : null) },
  { id: "R14", level: "ORANGE", title: "Severe pain", source: "ESI v4 (pain ≥ 7/10)", test: (e) => (has(e, "severe_pain") ? "severe pain reported" : null) },
  {
    id: "R15", level: "ORANGE", title: "Child priority sign", source: "WHO ETAT priority signs",
    test: (e) => {
      const p = present(e, "restlessness", "swelling_feet");
      return e.age_years !== undefined && e.age_years < 12 && p.length ? `${p.map(label).join(" + ")}, ${ageTxt(e)}` : null;
    },
  },
  {
    id: "R16", level: "ORANGE", title: "Pregnancy danger sign", source: "WHO pregnancy danger signs",
    test: (e) => {
      if (!has(e, "pregnancy")) return null;
      const why = [...present(e, "abdominal_pain", "convulsion", "headache").map(label), ...(flagMatches(e, BLEEDING) ? ["bleeding"] : [])];
      return why.length ? `pregnant + ${why.join(" + ")}` : null;
    },
  },
  {
    id: "R17", level: "YELLOW", title: "Possible dengue (no warning signs)", source: "WHO 2009 dengue guidelines",
    test: (e) => {
      const loc = findLocality(e.locality);
      const p = present(e, "body_ache", "headache", "retro_orbital_pain", "rash");
      return has(e, "fever") && p.length && loc && !has(e, ...DENGUE_WARNING)
        ? `fever + ${p.map(label).join(" + ")}, locality ${loc.name} (twin cities), no warning signs` : null;
    },
  },
  {
    id: "R18", level: "YELLOW", title: "Borderline vital sign", source: "ESI v4 danger-zone vitals",
    test: (e) => {
      const { spo2, rr, tempC } = e.vitals;
      if (spo2 !== undefined && spo2 >= 92 && spo2 <= 94) return `SpO2 ${spo2}% (92–94%)`;
      if (rr !== undefined && rr > 30) return `respiratory rate ${rr}/min (> 30)`;
      // Unknown age counts as adult here: R12 (child, ORANGE) is handled by the uncertainty check.
      if (tempC !== undefined && tempC >= 39 && (e.age_years === undefined || e.age_years >= 12)) return `temperature ${tempC}°C`;
      return null;
    },
  },
];
