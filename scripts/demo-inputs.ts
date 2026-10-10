// The inputs the live demo depends on. warm-cache fills the cache for these; check-cache verifies them.
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import cases from "@/fixtures/cases.json";

export const DEMO_CASES = ["c07-dengue-dhok-hassu", "c01-heart-attack"];
export const ALL_CASES = cases.map((c) => c.caseId);

const AUDIO_EXT: Record<string, string> = { ".webm": "audio/webm", ".m4a": "audio/mp4", ".mp4": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg" };

/** fixtures/audio/<caseId>.<ext> if recorded, else null (the case runs as text). */
export function caseAudio(caseId: string): { audioB64: string; mime: string } | null {
  for (const [ext, mime] of Object.entries(AUDIO_EXT)) {
    const f = path.join("fixtures", "audio", `${caseId}${ext}`);
    if (existsSync(f)) return { audioB64: readFileSync(f).toString("base64"), mime };
  }
  return null;
}

/** fixtures/rx/rx-demo.(jpg|jpeg|png) — the prescription photo used on stage, if it has been added. */
export function demoRxImage(): { imageB64: string; mime: string } | null {
  for (const ext of ["jpg", "jpeg", "png"]) {
    const f = path.join("fixtures", "rx", `rx-demo.${ext}`);
    if (existsSync(f)) return { imageB64: readFileSync(f).toString("base64"), mime: ext === "png" ? "image/png" : "image/jpeg" };
  }
  return null;
}
