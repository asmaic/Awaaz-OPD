import type { Extraction, TriageLevel } from "@/types/contracts";

export interface Rule { id: string; level: TriageLevel; title: string; source: string; test: (e: Extraction) => string | null }
export const RULES_VERSION = "rules-v1";
export const rules: Rule[] = [];
