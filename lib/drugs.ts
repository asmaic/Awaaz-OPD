import Fuse from "fuse.js";

/** Common Pakistani brands → generic ("+" separates combination products). */
export const BRANDS: Record<string, string> = {
  Risek: "omeprazole", Lipiget: "atorvastatin", Novidat: "ciprofloxacin", Brufen: "ibuprofen",
  Arinac: "ibuprofen+pseudoephedrine", Klaricid: "clarithromycin", Flagyl: "metronidazole",
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
