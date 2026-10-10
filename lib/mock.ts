// Shared API client. UI imports `api` from here; NEXT_PUBLIC_USE_MOCK=true serves fixtures, otherwise hits /api/*.
import type {
  ApiResult, ExtractReq, ExtractRes, Extraction, InstructionsReq, InstructionsRes,
  PrescriptionReq, PrescriptionRes, TriageLevel, TtsReq, TtsRes,
} from "@/types/contracts";
import { DEMO_HEADER } from "@/types/contracts";
import type { FacilitiesRes, HandoverReq, HandoverRes } from "@/types/features";
import { buildRecord, templateSbar } from "@/lib/handover";
import { statusAt } from "@/lib/referral";
import cases from "@/fixtures/cases.json";
import goldenC01 from "@/fixtures/golden/c01-heart-attack.extract.json";
import goldenC07 from "@/fixtures/golden/c07-dengue-dhok-hassu.extract.json";
import goldenRx from "@/fixtures/golden/rx-demo.prescription.json";
import goldenIns from "@/fixtures/golden/rx-demo.instructions.json";

export interface AwaazApi {
  extract(req: ExtractReq): Promise<ApiResult<ExtractRes>>;
  prescription(req: PrescriptionReq): Promise<ApiResult<PrescriptionRes>>;
  instructions(req: InstructionsReq): Promise<ApiResult<InstructionsRes>>;
  tts(req: TtsReq): Promise<ApiResult<TtsRes>>;
  handover(req: HandoverReq): Promise<ApiResult<HandoverRes>>;
  facilities(): Promise<ApiResult<FacilitiesRes>>;
}

let demoMode = false;
/** Called by the UI when Ctrl+Shift+D toggles demo mode; adds the x-awaaz-demo header to real calls. */
export const setDemoMode = (on: boolean) => { demoMode = on; };

// ---------- mock ----------
const goldenExtract: Record<string, ExtractRes> = {
  "c01-heart-attack": goldenC01 as ExtractRes,
  "c07-dengue-dhok-hassu": goldenC07 as ExtractRes,
};

const RULE_TITLES: Record<string, string> = {
  R01: "Low oxygen saturation", R02: "Possible heart attack", R03: "Convulsion / unconscious",
  R04: "Severe breathing difficulty", R05: "Possible shock", R08: "Severe dehydration (child)",
  R10: "Dengue with warning signs", R11: "Young infant (< 2 months)", R13: "Poisoning",
  R16: "Pregnancy danger sign", R17: "Possible dengue (no warning signs)", R18: "Borderline vital sign",
  R19: "No urgent criteria",
};

type Case = (typeof cases)[number] & { vitals?: Extraction["vitals"]; duration_days?: number; redFlags?: string[] };

function fromCase(c: Case): ExtractRes {
  const level = c.expectedLevel as TriageLevel;
  return {
    extraction: {
      transcript_ur: c.script_ur,
      translation_en: c.script_roman,
      chief_complaint: c.expectedSymptoms.join(", ").replaceAll("_", " "),
      symptoms: c.expectedSymptoms as Extraction["symptoms"],
      duration_days: c.duration_days,
      red_flags_mentioned: c.redFlags ?? [],
      age_years: c.age,
      sex: c.sex as Extraction["sex"],
      vitals: c.vitals ?? {},
      locality: c.locality,
      suggested_department: level === "RED" ? "Emergency" : c.age < 12 ? "Paediatrics" : "Medicine",
      missing_info: ["How long has this been going on?"],
      confidence: 0.9,
    },
    triage: {
      level,
      escalatedForUncertainty: false,
      rulesVersion: "rules-v1",
      hits: c.expectedRuleIds.map((id) => ({
        id, level, title: RULE_TITLES[id] ?? id, why: c.expectedSymptoms.join(" + ").replaceAll("_", " "), source: "mock",
      })),
    },
  };
}

const delay = () => new Promise((r) => setTimeout(r, 900 + Math.random() * 500));
const ok = <T>(data: T, t0: number): ApiResult<T> => ({ ok: true, data, meta: { cached: true, model: "mock", ms: Date.now() - t0 } });

const mockApi: AwaazApi = {
  async extract(req) {
    const t0 = Date.now();
    await delay();
    const c = (cases as Case[]).find((x) => x.caseId === req.caseId) ?? (cases as Case[])[6];
    return ok(goldenExtract[c.caseId] ?? fromCase(c), t0);
  },
  async prescription(req) {
    const t0 = Date.now();
    await delay();
    const rx = structuredClone(goldenRx.prescription) as PrescriptionRes["prescription"];
    return ok({ prescription: { ...rx, id: `rx-${Date.now()}`, patientId: req.patientId } }, t0);
  },
  async instructions() {
    const t0 = Date.now();
    await delay();
    return ok({ urdu: goldenIns.urdu }, t0);
  },
  async tts() {
    const t0 = Date.now();
    await delay();
    return ok({ audioUrl: "/fallback/rx-demo.wav" }, t0);
  },
  async handover(req) {
    const t0 = Date.now();
    await delay();
    return ok({ sbar: templateSbar(buildRecord(req)), generatedBy: "template" }, t0);
  },
  async facilities() {
    const now = new Date();
    return ok({ asOf: now.toISOString(), facilities: statusAt(now) }, now.getTime());
  },
};

// ---------- real ----------
async function post<T>(path: string, body: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(`/api/${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(demoMode ? { [DEMO_HEADER]: "1" } : {}) },
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResult<T>;
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "network error" };
  }
}

const realApi: AwaazApi = {
  extract: (req) => post("extract", req),
  prescription: (req) => post("prescription", req),
  instructions: (req) => post("instructions", req),
  tts: (req) => post("tts", req),
  handover: (req) => post("handover", req),
  facilities: async () => {
    try {
      return (await (await fetch("/api/facilities")).json()) as ApiResult<FacilitiesRes>;
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "network error" };
    }
  },
};

export const api: AwaazApi = process.env.NEXT_PUBLIC_USE_MOCK === "true" ? mockApi : realApi;
