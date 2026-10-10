import { ExtractReqZ } from "@/types/contracts";
import { handle } from "@/lib/http";
import { runExtractAndTriage } from "@/lib/pipeline";

export const POST = (req: Request) => handle(req, ExtractReqZ, runExtractAndTriage);

// Audio extraction can need a few retries (wrong-script transcripts, model fallback); allow up to 60 s on Vercel.
export const maxDuration = 60;
