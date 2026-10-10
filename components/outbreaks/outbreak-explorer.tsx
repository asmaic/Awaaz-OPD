"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertOctagon, ArrowDownRight, ArrowUpRight, BookOpen, Eye, FileWarning, Loader2, Printer, Radar, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EpiCurve } from "@/components/outbreaks/epi-curve";
import { useHydrated } from "@/components/shell/app-shell";
import { api } from "@/lib/mock";
import { SYNDROME, SYNDROMES, analyse, fromPatient, historyCases, sitrepFacts, syndromesOf, type SyndromeId } from "@/lib/surveillance";
import type { SitrepRes } from "@/lib/sitrep";
import { cn } from "@/lib/utils";
import { useQueue } from "@/store/queue";

const OutbreakMap = dynamic(() => import("@/components/outbreaks/outbreak-map"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

const pct = (g: number | null) => (g === null ? "—" : `${g >= 1 ? "+" : ""}${Math.round((g - 1) * 100)}%`);

/** Outbreak explorer: syndromic surveillance over a synthetic 28-day history + today's live queue. */
export function OutbreakExplorer() {
  const params = useSearchParams();
  const router = useRouter();
  const hydrated = useHydrated();
  const patients = useQueue((s) => s.patients);
  const log = useQueue((s) => s.log);
  const [now, setNow] = useState(0); // set after mount: Date.now() must not run during render/prerender
  useEffect(() => { const t = setTimeout(() => setNow(Date.now()), 0); return () => clearTimeout(t); }, []);

  const focusPatient = patients.find((p) => p.id === params.get("focus"));
  const requested = params.get("syndrome") as SyndromeId | null;
  const syndromeId: SyndromeId = requested && SYNDROME[requested] ? requested : (focusPatient && syndromesOf(fromPatient(focusPatient))[0]) || "dengue";
  const [picked, setPicked] = useState<string | null>(null);
  const [sitrep, setSitrep] = useState<SitrepRes | null>(null);
  const [drafting, setDrafting] = useState(false);
  const [err, setErr] = useState("");

  const all = useMemo(() => (now ? [...historyCases(now), ...patients.map(fromPatient)] : []), [now, patients]);
  const a = useMemo(() => (now ? analyse(all, syndromeId, now) : null), [all, syndromeId, now]);
  const perSyndrome = useMemo(() => (now ? Object.fromEntries(SYNDROMES.map((s) => [s.id, analyse(all, s.id, now)])) : null), [all, now]);
  const focusLocality = focusPatient?.extraction.locality;
  const listed = a ? a.cases.filter((c) => !picked || (c.locality ?? "Unknown") === picked).slice(0, 40) : [];

  const go = (id: SyndromeId) => {
    const q = new URLSearchParams(params);
    q.set("syndrome", id);
    setSitrep(null); setPicked(null);
    router.replace(`/outbreaks?${q}`);
  };

  async function draft() {
    if (!a) return;
    setDrafting(true); setErr("");
    const r = await api.sitrep({ syndromeId, facts: sitrepFacts(a) });
    setDrafting(false);
    if (!r.ok) { setErr(r.error); return; }
    setSitrep(r.data);
    log({ actor: "system", action: "notify_er", reason: `Outbreak alert drafted: ${a.syndrome.label}${a.alerts.length ? ` (${a.alerts.map((l) => l.locality).join(", ")})` : ""}`,
      payload: { kind: "sitrep", syndrome: syndromeId, generatedBy: r.data.generatedBy, alerts: a.alerts.map((l) => l.locality) } });
  }

  if (!hydrated || !a || !perSyndrome) {
    return <main className="mx-auto w-full max-w-[1800px] space-y-4 px-6 py-5"><Skeleton className="h-24 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></main>;
  }

  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-5 px-6 py-5">
      {/* Header + syndrome tabs */}
      <header className="space-y-3 rounded-2xl border bg-card px-6 py-4 shadow-sm">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Radar className="size-6 text-teal-600" /> Outbreak explorer</h1>
          <span className="text-sm text-muted-foreground">Syndromic surveillance · last 28 days · <b>synthetic history</b> + today&apos;s live queue</span>
        </div>
        {focusPatient && (
          <p className="rounded-xl bg-teal-50 px-3 py-2 text-base dark:bg-teal-950/40">
            Showing patients like <b>Token {focusPatient.token}</b> ({focusPatient.extraction.chief_complaint}{focusLocality ? `, ${focusLocality}` : ""}). Their locality is outlined on the map.
          </p>
        )}
        <div className="flex flex-wrap gap-2" role="tablist">
          {SYNDROMES.map((s) => {
            const x = perSyndrome[s.id];
            const on = s.id === syndromeId;
            return (
              <button key={s.id} role="tab" aria-selected={on} onClick={() => go(s.id)}
                className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-left transition-colors", on ? "border-teal-600 bg-teal-600 text-white" : "hover:bg-muted")}>
                <span className="font-semibold">{s.short}</span>
                <span className={cn("rounded-full px-1.5 text-sm tabular-nums", on ? "bg-white/20" : "bg-muted")}>{x.thisWeek}</span>
                {x.alerts.some((l) => l.alert === "alert") && <span className={cn("flex items-center gap-0.5 text-xs font-bold", on ? "text-white" : "text-triage-red")}><AlertOctagon className="size-3.5" />ALERT</span>}
              </button>
            );
          })}
        </div>
      </header>

      {/* Stat tiles */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Cases, last 28 days" value={a.total} sub={`${a.syndrome.label} · ${a.syndrome.ur}`} />
        <Tile label="This week vs last week" value={`${a.thisWeek} vs ${a.prevWeek}`}
          sub={<span className={cn("inline-flex items-center gap-1 font-semibold", (a.growth ?? 1) > 1 ? "text-triage-red" : "text-teal-700 dark:text-teal-400")}>
            {(a.growth ?? 1) > 1 ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{pct(a.growth)}</span>} />
        <Tile label="Doubling time" value={a.doublingDays ? `${a.doublingDays} days` : "Not growing"} sub="at this week's growth rate" />
        <Tile label="Localities on alert" value={a.alerts.filter((l) => l.alert === "alert").length}
          sub={a.alerts.length ? a.alerts.map((l) => l.locality).join(", ") : "none above usual level"} tone={a.alerts.some((l) => l.alert === "alert") ? "alert" : undefined} />
      </section>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Map */}
        <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <h2 className="text-base font-semibold">Where: cases this week by locality</h2>
            <span className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="size-3 rounded-full bg-triage-red" /> Alert</span>
              <span className="flex items-center gap-1"><span className="size-3 rounded-full bg-triage-yellow" /> Watch</span>
              <span className="flex items-center gap-1"><span className="size-3 rounded-full bg-teal-700" /> Usual</span>
              <span>· circle size = cases · click to filter</span>
            </span>
          </div>
          <div className="relative z-0 h-[26rem]"><OutbreakMap stats={a.byLocality} focus={focusLocality} onPick={(l) => setPicked((p) => (p === l ? null : l))} /></div>
        </section>

        {/* Curve + alerts */}
        <section className="space-y-4 rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="text-base font-semibold">When: {a.syndrome.label}, cases per day</h2>
          <EpiCurve daily={a.daily} label={a.syndrome.label} />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase">Statistical alerts</h3>
            {a.alerts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No locality is above its usual level this week.</p>
            ) : a.alerts.map((l) => (
              <div key={l.locality} className={cn("flex items-start gap-2 rounded-xl border p-2.5 text-sm", l.alert === "alert" ? "border-triage-red/50 bg-triage-red/5" : "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/30")}>
                {l.alert === "alert" ? <AlertOctagon className="mt-0.5 size-4 shrink-0 text-triage-red" /> : <Eye className="mt-0.5 size-4 shrink-0 text-amber-600" />}
                <div><b>{l.locality}</b> · {l.alert === "alert" ? "ALERT" : "Watch"} — {l.why}</div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        {/* Table view (also the accessible alternative to the map) */}
        <section className="rounded-2xl border bg-card p-4 shadow-sm">
          <h2 className="mb-2 text-base font-semibold">By locality {picked && <button className="ml-2 text-sm font-normal text-teal-700 underline" onClick={() => setPicked(null)}>clear filter: {picked}</button>}</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground uppercase"><tr><th className="py-1 text-left">Locality</th><th className="text-right">This week</th><th className="text-right">Usual / wk</th><th className="text-right">vs last wk</th><th className="pl-3 text-left">Status</th></tr></thead>
              <tbody className="divide-y">
                {a.byLocality.slice(0, 12).map((l) => (
                  <tr key={l.locality} onClick={() => setPicked(l.locality)} className={cn("cursor-pointer hover:bg-muted/50", picked === l.locality && "bg-teal-50 dark:bg-teal-950/30")}>
                    <td className="py-1.5 font-medium">{l.locality}{focusLocality && l.locality === focusLocality && " ●"}</td>
                    <td className="text-right tabular-nums">{l.thisWeek}</td>
                    <td className="text-right tabular-nums">{l.baselineWeekly}</td>
                    <td className="text-right tabular-nums">{pct(l.growth)}</td>
                    <td className="pl-3">{l.alert === "alert" ? <span className="font-semibold text-triage-red">⚠ Alert</span> : l.alert === "watch" ? <span className="font-semibold text-amber-700">◐ Watch</span> : <span className="text-muted-foreground">Usual</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <h3 className="mt-4 mb-1 text-sm font-semibold text-muted-foreground uppercase">Recent cases {picked ? `in ${picked}` : ""}</h3>
          <ul className="max-h-56 divide-y overflow-y-auto text-sm">
            {listed.map((c) => (
              <li key={c.id} className="flex items-center gap-2 py-1">
                <span className="w-24 shrink-0 text-muted-foreground tabular-nums">{new Date(c.ts).toLocaleDateString([], { day: "numeric", month: "short" })}</span>
                <span className="w-28 shrink-0">{c.locality ?? "Unknown"}</span>
                <span className="text-muted-foreground">{c.age ?? "?"}y · {c.sex ?? "?"}</span>
                <span className="truncate text-muted-foreground">{c.symptoms.map((s) => s.replaceAll("_", " ")).join(", ")}</span>
                {c.live && <span className="ml-auto shrink-0 rounded-full bg-teal-100 px-1.5 text-[11px] font-semibold text-teal-800 dark:bg-teal-950 dark:text-teal-300">today&apos;s queue</span>}
              </li>
            ))}
          </ul>
        </section>

        {/* Case definition + who + AI alert */}
        <section className="space-y-4">
          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-semibold"><BookOpen className="size-4 text-teal-600" /> Case definition: {a.syndrome.label}</h2>
            <p className="mt-1 text-sm">{a.syndrome.definition}</p>
            <p className="mt-1 text-xs text-muted-foreground">Source: {a.syndrome.source}. Patients are grouped by symptoms, not by an AI diagnosis.</p>
            {a.syndrome.note && <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">{a.syndrome.note}</p>}
            <div className="mt-3 grid grid-cols-5 gap-1 text-center text-xs">
              {a.ageBands.map((b) => (
                <div key={b.band}>
                  <div className="mx-auto flex h-14 w-full items-end justify-center"><div className="w-6 rounded-t bg-teal-600" style={{ height: `${(b.count / Math.max(1, ...a.ageBands.map((x) => x.count))) * 100}%` }} title={`${b.count} cases aged ${b.band}`} /></div>
                  <div className="tabular-nums">{b.count}</div><div className="text-muted-foreground">{b.band}</div>
                </div>
              ))}
            </div>
            <p className="mt-1 text-xs text-muted-foreground">By age · female {a.share.female} · male {a.share.male}</p>
          </div>

          <div className="rounded-2xl border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-base font-semibold"><FileWarning className="size-4 text-triage-red" /> Alert to the District Health Officer</h2>
              {!sitrep && (
                <Button onClick={draft} disabled={drafting} className="h-10 rounded-xl bg-teal-600 text-white hover:bg-teal-700">
                  {drafting ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />} Draft alert
                </Button>
              )}
            </div>
            {err && <p className="mt-2 text-sm text-triage-red">{err}</p>}
            {sitrep ? (
              <article className="mt-3 space-y-2 text-sm">
                <h3 className="text-lg font-bold">{sitrep.sitrep.headline}</h3>
                <p>{sitrep.sitrep.situation}</p>
                <ul className="list-disc pl-5">{sitrep.sitrep.recommended_actions.map((x) => <li key={x}>{x}</li>)}</ul>
                <p className="urdu rounded-lg bg-muted/60 px-3 text-base" dir="rtl">{sitrep.sitrep.urdu_summary}</p>
                <div className="flex items-center justify-between pt-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Sparkles className="size-3.5" /> {sitrep.generatedBy === "ai" ? "AI drafted from the computed numbers (every number checked)" : "Drafted from the computed numbers (template)"} · officer reviews before sending</span>
                  <Button variant="ghost" size="sm" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
                </div>
              </article>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">The numbers above are computed by fixed rules. The AI only writes them up as an alert, and is rejected if it adds any number that isn&apos;t in them.</p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: "alert" }) {
  return (
    <div className={cn("rounded-2xl border bg-card px-4 py-3 shadow-sm", tone === "alert" && "border-triage-red/60")}>
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className={cn("text-3xl font-bold tabular-nums", tone === "alert" && "text-triage-red")}>{value}</div>
      {sub && <div className="truncate text-sm text-muted-foreground">{sub}</div>}
    </div>
  );
}
