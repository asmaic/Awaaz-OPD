import { GoogleGenAI, type Part } from "@google/genai";
import type { Extraction, RxItem, RxRead } from "@/types/contracts";
import { ExtractionZ, RxReadZ, cleanExtraction, extractionJsonSchema, prescriptionJsonSchema } from "./schemas";
import { EXTRACTION_PROMPT, INSTRUCTIONS_PROMPT, PRESCRIPTION_PROMPT } from "./prompts";
import { z } from "zod";
import { ensureWav } from "@/lib/wav";
import { SbarZ, type Sbar } from "@/types/features";
import { SitrepZ, type Sitrep } from "@/lib/sitrep";

export class ScriptError extends Error {}
// Any Indic script (Devanagari … Sinhala, U+0900–U+0DFF). Seen live: "dengue" came back partly in Malayalam + Bengali letters.
export const DEVANAGARI = /[\u0900-\u0DFF]/;
/** Per-call timeouts before falling back. Vision and TTS are slower than text/audio extraction. */
export const TIMEOUT_MS = 6000;
const SLOW_TIMEOUT_MS = 15000;
/** Counters read by scripts/eval.ts. */
export const stats = { devanagariRetries: 0 };

export const env = (k: string) => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} is not set`);
  return v;
};

let client: GoogleGenAI | undefined;
const ai = () => (client ??= new GoogleGenAI({ apiKey: env("GEMINI_API_KEY") }));

/** JSON.parse that drops nulls: models send `"age_years": null` for "not stated", which our optional fields expect as absent. */
export const parseJson = (text: string): unknown => JSON.parse(text, (_k, v) => (v === null ? undefined : v));

/** Strip ";codecs=opus" etc. — Gemini rejects mime parameters on inline audio. */
const baseMime = (mime: string) => mime.split(";")[0].trim();

async function json(model: string, system: string, parts: Part[], schema: unknown, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  const r = await ai().models.generateContent({
    model,
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: schema,
      temperature: 0,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });
  if (!r.text) throw new Error(`empty response from ${model}`);
  return parseJson(r.text);
}

/** Urdu written mostly in Latin letters ("din mein do baar"). English words like BP or ECG inside Urdu are fine. */
const ARABIC_LETTERS = /[\u0600-\u06FF]/g;
const LATIN_LETTERS = /[A-Za-z]/g;
const isRoman = (s: string) => {
  const ur = s.match(ARABIC_LETTERS)?.length ?? 0, en = s.match(LATIN_LETTERS)?.length ?? 0;
  return en >= 12 && ur < en; // more Latin than Urdu letters
};

/**
 * Run `call`; retry once if the Urdu came back in Devanagari or mostly in Roman letters.
 * Devanagari twice → ScriptError (next model). Roman twice → keep it (the patient may really have spoken English).
 */
export async function urduOnly<T>(call: () => Promise<T>, urdu: (t: T) => string): Promise<T> {
  const first = await call();
  if (!DEVANAGARI.test(urdu(first)) && !isRoman(urdu(first))) return first;
  stats.devanagariRetries++;
  const second = await call();
  if (DEVANAGARI.test(urdu(second))) throw new ScriptError("model returned Indic script instead of Urdu (Perso-Arabic) twice");
  return second;
}

const extract = (input: Part, model: string, timeoutMs = TIMEOUT_MS): Promise<Extraction> =>
  urduOnly(async () => cleanExtraction(ExtractionZ.parse(await json(model, EXTRACTION_PROMPT, [input], extractionJsonSchema, timeoutMs))), (e) => e.transcript_ur);

// Audio is slow: measured 3.7–26 s for a 15 s Urdu clip, so 6 s cut off working requests. Text stays at TIMEOUT_MS.
export const extractFromAudio = (b64: string, mime: string, model = env("GEMINI_MODEL")) =>
  extract({ inlineData: { mimeType: baseMime(mime), data: b64 } }, model, SLOW_TIMEOUT_MS);

export const extractFromText = (text: string, model = env("GEMINI_MODEL")) =>
  extract({ text: `Patient said:\n${text}` }, model);

export async function readPrescription(b64: string, mime: string, model = env("GEMINI_VISION_MODEL")): Promise<RxRead> {
  const raw = await json(model, PRESCRIPTION_PROMPT, [{ inlineData: { mimeType: baseMime(mime), data: b64 } }], prescriptionJsonSchema, SLOW_TIMEOUT_MS);
  return RxReadZ.parse(raw);
}

const InstructionsZ = z.object({ urdu: z.string().min(1) });

/** Simple spoken-Urdu instructions from doctor-confirmed items only. */
export async function urduInstructions(items: RxItem[], model = env("GEMINI_MODEL")): Promise<string> {
  const meds = items.filter((i) => i.confirmedByDoctor).map((i) => ({
    medicine: i.brand_match ?? i.drug_raw.value,
    strength: i.strength.value, frequency: i.frequency.value, duration: i.duration.value, route: i.route?.value,
  }));
  if (!meds.length) throw new Error("no doctor-confirmed items");
  const r = await urduOnly(
    async () => InstructionsZ.parse(await json(model, INSTRUCTIONS_PROMPT, [{ text: JSON.stringify(meds) }], z.toJSONSchema(InstructionsZ))),
    (x) => x.urdu,
  );
  return r.urdu;
}

/** Gemini TTS → WAV bytes (wraps raw PCM if the model returns L16). */
export async function tts(text: string, voice = "Kore", model = env("GEMINI_TTS_MODEL")): Promise<Buffer> {
  const r = await ai().models.generateContent({
    model,
    // Only the text to speak goes in contents (the TTS model reads everything aloud); languageCode stops it reading Urdu as English.
    contents: text,
    config: {
      responseModalities: ["AUDIO"],
      speechConfig: { languageCode: "ur", voiceConfig: { prebuiltVoiceConfig: { voiceName: voice } } },
      abortSignal: AbortSignal.timeout(SLOW_TIMEOUT_MS),
    },
  });
  const audio = r.candidates?.[0]?.content?.parts?.find((p) => p.inlineData?.data)?.inlineData;
  if (!audio?.data) throw new Error(`no audio from ${model}`);
  return ensureWav(Buffer.from(audio.data, "base64"), audio.mimeType);
}

/** SBAR handover draft. Validation + the "no new numbers" check happen in lib/pipeline.ts. */
export async function handoverNote(record: unknown, system: string, model = env("GEMINI_MODEL")): Promise<Sbar> {
  return SbarZ.parse(await json(model, system, [{ text: JSON.stringify(record) }], z.toJSONSchema(SbarZ)));
}

/** Outbreak alert draft. The number check happens in lib/pipeline.ts. */
export async function sitrepNote(facts: unknown, system: string, model = env("GEMINI_MODEL")): Promise<Sitrep> {
  return urduOnly(async () => SitrepZ.parse(await json(model, system, [{ text: JSON.stringify(facts) }], z.toJSONSchema(SitrepZ))), (r) => r.urdu_summary);
}
