import Fuse from "fuse.js";
import data from "@/fixtures/localities.json";

export type Locality = (typeof data.localities)[number];

// Lowercase, drop spaces/dashes/punctuation so "G-9", "g9", "G 9" and "Bahria Town Phase 7" all compare cleanly.
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
// Longest name first so a longer name wins when one contains another.
const byLength = [...data.localities].sort((a, b) => b.name.length - a.name.length);
// Spelling variants the model produces ("Dhoke Hassu", "Satelite Town").
const fuse = new Fuse(data.localities, { keys: ["name", "ur"], threshold: 0.3 });

/** Twin-cities locality mentioned in free text (English or Urdu), or null. */
export function findLocality(text?: string): Locality | null {
  if (!text) return null;
  const t = norm(text);
  const exact = byLength.find((l) => t.includes(norm(l.name)) || t.includes(norm(l.ur)));
  if (exact) return exact;
  return t.length >= 4 ? (fuse.search(text)[0]?.item ?? null) : null;
}
