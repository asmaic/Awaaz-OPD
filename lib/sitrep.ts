// Outbreak alert ("sitrep") for the District Health Officer. The numbers come from lib/surveillance.ts;
// Gemini only writes the prose, and any number it adds that isn't in the facts rejects the draft.
// Client-safe: the template is also used by the mock API.
import { z } from "zod";
import type { SitrepFacts, SyndromeId } from "@/lib/surveillance";

export const SitrepZ = z.object({
  headline: z.string().min(1),
  situation: z.string().min(1),
  recommended_actions: z.array(z.string().min(1)).min(1).max(6),
  urdu_summary: z.string().min(1),
});
export type Sitrep = z.infer<typeof SitrepZ>;
export const SitrepReqZ = z.object({ syndromeId: z.enum(["dengue", "ili", "sari", "awd", "afi"]), facts: z.record(z.string(), z.unknown()) });
export type SitrepReq = { syndromeId: SyndromeId; facts: SitrepFacts };
export type SitrepRes = { sitrep: Sitrep; generatedBy: "ai" | "template" };

export const SITREP_PROMPT_VERSION = "sitrep-v2";
export const SITREP_PROMPT = `You draft a short outbreak alert (situation report) from a Pakistani government hospital OPD to the District Health Officer, Islamabad/Rawalpindi. Input is a JSON of surveillance facts already computed by the hospital's software.
Rules:
- Use ONLY the numbers and place names in the facts. Never invent a number, date, rate, death or lab result. Do not write any number that is not in the facts.
- This is syndromic surveillance: say "suspected" / "cases meeting the case definition", never "confirmed".
- "alerts" are localities where this week's count is statistically above their usual level; name them.
- recommended_actions: 3–5 standard public-health actions for this syndrome (e.g. dengue: larval source reduction and fogging in the named localities, community awareness, platelet-monitoring capacity; flu-like/SARI: testing, masks and isolation for SARI, protect the elderly; diarrhoea: water testing and chlorination, ORS stocks). No numbers in actions.
- urdu_summary: 1–2 simple sentences in Urdu for community health workers, every word in Perso-Arabic (Nastaliq) script only — never Devanagari, Bengali, Malayalam or any other script; write ڈینگی for dengue.
- Mention that the data is a demo dataset if facts.data_note says so.
Return JSON {"headline","situation","recommended_actions","urdu_summary"}.`;

/** Numbers in the text that are not in the source facts (same guard as the handover letter). */
export function numbersNotIn(text: string, facts: unknown): string[] {
  const source = JSON.stringify(facts);
  return [...new Set(text.match(/\d+(?:\.\d+)?/g) ?? [])].filter((n) => !source.includes(n));
}

const ACTIONS: Record<SyndromeId, string[]> = {
  dengue: ["Larval source reduction and fogging in the alerted localities", "Community awareness on removing standing water", "Prepare platelet monitoring and fluid management in the OPD and ER", "Report suspected cases to the district dengue cell"],
  ili: ["Test a sample of patients for influenza and COVID-19", "Advise masks and home rest for mild cases", "Prioritise the elderly and people with chronic illness", "Watch for severe (SARI) cases"],
  sari: ["Isolate SARI patients and test for influenza and COVID-19", "Check oxygen and ICU bed availability", "Masks for staff and patients in respiratory areas", "Notify the district surveillance officer"],
  awd: ["Test and chlorinate water supplies in the affected localities", "Check ORS and IV fluid stocks", "Hand-washing and safe-water messages", "Send stool samples for cholera testing"],
  afi: ["Run malaria rapid tests and typhoid testing on fever cases", "Map where positive tests come from", "Check antimalarial and antibiotic stocks"],
};

const UR: Record<SyndromeId, string> = {
  dengue: "ڈینگی کے مشتبہ مریض بڑھ رہے ہیں۔ گھروں میں کھڑا پانی ختم کریں اور بخار ہو تو فوراً ہسپتال آئیں۔",
  ili: "فلو جیسی بیماری کے مریض بڑھ رہے ہیں۔ کھانسی ہو تو ماسک پہنیں اور بزرگوں کا خاص خیال رکھیں۔",
  sari: "سانس کی شدید بیماری کے مریض آ رہے ہیں۔ سانس پھولے تو فوراً ہسپتال آئیں۔",
  awd: "دست کے مریض بڑھ رہے ہیں۔ پانی ابال کر پئیں اور او آر ایس استعمال کریں۔",
  afi: "بخار کے مریضوں کا ملیریا اور ٹائیفائیڈ کا ٹیسٹ کروائیں۔",
};

/** Deterministic alert from the facts — used when no AI answer is available, and in mock mode. */
export function templateSitrep(id: SyndromeId, f: SitrepFacts): Sitrep {
  const places = f.alerts.map((a) => `${a.locality} (${a.this_week} this week vs ${a.usual_per_week}/week usual)`);
  return {
    headline: places.length ? `${f.syndrome}: unusual rise in ${f.alerts.map((a) => a.locality).join(", ")}` : `${f.syndrome}: no locality above its usual level`,
    situation: [
      `${f.total_cases} suspected cases met the case definition in the last ${f.window_days} days; ${f.cases_this_week} this week vs ${f.cases_previous_week} the week before.`,
      places.length ? `Statistically above usual levels: ${places.join("; ")}.` : "No locality is above its usual level.",
      f.data_note,
    ].join(" "),
    recommended_actions: ACTIONS[id],
    urdu_summary: UR[id],
  };
}
