import { describe, expect, it } from "vitest";
import type { Extraction, Symptom, TriageLevel } from "@/types/contracts";
import { evaluate } from "@/lib/rules/engine";
import cases from "@/fixtures/cases.json";

const OCT = new Date("2026-10-09T09:00:00+05:00"); // dengue season
const MAR = new Date("2026-03-09T09:00:00+05:00"); // off season

const ex = (p: Partial<Extraction> = {}): Extraction => ({
  transcript_ur: "", translation_en: "", chief_complaint: "", symptoms: [], red_flags_mentioned: [],
  vitals: {}, suggested_department: "Medicine", missing_info: [], confidence: 0.9, age_years: 35, ...p,
});
const sx = (...symptoms: Symptom[]) => ({ symptoms });
const run = (p: Partial<Extraction>, now = OCT) => evaluate(ex(p), now);
const ids = (p: Partial<Extraction>, now = OCT) => run(p, now).hits.map((h) => h.id);
const level = (p: Partial<Extraction>, now = OCT): TriageLevel => run(p, now).level;

describe("RED rules", () => {
  it("R01 SpO2 < 92 (boundary 91 vs 92)", () => {
    expect(ids({ vitals: { spo2: 91 } })).toContain("R01");
    expect(ids({ vitals: { spo2: 92 } })).not.toContain("R01");
    expect(level({ vitals: { spo2: 91 } })).toBe("RED");
  });
  it("R02 chest pain + associated symptom, age ≥ 30 or unknown", () => {
    expect(ids({ ...sx("chest_pain", "sweating"), age_years: 55 })).toContain("R02");
    expect(ids({ ...sx("chest_pain", "arm_jaw_pain"), age_years: 30 })).toContain("R02");
    expect(ids({ ...sx("chest_pain", "shortness_of_breath"), age_years: undefined })).toContain("R02");
    expect(ids({ ...sx("chest_pain", "sweating"), age_years: 29 })).not.toContain("R02");
    expect(ids({ ...sx("chest_pain"), age_years: 55 })).not.toContain("R02");
  });
  it("R02 why text names the evidence", () => {
    const hit = run({ ...sx("chest_pain", "sweating", "arm_jaw_pain"), age_years: 55 }).hits.find((h) => h.id === "R02");
    expect(hit?.why).toBe("chest pain + sweating + arm jaw pain, age 55");
  });
  it("R03 unconscious or convulsion", () => {
    expect(ids(sx("convulsion"))).toContain("R03");
    expect(ids(sx("unconscious"))).toContain("R03");
    expect(ids(sx("headache"))).not.toContain("R03");
  });
  it("R04 blue lips, or breathlessness with a severe red flag", () => {
    expect(ids(sx("blue_lips"))).toContain("R04");
    expect(ids({ ...sx("shortness_of_breath"), red_flags_mentioned: ["سانس بالکل نہیں آ رہی"] })).toContain("R04");
    expect(ids({ ...sx("shortness_of_breath"), red_flags_mentioned: ["I can't breathe"] })).toContain("R04");
    expect(ids(sx("shortness_of_breath"))).not.toContain("R04");
  });
  it("R05 cold clammy skin + dizziness or SBP < 90", () => {
    expect(ids(sx("cold_clammy_skin", "dizziness"))).toContain("R05");
    expect(ids({ ...sx("cold_clammy_skin"), vitals: { sbp: 89 } })).toContain("R05");
    expect(ids({ ...sx("cold_clammy_skin"), vitals: { sbp: 90 } })).not.toContain("R05");
    expect(ids(sx("dizziness"))).not.toContain("R05");
  });
  it("R06 stroke signs", () => {
    expect(ids(sx("one_sided_weakness"))).toContain("R06");
    expect(ids(sx("slurred_speech"))).toContain("R06");
    expect(ids(sx("dizziness"))).not.toContain("R06");
  });
  it("R07 GI bleed + dizziness", () => {
    expect(ids(sx("blood_in_vomit_or_stool", "dizziness"))).toContain("R07");
    expect(ids(sx("blood_in_vomit_or_stool"))).not.toContain("R07");
  });
  it("R08 child diarrhoea with ≥ 2 dehydration signs", () => {
    expect(ids({ ...sx("diarrhoea", "lethargy", "sunken_eyes"), age_years: 3 })).toContain("R08");
    expect(ids({ ...sx("diarrhoea", "lethargy"), age_years: 3 })).not.toContain("R08");
    expect(ids({ ...sx("diarrhoea", "lethargy", "sunken_eyes"), age_years: 12 })).not.toContain("R08");
  });
  it("R09 severe dengue only in season", () => {
    const p = { ...sx("fever", "confusion"), locality: "Chaklala" };
    expect(ids(p, OCT)).toContain("R09");
    expect(ids(p, MAR)).not.toContain("R09");
    expect(ids({ ...sx("fever", "confusion"), locality: "Lahore" }, OCT)).not.toContain("R09");
    expect(ids({ ...sx("fever", "confusion") }, OCT)).toContain("R09"); // locality missing counts
  });
});

