import { ExtractReqZ } from "@/types/contracts";
import { handle } from "@/lib/http";
import { runExtractAndTriage } from "@/lib/pipeline";

export const POST = (req: Request) => handle(req, ExtractReqZ, runExtractAndTriage);
