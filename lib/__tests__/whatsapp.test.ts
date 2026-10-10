import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { isTwilioMediaUrl, maskPhone, phoneKey, remoteCode, replyFor, twilioSignature, twiml, verifyTwilio } from "@/lib/whatsapp";

const URL_ = "https://awaaz.example/api/whatsapp";
const params = { From: "whatsapp:+923001234567", Body: "chaar din se bukhar hai", NumMedia: "0" };

describe("Twilio signature", () => {
  it("matches an independent HMAC-SHA1 over url + sorted params", () => {
    const expected = createHmac("sha1", "secret").update(`${URL_}Bodychaar din se bukhar haiFromwhatsapp:+923001234567NumMedia0`).digest("base64");
    expect(twilioSignature("secret", URL_, params)).toBe(expected);
  });
  it("verifies genuine requests and rejects tampered or unsigned ones", () => {
    const sig = twilioSignature("secret", URL_, params);
    expect(verifyTwilio("secret", URL_, params, sig)).toBe(true);
    expect(verifyTwilio("secret", URL_, { ...params, Body: "tampered" }, sig)).toBe(false);
    expect(verifyTwilio("other", URL_, params, sig)).toBe(false);
    expect(verifyTwilio("secret", URL_, params, null)).toBe(false);
  });
});

describe("safety helpers", () => {
  it("only downloads media from Twilio", () => {
    expect(isTwilioMediaUrl("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages/MM1/Media/ME1")).toBe(true);
    expect(isTwilioMediaUrl("http://api.twilio.com/x")).toBe(false);
    expect(isTwilioMediaUrl("https://169.254.169.254/latest/meta-data")).toBe(false);
    expect(isTwilioMediaUrl("https://api.twilio.com.evil.com/x")).toBe(false);
  });
  it("never keeps the full phone number", () => {
    expect(maskPhone("whatsapp:+923001234567")).toBe("••4567");
    expect(phoneKey("whatsapp:+923001234567")).toBe(phoneKey("whatsapp:+923001234567"));
    expect(phoneKey("whatsapp:+923001234567")).not.toContain("3001234567");
  });
  it("escapes XML in the reply", () => {
    expect(twiml("a < b & c")).toContain("<Message>a &lt; b &amp; c</Message>");
  });
});

describe("reply", () => {
  it("RED tells the patient to come now / call 1122, with a code, and says it is not a diagnosis", () => {
    const r = replyFor("RED", remoteCode("x"), "possible heart attack");
    expect(r).toContain("1122");
    expect(r).toMatch(/کوڈ دکھائیں: [0-9A-Z]{4}/);
    expect(r).toContain("not a diagnosis");
  });
  it("GREEN is not urgent", () => {
    expect(replyFor("GREEN", "AB12")).toContain("not urgent");
  });
});
