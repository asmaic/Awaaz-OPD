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
  const now = useNow();

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
    <main className="mx-auto grid w-full max-w-[1800px] flex-1 grid-rows-[auto_1fr] gap-5 px-6 py-5 text-lg">
      {/* Header */}
      <header className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-2xl border bg-card px-6 py-4 shadow-sm">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">PIMS Medicine OPD <span className="font-normal text-muted-foreground">— demo</span></h1>
          <p className="h-7 text-base text-muted-foreground tabular-nums">
            {hydrated && now > 0 && <>
              {new Date(now).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" })} ·{" "}
              {new Date(now).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </>}
          </p>
        </div>
        <ul className="flex flex-1 flex-wrap items-center gap-2">
          {TRIAGE_LEVELS.map((l) => {
            const m = LEVEL_META[l];
            const Icon = m.icon;
            return (
              <li key={l} className={cn("flex items-center gap-2 rounded-xl px-3 py-2", m.soft)}>
                <Icon className={cn("size-5", m.text)} />
                <span className={cn("font-semibold", m.text)}>{m.label}</span>
                <span className="text-2xl font-bold tabular-nums">{hydrated ? counts[l] : "–"}</span>
              </li>
            );
          })}
          <li className="flex items-center gap-2 px-2 text-muted-foreground"><Users className="size-5" /> {hydrated ? queue.length : "–"} in queue</li>
        </ul>
        <label className="flex w-64 items-center gap-3">
          <Stethoscope className="size-5 shrink-0 text-teal-600" />
          <span className="shrink-0 text-base whitespace-nowrap">Doctors <b className="font-mono">{doctors}</b></span>
          <Slider min={1} max={8} step={1} value={[doctors]} onValueChange={(v) => setDoctorsOnDuty(Array.isArray(v) ? v[0] : v)} />
        </label>
      </header>

      <div className="grid min-h-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px] 2xl:grid-cols-[minmax(0,1fr)_460px]">
        {/* Queue */}
        <section className="min-h-0">
          {!hydrated ? (
            <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}</div>
          ) : queue.length === 0 ? (
            <div className="grid h-64 place-items-center rounded-2xl border border-dashed text-muted-foreground">
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
                    />
                  ))}
                </AnimatePresence>
              </ul>
            </LayoutGroup>
          )}
        </section>

        {/* Side panel */}
        <aside className="flex flex-col gap-5">
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex items-center justify-between px-4 py-3">
              <h2 className="flex items-center gap-2 text-base font-semibold"><MapPin className="size-5 text-triage-orange" /> Suspected dengue · twin cities</h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-sm">{hydrated ? denguePins.length : 0}</span>
            </div>
            <div className="relative z-0 h-72 2xl:h-96">{hydrated && <DengueMap patients={denguePins} />}</div>
          </div>
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="mb-2 flex items-center gap-2 text-base font-semibold"><Activity className="size-5 text-teal-600" /> Recent AI activity</h2>
            {hydrated && <ActivityFeed entries={audit} patients={patients} />}
          </div>
        </aside>
      </div>

      <OverrideDialog patient={overrideFor} onClose={() => setOverrideFor(null)} />
    </main>
  );
}
