import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ExtractionZ, PatientZ, PrescriptionZ, SymptomZ, TriageLevelZ, TriageResultZ } from "@/types/contracts";
import cases from "./cases.json";
import seed from "./seed-patients.json";
import localities from "./localities.json";
import c01 from "./golden/c01-heart-attack.extract.json";
import c07 from "./golden/c07-dengue-dhok-hassu.extract.json";
import rx from "./golden/rx-demo.prescription.json";

const DEVANAGARI = /[ऀ-ॿ]/;

describe("fixtures match contracts", () => {
  it("cases use valid symptoms/levels and Nastaliq script", () => {
    expect(cases).toHaveLength(20);
    for (const c of cases) {
      z.array(SymptomZ).parse(c.expectedSymptoms);
      TriageLevelZ.parse(c.expectedLevel);
      expect(c.script_ur).toMatch(/[؀-ۿ]/);
      expect(c.script_ur).not.toMatch(DEVANAGARI);
    }
    const count = (l: string) => cases.filter((c) => c.expectedLevel === l).length;
    expect([count("RED"), count("ORANGE"), count("YELLOW"), count("GREEN")]).toEqual([6, 6, 4, 4]);
  });

  it("case localities exist in localities.json", () => {
    const names = new Set(localities.localities.map((l) => l.name));
    for (const c of cases) if (c.locality) expect(names).toContain(c.locality);
  });

  it("seed patients and golden responses parse", () => {
    z.array(PatientZ).parse(seed);
    for (const g of [c01, c07]) { ExtractionZ.parse(g.extraction); TriageResultZ.parse(g.triage); }
    PrescriptionZ.parse(rx.prescription);
  });
});
