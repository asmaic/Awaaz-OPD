import type { Interaction } from "@/types/contracts";

const ACE_INHIBITORS = ["captopril", "enalapril", "lisinopril", "ramipril", "perindopril"];
const BINDERS = ["antacid", "aluminium hydroxide", "magnesium hydroxide", "calcium", "calcium carbonate", "iron", "ferrous sulfate"];

/** [group A, group B, severity, note] — matched on generic names. */
const TABLE: [string[], string[], Interaction["severity"], string][] = [
  [["clarithromycin"], ["atorvastatin", "simvastatin"], "major",
    "Clarithromycin raises statin levels and the risk of muscle damage (rhabdomyolysis). Pause the statin during the course or use azithromycin."],
  [["metronidazole"], ["warfarin"], "major", "Metronidazole strongly increases warfarin's effect and bleeding risk. Check INR or avoid."],
  [["warfarin"], ["ibuprofen", "aspirin", "mefenamic acid"], "major", "NSAIDs/aspirin with warfarin sharply raise bleeding risk. Prefer paracetamol for pain."],
  [["ciprofloxacin"], BINDERS, "moderate", "Antacids, calcium and iron block ciprofloxacin absorption. Take ciprofloxacin 2 h before or 6 h after."],
  [ACE_INHIBITORS, ["ibuprofen"], "moderate", "Ibuprofen reduces the BP-lowering effect of ACE inhibitors and can harm the kidneys."],
];

/** Interactions among the given generics (combination products like "a+b" are split). */
export function checkInteractions(generics: string[]): Interaction[] {
  const present = new Set(generics.flatMap((g) => g.toLowerCase().split("+").map((x) => x.trim())));
  const out: Interaction[] = [];
  for (const [as, bs, severity, note] of TABLE) {
    for (const a of as) for (const b of bs) {
      if (present.has(a) && present.has(b)) out.push({ pair: [a, b], severity, note });
    }
  }
  return out;
}
