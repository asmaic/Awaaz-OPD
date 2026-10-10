import { describe, expect, it } from "vitest";
import type { Patient, Symptom } from "@/types/contracts";
import type { FacilityStatus } from "@/types/features";
import { evaluate } from "@/lib/rules/engine";
import { haversineKm, needsFor, planReferral, statusAt, travelMinutes } from "@/lib/referral";

const NOW = new Date("2026-10-10T09:00:00+05:00");
function patient(symptoms: Symptom[], extra: Partial<Patient["extraction"]> = {}): Patient {
  const extraction = {
    transcript_ur: "", translation_en: "", chief_complaint: "", symptoms, red_flags_mentioned: [], vitals: {},
    suggested_department: "Medicine" as const, missing_info: [], confidence: 0.9, age_years: 55, ...extra,
  };
  return { id: "p1", token: 48, name: "Test", arrivedAt: NOW.toISOString(), extraction, triage: evaluate(extraction, NOW), status: "waiting", estWaitMin: 0 };
}

describe("needsFor", () => {
  it("maps rules to capabilities", () => {
    expect(needsFor(patient(["chest_pain", "sweating"])).map((n) => n.capability)).toEqual(["er", "cath_lab"]);
    expect(needsFor(patient(["slurred_speech"])).map((n) => n.capability)).toContain("stroke_unit");
    expect(needsFor(patient(["pregnancy", "abdominal_pain"], { age_years: 26 })).map((n) => n.capability)).toContain("labour_room");
    expect(needsFor(patient(["diarrhoea", "lethargy", "sunken_eyes"], { age_years: 3 })).map((n) => n.capability)).toContain("picu");
    expect(needsFor(patient(["convulsion"], { age_years: 40 })).map((n) => n.capability)).toContain("icu");
  });
});

describe("planReferral", () => {
  it("heart attack from Saddar goes to a free cath lab, not PIMS (cath lab busy, ER full)", () => {
    const plan = planReferral(patient(["chest_pain", "sweating", "arm_jaw_pain"], { locality: "Saddar" }), statusAt(NOW));
    expect(plan.origin).toMatchObject({ label: "Saddar", isPatientLocality: true });
    expect(plan.best?.facility.id).toBe("ric");
    expect(plan.best?.why).toMatch(/^cath lab free · \d+ min from Saddar · ER \d+% full/);
    const pims = plan.options.find((o) => o.facility.id === "pims")!;
    expect(pims.busy).toEqual(["cath_lab"]);
    // Facilities without a cath lab are excluded, not just penalised.
    expect(plan.options.filter((o) => o.missing.length).every((o) => o.score === Infinity)).toBe(true);
  });

  it("unknown locality starts from this OPD (PIMS)", () => {
    const plan = planReferral(patient(["chest_pain", "sweating"]), statusAt(NOW));
    expect(plan.origin).toMatchObject({ label: "PIMS", isPatientLocality: false });
  });

  it("no facility with every capability → best is null", () => {
    const only: FacilityStatus[] = [{ id: "x", name: "X", short: "X", city: "", lat: 33.6, lng: 73.0, capabilities: ["er"], erLoad: 0.1, freeBeds: 5, busy: [] }];
    expect(planReferral(patient(["chest_pain", "sweating"]), only).best).toBeNull();
  });

  it("a full ER with no beds loses to a slightly farther open one", () => {
    const base = { city: "", capabilities: ["er" as const], busy: [] };
    const near: FacilityStatus = { ...base, id: "near", name: "Near", short: "Near", lat: 33.6, lng: 73.05, erLoad: 1, freeBeds: 0 };
    const far: FacilityStatus = { ...base, id: "far", name: "Far", short: "Far", lat: 33.62, lng: 73.07, erLoad: 0.3, freeBeds: 4 };
    expect(planReferral(patient(["poisoning"], { locality: "Saddar" }), [near, far]).best?.facility.id).toBe("far");
  });
});

describe("travel + live status", () => {
  it("travel estimate is monotonic and sane", () => {
    expect(haversineKm({ lat: 33.597, lng: 73.05 }, { lat: 33.597, lng: 73.05 })).toBe(0);
    expect(travelMinutes(0)).toBe(3);
    expect(travelMinutes(5)).toBe(17);
  });
  it("status is deterministic per minute and stays in range", () => {
    expect(statusAt(NOW)).toEqual(statusAt(new Date(NOW.getTime() + 30_000)));
    for (const f of statusAt(NOW)) {
      expect(f.erLoad).toBeGreaterThanOrEqual(0.05);
      expect(f.erLoad).toBeLessThanOrEqual(1);
      expect(f.freeBeds).toBeGreaterThanOrEqual(0);
    }
  });
});
