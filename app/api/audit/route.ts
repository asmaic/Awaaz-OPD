import type { ApiResult, AuditEntry } from "@/types/contracts";

export async function GET(): Promise<Response> {
  return Response.json({ ok: true, data: [], meta: { cached: false, ms: 0 } } satisfies ApiResult<AuditEntry[]>);
}
