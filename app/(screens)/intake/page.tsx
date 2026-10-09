"use client";
import { useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Mic, Play, Square, Upload } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/mock";
import cases from "@/fixtures/cases.json";
import { ErrorCard } from "@/components/error-card";
import { IntakeResult } from "@/components/intake/intake-result";
import { ProcessingSteps, STEPS } from "@/components/intake/processing-steps";
import { TokenCard } from "@/components/intake/token-card";
import { blobToB64, useRecorder } from "@/components/intake/use-recorder";
import { Waveform } from "@/components/intake/waveform";
import { cn } from "@/lib/utils";
import { useQueue } from "@/store/queue";
import type { ApiResult, ExtractReq, ExtractRes, Patient } from "@/types/contracts";

type Meta = Extract<ApiResult<ExtractRes>, { ok: true }>["meta"];
type Phase =
  | { k: "idle" }
  | { k: "processing"; step: number }
  | { k: "result"; res: ExtractRes; meta: Meta }
  | { k: "error"; msg: string }
  | { k: "queued"; patient: Patient };

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const DEMO_CASES = ["c07-dengue-dhok-hassu", "c01-heart-attack"];
const caseLabel = (id: string) => {
  const [num, ...rest] = id.split("-");
  return `${num.toUpperCase()} · ${rest.join(" ").replace(/\b\w/g, (c) => c.toUpperCase())}`;
};
const SAMPLE_OPTIONS = [
  ...DEMO_CASES,
  ...cases.map((c) => c.caseId).filter((id) => !DEMO_CASES.includes(id)),
];

const fmt = (ms: number) => `0:${String(Math.floor(ms / 1000)).padStart(2, "0")}`;

