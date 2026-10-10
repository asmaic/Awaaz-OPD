// Feature 5 — hospital pharmacy stock + same-generic substitutes. Pure; the doctor approves every swap.
import data from "@/fixtures/pharmacy.json";
import type { RxItem } from "@/types/contracts";
import type { StockCheck, StockEntry } from "@/types/features";

export const STOCK = data.stock as StockEntry[];

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, ""); // "500 mg" ≡ "500mg"
const PER_DAY: Record<string, number> = { "once daily": 1, "at bedtime": 1, "twice daily": 2, "three times daily": 3, "four times daily": 4 };

/** Tablets for the whole course, from normalised frequency + duration ("twice daily" × "7 days" = 14). */
export function courseUnits(item: RxItem): number | undefined {
  const perDay = PER_DAY[item.frequency.value.replace(/\s*\(.*$/, "").trim()];
  const d = /^(\d+)\s*(day|week|month)s?$/i.exec(item.duration.value.trim());
  if (!perDay || !d) return undefined;
  const days = Number(d[1]) * ({ day: 1, week: 7, month: 30 } as const)[d[2].toLowerCase() as "day" | "week" | "month"];
  return perDay * days;
}

export function checkStock(items: RxItem[], stock: StockEntry[] = STOCK): StockCheck[] {
  return items.map((item, index) => {
    if (!item.generic) return { index, status: "unknown", substitutes: [] };
    const strength = norm(item.strength.value);
    const sameDrug = stock.filter((s) => s.generic === item.generic && norm(s.strength) === strength);
    const entry = sameDrug.find((s) => item.brand_match && norm(s.brand) === norm(item.brand_match));
    const units = courseUnits(item);
    const substitutes = sameDrug
      .filter((s) => s.inStock && s !== entry)
      .sort((a, b) => a.unitPrice - b.unitPrice)
      .map((s) => ({ ...s, savesPerCourse: entry && units ? (entry.unitPrice - s.unitPrice) * units : undefined }));
    const status = !entry ? "not_stocked" : entry.inStock ? "in_stock" : "out_of_stock";
    return { index, status, entry, substitutes, courseUnits: units };
  });
}
