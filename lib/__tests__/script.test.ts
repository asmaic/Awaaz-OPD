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
