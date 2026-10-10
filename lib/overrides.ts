// Feature 10 — override transparency and queue-jumping flags. Pure rules over the audit trail; nothing is blocked,
// everything is visible. The flags are prompts for a supervisor, not accusations.
import type { AuditEntry, Patient, TriageLevel } from "@/types/contracts";
import { TRIAGE_LEVELS } from "@/types/contracts";
import { OverridePayloadZ, type OverrideEvent, type OverrideFlag, type ReviewedOverride } from "@/types/features";

const rank = (l: TriageLevel) => TRIAGE_LEVELS.indexOf(l); // 0 = RED

/** Reasons that describe a person, not a clinical finding. */
const NON_CLINICAL = /\b(vip|sifarish|sifaarish|relative|rishtedar|friend|staff|colleague|request|reference|ref|mna|mpa|officer|minister|sahab|boss|important)\b/i;
export const MIN_REASON = 15;
/** Upgrades of GREEN patients by one person in a day before it is flagged as a pattern. */
export const PATTERN_THRESHOLD = 3;

/** Override events from the audit trail (store or server), oldest first. Ignores entries from before this feature. */
export function overrideEvents(audit: AuditEntry[], patients: Patient[] = []): OverrideEvent[] {
  return audit.flatMap((e) => {
    if (e.action !== "override" || !e.patientId) return [];
    const p = OverridePayloadZ.safeParse(e.payload);
    if (!p.success) return [];
    const token = p.data.token ?? patients.find((x) => x.id === e.patientId)?.token;
    return [{ id: e.id, ts: e.ts, patientId: e.patientId, token, by: p.data.by, from: p.data.from, to: p.data.to, rulesLevel: p.data.rulesLevel, reason: e.reason ?? "" }];
  }).sort((a, b) => a.ts.localeCompare(b.ts));
}

export function flagsFor(ev: OverrideEvent): OverrideFlag[] {
  const flags: OverrideFlag[] = [];
  const reason = ev.reason.trim();
  if (reason.length < MIN_REASON || NON_CLINICAL.test(reason)) {
    flags.push({ code: "vague_reason", severity: "medium", message: `Reason "${reason}" doesn't describe a clinical finding` });
  }
  const jump = rank(ev.rulesLevel) - rank(ev.to);
  if (jump >= 2) {
    flags.push({ code: "unsupported_jump", severity: "high", message: `Raised ${jump} levels above what the rules found (${ev.rulesLevel} → ${ev.to})` });
  }
  if (rank(ev.to) > rank(ev.from) && rank(ev.from) <= rank("ORANGE")) {
    flags.push({ code: "urgent_downgrade", severity: "high", message: `Urgent patient lowered ${ev.from} → ${ev.to}` });
  }
  return flags;
}

/** Every override with its flags, plus a per-person pattern flag on each override that reaches the threshold (same calendar day). */
export function reviewOverrides(events: OverrideEvent[]): ReviewedOverride[] {
  const greenUpsByDay = new Map<string, number>();
  return events.map((ev) => {
    const flags = flagsFor(ev);
    if (ev.rulesLevel === "GREEN" && rank(ev.to) < rank("GREEN")) {
      const k = `${ev.by.trim().toLowerCase()}|${ev.ts.slice(0, 10)}`;
      const n = (greenUpsByDay.get(k) ?? 0) + 1;
      greenUpsByDay.set(k, n);
      if (n >= PATTERN_THRESHOLD) {
        flags.push({ code: "staff_pattern", severity: "high", message: `${ev.by} has raised ${n} GREEN patients today` });
      }
    }
    return { ...ev, flags };
  });
}

/**
 * Short check code printed on the token slip and shown when the patient is called, so a slip can't be reused
 * or swapped. FNV-1a over id|token|arrival, Crockford base32 (no I/L/O/U).
 * ponytail: tamper-evident, not cryptographic; use an HMAC with a server secret if slips ever carry value.
 */
export function tokenCode(p: Pick<Patient, "id" | "token" | "arrivedAt">): string {
  let h = 0x811c9dc5;
  for (const c of `${p.id}|${p.token}|${p.arrivedAt}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193) >>> 0;
  const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  return Array.from({ length: 4 }, (_, i) => A[(h >>> (i * 5)) & 31]).join("");
}
