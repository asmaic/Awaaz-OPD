// Feature 1 — "Where should this patient go?" Pure and deterministic: rules pick the facility, never the LLM.
import data from "@/fixtures/facilities.json";
import type { Patient, TriageLevel } from "@/types/contracts";
import { TRIAGE_LEVELS } from "@/types/contracts";
import { CAPABILITY_LABEL, type Capability, type Facility, type FacilityStatus, type Need, type ReferralOption, type ReferralPlan } from "@/types/features";
import { findLocality } from "@/lib/localities";

type Raw = Facility & { baseLoad: number; baseBeds: number; busy: Capability[] };
export const FACILITIES = data.facilities as Raw[];
export const HOME = FACILITIES.find((f) => f.id === "pims")!; // this OPD

const rank = (l: TriageLevel) => TRIAGE_LEVELS.indexOf(l);
const has = (p: Patient, ...ids: string[]) => p.triage.hits.some((h) => ids.includes(h.id));

/**
 * Simulated live status, deterministic per minute so every window shows the same board.
 * ponytail: mock feed; replace with the hospitals' real bed/ER API when one exists.
 */
export function statusAt(now: Date): FacilityStatus[] {
  const m = Math.floor(now.getTime() / 60000);
  return FACILITIES.map((f, i) => {
    const wave = Math.sin(m / 7 + i * 1.7);
    return {
      id: f.id, name: f.name, short: f.short, city: f.city, lat: f.lat, lng: f.lng, capabilities: f.capabilities,
      erLoad: Math.min(1, Math.max(0.05, Math.round((f.baseLoad + 0.08 * wave) * 100) / 100)),
      freeBeds: Math.max(0, Math.round(f.baseBeds + 1.5 * wave)),
      busy: f.busy,
    };
  });
}

/** What the patient needs, from the rules that fired (+ age/pregnancy). Always includes an ER. */
export function needsFor(p: Patient): Need[] {
  const level = p.override?.level ?? p.triage.level;
  const e = p.extraction;
  const needs: Need[] = [{ capability: "er", because: `${level} triage` }];
  if (has(p, "R02")) needs.push({ capability: "cath_lab", because: "possible heart attack (R02)" });
  if (has(p, "R06")) needs.push({ capability: "stroke_unit", because: "possible stroke (R06)" });
  if (has(p, "R16") || e.symptoms.includes("pregnancy")) needs.push({ capability: "labour_room", because: "pregnancy" });
  const child = e.age_years !== undefined && e.age_years < 12;
  if (child && rank(level) <= rank("ORANGE")) needs.push({ capability: "picu", because: `child, age ${e.age_years}` });
  else if (has(p, "R01", "R03", "R04", "R05", "R07", "R09")) needs.push({ capability: "icu", because: "danger sign needing monitoring" });
  return needs;
}

const R_KM = 6371;
export function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.sqrt(h));
}

/** Ambulance estimate: straight-line km × 1.4 road factor at 30 km/h, plus 3 min to load. ponytail: no live traffic. */
export const travelMinutes = (km: number) => Math.round(3 + (km * 1.4 * 60) / 30);

/** Rank facilities. Lower score is better: minutes + ER crowding + no-bed and busy-capability penalties. */
export function planReferral(p: Patient, statuses: FacilityStatus[]): ReferralPlan {
  const needs = needsFor(p);
  const loc = findLocality(p.extraction.locality);
  const origin = loc
    ? { label: loc.name, lat: loc.lat, lng: loc.lng, isPatientLocality: true }
    : { label: HOME.short, lat: HOME.lat, lng: HOME.lng, isPatientLocality: false };

  const options: ReferralOption[] = statuses.map((f) => {
    const required = needs.map((n) => n.capability);
    const missing = required.filter((c) => !f.capabilities.includes(c));
    const busy = required.filter((c) => f.capabilities.includes(c) && f.busy.includes(c));
    const travelMin = travelMinutes(haversineKm(origin, f));
    const score = missing.length ? Infinity : travelMin + Math.round(f.erLoad * 40) + (f.freeBeds === 0 ? 45 : 0) + busy.length * 30;
    const special = needs.find((n) => n.capability !== "er");
    const parts = [
      missing.length ? `no ${missing.map((c) => CAPABILITY_LABEL[c].toLowerCase()).join(", ")}`
        : busy.length ? `${busy.map((c) => CAPABILITY_LABEL[c].toLowerCase()).join(", ")} busy`
        : special ? `${CAPABILITY_LABEL[special.capability].toLowerCase()} free` : "ER open",
      `${travelMin} min from ${origin.label}`,
      `ER ${Math.round(f.erLoad * 100)}% full`,
      f.freeBeds ? `${f.freeBeds} bed${f.freeBeds > 1 ? "s" : ""} free` : "no free beds",
    ];
    return { facility: f, travelMin, missing, busy, score, why: parts.join(" · ") };
  }).sort((a, b) => a.score - b.score || a.travelMin - b.travelMin);

  const best = options[0] && Number.isFinite(options[0].score) ? options[0] : null;
  return { needs, origin, options, best };
}
