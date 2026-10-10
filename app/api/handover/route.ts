import { HandoverReqZ } from "@/types/features";
import { handle } from "@/lib/http";
import { runHandover } from "@/lib/pipeline";

/** POST /api/handover { patient, prescription?, referral? } → { sbar, generatedBy: "ai" | "template" } */
export const POST = (req: Request) => handle(req, HandoverReqZ, runHandover);