describe("ORANGE rules", () => {
  it("R10 fever 2–7 days (or unknown) + warning sign", () => {
    expect(ids({ ...sx("fever", "bleeding_gums"), duration_days: 2 })).toContain("R10");
    expect(ids({ ...sx("fever", "bleeding_gums"), duration_days: 7 })).toContain("R10");
    expect(ids({ ...sx("fever", "bleeding_gums") })).toContain("R10");
    expect(ids({ ...sx("fever", "bleeding_gums"), duration_days: 1 })).not.toContain("R10");
    expect(ids({ ...sx("fever", "bleeding_gums"), duration_days: 8 })).not.toContain("R10");
    expect(ids({ ...sx("fever", "body_ache"), duration_days: 3 })).not.toContain("R10");
    expect(level({ ...sx("fever", "abdominal_pain"), duration_days: 4 })).toBe("ORANGE");
  });
  it("R11 infant under 2 months (0.17 years)", () => {
    expect(ids({ age_years: 0.16 })).toContain("R11");
    expect(ids({ age_years: 0.17 })).not.toContain("R11");
  });
  it("R12 child with temp ≥ 39.5", () => {
    expect(ids({ age_years: 5, vitals: { tempC: 39.5 } })).toContain("R12");
    expect(ids({ age_years: 5, vitals: { tempC: 39.4 } })).not.toContain("R12");
    expect(ids({ age_years: 12, vitals: { tempC: 40 } })).not.toContain("R12");
  });
  it("R13 poisoning, R14 severe pain", () => {
    expect(ids(sx("poisoning"))).toContain("R13");
    expect(ids(sx("severe_pain"))).toContain("R14");
    expect(ids(sx("vomiting"))).not.toContain("R13");
  });
  it("R15 child restlessness or swollen feet", () => {
    expect(ids({ ...sx("restlessness"), age_years: 4 })).toContain("R15");
    expect(ids({ ...sx("swelling_feet"), age_years: 11 })).toContain("R15");
    expect(ids({ ...sx("swelling_feet"), age_years: 40 })).not.toContain("R15");
  });
  it("R16 pregnancy danger signs", () => {
    expect(ids(sx("pregnancy", "abdominal_pain"))).toContain("R16");
    expect(ids(sx("pregnancy", "headache"))).toContain("R16");
    expect(ids({ ...sx("pregnancy"), red_flags_mentioned: ["تھوڑا خون بھی آیا ہے"] })).toContain("R16");
    expect(ids(sx("pregnancy"))).not.toContain("R16");
  });
});

