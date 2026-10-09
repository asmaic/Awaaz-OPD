// pnpm eval [--only-failing]
// Runs all 20 cases through the real pipeline (audio from fixtures/audio if present, else the Urdu script as text).
// Results are cached, so re-runs are free.
import cases from "@/fixtures/cases.json";
import { TRIAGE_LEVELS, type Symptom, type TriageLevel } from "@/types/contracts";
import { runExtractAndTriage } from "@/lib/pipeline";
import { stats } from "@/lib/ai/gemini";
import { caseAudio } from "./demo-inputs";

const onlyFailing = process.argv.includes("--only-failing");
const rank = (l: TriageLevel) => TRIAGE_LEVELS.indexOf(l);

async function main() {
  let correct = 0, under = 0, tp = 0, fp = 0, fn = 0;
  const rows: string[] = [];

  for (const c of cases) {
    const audio = caseAudio(c.caseId);
    const req = audio ? { ...audio, caseId: c.caseId } : { text: c.script_ur, caseId: c.caseId };
    let line: string;
    try {
      const { data, meta } = await runExtractAndTriage(req, false);
      const got = data.triage.level;
      const expected = c.expectedLevel as TriageLevel;
      const isUnder = rank(got) > rank(expected) && rank(expected) <= rank("ORANGE");
      const exp = new Set(c.expectedSymptoms as Symptom[]);
      const act = new Set(data.extraction.symptoms);
      const missing = [...exp].filter((s) => !act.has(s));
      const extra = [...act].filter((s) => !exp.has(s));
      tp += exp.size - missing.length; fn += missing.length; fp += extra.length;
      if (got === expected) correct++;
      if (isUnder) under++;
      const ok = got === expected && !missing.length;
      const mark = isUnder ? "UNDER" : got === expected ? (ok ? "ok" : "ok*") : "diff";
      line = `${mark.padEnd(5)} ${c.caseId.padEnd(28)} ${expected.padEnd(6)} → ${got.padEnd(6)} ${data.triage.hits.map((h) => h.id).join(",").padEnd(12)}`
        + `${missing.length ? ` missing:${missing.join(",")}` : ""}${extra.length ? ` extra:${extra.join(",")}` : ""}`
        + ` [${audio ? "audio" : "text"}${meta.cached ? ", cached" : ""}${meta.fallback ? `, ${meta.fallback}` : ""}]`;
      if (onlyFailing && ok) continue;
    } catch (e) {
      line = `ERROR ${c.caseId.padEnd(28)} ${e instanceof Error ? e.message : e}`;
    }
    rows.push(line);
    console.log(line);
  }

  const n = cases.length;
  const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(0)}%` : "n/a");
  console.log(`\nLevel accuracy:        ${correct}/${n} (${pct(correct, n)})`);
  console.log(`Under-triaged RED/ORANGE: ${under}  ${under === 0 ? "✓" : "✗ MUST BE 0"}`);
  console.log(`Symptom precision:     ${pct(tp, tp + fp)}   recall: ${pct(tp, tp + fn)}`);
  console.log(`Devanagari retries:    ${stats.devanagariRetries} (fresh calls only)`);
  if (under > 0) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exit(1); });
