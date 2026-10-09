import Groq, { toFile } from "groq-sdk";
import type { Extraction } from "@/types/contracts";
import { ExtractionZ, cleanExtraction, extractionJsonSchema } from "./schemas";
import { EXTRACTION_PROMPT } from "./prompts";
import { DEVANAGARI, ScriptError, TIMEOUT_MS, env } from "./gemini";

let client: Groq | undefined;
const groq = () => (client ??= new Groq({ apiKey: env("GROQ_API_KEY") }));

export async function groqTranscribe(buf: Buffer, mime: string): Promise<string> {
  const ext = mime.includes("mp4") ? "mp4" : mime.includes("wav") ? "wav" : mime.includes("ogg") ? "ogg" : "webm";
  const r = await groq().audio.transcriptions.create(
    { file: await toFile(buf, `clip.${ext}`, { type: mime.split(";")[0] }), model: "whisper-large-v3", language: "ur", temperature: 0 },
    { timeout: TIMEOUT_MS },
  );
  return r.text;
}

export async function groqExtract(text: string): Promise<Extraction> {
  const r = await groq().chat.completions.create(
    {
      model: "openai/gpt-oss-120b",
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: `${EXTRACTION_PROMPT}\nReturn an object matching this JSON Schema:\n${JSON.stringify(extractionJsonSchema)}` },
        { role: "user", content: `Patient said:\n${text}` },
      ],
    },
    { timeout: TIMEOUT_MS },
  );
  const e = cleanExtraction(ExtractionZ.parse(JSON.parse(r.choices[0]?.message.content ?? "")));
  if (DEVANAGARI.test(e.transcript_ur)) throw new ScriptError("Groq returned Devanagari");
  return e;
}
