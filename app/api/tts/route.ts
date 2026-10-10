import { TtsReqZ } from "@/types/contracts";
import { handle } from "@/lib/http";
import { blobGet, runTts } from "@/lib/pipeline";

export const POST = (req: Request) => handle(req, TtsReqZ, runTts);

/** GET /api/tts?id=<cache key> serves the generated WAV. */
export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id") ?? "";
  const wav = /^[0-9a-f]{64}$/.test(id) ? await blobGet(id) : null;
  if (!wav) return new Response("not found", { status: 404 });
  return new Response(new Uint8Array(wav), { headers: { "content-type": "audio/wav", "cache-control": "public, max-age=31536000, immutable" } });
}
