import { PrescriptionReqZ, type PrescriptionRes } from "@/types/contracts";
import { handle } from "@/lib/http";
import { runPrescription } from "@/lib/pipeline";

export const POST = (req: Request) =>
  handle(req, PrescriptionReqZ, async (body, demo) => {
    const { data, meta } = await runPrescription(body, demo);
    return { data: { prescription: data } satisfies PrescriptionRes, meta };
  });
