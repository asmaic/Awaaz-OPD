import { describe, expect, it } from "vitest";
import { matchBrand } from "@/lib/drugs";
import { checkInteractions } from "@/lib/interactions";

describe("matchBrand", () => {
  it("matches brands as written, with forms, strengths and typos", () => {
    expect(matchBrand("Tab. Klaricid 500mg")).toEqual({ brand: "Klaricid", generic: "clarithromycin" });
    expect(matchBrand("Lipiget")?.generic).toBe("atorvastatin");
    expect(matchBrand("Cap Risek 20")?.generic).toBe("omeprazole");
    expect(matchBrand("Klarcid")?.brand).toBe("Klaricid");
    expect(matchBrand("Augmentin 625")?.generic).toBe("amoxicillin+clavulanate");
    expect(matchBrand("Paracetamol")).toEqual({ brand: undefined, generic: "paracetamol" });
  });
  it("returns null for unknown or unreadable names", () => {
    expect(matchBrand("[UNCLEAR]")).toBeNull();
    expect(matchBrand("Xyzzy")).toBeNull();
  });
});

describe("checkInteractions", () => {
  it("flags clarithromycin + atorvastatin as major", () => {
    const [i] = checkInteractions(["clarithromycin", "atorvastatin", "omeprazole"]);
    expect(i).toMatchObject({ pair: ["clarithromycin", "atorvastatin"], severity: "major" });
  });
  it("splits combination products and finds moderate interactions", () => {
    expect(checkInteractions(["ibuprofen+pseudoephedrine", "enalapril"])[0]?.severity).toBe("moderate");
    expect(checkInteractions(["ciprofloxacin", "calcium carbonate"])).toHaveLength(1);
  });
  it("returns nothing for safe combinations", () => {
    expect(checkInteractions(["paracetamol", "omeprazole"])).toEqual([]);
  });
});

describe("normalize", async () => {
  const { normalizeFrequency, normalizeDuration } = await import("@/lib/drugs");
  it("frequencies", () => {
    expect(normalizeFrequency("BD")).toBe("twice daily");
    expect(normalizeFrequency("t.d.s")).toBe("three times daily");
    expect(normalizeFrequency("1+0+1")).toBe("twice daily");
    expect(normalizeFrequency("0+0+1")).toBe("once daily");
    expect(normalizeFrequency("[UNCLEAR]")).toBe("[UNCLEAR]");
    expect(normalizeFrequency("1 + 0 + 1 BD")).toBe("twice daily");
    expect(normalizeFrequency("0 + 0 + 1 OD")).toBe("once daily");
    expect(normalizeFrequency("1 + 0 + 0 OD (before bkfst)")).toBe("once daily (before bkfst)");
    expect(normalizeFrequency("1 + 0 + 0 OD (bef")).toBe("once daily (bef)");
    expect(normalizeFrequency("as directed")).toBe("as directed");
  });
  it("durations", () => {
    expect(normalizeDuration("x 5/7")).toBe("5 days");
    expect(normalizeDuration("2/52")).toBe("2 weeks");
    expect(normalizeDuration("1/12")).toBe("1 month");
    expect(normalizeDuration("7 days")).toBe("7 days");
  });
});

describe("templateInstructions", async () => {
  const { templateInstructions } = await import("@/lib/drugs");
  const f = (value: string) => ({ value, confidence: 1 });
  const item = (drug: string, strength: string, freq: string, dur: string, confirmed = true) => ({
    drug_raw: f(drug), brand_match: drug, strength: f(strength), frequency: f(freq), duration: f(dur), confirmedByDoctor: confirmed,
  });
  it("uses exactly the confirmed fields", () => {
    expect(templateInstructions([item("Risek", "20mg", "once daily (before bkfst)", "10 days")]))
      .toBe("Risek 20mg، دن میں ایک دفعہ (before bkfst)، 10 دن تک۔");
    expect(templateInstructions([item("Klaricid", "500mg", "twice daily", "1 week"), item("Lipiget", "40mg", "once daily", "1 month", false)]))
      .toBe("Klaricid 500mg، دن میں دو دفعہ، 1 ہفتے تک۔");
  });
});
