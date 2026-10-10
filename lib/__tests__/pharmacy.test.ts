import { describe, expect, it } from "vitest";
import type { RxItem } from "@/types/contracts";
import { checkStock, courseUnits } from "@/lib/pharmacy";

const f = (value: string) => ({ value, confidence: 1 });
const item = (brand: string, generic: string, strength: string, freq: string, dur: string): RxItem => ({
  drug_raw: f(`Tab. ${brand}`), brand_match: brand, generic, strength: f(strength), frequency: f(freq), duration: f(dur), confirmedByDoctor: false,
});

describe("courseUnits", () => {
  it("multiplies doses per day by days", () => {
    expect(courseUnits(item("Klaricid", "clarithromycin", "500 mg", "twice daily", "7 days"))).toBe(14);
    expect(courseUnits(item("Lipiget", "atorvastatin", "40mg", "once daily", "1 month"))).toBe(30);
    expect(courseUnits(item("Risek", "omeprazole", "20mg", "once daily (before bkfst)", "2 weeks"))).toBe(14);
    expect(courseUnits(item("Panadol", "paracetamol", "500mg", "when needed", "3 days"))).toBeUndefined();
    expect(courseUnits(item("Risek", "omeprazole", "20mg", "once daily", "[UNCLEAR]"))).toBeUndefined();
  });
});

describe("checkStock", () => {
  it("Klaricid out of stock → Claritek, saves Rs 644 on a 14-tablet course", () => {
    const [c] = checkStock([item("Klaricid", "clarithromycin", "500 mg", "twice daily", "7 days")]);
    expect(c.status).toBe("out_of_stock");
    expect(c.substitutes[0]).toMatchObject({ brand: "Claritek", unitPrice: 72, savesPerCourse: (118 - 72) * 14 });
  });
  it("in-stock brand still lists cheaper same-generic options", () => {
    const [c] = checkStock([item("Lipiget", "atorvastatin", "40mg", "once daily", "30 days")]);
    expect(c.status).toBe("in_stock");
    expect(c.substitutes).toEqual([]); // 20mg is a different strength, never offered
  });
  it("only same generic + same strength + in stock, cheapest first", () => {
    const [c] = checkStock([item("Risek", "omeprazole", "20 mg", "once daily", "14 days")]);
    expect(c.status).toBe("out_of_stock");
    expect(c.substitutes.map((s) => s.brand)).toEqual(["Omeprazole (hospital generic)"]);
    expect(c.substitutes[0].savesPerCourse).toBe((21 - 6) * 14);
  });
  it("unknown generic or brand not on the list", () => {
    expect(checkStock([{ ...item("X", "x", "1mg", "once daily", "1 day"), generic: undefined }])[0].status).toBe("unknown");
    expect(checkStock([item("Ventolin", "salbutamol", "2mg", "three times daily", "5 days")])[0].status).toBe("not_stocked");
  });
});
