import type { RxItem } from "@/types/contracts";
import Fuse from "fuse.js";

/** Common Pakistani brands → generic ("+" separates combination products). */
export const BRANDS: Record<string, string> = {
  Risek: "omeprazole", Lipiget: "atorvastatin", Novidat: "ciprofloxacin", Brufen: "ibuprofen",
  Arinac: "ibuprofen+pseudoephedrine", Klaricid: "clarithromycin", Claritek: "clarithromycin", Flagyl: "metronidazole",
  Ponstan: "mefenamic acid", Velosef: "cephradine", Augmentin: "amoxicillin+clavulanate", Amoxil: "amoxicillin",
  Calpol: "paracetamol", Panadol: "paracetamol", Ventolin: "salbutamol", Gravinate: "dimenhydrinate",
  Softin: "loratadine", Motilium: "domperidone", Concor: "bisoprolol", Glucophage: "metformin", Disprin: "aspirin",
};

const entries = [
  ...Object.entries(BRANDS).map(([brand, generic]) => ({ name: brand, brand, generic })),
  // Doctors also write generics directly.
  ...[...new Set(Object.values(BRANDS).flatMap((g) => g.split("+")))].map((g) => ({ name: g, brand: undefined, generic: g })),
];
const fuse = new Fuse(entries, { keys: ["name"], threshold: 0.35 });

// "Tab. Klaricid 500mg" → "Klaricid"
const FORM = /^(tab|tabs|cap|caps|syp|syr|inj|susp|drops?|oint|cr)\.?\s+/i;
const clean = (raw: string) => raw.trim().replace(FORM, "").replace(/\s*\d.*$/, "").trim();

/** Fuzzy-match a drug name as written to a known brand/generic. */
export function matchBrand(raw: string): { brand?: string; generic: string } | null {
  const name = clean(raw);
  if (name.length < 3) return null;
  const hit = fuse.search(name)[0]?.item;
  return hit ? { brand: hit.brand, generic: hit.generic } : null;
}

const FREQ: Record<string, string> = {
  OD: "once daily", QD: "once daily", BD: "twice daily", BID: "twice daily", TDS: "three times daily", TID: "three times daily",
  QID: "four times daily", SOS: "when needed", PRN: "when needed", HS: "at bedtime", STAT: "immediately, once",
};
const PER_DAY = ["", "once daily", "twice daily", "three times daily", "four times daily"];

/**
 * "BD" → "twice daily", "1+0+1 BD" → "twice daily", "1+0+0 OD (before bkfst)" → "once daily (before bkfst)".
 * Anything unrecognised is returned unchanged.
 */
export function normalizeFrequency(v: string): string {
  const t = v.toUpperCase().replace(/\./g, "");
  const abbr = Object.keys(FREQ).find((k) => new RegExp(`\\b${k}\\b`).test(t));
  const doses = /(\d)\s*\+\s*(\d)\s*\+\s*(\d)/.exec(t);
  const base = abbr ? FREQ[abbr] : doses ? PER_DAY[doses.slice(1).filter((d) => d !== "0").length] : "";
  if (!base) return v;
  const note = /\(([^)]*)\)?/.exec(v)?.[1]?.trim();
  return note ? `${base} (${note})` : base;
}

/** "x 5/7" → "5 days", "2/52" → "2 weeks", "1/12" → "1 month". */
export function normalizeDuration(v: string): string {
  const m = /^x?\s*(\d+)\s*\/\s*(7|52|12)$/i.exec(v.trim());
  if (!m) return v;
  const n = Number(m[1]);
  const unit = { "7": "day", "52": "week", "12": "month" }[m[2] as "7" | "52" | "12"];
  return `${n} ${unit}${n === 1 ? "" : "s"}`;
}

const FREQ_UR: Record<string, string> = {
  "once daily": "دن میں ایک دفعہ", "twice daily": "دن میں دو دفعہ", "three times daily": "دن میں تین دفعہ",
  "four times daily": "دن میں چار دفعہ", "when needed": "ضرورت کے وقت", "at bedtime": "سونے سے پہلے", "immediately, once": "ابھی ایک دفعہ",
};
const UNIT_UR: Record<string, string> = { day: "دن", week: "ہفتے", month: "مہینے" };

/**
 * Urdu instructions from fixed phrases — no model, so it can't add or change anything.
 * Used when no AI/cached answer exists (demo mode with an edited field, or every model down).
 * Drug names and strengths stay in Latin letters, as in the prescription.
 */
export function templateInstructions(items: RxItem[]): string {
  return items.filter((i) => i.confirmedByDoctor).map((i) => {
    const freq = i.frequency.value.replace(/^([^(]+?)\s*(\(.*)?$/, (_m, base: string, note = "") =>
      `${FREQ_UR[base.trim()] ?? base.trim()}${note ? ` ${note}` : ""}`);
    const dur = /^(\d+)\s*(day|week|month)s?$/i.exec(i.duration.value.trim());
    const durUr = dur ? `${dur[1]} ${UNIT_UR[dur[2].toLowerCase()]} تک` : i.duration.value;
    return `${i.brand_match ?? i.drug_raw.value} ${i.strength.value}، ${freq}، ${durUr}۔`;
  }).join("\n");
}
