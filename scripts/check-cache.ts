// pnpm check-cache — replay the demo path in demo mode (no network) and report anything not served from cache.
import { runExtractAndTriage, runInstructions, runTts, demoConfirmedItems, runPrescription } from "@/lib/pipeline";
import { ALL_CASES, DEMO_CASES, caseAudio, demoRxImage } from "./demo-inputs";

let missing = 0;
async function check(label: string, critical: boolean, fn: () => Promise<{ meta: { cached: boolean; fallback?: string } }>) {
  try {
    const { meta } = await fn();
    const how = meta.fallback === "golden" ? "golden fixture" : "cache";
    console.log(`✓ ${label.padEnd(40)} ${how}`);
  } catch {
    if (critical) missing++;
    console.log(`${critical ? "✗" : "-"} ${label.padEnd(40)} MISSING${critical ? "" : " (not on demo path)"}`);
  }
}

async function main() {
  process.env.DEMO_MODE = "true";
  for (const caseId of ALL_CASES) {
    const critical = DEMO_CASES.includes(caseId);
    await check(`extract ${caseId}`, critical, () => runExtractAndTriage({ caseId }, true));
    const audio = caseAudio(caseId);
    if (audio) await check(`extract ${caseId} (audio)`, critical, () => runExtractAndTriage({ ...audio, caseId }, true));
  }
  const img = demoRxImage() ?? { imageB64: "", mime: "image/jpeg" };
  await check("prescription rx-demo", true, () => runPrescription({ ...img, patientId: "demo", caseId: "rx-demo" }, true));
  const items = await demoConfirmedItems();
  let urdu = "";
  await check("instructions (demo prescription)", true, async () => {
    const r = await runInstructions({ items: items ?? [], patientName: undefined }, true);
    urdu = r.data.urdu;
    return r;
  });
  await check("tts (demo instructions)", true, () => runTts({ text: urdu }, true));
  console.log(missing ? `\n${missing} demo-path input(s) missing — run pnpm warm.` : "\nDemo path fully cached.");
  if (missing) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
