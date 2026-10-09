import { describe, expect, it } from "vitest";
import { ScriptError, stats, urduOnly } from "@/lib/ai/gemini";

describe("Devanagari guard", () => {
  const seq = (...outs: string[]) => { let i = 0; return async () => outs[i++]; };
  it("passes Urdu through on the first try", async () => {
    expect(await urduOnly(seq("سینے میں درد"), (s) => s)).toBe("سینے میں درد");
  });
  it("retries once after Devanagari", async () => {
    const before = stats.devanagariRetries;
    expect(await urduOnly(seq("सीने में दर्द", "سینے میں درد"), (s) => s)).toBe("سینے میں درد");
    expect(stats.devanagariRetries).toBe(before + 1);
  });
  it("throws ScriptError if Devanagari twice", async () => {
    await expect(urduOnly(seq("सीने", "दर्द"), (s) => s)).rejects.toBeInstanceOf(ScriptError);
  });
});

describe("parseJson", async () => {
  const { parseJson } = await import("@/lib/ai/gemini");
  const { ExtractionZ } = await import("@/types/contracts");
  it("treats null optional fields as absent", () => {
    const e = parseJson(JSON.stringify({ transcript_ur: "x", translation_en: "x", chief_complaint: "x", symptoms: [], red_flags_mentioned: [],
      age_years: null, vitals: { spo2: null }, suggested_department: "Medicine", missing_info: [], confidence: 0.9 }));
    expect(ExtractionZ.parse(e).age_years).toBeUndefined();
  });
});
