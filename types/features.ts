// Shared types for the add-on features (referral, handover, pharmacy, override transparency).
// types/contracts.ts stays frozen; these build on it. Same rule applies: import, never redefine.
import { z } from "zod";
import { PatientZ, PrescriptionZ, TriageLevelZ, type TriageLevel } from "./contracts";

// ---------- 1. Referral / bed finder ----------
export const CAPABILITIES = ["er", "icu", "cath_lab", "picu", "labour_room", "stroke_unit"] as const;
export type Capability = (typeof CAPABILITIES)[number];
export const CAPABILITY_LABEL: Record<Capability, string> = {
  er: "Emergency room", icu: "ICU bed", cath_lab: "Cath lab", picu: "Paediatric ICU", labour_room: "Labour room", stroke_unit: "Stroke unit / CT",
};

export interface Facility {
  id: string; name: string; short: string; city: string; lat: number; lng: number;
  capabilities: Capability[];
}
/** Simulated live status (GET /api/facilities). */
export interface FacilityStatus extends Facility {
  erLoad: number; // 0–1
  freeBeds: number;
  busy: Capability[]; // has the capability but it is occupied right now
}
export interface Need { capability: Capability; because: string }
export interface ReferralOption {
  facility: FacilityStatus;
  travelMin: number;
  missing: Capability[]; // required but not offered
  busy: Capability[]; // required, offered, occupied now
  score: number; // lower is better; Infinity if a required capability is missing
  why: string;
}
export interface ReferralPlan {
  needs: Need[];
  origin: { label: string; lat: number; lng: number; isPatientLocality: boolean };
  options: ReferralOption[]; // best first
  best: ReferralOption | null;
}
export type FacilitiesRes = { asOf: string; facilities: FacilityStatus[] };

// ---------- 2. Handover / referral letter (SBAR) ----------
export const SbarZ = z.object({
  situation: z.string().min(1), background: z.string().min(1), assessment: z.string().min(1), recommendation: z.string().min(1),
});
export type Sbar = z.infer<typeof SbarZ>;
export const HandoverReqZ = z.object({
  patient: PatientZ,
  prescription: PrescriptionZ.optional(),
  referral: z.object({ facility: z.string(), needs: z.array(z.string()) }).optional(),
});
export type HandoverReq = z.infer<typeof HandoverReqZ>;
export type HandoverRes = { sbar: Sbar; generatedBy: "ai" | "template" };

// ---------- 5. Pharmacy stock + substitutes ----------
export interface StockEntry { brand: string; generic: string; strength: string; unitPrice: number; inStock: boolean }
export interface Substitute extends StockEntry { savesPerCourse?: number }
export interface StockCheck {
  index: number; // item index in the prescription
  status: "in_stock" | "out_of_stock" | "not_stocked" | "unknown";
  entry?: StockEntry;
  substitutes: Substitute[]; // same generic + strength, in stock, cheapest first
  courseUnits?: number; // tablets for the whole course, if frequency and duration are known
}

// ---------- 10. Override transparency ----------
export interface OverrideEvent {
  id: string; ts: string; patientId: string; token?: number;
  by: string; from: TriageLevel; to: TriageLevel; rulesLevel: TriageLevel; reason: string;
}
export type FlagCode = "vague_reason" | "unsupported_jump" | "urgent_downgrade" | "staff_pattern";
export interface OverrideFlag { code: FlagCode; severity: "high" | "medium"; message: string }
export interface ReviewedOverride extends OverrideEvent { flags: OverrideFlag[] }

export const OverridePayloadZ = z.object({ from: TriageLevelZ, to: TriageLevelZ, rulesLevel: TriageLevelZ, by: z.string(), token: z.number().optional() });
