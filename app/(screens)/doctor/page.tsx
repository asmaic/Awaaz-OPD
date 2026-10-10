"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { CheckCheck, FileScan, Hospital, Loader2, RotateCcw, ScanText, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorCard } from "@/components/error-card";
import { CapturePanel, SAMPLES } from "@/components/doctor/capture-panel";
import { urlToJpeg, type Captured } from "@/components/doctor/image";
import { InteractionBanners, RxTable, needsReview, type FieldKey } from "@/components/doctor/rx-review";
import { VoiceBack } from "@/components/doctor/voice-back";
import { StockPanel } from "@/components/doctor/stock-panel";
import { ReferralDialog } from "@/components/referral/referral-dialog";
import type { Substitute } from "@/types/features";
import { useHydrated } from "@/components/shell/app-shell";
import { TriageBadge } from "@/components/triage";
import { api } from "@/lib/mock";
import { activePatients, effectiveLevel, useQueue } from "@/store/queue";
import type { Prescription } from "@/types/contracts";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const KEYS: FieldKey[] = ["drug_raw", "strength", "frequency", "duration"];

type Phase = "capture" | "reading" | "review" | "error" | "confirming" | "confirmed";

export default function DoctorPage() {
  const hydrated = useHydrated();
  const patients = useQueue((s) => s.patients);
  const { log, addPrescription, updatePrescription } = useQueue.getState();
  const active = activePatients(patients);
  const [pickedId, setPickedId] = useState<string | null>(null);
  const patient = active.find((p) => p.id === pickedId) ?? active.find((p) => p.status === "with_doctor") ?? active[0];

  const [phase, setPhase] = useState<Phase>("capture");
  const [captured, setCaptured] = useState<Captured | null>(null);
  const [rx, setRx] = useState<Prescription | null>(null);
  const [resolved, setResolved] = useState<Set<string>>(new Set());
  const [urdu, setUrdu] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [referOpen, setReferOpen] = useState(false);

  const unresolved = rx ? rx.items.reduce((n, it, i) => n + KEYS.filter((k) => needsReview(it[k]) && !resolved.has(`${i}.${k}`)).length, 0) : 0;

  async function read(c: Captured) {
    setCaptured(c);
    setPhase("reading");
    setUrdu(null);
    const r = await api.prescription({ imageB64: c.b64, mime: c.mime, patientId: patient?.id ?? "walk-in", caseId: c.caseId });
    if (!r.ok) { setError(r.error); setPhase("error"); return; }
    if (USE_MOCK) log({ actor: "ai", action: r.meta.cached ? "cache_hit" : "rx_read", model: r.meta.model, promptVersion: "rx-v1", patientId: patient?.id, payload: r.data.prescription });
    setRx(r.data.prescription);
    setResolved(new Set());
    setPhase("review");
  }

  function onField(i: number, k: FieldKey, v: string) {
    setRx((x) => x && { ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: { ...it[k], value: v } } : it)) });
  }
  function onResolve(i: number, k: FieldKey) {
    setRx((x) => x && { ...x, items: x.items.map((it, j) => (j === i ? { ...it, [k]: { ...it[k], confidence: 1 } } : it)) });
    setResolved((s) => new Set(s).add(`${i}.${k}`));
  }

  async function confirm() {
    if (!rx || unresolved) return;
    setPhase("confirming");
    const confirmed: Prescription = { ...rx, items: rx.items.map((it) => ({ ...it, confirmedByDoctor: true })) };
    addPrescription(confirmed);
    log({ actor: "doctor", action: "confirm", patientId: patient?.id, reason: `Prescription confirmed (${resolved.size} field(s) corrected)`, payload: confirmed });
    const r = await api.instructions({ items: confirmed.items, patientName: patient?.name });
    if (!r.ok) { setError(r.error); setPhase("error"); return; }
    updatePrescription(confirmed.id, { urduInstructions: r.data.urdu });
    setRx(confirmed);
    setUrdu(r.data.urdu);
    setPhase("confirmed");
  }

  /** Doctor-approved swap to an in-stock brand of the same generic + strength. The written name stays as evidence. */
  function onSwap(i: number, sub: Substitute) {
    if (!rx) return;
    const from = rx.items[i].brand_match ?? rx.items[i].drug_raw.value;
    setRx({ ...rx, items: rx.items.map((it, j) => (j === i ? { ...it, brand_match: sub.brand } : it)) });
    log({ actor: "doctor", action: "override", patientId: patient?.id,
      reason: `Substituted ${from} → ${sub.brand} (${sub.generic} ${sub.strength}): out of stock${sub.savesPerCourse ? `, saves Rs ${sub.savesPerCourse}` : ""}`,
      payload: { kind: "rx_substitute", index: i, from, to: sub.brand, generic: sub.generic, savesPerCourse: sub.savesPerCourse } });
  }

  const restart = () => { setPhase("capture"); setCaptured(null); setRx(null); setUrdu(null); };

  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-6 px-6 py-6">
      {/* Patient strip */}
      <section className="flex flex-wrap items-end gap-x-6 gap-y-3 border-b-2 border-ink pb-4">
        {!hydrated ? <Skeleton className="h-14 w-96" /> : patient ? (
          <>
            <div>
              <div className="register-label flex items-center gap-1.5"><UserRound className="size-3.5" /> Now seeing</div>
              <div className="flex items-baseline gap-3">
                <span className="signage text-6xl font-extrabold tabular-nums">{patient.token}</span>
                <span className="text-2xl font-bold">{patient.name}</span>
              </div>
            </div>
            <select
              value={patient.id}
              onChange={(e) => setPickedId(e.target.value)}
              aria-label="Patient being seen"
              className="h-10 rounded-md border bg-card px-3 text-base"
            >
              {active.map((p) => <option key={p.id} value={p.id}>Token {p.token} · {p.name}{p.status === "with_doctor" ? " (with doctor)" : ""}</option>)}
            </select>
            <TriageBadge level={effectiveLevel(patient)} />
            <span className="min-w-0 flex-1 truncate pb-2 text-lg text-mute">{patient.extraction.chief_complaint}</span>
            <Button variant="outline" className="h-11 rounded-md" onClick={() => setReferOpen(true)}>
              <Hospital className="size-4" /> Treat here or transfer?
            </Button>
          </>
        ) : <span className="text-muted-foreground">No patients in the queue — add one at Intake.</span>}
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(340px,0.8fr)_minmax(0,1.4fr)]">
        {/* Left: capture / photo */}
        <section className="space-y-3 rounded-md border bg-card p-5">
          <header className="flex items-center justify-between">
            <h2 className="register-label flex items-center gap-1.5"><FileScan className="size-3.5 text-scrub" /> Prescription photo</h2>
            {captured && <Button variant="ghost" className="rounded-md" onClick={restart}><RotateCcw className="size-4" /> New photo</Button>}
          </header>
          {captured ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={captured.previewUrl} alt="Captured prescription" className="max-h-[68vh] w-full rounded-md border object-contain" />
          ) : (
            <CapturePanel onCapture={read} />
          )}
        </section>

        {/* Right: extraction & confirmation */}
        <section className="space-y-4 rounded-md border bg-card p-5">
          <header className="flex items-center justify-between gap-3">
            <h2 className="register-label flex items-center gap-1.5"><ScanText className="size-3.5 text-scrub" /> What the AI read · check every amber field</h2>
            {rx && phase !== "confirmed" && (
              <span className={unresolved ? "rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "rounded-full bg-scrub-tint px-3 py-1 text-sm font-medium text-scrub"}>
                {unresolved ? `${unresolved} field${unresolved > 1 ? "s need" : " needs"} your review` : "All fields reviewed"}
              </span>
            )}
          </header>

          {phase === "capture" && (
            <div className="grid h-72 place-items-center rounded-md border border-dashed text-center text-muted-foreground">
              <div>
                <p className="text-lg">Capture or pick a prescription on the left.</p>
                <button
                  type="button"
                  className="mt-2 text-scrub underline-offset-4 hover:underline"
                  onClick={async () => read(await urlToJpeg(SAMPLES[0].url, SAMPLES[0].caseId))}
                >
                  Use the sample prescription
                </button>
              </div>
            </div>
          )}

          {phase === "reading" && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Reading handwriting, matching brands, checking interactions…</p>
              {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-md" />)}
            </div>
          )}

          {phase === "error" && (
            <ErrorCard
              message={error}
              onRetry={captured ? () => read(captured) : undefined}
              onSample={async () => read(await urlToJpeg(SAMPLES[0].url, SAMPLES[0].caseId))}
            />
          )}

          {rx && (phase === "review" || phase === "confirming" || phase === "confirmed") && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <InteractionBanners interactions={rx.interactions} />
              <div className={phase === "confirmed" ? "pointer-events-none opacity-80" : undefined}>
                <RxTable items={rx.items} resolved={resolved} onField={onField} onResolve={onResolve} />
              </div>
              <StockPanel items={rx.items} disabled={phase === "confirmed"} onSwap={onSwap} />
              {phase !== "confirmed" ? (
                <div className="flex items-center justify-end gap-3">
                  <span className="text-sm text-muted-foreground">Amber fields must be edited or confirmed before saving.</span>
                  <Button
                    onClick={confirm}
                    disabled={!!unresolved || phase === "confirming"}
                    className="h-12 rounded-md bg-scrub px-5 text-base text-primary-foreground hover:bg-scrub-deep"
                  >
                    {phase === "confirming" ? <Loader2 className="size-5 animate-spin" /> : <CheckCheck className="size-5" />}
                    Confirm prescription
                  </Button>
                </div>
              ) : (
                urdu && <VoiceBack rxId={rx.id} urdu={urdu} patientId={patient?.id} />
              )}
            </motion.div>
          )}
        </section>
      </div>
      <ReferralDialog patient={referOpen ? patient ?? null : null} prescription={phase === "confirmed" ? rx ?? undefined : undefined} onClose={() => setReferOpen(false)} />
    </main>
  );
}