describe("YELLOW / GREEN", () => {
  it("R17 possible dengue in twin cities without warning signs", () => {
    expect(ids({ ...sx("fever", "body_ache"), locality: "Dhok Hassu" })).toContain("R17");
    expect(ids({ ...sx("fever", "headache"), locality: "Bahria Town Phase 7" })).toContain("R17");
    expect(ids({ ...sx("fever", "headache"), locality: "G9" })).toContain("R17");
    expect(ids({ ...sx("fever", "body_ache"), locality: "Lahore" })).not.toContain("R17");
    expect(ids({ ...sx("fever", "body_ache", "nosebleed"), locality: "G-9" })).not.toContain("R17");
    expect(level({ ...sx("fever", "rash"), locality: "G-10" })).toBe("YELLOW");
  });
  it("R18 borderline vitals (SpO2 92–94, RR > 30, adult temp ≥ 39)", () => {
    expect(ids({ vitals: { spo2: 92 } })).toContain("R18");
    expect(ids({ vitals: { spo2: 94 } })).toContain("R18");
    expect(ids({ vitals: { spo2: 95 } })).not.toContain("R18");
    expect(ids({ vitals: { rr: 31 } })).toContain("R18");
    expect(ids({ vitals: { rr: 30 } })).not.toContain("R18");
    expect(ids({ vitals: { tempC: 39 }, age_years: 12 })).toContain("R18");
    expect(ids({ vitals: { tempC: 38.9 } })).not.toContain("R18");
  });
  it("R19 default GREEN", () => {
    const r = run(sx("burning_urination"));
    expect(r.level).toBe("GREEN");
    expect(r.hits.map((h) => h.id)).toEqual(["R19"]);
  });
  it("highest level wins and all hits are reported", () => {
    const r = run({ ...sx("chest_pain", "sweating", "fever", "body_ache"), locality: "Saddar", age_years: 50 });
    expect(r.level).toBe("RED");
    expect(r.hits.map((h) => h.id)).toEqual(expect.arrayContaining(["R02", "R17"]));
  });
});

describe("R20 uncertainty escalation", () => {
  it("low confidence escalates GREEN → YELLOW", () => {
    const r = run({ ...sx("cough"), confidence: 0.4 });
    expect(r).toMatchObject({ level: "YELLOW", escalatedForUncertainty: true });
    expect(r.hits.map((h) => h.id)).toEqual(["R20"]);
  });
  it("confidence 0.5 is not escalated", () => {
    expect(run({ ...sx("cough"), confidence: 0.5 }).escalatedForUncertainty).toBe(false);
  });
  it("unexplained red flag escalates one level", () => {
    expect(level({ ...sx("cough"), red_flags_mentioned: ["kuch ajeeb sa ho raha hai"] })).toBe("YELLOW");
    expect(level({ ...sx("fever", "body_ache"), locality: "G-9", red_flags_mentioned: ["bohat bura haal"] })).toBe("ORANGE");
  });
  it("unknown age that blocks a child-only rule escalates", () => {
    const r = run({ ...sx("diarrhoea", "lethargy", "sunken_eyes"), age_years: undefined });
    expect(r.level).toBe("YELLOW");
    expect(r.hits.find((h) => h.id === "R20")?.why).toContain("R08");
  });
  it("RED is never escalated past RED and missing data never lowers", () => {
    const r = run({ ...sx("convulsion"), confidence: 0.2 });
    expect(r).toMatchObject({ level: "RED", escalatedForUncertainty: false });
  });
});

describe("fixtures/cases.json", () => {
  type Case = (typeof cases)[number] & { vitals?: Extraction["vitals"]; duration_days?: number; redFlags?: string[] };
  for (const c of cases as Case[]) {
    it(`${c.caseId} → ${c.expectedLevel}`, () => {
      const r = run({
        symptoms: c.expectedSymptoms as Symptom[], age_years: c.age, sex: c.sex as Extraction["sex"],
        locality: c.locality, vitals: c.vitals ?? {}, duration_days: c.duration_days, red_flags_mentioned: c.redFlags ?? [],
      });
      expect(r.level).toBe(c.expectedLevel);
      expect(r.hits.map((h) => h.id)).toEqual(expect.arrayContaining(c.expectedRuleIds));
    });
  }
});
