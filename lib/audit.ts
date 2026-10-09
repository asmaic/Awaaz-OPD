import type { AuditEntry } from "@/types/contracts";
const TODO = (what: string): never => { throw new Error(`TODO: ${what}`); };

export const audit = async (_e: Omit<AuditEntry, "id" | "ts">): Promise<AuditEntry> => TODO("audit");
export const readAudit = async (_limit = 200): Promise<AuditEntry[]> => TODO("readAudit");
