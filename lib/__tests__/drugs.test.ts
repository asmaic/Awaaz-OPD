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
  });
  it("durations", () => {
    expect(normalizeDuration("x 5/7")).toBe("5 days");
    expect(normalizeDuration("2/52")).toBe("2 weeks");
    expect(normalizeDuration("1/12")).toBe("1 month");
    expect(normalizeDuration("7 days")).toBe("7 days");
  });
});
