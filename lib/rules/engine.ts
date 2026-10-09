import type { Extraction, RuleHit, TriageLevel, TriageResult } from "@/types/contracts";
import { TRIAGE_LEVELS } from "@/types/contracts";
import { RULES_VERSION, rules, type Ctx } from "./rules";

const rank = (l: TriageLevel) => TRIAGE_LEVELS.indexOf(l); // 0 = RED (most urgent)

function fire(e: Extraction, ctx: Ctx): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const r of rules) {
    const why = r.test(e, ctx);
    if (why) hits.push({ id: r.id, level: r.level, title: r.title, why, source: r.source });
  }
  return hits;
}

/** Reasons the data is too uncertain to trust a low level (R20). Missing data must never lower a level. */
function uncertainty(e: Extraction, hits: RuleHit[], ctx: Ctx): string[] {
  const reasons: string[] = [];
  if (e.confidence < 0.5) reasons.push(`extraction confidence ${e.confidence.toFixed(2)} (< 0.5)`);
  const urgent = hits.some((h) => rank(h.level) <= rank("ORANGE"));
  if (e.red_flags_mentioned.length && !urgent) {
    reasons.push(`red flag not explained by any rule: “${e.red_flags_mentioned.join("”, “")}”`);
  }
  if (e.age_years === undefined && !urgent) {
    // Would a child-only RED/ORANGE rule fire if the patient turned out to be a child?
    const asChild = fire({ ...e, age_years: 5 }, ctx).filter((h) => ["R08", "R12", "R15"].includes(h.id));
    if (asChild.length) reasons.push(`age unknown; ${asChild.map((h) => h.id).join(", ")} would fire for a child`);
  }
  return reasons;
}

/** Pure, deterministic triage. The LLM only extracts; this decides. */
export function evaluate(e: Extraction, now: Date = new Date()): TriageResult {
  const ctx = { now };
  const hits = fire(e, ctx);
  let level: TriageLevel = hits.reduce<TriageLevel>((best, h) => (rank(h.level) < rank(best) ? h.level : best), "GREEN");

  if (!hits.length && e.confidence >= 0.5) {
    hits.push({ id: "R19", level: "GREEN", title: "No urgent criteria",
      why: `No danger signs or warning rules fired; confidence ${e.confidence.toFixed(2)}`, source: "Default (ESI level 4–5 equivalent)" });
  }

  const reasons = uncertainty(e, hits, ctx);
  const escalated = reasons.length > 0 && level !== "RED";
  if (escalated) {
    level = TRIAGE_LEVELS[rank(level) - 1];
    hits.push({ id: "R20", level, title: "Escalated for uncertainty", why: reasons.join("; "), source: "Safety rule: uncertainty never lowers priority" });
  }
  return { level, hits, escalatedForUncertainty: escalated, rulesVersion: RULES_VERSION };
}
