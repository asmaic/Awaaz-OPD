import type { Extraction } from "@/types/contracts";

// "my name is Sabina", "my daughter's name is Ayesha Bibi", "my son's name is Ali." — from the English translation,
// which spells names in Latin letters. Up to three capitalised words, stopping at punctuation or a lowercase word.
const EN = /\b(?:[Mm]y|(?:[Mm]y\s+)?(?:son|daughter|child|baby|wife|husband|mother|father|brother|sister)'s)\s+name\s+is\s+((?:[A-Z][\p{L}'-]*)(?:\s+[A-Z][\p{L}'-]*){0,2})/u;
// Fallback: Urdu "میرا نام صبینہ ہے" / "میری بیٹی کا نام عائشہ ہے".
const UR = /نام\s+([؀-ۿ]+(?:\s+[؀-ۿ]+)?)\s+ہے/;

/** The patient's name if they said it, to PRE-FILL the intake name box (the nurse checks it; never auto-submitted). */
export function spokenName(e: Pick<Extraction, "translation_en" | "transcript_ur">): string | undefined {
  const en = EN.exec(e.translation_en)?.[1]?.trim();
  if (en) return en;
  const ur = UR.exec(e.transcript_ur)?.[1]?.trim();
  return ur || undefined;
}
