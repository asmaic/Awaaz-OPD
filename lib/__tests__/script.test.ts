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
  it("retries once when the transcript comes back in Roman letters", async () => {
    expect(await urduOnly(seq("din mein do baar dard", "دن میں دو بار درد"), (s) => s)).toBe("دن میں دو بار درد");
  });
  it("retries when only a word or two is in Urdu script", async () => {
    expect(await urduOnly(seq("Clorazep 5mg دن mein do baar, saat din ke liye", "دن میں دو بار، سات دن تک"), (s) => s)).toBe("دن میں دو بار، سات دن تک");
  });
  it("keeps a second Roman answer instead of failing (patient may have spoken English)", async () => {
    expect(await urduOnly(seq("chest pain since morning", "chest pain since morning"), (s) => s)).toBe("chest pain since morning");
  });
  it("does not treat Urdu with English words (BP, ECG) as Roman", async () => {
    expect(await urduOnly(seq("میرا BP بہت زیادہ ہے"), (s) => s)).toBe("میرا BP بہت زیادہ ہے");
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

describe("Indic-script guard covers more than Devanagari", async () => {
  const { DEVANAGARI } = await import("@/lib/ai/gemini");
  it("rejects Malayalam / Bengali mixed into Urdu (seen live), accepts clean Urdu", () => {
    expect(DEVANAGARI.test("ڈെങ്കি سے بچاؤ")).toBe(true);
    expect(DEVANAGARI.test("ডেঙ্গু")).toBe(true);
    expect(DEVANAGARI.test("ڈینگی سے بچاؤ کے لیے BP چیک کریں۔ 500 mg")).toBe(false);
  });
});

describe("unreadable transcript never blocks the patient", async () => {
  const { withUnreadableTranscript, URDU_TRANSCRIPT_UNAVAILABLE, DEVANAGARI } = await import("@/lib/ai/gemini");
  const { evaluate } = await import("@/lib/rules/engine");
  const base = { transcript_ur: "सीने में दर्द", translation_en: "Chest pain to the arm, sweating", chief_complaint: "Chest pain", symptoms: ["chest_pain", "sweating", "arm_jaw_pain"] as const,
    red_flags_mentioned: [], vitals: {}, suggested_department: "Medicine" as const, missing_info: ["Since when?"], confidence: 0.9, age_years: 55 };
  it("keeps symptoms, swaps in an Urdu notice, asks the nurse, lowers confidence", () => {
    const e = withUnreadableTranscript({ ...base, symptoms: [...base.symptoms] });
    expect(e.transcript_ur).toBe(URDU_TRANSCRIPT_UNAVAILABLE);
    expect(DEVANAGARI.test(e.transcript_ur)).toBe(false);
    expect(e.missing_info[0]).toMatch(/confirm the complaint/);
    expect(e.confidence).toBeLessThan(0.5);
    expect(e.symptoms).toEqual(["chest_pain", "sweating", "arm_jaw_pain"]);
  });
  it("triage still runs, and uncertainty raises (never lowers) the level", () => {
    const green = withUnreadableTranscript({ ...base, symptoms: ["cough"] });
    expect(evaluate(green).level).toBe("YELLOW"); // GREEN escalated by R20
    const red = withUnreadableTranscript({ ...base, symptoms: [...base.symptoms] });
    expect(evaluate(red).level).toBe("RED");
  });
});

describe("friendly errors", async () => {
  const { friendlyError } = await import("@/lib/http");
  it("hides internals when every AI path failed", () => {
    const m = friendlyError("all AI paths failed — primary: model returned Indic script instead of Urdu (Perso-Arabic) twice | fallback-model: This operation was aborted");
    expect(m).not.toMatch(/Indic|aborted|GROQ/);
    expect(m).toMatch(/sample case/);
  });
  it("leaves other errors alone", () => {
    expect(friendlyError("invalid request: text Required")).toBe("invalid request: text Required");
  });
});
