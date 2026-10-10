// Server-side pipelines shared by app/api/* and scripts/*. Every AI call goes through runAi (cache → models → golden).
import { randomUUID } from "node:crypto";
import type {
  ExtractReq, ExtractRes, Extraction, Interaction, InstructionsReq, PrescriptionReq, Prescription, RxItem, RxRead, TtsReq,
} from "@/types/contracts";
import { extractFromAudio, extractFromText, readPrescription, tts as geminiTts, urduInstructions, env } from "@/lib/ai/gemini";
import { groqExtract, groqTranscribe } from "@/lib/ai/groq";
import { EXTRACTION_PROMPT_VERSION, INSTRUCTIONS_PROMPT_VERSION, PRESCRIPTION_PROMPT_VERSION } from "@/lib/ai/prompts";
import { blobGet, blobSet, goldenFixture, runAi, type Attempt, type RunMeta } from "@/lib/cache";
import { audit } from "@/lib/audit";
import { evaluate } from "@/lib/rules/engine";
import { matchBrand, normalizeDuration, normalizeFrequency, templateInstructions } from "@/lib/drugs";
import { checkInteractions } from "@/lib/interactions";
import cases from "@/fixtures/cases.json";

type Out<T> = { data: T; meta: RunMeta; key: string };
const UNCLEAR = "[UNCLEAR]";

// ---------- extraction ----------

/** Voice/text → Extraction. caseId alone means "play sample case": use that case's Urdu script as text. */
export async function runExtraction(req: ExtractReq, demo: boolean): Promise<Out<Extraction>> {
  const text = req.text ?? (req.audioB64 ? undefined : cases.find((c) => c.caseId === req.caseId)?.script_ur);
  if (!req.audioB64 && !text) throw new Error(`unknown caseId ${req.caseId}`);

  const primary = env("GEMINI_MODEL");
  const fallback = env("GEMINI_FALLBACK_MODEL");
  let input: (string | Buffer)[];
  let attempts: Attempt<Extraction>[];
  if (req.audioB64) {
    const b64 = req.audioB64;
    const mime = req.mime ?? "audio/webm";
    const bytes = Buffer.from(b64, "base64");
    input = [mime.split(";")[0], bytes];
    attempts = [
      { label: "primary", model: primary, run: () => extractFromAudio(b64, mime, primary) },
      { label: "fallback-model", model: fallback, run: () => extractFromAudio(b64, mime, fallback) },
      { label: "groq", model: "groq/whisper-large-v3+gpt-oss-120b", run: async () => groqExtract(await groqTranscribe(bytes, mime)) },
    ];
  } else {
    const t = text!;
    input = [t];
    attempts = [
      { label: "primary", model: primary, run: () => extractFromText(t, primary) },
      { label: "fallback-model", model: fallback, run: () => extractFromText(t, fallback) },
      { label: "groq", model: "groq/gpt-oss-120b", run: () => groqExtract(t) },
    ];
  }

  return runAi({
    route: "extract", model: primary, promptVersion: EXTRACTION_PROMPT_VERSION, input, demo, action: "extract", attempts,
    golden: async () => (await goldenFixture<ExtractRes>(req.caseId, "extract"))?.extraction ?? null,
  });
}

/** Extraction + deterministic triage (the rules decide, never the model). */
export async function runExtractAndTriage(req: ExtractReq, demo: boolean): Promise<Out<ExtractRes>> {
  const { data: extraction, meta, key } = await runExtraction(req, demo);
  const triage = evaluate(extraction);
  await audit({
    actor: "rules", action: "triage", payload: { level: triage.level, escalatedForUncertainty: triage.escalatedForUncertainty, caseId: req.caseId },
    ruleIds: triage.hits.map((h) => h.id), reason: triage.hits.map((h) => `${h.id}: ${h.why}`).join("; "),
  });
  return { data: { extraction, triage }, meta, key };
}

// ---------- prescription ----------

/** Normalise abbreviations, match brands, check interactions. Doctor confirmation always starts false. */
export function postProcessRx(read: RxRead): { items: RxItem[]; interactions: Interaction[] } {
  const items: RxItem[] = read.items.map((it) => {
    const m = it.drug_raw.value === UNCLEAR ? null : matchBrand(it.drug_raw.value);
    const norm = (f: { value: string; confidence: number }, fn: (s: string) => string) =>
      f.value === UNCLEAR ? f : { ...f, value: fn(f.value) };
    return {
      drug_raw: it.drug_raw, brand_match: m?.brand, generic: m?.generic,
      strength: it.strength, frequency: norm(it.frequency, normalizeFrequency), duration: norm(it.duration, normalizeDuration),
      route: it.route, confirmedByDoctor: false,
    };
  });
  return { items, interactions: checkInteractions(items.flatMap((i) => (i.generic ? [i.generic] : []))) };
}

