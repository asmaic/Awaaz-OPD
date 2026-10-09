import type { ApiResult } from "@/types/contracts";

export async function POST(): Promise<Response> {
  return Response.json({ ok: false, error: "not implemented" } satisfies ApiResult<never>, { status: 501 });
}