export default function IntakePage() {
  const [phase, setPhase] = useState<Phase>({ k: "idle" });
  const [sample, setSample] = useState(SAMPLE_OPTIONS[0]);
  const lastReq = useRef<ExtractReq | null>(null);
  const holdStart = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const addPatient = useQueue((s) => s.addPatient);
  const log = useQueue((s) => s.log);

  async function run(req: ExtractReq) {
    lastReq.current = req;
    setPhase({ k: "processing", step: 1 });
    const ticker = setInterval(() => {
      setPhase((p) => (p.k === "processing" && p.step < STEPS.length - 1 ? { ...p, step: p.step + 1 } : p));
    }, 550);
    const r = await api.extract(req);
    clearInterval(ticker);
    if (!r.ok) {
      setPhase({ k: "error", msg: r.error });
      return;
    }
    // In mock mode there is no backend audit log, so mirror the AI + rules events client-side.
    if (USE_MOCK) {
      log({ actor: "ai", action: r.meta.cached ? "cache_hit" : "extract", model: r.meta.model, promptVersion: "ext-v1", payload: r.data.extraction });
      log({ actor: "rules", action: "triage", ruleIds: r.data.triage.hits.map((h) => h.id), payload: r.data.triage });
    }
    setPhase({ k: "processing", step: STEPS.length });
    setTimeout(() => setPhase({ k: "result", res: r.data, meta: r.meta }), 350);
  }

  const recorder = useRecorder(async (blob, mime) => {
    if (blob.size < 2000) {
      toast("Recording too short", { description: "Hold the button and speak for a few seconds." });
      setPhase({ k: "idle" });
      return;
    }
    void run({ audioB64: await blobToB64(blob), mime });
  });

  const onPointerDown = () => {
    if (recorder.recording) return;
    holdStart.current = performance.now();
    void recorder.start();
  };
  const onPointerUp = () => {
    // Held > 400 ms → push-to-talk release stops. A quick tap leaves it recording until the next tap.
    if (recorder.recording && performance.now() - holdStart.current > 400) recorder.stop();
  };
  // Keyboard activation (Enter/Space) arrives as a click with detail 0: toggle.
  const onClick = (e: React.MouseEvent) => {
    if (e.detail !== 0) return;
    if (recorder.recording) recorder.stop();
    else void recorder.start();
  };

  async function onUpload(f: File | undefined) {
    if (!f) return;
    void run({ audioB64: await blobToB64(f), mime: f.type || "audio/webm" });
  }

  const reset = () => setPhase({ k: "idle" });

  return (
    <main className="mx-auto w-full max-w-[1400px] flex-1 px-6 py-8">
      <AnimatePresence mode="wait">
        {phase.k === "idle" && (
          <motion.div key="idle" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex flex-col items-center gap-8 pt-4 text-center">
            <div>
              <p className="urdu mb-3 text-4xl leading-[2.6]">اپنی تکلیف بتائیں</p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight">Tell us what’s wrong</h1>
              <p className="mt-2 text-lg text-muted-foreground">Hold the button and speak in Urdu or English. Up to 30 seconds.</p>
            </div>

            <div className="relative grid place-items-center">
              {recorder.recording && (
                <>
                  <span className="absolute size-56 animate-ping rounded-full bg-triage-red/15" />
                  <span className="absolute size-64 rounded-full border-2 border-triage-red/20" />
                </>
              )}
              <button
                type="button"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onClick={onClick}
                aria-label={recorder.recording ? "Stop recording" : "Start recording"}
                className={cn(
                  "relative grid size-48 touch-none place-items-center rounded-full text-white shadow-2xl transition-all duration-300 select-none",
                  recorder.recording ? "scale-105 bg-triage-red shadow-triage-red/40" : "bg-teal-600 shadow-teal-600/40 hover:scale-105 hover:bg-teal-700",
                )}
              >
                {recorder.recording ? <Square className="size-16 fill-current" /> : <Mic className="size-20" strokeWidth={1.75} />}
              </button>
            </div>

            <div className="flex w-full max-w-xl flex-col items-center gap-2">
              <Waveform analyser={recorder.analyser} className="h-20 w-full" />
              <div className="h-6 font-mono text-lg tabular-nums text-muted-foreground">
                {recorder.recording ? `${fmt(recorder.elapsed)} / 0:30 · tap or release to stop` : recorder.error ?? ""}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-12 items-center gap-2 rounded-xl border bg-card px-4 text-base font-medium shadow-sm hover:bg-muted"
              >
                <Upload className="size-4" /> Upload clip
              </button>
              <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => onUpload(e.target.files?.[0])} />
              <div className="flex h-12 items-center overflow-hidden rounded-xl border bg-card shadow-sm">
                <select
                  value={sample}
                  onChange={(e) => setSample(e.target.value)}
                  className="h-full bg-transparent pr-2 pl-4 text-base outline-none"
                  aria-label="Sample case"
                >
                  {SAMPLE_OPTIONS.map((id) => <option key={id} value={id}>{caseLabel(id)}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => run({ caseId: sample })}
                  className="flex h-full items-center gap-2 border-l bg-muted/50 px-4 font-medium hover:bg-muted"
                >
                  <Play className="size-4 fill-current" /> Play sample case
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {phase.k === "processing" && (
          <motion.div key="proc" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pt-10">
            <ProcessingSteps current={phase.step} />
          </motion.div>
        )}

        {phase.k === "result" && (
          <motion.div key="result" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <IntakeResult
              res={phase.res}
              meta={phase.meta}
              onReset={reset}
              onAdd={(name) => setPhase({ k: "queued", patient: addPatient({ name, extraction: phase.res.extraction, triage: phase.res.triage }) })}
            />
          </motion.div>
        )}

        {phase.k === "error" && (
          <motion.div key="err" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pt-16">
            <ErrorCard
              message={phase.msg}
              onRetry={() => lastReq.current && run(lastReq.current)}
              onSample={() => run({ caseId: sample })}
            />
          </motion.div>
        )}

        {phase.k === "queued" && (
          <motion.div key="queued" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }} className="pt-6">
            <TokenCard patient={phase.patient} onNext={reset} />
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
