import { audit } from "@/lib/audit";
import { isDemo } from "@/lib/http";
import { runExtractAndTriage } from "@/lib/pipeline";
import { HELP_REPLY, SORRY_REPLY, isTwilioMediaUrl, maskPhone, phoneKey, replyFor, saveRemote, twiml, verifyTwilio } from "@/lib/whatsapp";

const xmlResponse = (body: string) => new Response(body, { headers: { "content-type": "text/xml; charset=utf-8" } });

/** Public URL Twilio signed: WHATSAPP_WEBHOOK_URL if set (behind proxies), else rebuilt from forwarded headers. */
function publicUrl(req: Request): string {
  if (process.env.WHATSAPP_WEBHOOK_URL) return process.env.WHATSAPP_WEBHOOK_URL;
  const u = new URL(req.url);
  const proto = req.headers.get("x-forwarded-proto") ?? u.protocol.replace(":", "");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? u.host;
  return `${proto}://${host}${u.pathname}${u.search}`;
}

/**
 * POST /api/whatsapp — Twilio WhatsApp webhook (application/x-www-form-urlencoded).
 * Voice note or text → same extraction + rules pipeline → fixed Urdu/English reply (TwiML) + server inbox.
 * Always answers 200 with a message (Twilio retries errors and the patient should never be left without a reply).
 */
export async function POST(req: Request) {
  const params = Object.fromEntries([...(await req.formData()).entries()].map(([k, v]) => [k, String(v)]));
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (token ? !verifyTwilio(token, publicUrl(req), params, req.headers.get("x-twilio-signature")) : process.env.WHATSAPP_ALLOW_UNSIGNED !== "true") {
    return new Response("forbidden", { status: 403 });
  }

  const from = params.From ?? "";
  const body = (params.Body ?? "").trim();
  const mediaUrl = params.MediaUrl0;
  const mime = params.MediaContentType0 ?? "";
  const isVoice = Number(params.NumMedia ?? 0) > 0 && mime.startsWith("audio/") && !!mediaUrl;
  if (!isVoice && body.length < 3) return xmlResponse(twiml(HELP_REPLY));

  try {
    let input: { audioB64: string; mime: string } | { text: string };
    if (isVoice) {
      if (!isTwilioMediaUrl(mediaUrl)) throw new Error("media URL is not a Twilio URL");
      const auth = process.env.TWILIO_ACCOUNT_SID && token ? { authorization: `Basic ${Buffer.from(`${process.env.TWILIO_ACCOUNT_SID}:${token}`).toString("base64")}` } : undefined;
      const media = await fetch(mediaUrl, { headers: auth, signal: AbortSignal.timeout(6000) });
      if (!media.ok) throw new Error(`media download failed: ${media.status}`);
      input = { audioB64: Buffer.from(await media.arrayBuffer()).toString("base64"), mime };
    } else {
      input = { text: body };
    }
    const { data } = await runExtractAndTriage(input, isDemo(req));
    const rec = await saveRemote({ phone: maskPhone(from), phoneKey: phoneKey(from), channel: "whatsapp", kind: isVoice ? "voice" : "text",
      extraction: data.extraction, triage: data.triage });
    await audit({ actor: "system", action: "confirm", reason: `WhatsApp intake ${rec.phone} → ${data.triage.level}, code ${rec.code}`,
      ruleIds: data.triage.hits.map((h) => h.id), payload: { kind: "remote_intake", id: rec.id, channel: "whatsapp", voice: isVoice } });
    return xmlResponse(twiml(replyFor(data.triage.level, rec.code, data.triage.hits[0]?.title?.toLowerCase())));
  } catch (e) {
    console.error(`[whatsapp] ${e instanceof Error ? e.message : e}`);
    return xmlResponse(twiml(SORRY_REPLY));
  }
}
