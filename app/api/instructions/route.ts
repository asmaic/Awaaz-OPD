import { InstructionsReqZ } from "@/types/contracts";
import { handle } from "@/lib/http";
import { runInstructions } from "@/lib/pipeline";

export const POST = (req: Request) => handle(req, InstructionsReqZ, runInstructions);
