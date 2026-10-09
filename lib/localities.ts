import data from "@/fixtures/localities.json";

export type Locality = (typeof data.localities)[number];

// Lowercase, drop spaces/dashes/punctuation so "G-9", "g9", "G 9" and "Bahria Town Phase 7" all compare cleanly.
const norm = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");

/** Twin-cities locality mentioned in free text (English or Urdu), or null. */
export function findLocality(text?: string): Locality | null {
  if (!text) return null;
  const t = norm(text);
  // Longest name first so "G-10" wins over "G-1…" style prefixes.
  const byLength = [...data.localities].sort((a, b) => b.name.length - a.name.length);
  return byLength.find((l) => t.includes(norm(l.name)) || t.includes(norm(l.ur))) ?? null;
}
