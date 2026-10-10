// pnpm warm — run the demo path + all 20 cases live (cached), then copy every entry into fixtures/golden-cache (committed),
// so demo mode works from a fresh clone with no network.
// pnpm warm --from-audit — instead promote every AI response used in a browser rehearsal (from .data/audit.jsonl):
// the doctor screen's sample photo is a browser-made JPEG this script can't reproduce, so rehearse once, then run this.
import { runExtractAndTriage, runInstructions, runPrescription, runTts, demoConfirmedItems } from "@/lib/pipeline";
import { promote } from "@/lib/cache";
import { ALL_CASES, DEMO_CASES, caseAudio, demoRxImage } from "./demo-inputs";

const keys: string[] = [];
let failures = 0;

async function step<T extends { meta: { cached: boolean; fallback?: string }; key: string }>(label: string, fn: () => Promise<T>) {
  try {
    const r = await fn();
    keys.push(r.key);
    console.log(`✓ ${label.padEnd(40)} ${r.meta.cached ? "cached" : "live"}${r.meta.fallback ? ` (${r.meta.fallback})` : ""}`);
    return r;
  } catch (e) {
    failures++;
    console.log(`✗ ${label.padEnd(40)} ${e instanceof Error ? e.message : e}`);
    return null;
  }
}

async function fromAudit() {
  const { readAudit } = await import("@/lib/audit");
  const hashes = new Set((await readAudit(100_000)).filter((e) => e.inputHash && (e.actor === "ai" || e.action === "cache_hit")).map((e) => e.inputHash!));
  let promoted = 0;
  for (const k of hashes) if (await promote(k)) promoted++;
  console.log(`Promoted ${promoted}/${hashes.size} rehearsal entries to fixtures/golden-cache.`);
}

async function main() {
  if (process.argv.includes("--from-audit")) return fromAudit();
  // Every case as text ("Play sample case"), plus recorded audio where it exists.
  for (const caseId of [...DEMO_CASES, ...ALL_CASES.filter((c) => !DEMO_CASES.includes(c))]) {
    await step(`extract ${caseId}`, () => runExtractAndTriage({ caseId }, false));
    const audio = caseAudio(caseId);
    if (audio) await step(`extract ${caseId} (audio)`, () => runExtractAndTriage({ ...audio, caseId }, false));
  }

  const img = demoRxImage();
  if (img) await step("prescription rx-demo photo", () => runPrescription({ ...img, patientId: "demo", caseId: "rx-demo" }, false));
  else console.log("- prescription: add fixtures/rx/rx-demo.jpg to warm the live vision call (golden fixture covers demo mode)");

  const items = await demoConfirmedItems();
  const ins = items && (await step("instructions (demo prescription)", () => runInstructions({ items }, false)));
  if (ins) await step("tts (demo instructions)", () => runTts({ text: ins.data.urdu }, false));

  let promoted = 0;
  for (const k of new Set(keys)) if (await promote(k)) promoted++;
  console.log(`\nPromoted ${promoted} entries to fixtures/golden-cache. ${failures ? `${failures} step(s) failed.` : "All steps OK."}`);
  if (failures) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
