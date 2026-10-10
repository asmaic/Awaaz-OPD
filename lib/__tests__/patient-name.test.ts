import { describe, expect, it } from "vitest";
import { spokenName } from "@/lib/patient-name";

const ex = (translation_en: string, transcript_ur = "") => ({ translation_en, transcript_ur });

describe("spokenName", () => {
  it("reads the name from the translation (the live Sabina case)", () => {
    expect(spokenName(ex("There is severe chest pain, it is going to the left arm and I am sweating a lot, my name is Sabina, I am a girl and my age is 36 years."))).toBe("Sabina");
    expect(spokenName(ex("My name is Muhammad Aslam and my sugar medicine has run out."))).toBe("Muhammad Aslam");
  });
  it("handles a relative speaking for the patient", () => {
    expect(spokenName(ex("My daughter's name is Ayesha Bibi, she has diarrhoea."))).toBe("Ayesha Bibi");
    expect(spokenName(ex("my son's name is Ali. He has fever."))).toBe("Ali");
  });
  it("falls back to the Urdu transcript", () => {
    expect(spokenName(ex("I have fever.", "میرا نام صبینہ ہے، مجھے بخار ہے۔"))).toBe("صبینہ");
  });
  it("returns nothing when no name was said", () => {
    expect(spokenName(ex("I have had fever for four days and my stomach hurts."))).toBeUndefined();
    expect(spokenName(ex("The name of the medicine is unclear."))).toBeUndefined();
  });
});
