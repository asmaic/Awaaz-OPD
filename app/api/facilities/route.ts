import { connection } from "next/server";
import type { ApiResult } from "@/types/contracts";
import type { FacilitiesRes } from "@/types/features";
import { statusAt } from "@/lib/referral";

/** GET /api/facilities → simulated live ER load / free beds / busy capabilities (changes every minute). */
export async function GET() {
  await connection(); // per-request, never prerendered
  const now = new Date();
  return Response.json({ ok: true, data: { asOf: now.toISOString(), facilities: statusAt(now) }, meta: { cached: false, ms: 0 } } satisfies ApiResult<FacilitiesRes>);
}
