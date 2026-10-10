// WhatsApp intake (Twilio WhatsApp Sandbox / Business API webhook). A patient sends a voice note or text from home;
// we triage it with the same pipeline and reply with a FIXED Urdu + English message (no AI-written advice) and a
// check code to show at the counter. Remote patients wait in a server inbox until the dashboard pulls them in.
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { Extraction, TriageLevel, TriageResult } from "@/types/contracts";
import { WRITE_ROOT } from "@/lib/paths";

/**
 * Twilio request signature: base64(HMAC-SHA1(authToken, fullUrl + each POST param name+value, sorted by name)).
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
export function twilioSignature(authToken: string, url: string, params: Record<string, string>): string {
  const data = url + Object.keys(params).sort().map((k) => k + params[k]).join("");
  return createHmac("sha1", authToken).update(data, "utf8").digest("base64");
}

export function verifyTwilio(authToken: string, url: string, params: Record<string, string>, signature: string | null): boolean {
  if (!signature) return false;
  const a = Buffer.from(twilioSignature(authToken, url, params));
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** Only fetch media from Twilio's own API host (never a URL an attacker could choose → no SSRF). */
export function isTwilioMediaUrl(u: string): boolean {
  try {
    const url = new URL(u);
    return url.protocol === "https:" && (url.hostname === "api.twilio.com" || url.hostname.endsWith(".twilio.com"));
  } catch {
    return false;
  }
}

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const twiml = (message: string) => `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${xml(message)}</Message></Response>`;

/** "whatsapp:+923001234567" → "••4567". The full number is never stored. */
export const maskPhone = (from: string) => `••${from.replace(/\D/g, "").slice(-4)}`;
/** Stable pseudonymous id so repeat messages from one phone can be linked without storing the number. */
export const phoneKey = (from: string) => createHash("sha256").update(`awaaz|${from}`).digest("hex").slice(0, 16);

/** 4-char code (Crockford base32) the patient shows at the counter. */
export function remoteCode(id: string): string {
  const h = createHash("sha256").update(id).digest();
  const A = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  return Array.from({ length: 4 }, (_, i) => A[h[i] % 32]).join("");
}

const ADVICE: Record<TriageLevel, { ur: string; en: string }> = {
  RED: { ur: "فوراً ایمرجنسی آئیں یا 1122 پر کال کریں۔ انتظار نہ کریں۔", en: "Come to the Emergency NOW or call 1122. Do not wait." },
  ORANGE: { ur: "آج ہی جلد از جلد ہسپتال آئیں۔", en: "Come to the hospital as soon as possible today." },
  YELLOW: { ur: "آج او پی ڈی کے وقت میں آئیں۔", en: "Come to the OPD today during opening hours." },
  GREEN: { ur: "او پی ڈی کے وقت میں آئیں، جلدی نہیں ہے۔", en: "Come during OPD hours; it is not urgent." },
};
const LEVEL_UR: Record<TriageLevel, string> = { RED: "سرخ (ایمرجنسی)", ORANGE: "نارنجی (بہت جلد)", YELLOW: "پیلا (آج)", GREEN: "سبز (عام)" };

/** Fixed-text reply. Never includes a diagnosis — only the priority, what to do, and the counter code. */
export function replyFor(level: TriageLevel, code: string, reason?: string): string {
  const a = ADVICE[level];
  return [
    "آواز OPD — آپ کا پیغام موصول ہو گیا۔",
    `ترجیح: ${LEVEL_UR[level]}`,
    a.ur,
    `کاؤنٹر پر یہ کوڈ دکھائیں: ${code}`,
    "",
    `Awaaz OPD — priority ${level}${reason ? ` (${reason})` : ""}. ${a.en} Show code ${code} at the counter.`,
    "This is triage, not a diagnosis. If you feel worse, come immediately.",
  ].join("\n");
}

export const HELP_REPLY = [
  "آواز OPD: اپنی تکلیف کا وائس نوٹ بھیجیں یا لکھ کر بتائیں (کب سے، کیا ہو رہا ہے، کس علاقے سے ہیں)۔",
  "Awaaz OPD: send a voice note or text describing your problem (since when, what is happening, which area).",
].join("\n");

export const SORRY_REPLY = [
  "معذرت، ابھی آپ کا پیغام سمجھ نہیں آ سکا۔ براہ کرم ہسپتال کے کاؤنٹر پر آئیں۔ ایمرجنسی میں 1122 پر کال کریں۔",
  "Sorry, we could not process your message right now. Please come to the hospital counter. In an emergency call 1122.",
].join("\n");

// ---------- remote inbox ----------

export interface RemoteIntake {
  id: string; receivedAt: string; code: string; phone: string; phoneKey: string; channel: "whatsapp";
  kind: "voice" | "text"; extraction: Extraction; triage: TriageResult;
}

const INBOX = () => path.join(WRITE_ROOT, ".data", "remote-intake.jsonl");

export async function saveRemote(r: Omit<RemoteIntake, "id" | "receivedAt" | "code">): Promise<RemoteIntake> {
  const id = randomUUID();
  const rec: RemoteIntake = { id, receivedAt: new Date().toISOString(), code: remoteCode(id), ...r };
  await mkdir(path.dirname(INBOX()), { recursive: true });
  await appendFile(INBOX(), `${JSON.stringify(rec)}\n`);
  return rec;
}

/** Remote intakes received after `after` (ISO), oldest first. */
export async function listRemote(after?: string): Promise<RemoteIntake[]> {
  const text = await readFile(INBOX(), "utf8").catch(() => "");
  return text.split("\n").filter(Boolean).map((l) => JSON.parse(l) as RemoteIntake).filter((r) => !after || r.receivedAt > after);
}
