"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { AnimatePresence, LayoutGroup } from "motion/react";
import { Activity, MapPin, Stethoscope, Users } from "lucide-react";
import { toast } from "sonner";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { OverrideDialog } from "@/components/dashboard/override-dialog";
import { PatientCard } from "@/components/dashboard/patient-card";
import { TransparencyPanel } from "@/components/dashboard/transparency-panel";
import { ReferralDialog } from "@/components/referral/referral-dialog";
import { useRemoteIntake } from "@/components/remote/use-remote-intake";
import { useHydrated } from "@/components/shell/app-shell";
import { LEVEL_META } from "@/components/triage";
import { cn } from "@/lib/utils";
import { DENGUE_RULES, activePatients, effectiveLevel, useQueue } from "@/store/queue";
import { TRIAGE_LEVELS, type Patient } from "@/types/contracts";

const DengueMap = dynamic(() => import("@/components/dashboard/dengue-map"), {
  ssr: false,
  loading: () => <Skeleton className="size-full rounded-none" />,
});

function useNow(ms = 1000) {
  const [now, setNow] = useState(0); // 0 until mounted: Date.now() must not run during prerender
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const id = setInterval(tick, ms);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [ms]);
  return now;
}

export default function DashboardPage() {
  const hydrated = useHydrated();
  const patients = useQueue((s) => s.patients);
  const audit = useQueue((s) => s.audit);
  const doctors = useQueue((s) => s.doctorsOnDuty);
  const { setDoctorsOnDuty, updateStatus } = useQueue.getState();
  const [overrideFor, setOverrideFor] = useState<Patient | null>(null);
  const [referFor, setReferFor] = useState<Patient | null>(null);
  const now = useNow();
  useRemoteIntake();

  const queue = activePatients(patients);
  const denguePins = patients.filter((p) => p.geo && p.status !== "done" && p.triage.hits.some((h) => DENGUE_RULES.includes(h.id)));
  const counts = Object.fromEntries(TRIAGE_LEVELS.map((l) => [l, queue.filter((p) => effectiveLevel(p) === l).length]));

  // Toast once per ER notification that happens while this board is open (including from another window).
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    const notified = patients.filter((p) => p.erNotifiedAt);
    if (!seen.current) { seen.current = new Set(notified.map((p) => p.id)); return; }
    for (const p of notified) {
      if (seen.current.has(p.id)) continue;
      seen.current.add(p.id);
      toast.error(`🔴 Token ${p.token} — ${(p.triage.hits[0]?.title ?? "emergency").toLowerCase()} — ER notified`, {
        description: `${p.name} · ${p.extraction.chief_complaint}`,
        duration: 6000,
      });
    }
  }, [patients, hydrated]);

  return (
    <main className="mx-auto grid w-full max-w-[1800px] flex-1 grid-rows-[auto_1fr] gap-6 px-6 py-6 text-lg">
      {/* Board header: department sign, tally per level, clock */}
      <header className="grid items-end gap-x-10 gap-y-4 border-b-2 border-ink pb-4 lg:grid-cols-[auto_1fr_auto]">
        <div>
          <div className="register-label">PIMS Islamabad · demo</div>
          <h1 className="signage text-6xl font-extrabold uppercase">Medicine OPD</h1>
          <div className="urdu text-lg leading-[1.8] text-mute">شعبہ طب · قطار</div>
        </div>

        <ul className="flex items-stretch self-stretch" aria-label="Patients waiting by level">
          {TRIAGE_LEVELS.map((l) => {
            const m = LEVEL_META[l];
            const Icon = m.icon;
            return (
              <li key={l} className="flex min-w-24 flex-col justify-end border-l px-4 first:border-l-0">
                <span className={cn("mb-auto h-1.5 w-full rounded-[1px]", m.bg)} />
                <span className={cn("mt-2 flex items-center gap-1 font-mono text-[11px] font-semibold tracking-[0.12em] uppercase", m.text)}><Icon className="size-3.5" />{m.label}</span>
                <span className="signage text-5xl font-extrabold tabular-nums">{hydrated ? counts[l] : "–"}</span>
              </li>
            );
          })}
          <li className="flex min-w-24 flex-col justify-end border-l px-4">
            <span className="mt-2 flex items-center gap-1 font-mono text-[11px] font-semibold tracking-[0.12em] text-mute uppercase"><Users className="size-3.5" />Waiting</span>
            <span className="signage text-5xl font-extrabold tabular-nums">{hydrated ? queue.length : "–"}</span>
          </li>
        </ul>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <div className="signage h-12 text-5xl font-extrabold tabular-nums">
              {hydrated && now > 0 && new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </div>
            <div className="h-4 font-mono text-[11px] tracking-[0.12em] text-mute uppercase">
              {hydrated && now > 0 && new Date(now).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })}
            </div>
          </div>
          <label className="flex w-60 items-center gap-3">
            <Stethoscope className="size-4 shrink-0 text-scrub" />
            <span className="register-label shrink-0">Doctors <b className="text-ink">{doctors}</b></span>
            <Slider min={1} max={8} step={1} value={[doctors]} onValueChange={(v) => setDoctorsOnDuty(Array.isArray(v) ? v[0] : v)} />
          </label>
        </div>
      </header>

      <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* Queue */}
        <section className="min-h-0">
          {!hydrated ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}</div>
          ) : queue.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-lg border border-dashed text-muted-foreground">
              Queue is empty. New patients from Intake appear here instantly.
            </div>
          ) : (
            <LayoutGroup>
              <ul className="space-y-3">
                <AnimatePresence initial={false}>
                  {queue.map((p) => (
                    <PatientCard
                      key={p.id}
                      patient={p}
                      fresh={!!p.erNotifiedAt && now - Date.parse(p.erNotifiedAt) < 3000}
                      onCallIn={() => updateStatus(p.id, "with_doctor")}
                      onDone={() => updateStatus(p.id, "done")}
                      onSendER={() => updateStatus(p.id, "sent_to_er")}
                      onOverride={() => setOverrideFor(p)}
                      onRefer={() => setReferFor(p)}
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}
        </section>

        {/* Side panel */}
        <aside className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-md border bg-card">
            <div className="flex items-baseline justify-between border-b px-4 py-2.5">
              <h2 className="register-label flex items-center gap-1.5"><MapPin className="size-3.5 text-triage-orange" /> Suspected dengue · twin cities</h2>
              <span className="signage text-2xl font-extrabold tabular-nums">{hydrated ? denguePins.length : 0}</span>
            </div>
            <div className="relative z-0 h-72 2xl:h-96">{hydrated && <DengueMap patients={denguePins} />}</div>
          </div>
          <div className="rounded-md border bg-card">
            <h2 className="register-label flex items-center gap-1.5 border-b px-4 py-2.5"><Activity className="size-3.5 text-scrub" /> Recent activity</h2>
            <div className="p-2">{hydrated && <ActivityFeed entries={audit} patients={patients} />}</div>
          </div>
          {hydrated && <TransparencyPanel audit={audit} patients={patients} now={now} />}
        </aside>
      </div>

      <OverrideDialog patient={overrideFor} onClose={() => setOverrideFor(null)} />
      <ReferralDialog patient={referFor} onClose={() => setReferFor(null)} />
    </main>
  );
}
