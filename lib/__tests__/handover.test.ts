import { describe, expect, it } from "vitest";
import type { Patient, Prescription } from "@/types/contracts";
import { buildRecord, handoverQrText, templateSbar, unsupportedNumbers } from "@/lib/handover";
import c01 from "@/fixtures/golden/c01-heart-attack.extract.json";
import rx from "@/fixtures/golden/rx-demo.prescription.json";

const patient = { id: "p-x", token: 48, name: "Test Patient", arrivedAt: "2026-10-10T06:00:00Z", status: "waiting", estWaitMin: 0,
  erNotifiedAt: "2026-10-10T06:00:05Z", ...c01 } as Patient;
const prescription = { ...rx.prescription, items: rx.prescription.items.map((i) => ({ ...i, confirmedByDoctor: true })) } as Prescription;
const req = { patient, prescription, referral: { facility: "Rawalpindi Institute of Cardiology", needs: ["cath lab"] } };

describe("buildRecord", () => {
  it("keeps clinical facts, drops identity and timestamps (stable cache key)", () => {
    const r = buildRecord(req);
    const s = JSON.stringify(r);
    expect(s).not.toContain("Test Patient");
    expect(s).not.toContain("2026-10-10");
    expect(s).not.toContain("p-x");
    expect(r.triage).toMatchObject({ level: "RED", er_notified: true });
    expect(r.medicines.map((m) => m.name)).toEqual(["Klaricid", "Lipiget", "Risek"]);
    expect(buildRecord({ ...req, patient: { ...patient, id: "other", token: 99 } })).toEqual(r);
  });
  it("only includes doctor-confirmed medicines", () => {
    const unconfirmed = { ...prescription, items: prescription.items.map((i, n) => ({ ...i, confirmedByDoctor: n === 0 })) };
    expect(buildRecord({ ...req, prescription: unconfirmed }).medicines).toHaveLength(1);
  });
});

describe("templateSbar", () => {
  const sbar = templateSbar(buildRecord(req));
  it("states facts from the record in each section", () => {
    expect(sbar.situation).toMatch(/^55-year-old male, triaged RED/);
    expect(sbar.assessment).toContain("R02 Possible heart attack");
    expect(sbar.assessment).toContain("ER was notified");
    expect(sbar.assessment).toContain("Major interaction alert: clarithromycin + atorvastatin");
    expect(sbar.recommendation).toContain("Referred to Rawalpindi Institute of Cardiology for cath lab");
    expect(sbar.recommendation).toContain("Klaricid 500 mg");
  });
  it("never introduces a number that is not in the record", () => {
    expect(unsupportedNumbers(sbar, buildRecord(req))).toEqual([]);
  });
  it("handles missing age and no prescription", () => {
    const p = { ...patient, extraction: { ...patient.extraction, age_years: undefined, sex: undefined } };
    const s = templateSbar(buildRecord({ patient: p }));
    expect(s.situation).toMatch(/^Patient \(age not recorded\), triaged RED/);
    expect(s.recommendation).toContain("No medicines prescribed yet");
  });
});

describe("unsupportedNumbers", () => {
  it("flags invented numbers", () => {
    const r = buildRecord(req);
    const sbar = { ...templateSbar(r), background: "Troponin 2.4, BP 90/60." };
    expect(unsupportedNumbers(sbar, r)).toEqual(expect.arrayContaining(["2.4", "90", "60"]));
  });
});

describe("handoverQrText", () => {
  it("stays short enough for a scannable QR", () => {
    const t = handoverQrText(patient, templateSbar(buildRecord(req)), "RIC");
    expect(t.startsWith("AWAAZ OPD HANDOVER · Token 48")).toBe(true);
    expect(t.length).toBeLessThanOrEqual(900);
  });
});