export async function runPrescription(req: PrescriptionReq, demo: boolean): Promise<Out<Prescription>> {
  const vision = env("GEMINI_VISION_MODEL");
  const fallback = env("GEMINI_FALLBACK_MODEL");
  // Cache the raw model reading; brand match / normalisation / interactions run after the cache so fixes apply to cached reads too.
  const { data, meta, key } = await runAi<RxRead>({
    route: "prescription", model: vision, promptVersion: PRESCRIPTION_PROMPT_VERSION,
    input: [req.mime, Buffer.from(req.imageB64, "base64")], demo, action: "rx_read", patientId: req.patientId,
    attempts: [
      { label: "primary", model: vision, run: () => readPrescription(req.imageB64, req.mime, vision) },
      { label: "fallback-model", model: fallback, run: () => readPrescription(req.imageB64, req.mime, fallback) },
    ],
    golden: async () => (await goldenFixture<{ prescription: Prescription }>(req.caseId, "prescription"))?.prescription ?? null,
  });
  const { items, interactions } = postProcessRx(data);
  return { data: { id: `rx-${randomUUID()}`, patientId: req.patientId, items, interactions }, meta, key };
}

// ---------- Urdu instructions ----------

// What the instructions depend on; also the cache input, so editing a field re-generates.
const rxSignature = (items: RxItem[]) =>
  JSON.stringify(items.filter((i) => i.confirmedByDoctor).map((i) => [i.brand_match ?? i.drug_raw.value, i.strength.value, i.frequency.value, i.duration.value]));

export async function runInstructions(req: InstructionsReq, demo: boolean): Promise<Out<{ urdu: string }>> {
  if (!req.items.some((i) => i.confirmedByDoctor)) throw new Error("no doctor-confirmed items");
  const primary = env("GEMINI_MODEL");
  const fallback = env("GEMINI_FALLBACK_MODEL");
  return runAi({
    route: "instructions", model: primary, promptVersion: INSTRUCTIONS_PROMPT_VERSION, input: [rxSignature(req.items)], demo, action: "confirm",
    attempts: [
      { label: "primary", model: primary, run: async () => ({ urdu: await urduInstructions(req.items, primary) }) },
      { label: "fallback-model", model: fallback, run: async () => ({ urdu: await urduInstructions(req.items, fallback) }) },
    ],
    // Golden only if the confirmed items are exactly the demo prescription (wrong instructions are worse than none).
    golden: async () => {
      const demoItems = await demoConfirmedItems();
      return demoItems && rxSignature(demoItems) === rxSignature(req.items) ? goldenFixture<{ urdu: string }>("rx-demo", "instructions") : null;
    },
    // Anything else (e.g. demo mode after the doctor typed another value): fixed-phrase Urdu built from exactly what was confirmed.
    template: () => ({ urdu: templateInstructions(req.items) }),
  });
}

/** The demo prescription as the doctor confirms it on stage: every item confirmed, the [UNCLEAR] duration edited to 14 days. */
export async function demoConfirmedItems(): Promise<RxItem[] | null> {
  const rx = await goldenFixture<{ prescription: Prescription }>("rx-demo", "prescription");
  return rx?.prescription.items.map((i) => ({
    ...i, confirmedByDoctor: true, duration: i.duration.value === UNCLEAR ? { value: "14 days", confidence: 1 } : i.duration,
  })) ?? null;
}

// ---------- TTS ----------

export const ttsUrl = (key: string) => `/api/tts?id=${key}`;

export async function runTts(req: TtsReq, demo: boolean): Promise<Out<{ audioUrl: string }>> {
  const model = env("GEMINI_TTS_MODEL");
  const voice = req.voice ?? "Kore";
  return runAi({
    route: "tts", model, promptVersion: "tts-v1", input: [voice, req.text], demo, action: "tts",
    attempts: [{
      label: "primary", model,
      run: async (key) => {
        await blobSet(key, await geminiTts(req.text, voice, model));
        return { audioUrl: ttsUrl(key) };
      },
    }],
    // Person B's pre-recorded clip for the demo prescription.
    golden: async () => {
      const ins = await goldenFixture<{ urdu: string }>("rx-demo", "instructions");
      return ins?.urdu === req.text ? { audioUrl: "/fallback/rx-demo.wav" } : null;
    },
  });
}

export { blobGet };
