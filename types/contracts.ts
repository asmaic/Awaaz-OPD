// FROZEN shared contract. Do not edit without both developers agreeing.
import { z } from "zod";

export type TriageLevel = "RED" | "ORANGE" | "YELLOW" | "GREEN";
export const TRIAGE_LEVELS = ["RED", "ORANGE", "YELLOW", "GREEN"] as const;
export const SYMPTOMS = ["fever","chest_pain","sweating","arm_jaw_pain","shortness_of_breath",
  "cough","abdominal_pain","vomiting","persistent_vomiting","diarrhoea","bleeding_gums",
  "nosebleed","blood_in_vomit_or_stool","rash","body_ache","headache","retro_orbital_pain",
  "lethargy","restlessness","confusion","unconscious","convulsion","one_sided_weakness",
  "slurred_speech","cold_clammy_skin","dizziness","pregnancy","severe_pain","poisoning",
  "sunken_eyes","swelling_feet","burning_urination","blue_lips","other"] as const;
export type Symptom = typeof SYMPTOMS[number];
export interface Vitals { tempC?: number; spo2?: number; hr?: number; sbp?: number; dbp?: number; rr?: number }

export const DEPARTMENTS = ["Emergency","Medicine","Paediatrics","Gynae/Obs","Surgery","Cardiology","Other"] as const;

export interface Extraction {
  transcript_ur: string; translation_en: string; chief_complaint: string; symptoms: Symptom[];
  duration_days?: number; red_flags_mentioned: string[]; age_years?: number; sex?: "M"|"F"|"unknown";
  vitals: Vitals; locality?: string;
  suggested_department: "Emergency"|"Medicine"|"Paediatrics"|"Gynae/Obs"|"Surgery"|"Cardiology"|"Other";
  missing_info: string[]; confidence: number; // 0–1, advisory only
}
export interface RuleHit { id: string; level: TriageLevel; title: string; why: string; source: string }
export interface TriageResult { level: TriageLevel; hits: RuleHit[]; escalatedForUncertainty: boolean; rulesVersion: string }
export interface Patient {
  id: string; token: number; name: string; arrivedAt: string; extraction: Extraction; triage: TriageResult;
  status: "waiting"|"with_doctor"|"done"|"sent_to_er"; estWaitMin: number; erNotifiedAt?: string;
  override?: { level: TriageLevel; by: string; reason: string };
  geo?: { lat: number; lng: number; label: string };
}
export interface RxField<T> { value: T | "[UNCLEAR]"; confidence: number }
export interface RxItem { drug_raw: RxField<string>; generic?: string; brand_match?: string;
  strength: RxField<string>; frequency: RxField<string>; duration: RxField<string>;
  route?: RxField<string>; confirmedByDoctor: boolean }
export interface Interaction { pair: [string, string]; severity: "major"|"moderate"; note: string }
export interface Prescription { id: string; patientId: string; items: RxItem[];
  interactions: Interaction[]; urduInstructions?: string; audioUrl?: string }
export interface AuditEntry { id: string; ts: string; actor: "ai"|"rules"|"nurse"|"doctor"|"system";
  action: "extract"|"triage"|"rx_read"|"confirm"|"override"|"notify_er"|"tts"|"cache_hit"|"fallback";
  patientId?: string; model?: string; promptVersion?: string; inputHash?: string;
  payload: unknown; ruleIds?: string[]; reason?: string }

// Every API route returns ApiResult<T>
export type ApiResult<T> = { ok: true; data: T; meta: { cached: boolean; model?: string; ms: number; fallback?: string } }
                         | { ok: false; error: string };

export type ExtractReq = { audioB64?: string; mime?: string; text?: string; caseId?: string };
export type ExtractRes = { extraction: Extraction; triage: TriageResult };
export type TranscribeRes = { transcript_ur: string; translation_en: string };
export type PrescriptionReq = { imageB64: string; mime: string; patientId: string; caseId?: string };
export type PrescriptionRes = { prescription: Prescription };
export type InstructionsReq = { items: RxItem[]; patientName?: string };
export type InstructionsRes = { urdu: string };
export type TtsReq = { text: string; voice?: string; cacheKey?: string };
export type TtsRes = { audioUrl: string };
// Demo mode: client sends header "x-awaaz-demo: 1"
export const DEMO_HEADER = "x-awaaz-demo";

