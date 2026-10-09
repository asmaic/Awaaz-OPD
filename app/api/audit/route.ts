import { z } from "zod";
import type { ApiResult, AuditEntry } from "@/types/contracts";
import { audit, readAudit } from "@/lib/audit";

/** GET /api/audit?limit=200 → latest entries, newest first. */
export async function GET(req: Request) {
  const t0 = Date.now();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 200, 1000);
  const data = await readAudit(limit);
  return Response.json({ ok: true, data, meta: { cached: false, ms: Date.now() - t0 } } satisfies ApiResult<AuditEntry[]>);
}

// Human actions from the UI (nurse/doctor confirmations, overrides, ER notifications).
const UiEventZ = z.object({
  actor: z.enum(["nurse", "doctor", "system"]),
  action: z.enum(["confirm", "override", "notify_er"]),
  patientId: z.string().optional(),
  payload: z.unknown(),
  ruleIds: z.array(z.string()).optional(),
  reason: z.string().optional(),
}).refine((e) => e.action !== "override" || !!e.reason?.trim(), "override requires a reason");

/** POST /api/audit { actor, action, patientId?, payload, reason? } → the stored entry. */
export async function POST(req: Request) {
  const t0 = Date.now();
  const parsed = UiEventZ.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false, error: parsed.error.issues[0]?.message ?? "invalid" } satisfies ApiResult<never>, { status: 400 });
  const entry = await audit(parsed.data);
  return Response.json({ ok: true, data: entry, meta: { cached: false, ms: Date.now() - t0 } } satisfies ApiResult<AuditEntry>);
}
