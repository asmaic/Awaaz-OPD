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
  const board = () => statusAt(NOW);
  const withHome = (patch: Partial<FacilityStatus>) => board().map((f) => (f.id === "pims" ? { ...f, ...patch } : f));

  it("heart attack: PIMS cath lab busy → stabilise here, transfer to a free cath lab (RIC)", () => {
    const plan = planReferral(patient(["chest_pain", "sweating", "arm_jaw_pain"]), board());
    expect(plan.decision).toBe("transfer");
    expect(plan.homeGaps).toEqual(["cath lab busy at PIMS"]);
    expect(plan.best?.facility.id).toBe("ric");
    expect(plan.best?.why).toMatch(/^cath lab free · \d+ min from PIMS · ER \d+% full/);
    // Facilities without a cath lab are excluded, not just penalised.
    expect(plan.options.filter((o) => o.missing.length).every((o) => o.score === Infinity)).toBe(true);
  });

  it("heart attack with PIMS cath lab free → treat here", () => {
    const plan = planReferral(patient(["chest_pain", "sweating"]), withHome({ busy: [] }));
    expect(plan.decision).toBe("treat_here");
    expect(plan.best).toBeNull();
    expect(plan.home?.why).toMatch(/you are here/);
  });

  it("origin is always PIMS (the patient is in our OPD), even when they name their neighbourhood", () => {
    const plan = planReferral(patient(["chest_pain", "sweating"], { locality: "Saddar" }), board());
    expect(plan.origin).toMatchObject({ label: "PIMS", isPatientLocality: false });
    expect(plan.options[0].facility.id).toBe("pims");
    expect(plan.options[0].travelMin).toBe(0);
  });

  it("a crowded ER alone never sends an urgent patient away (dengue ORANGE, PIMS ER 100% full)", () => {
    const p = patient(["fever", "abdominal_pain", "bleeding_gums"], { age_years: 28, duration_days: 4, locality: "Dhok Hassu" });
    expect(p.triage.level).toBe("ORANGE");
    const plan = planReferral(p, withHome({ erLoad: 1, freeBeds: 0 }));
    expect(plan.decision).toBe("treat_here");
    expect(plan.homeGaps).toEqual([]);
  });

  it("no free bed matters only when the patient needs admitting (ICU)", () => {
    const fits = planReferral(patient(["poisoning"], { age_years: 24 }), withHome({ freeBeds: 0 }));
    expect(fits.decision).toBe("treat_here"); // ER-only need
    const icu = planReferral(patient(["convulsion"], { age_years: 40 }), withHome({ freeBeds: 0 }));
    expect(icu.decision).toBe("transfer");
    expect(icu.homeGaps).toContain("no free bed at PIMS");
  });

  it("nobody else covers the gap → no_option (stabilise and escalate)", () => {
    const only = board().filter((f) => f.id === "pims");
    const plan = planReferral(patient(["chest_pain", "sweating"]), only);
    expect(plan.decision).toBe("no_option");
    expect(plan.best).toBeNull();
  });

  it("among transfer targets, a full ER with no beds loses to a slightly farther open one", () => {
    const base = { city: "", capabilities: ["er" as const, "icu" as const], busy: [] };
    const near: FacilityStatus = { ...base, id: "near", name: "Near", short: "Near", lat: 33.7, lng: 73.06, erLoad: 1, freeBeds: 0 };
    const far: FacilityStatus = { ...base, id: "far", name: "Far", short: "Far", lat: 33.72, lng: 73.08, erLoad: 0.3, freeBeds: 4 };
    const pimsFull = board().filter((f) => f.id === "pims").map((f) => ({ ...f, freeBeds: 0 }));
    expect(planReferral(patient(["convulsion"], { age_years: 40 }), [...pimsFull, near, far]).best?.facility.id).toBe("far");
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
