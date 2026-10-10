import { SitrepReqZ, type SitrepReq } from "@/lib/sitrep";
import { handle } from "@/lib/http";
import { runSitrep } from "@/lib/pipeline";

/** POST /api/sitrep { syndromeId, facts } → { sitrep, generatedBy } — AI-drafted outbreak alert, numbers checked against the facts. */
export const POST = (req: Request) => handle(req, SitrepReqZ, (body, demo) => runSitrep(body as SitrepReq, demo));
