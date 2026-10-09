// AI output schemas live in types/contracts.ts; re-exported here for lib/ai/* convenience.
import type { Extraction } from "@/types/contracts";
export { ExtractionZ, RxReadZ, extractionJsonSchema, prescriptionJsonSchema } from "@/types/contracts";

/**
 * Models fill unknown optional fields with 0 / "" (seen live: age_years 0 for an unstated age,
 * which fired the infant rule and blocked the heart-attack rule). Treat those as "not stated".
 */
export function cleanExtraction(e: Extraction): Extraction {
  const pos = (n?: number) => (n !== undefined && n > 0 ? n : undefined);
  const vitals = Object.fromEntries(Object.entries(e.vitals).filter(([, v]) => v !== undefined && v > 0));
  return {
    ...e,
    age_years: pos(e.age_years),
    duration_days: pos(e.duration_days),
    locality: e.locality?.trim() || undefined,
    vitals,
  };
}
