import type { ApiResult } from "@/types/contracts";
import { listRemote, type RemoteIntake } from "@/lib/whatsapp";

/** GET /api/remote-intake?after=<iso> → WhatsApp intakes waiting to be added to the queue (polled by the dashboard). */
export async function GET(req: Request) {
  const t0 = Date.now();
  const data = await listRemote(new URL(req.url).searchParams.get("after") ?? undefined);
  return Response.json({ ok: true, data, meta: { cached: false, ms: Date.now() - t0 } } satisfies ApiResult<RemoteIntake[]>);
}
