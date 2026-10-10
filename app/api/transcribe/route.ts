import { ExtractReqZ, type TranscribeRes } from "@/types/contracts";
import { handle } from "@/lib/http";
import { runExtraction } from "@/lib/pipeline";

// Same single Gemini call (and cache entry) as /api/extract; returns only the transcript.
export const POST = (req: Request) =>
  handle(req, ExtractReqZ, async (body, demo) => {
    const { data, meta } = await runExtraction(body, demo);
    return { data: { transcript_ur: data.transcript_ur, translation_en: data.translation_en } satisfies TranscribeRes, meta };
  });

// Audio extraction can need a few retries (wrong-script transcripts, model fallback); allow up to 60 s on Vercel.
export const maxDuration = 60;
