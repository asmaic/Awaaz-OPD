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
