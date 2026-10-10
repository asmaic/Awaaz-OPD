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
          <motion.div key="idle" exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="flex min-h-[calc(100dvh-10rem)] flex-col items-center gap-7 pt-2 text-center">
            <div className="flex flex-col items-center">
              <p className="urdu text-6xl leading-[2.4] lg:text-7xl" lang="ur">اپنی تکلیف بتائیں</p>
              <h1 className="signage mt-1 text-4xl font-extrabold uppercase">Tell us what’s wrong</h1>
              <p className="mt-3 max-w-md text-lg text-mute">Press and hold the button, speak in Urdu or English, then let go. Up to 30 seconds.</p>
            </div>

            <div className="relative grid place-items-center">
              {recorder.recording && (
                <>
                  <span className="absolute size-60 animate-ping rounded-full bg-triage-red/10" />
                  <span className="absolute size-72 rounded-full border border-triage-red/30" />
                </>
              )}
              <button
                type="button"
                onPointerDown={onPointerDown}
                onPointerUp={onPointerUp}
                onClick={onClick}
                aria-label={recorder.recording ? "Stop recording" : "Start recording"}
                className={cn(
                  "relative grid size-52 touch-none place-items-center rounded-full ring-8 transition-colors duration-200 select-none",
                  recorder.recording ? "bg-triage-red text-white ring-triage-red/15" : "bg-scrub text-primary-foreground ring-scrub/12 hover:bg-scrub-deep",
                )}
              >
                {recorder.recording ? <Square className="size-16 fill-current" /> : <Mic className="size-20" strokeWidth={1.75} />}
              </button>
            </div>

            <div className="flex w-full max-w-xl flex-col items-center gap-2">
              <Waveform analyser={recorder.analyser} className="h-20 w-full" />
              <div className="h-6 font-mono text-base tabular-nums text-mute">
                {recorder.recording ? `${fmt(recorder.elapsed)} / 0:30 · tap or release to stop` : recorder.error ?? ""}
              </div>
            </div>

            <div className="mt-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-3 border-t pt-4">
              <span className="register-label mr-2">For staff</span>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="flex h-11 items-center gap-2 rounded-md border bg-card px-4 text-base font-medium hover:bg-muted"
              >
                <Upload className="size-4" /> Upload clip
              </button>
              <input ref={fileRef} type="file" accept="audio/*" hidden onChange={(e) => onUpload(e.target.files?.[0])} />
              <div className="flex h-11 items-center overflow-hidden rounded-md border bg-card">
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