// ---------- Zod schemas (validate all AI output + request bodies) ----------
export const TriageLevelZ = z.enum(TRIAGE_LEVELS);
export const SymptomZ = z.enum(SYMPTOMS);
export const VitalsZ = z.object({
  tempC: z.number().optional(), spo2: z.number().optional(), hr: z.number().optional(),
  sbp: z.number().optional(), dbp: z.number().optional(), rr: z.number().optional(),
});
export const ExtractionZ = z.object({
  transcript_ur: z.string(),
  translation_en: z.string(),
  chief_complaint: z.string(),
  symptoms: z.array(SymptomZ),
  duration_days: z.number().optional(),
  red_flags_mentioned: z.array(z.string()),
  age_years: z.number().optional(),
  sex: z.enum(["M", "F", "unknown"]).optional(),
  vitals: VitalsZ,
  locality: z.string().optional(),
  suggested_department: z.enum(DEPARTMENTS),
  missing_info: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});
export const RuleHitZ = z.object({ id: z.string(), level: TriageLevelZ, title: z.string(), why: z.string(), source: z.string() });
export const TriageResultZ = z.object({
  level: TriageLevelZ, hits: z.array(RuleHitZ), escalatedForUncertainty: z.boolean(), rulesVersion: z.string(),
});
export const RxFieldZ = z.object({ value: z.string(), confidence: z.number().min(0).max(1) });
export const RxItemZ = z.object({
  drug_raw: RxFieldZ, generic: z.string().optional(), brand_match: z.string().optional(),
  strength: RxFieldZ, frequency: RxFieldZ, duration: RxFieldZ, route: RxFieldZ.optional(),
  confirmedByDoctor: z.boolean(),
});
export const InteractionZ = z.object({
  pair: z.tuple([z.string(), z.string()]), severity: z.enum(["major", "moderate"]), note: z.string(),
});
export const PrescriptionZ = z.object({
  id: z.string(), patientId: z.string(), items: z.array(RxItemZ), interactions: z.array(InteractionZ),
  urduInstructions: z.string().optional(), audioUrl: z.string().optional(),
});
export const PatientZ = z.object({
  id: z.string(), token: z.number().int(), name: z.string(), arrivedAt: z.string(),
  extraction: ExtractionZ, triage: TriageResultZ,
  status: z.enum(["waiting", "with_doctor", "done", "sent_to_er"]), estWaitMin: z.number(),
  erNotifiedAt: z.string().optional(),
  override: z.object({ level: TriageLevelZ, by: z.string(), reason: z.string() }).optional(),
  geo: z.object({ lat: z.number(), lng: z.number(), label: z.string() }).optional(),
});

// What the vision model returns (before brand match / interactions / confirmation are added).
export const RxReadZ = z.object({
  items: z.array(z.object({
    drug_raw: RxFieldZ, strength: RxFieldZ, frequency: RxFieldZ, duration: RxFieldZ, route: RxFieldZ.optional(),
  })),
});
export type RxRead = z.infer<typeof RxReadZ>;

export const ExtractReqZ = z.object({
  audioB64: z.string().optional(), mime: z.string().optional(), text: z.string().optional(), caseId: z.string().optional(),
}).refine((r) => r.audioB64 || r.text || r.caseId, "audioB64, text or caseId required");
export const PrescriptionReqZ = z.object({
  imageB64: z.string(), mime: z.string(), patientId: z.string(), caseId: z.string().optional(),
});
export const InstructionsReqZ = z.object({ items: z.array(RxItemZ), patientName: z.string().optional() });
export const TtsReqZ = z.object({ text: z.string().min(1), voice: z.string().optional(), cacheKey: z.string().optional() });

// JSON Schemas for Gemini structured output (responseJsonSchema).
const toGeminiSchema = (s: z.ZodType) => {
  const { $schema: _drop, ...rest } = z.toJSONSchema(s, { io: "output" }) as Record<string, unknown>;
  return rest;
};
export const extractionJsonSchema = toGeminiSchema(ExtractionZ);
export const prescriptionJsonSchema = toGeminiSchema(RxReadZ);

// Compile-time guard: Zod schemas must stay in sync with the interfaces above.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const _sync: [Same<z.infer<typeof ExtractionZ>, Extraction>, Same<z.infer<typeof TriageResultZ>, TriageResult>,
  Same<z.infer<typeof InteractionZ>, Interaction>] = [true, true, true];
void _sync;
