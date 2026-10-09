import type { Extraction, TriageResult } from "@/types/contracts";
const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export const evaluate = (_e: Extraction): TriageResult => TODO("evaluate");
