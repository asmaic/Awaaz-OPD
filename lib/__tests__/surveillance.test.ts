import { describe, expect, it } from "vitest";
import type { Symptom } from "@/types/contracts";
import { analyse, fromPatient, historyCases, poissonTail, sitrepFacts, syndromesOf, type CaseRecord } from "@/lib/surveillance";
import c07 from "@/fixtures/golden/c07-dengue-dhok-hassu.extract.json";

const NOW = new Date("2026-10-10T12:00:00+05:00").getTime();
const rec = (symptoms: Symptom[], p: Partial<CaseRecord> = {}): CaseRecord => ({
  id: Math.random().toString(36), ts: new Date(NOW).toISOString(), symptoms, level: "GREEN", ruleIds: [], ...p,
});

describe("case definitions", () => {
  it("dengue: fever + 2 signs, or a dengue rule — never with cough", () => {
    expect(syndromesOf(rec(["fever", "headache", "retro_orbital_pain"]))).toContain("dengue");
    expect(syndromesOf(rec(["fever"], { ruleIds: ["R10"] }))).toContain("dengue");
    expect(syndromesOf(rec(["fever", "headache", "body_ache", "cough"], { ruleIds: ["R17"] }))).not.toContain("dengue");
    expect(syndromesOf(rec(["fever", "headache"]))).not.toContain("dengue");
  });
  it("ILI = fever + cough within 10 days; SARI adds breathlessness or urgency", () => {
    expect(syndromesOf(rec(["fever", "cough"], { durationDays: 3 }))).toEqual(["ili"]);
    expect(syndromesOf(rec(["fever", "cough"], { durationDays: 14 }))).not.toContain("ili");
    expect(syndromesOf(rec(["fever", "cough", "shortness_of_breath"]))).toEqual(expect.arrayContaining(["ili", "sari"]));
    expect(syndromesOf(rec(["fever", "cough"], { level: "ORANGE" }))).toContain("sari");
  });
  it("AWD and undifferentiated fever (where malaria/typhoid sit)", () => {
    expect(syndromesOf(rec(["diarrhoea", "vomiting"]))).toEqual(["awd"]);
    expect(syndromesOf(rec(["fever"]))).toEqual(["afi"]);
    expect(syndromesOf(rec(["fever", "diarrhoea"]))).toEqual(["awd"]);
    expect(syndromesOf(rec(["burning_urination"]))).toEqual([]);
  });
  it("a live queue patient maps through its rules (c07 Dhok Hassu → dengue)", () => {
    const p = { id: "p1", arrivedAt: new Date(NOW).toISOString(), ...c07 } as Parameters<typeof fromPatient>[0];
    const r = fromPatient(p);
    expect(r).toMatchObject({ locality: "Dhok Hassu", live: true, ruleIds: ["R10"] });
    expect(syndromesOf(r)).toEqual(["dengue"]);
  });
});

describe("poissonTail", () => {
  it("matches known values", () => {
    expect(poissonTail(0, 3)).toBe(1);
    expect(poissonTail(1, 1)).toBeCloseTo(1 - Math.exp(-1), 10);
    expect(poissonTail(4, 1.5)).toBeCloseTo(0.0656, 3);
    expect(poissonTail(13, 3.7)).toBeLessThan(0.001);
  });
});

describe("analyse (synthetic 28-day history)", () => {
  const all = historyCases(NOW);
  it("finds the planted dengue outbreak in Dhok Hassu and Pirwadhai only", () => {
    const a = analyse(all, "dengue", NOW);
    expect(a.alerts.map((l) => l.locality).sort()).toEqual(["Dhok Hassu", "Pirwadhai"]);
    expect(a.alerts.every((l) => l.alert === "alert" && l.pValue < 0.005)).toBe(true);
  });
  it("finds the flu-like wave in the G-sectors", () => {
    const alerts = analyse(all, "ili", NOW).alerts.filter((l) => l.alert === "alert").map((l) => l.locality);
    expect(alerts).toEqual(expect.arrayContaining(["G-9", "G-10"]));
    expect(alerts.every((l) => l.startsWith("G-") || l.startsWith("I-"))).toBe(true);
  });
  it("a cluster that has ended (Tench Bhata diarrhoea, 2–3 weeks ago) raises no alert now", () => {
    const a = analyse(all, "awd", NOW);
    expect(a.alerts).toEqual([]);
    const tb = a.cases.filter((c) => c.locality === "Tench Bhata").length;
    expect(tb).toBeGreaterThanOrEqual(6); // it is still visible in the 28-day history
  });
  it("background fever produces no false alarms", () => {
    expect(analyse(all, "afi", NOW).alerts).toEqual([]);
  });
  it("epi curve covers the window and sums to the total", () => {
    const a = analyse(all, "ili", NOW);
    expect(a.daily).toHaveLength(28);
    expect(a.daily.reduce((s, d) => s + d.count, 0)).toBe(a.total);
    expect(a.daily.at(-1)?.date).toBe("2026-10-10");
  });
  it("live patients join the analysis", () => {
    const live = rec(["fever", "headache", "body_ache"], { locality: "Dhok Hassu", live: true });
    expect(analyse([...all, live], "dengue", NOW).total).toBe(analyse(all, "dengue", NOW).total + 1);
  });
  it("sitrep facts carry only computed numbers", () => {
    const f = sitrepFacts(analyse(all, "dengue", NOW));
    expect(f.alerts.map((x) => x.locality)).toContain("Dhok Hassu");
    expect(f.data_note).toMatch(/Synthetic/);
  });
});

describe("live patients join the canonical locality", () => {
  it("maps Urdu and misspelt locality names to the fixture name", () => {
    const base = { id: "x", arrivedAt: "2026-10-10T09:00:00+05:00", triage: { level: "ORANGE" as const, hits: [] } };
    const ex = (locality: string) => ({ transcript_ur: "", translation_en: "", chief_complaint: "", symptoms: [], red_flags_mentioned: [], vitals: {},
      suggested_department: "Medicine" as const, missing_info: [], confidence: 0.9, locality });
    expect(fromPatient({ ...base, extraction: ex("ڈھوک حسو") }).locality).toBe("Dhok Hassu");
    expect(fromPatient({ ...base, extraction: ex("Dhoke Hassu") }).locality).toBe("Dhok Hassu");
  });
});
