"use client";
import { Fragment, useEffect, useState } from "react";
import { ChevronRight, Download, RefreshCw, ScrollText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ACTOR_ICON } from "@/components/dashboard/activity-feed";
import { useHydrated } from "@/components/shell/app-shell";
import { cn } from "@/lib/utils";
import { useQueue } from "@/store/queue";
import type { ApiResult, AuditEntry } from "@/types/contracts";

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";
const ACTORS: AuditEntry["actor"][] = ["ai", "rules", "nurse", "doctor", "system"];
const ACTIONS: AuditEntry["action"][] = ["extract", "triage", "rx_read", "confirm", "override", "notify_er", "tts", "cache_hit", "fallback"];

const ACTION_STYLE: Partial<Record<AuditEntry["action"], string>> = {
  notify_er: "bg-triage-red/10 text-triage-red",
  override: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  cache_hit: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300",
  fallback: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-300",
  confirm: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300",
};

function Select<T extends string>({ value, onChange, options, label }: { value: T | "all"; onChange: (v: T | "all") => void; options: readonly T[]; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as T | "all")} className="h-10 rounded-xl border bg-background px-3 text-base">
        <option value="all">All</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

export default function AuditPage() {
  const hydrated = useHydrated();
  const local = useQueue((s) => s.audit);
  const patients = useQueue((s) => s.patients);
  const [server, setServer] = useState<AuditEntry[]>([]);
  const [reload, setReload] = useState(0);
  const [actor, setActor] = useState<AuditEntry["actor"] | "all">("all");
  const [action, setAction] = useState<AuditEntry["action"] | "all">("all");
  const [patient, setPatient] = useState<string>("all");
  const [open, setOpen] = useState<Set<string>>(new Set());

  // Real mode: AI / rules / cache / fallback events come from the server log; UI actions live in the store.
  useEffect(() => {
    if (USE_MOCK) return;
    let cancelled = false;
    fetch("/api/audit")
      .then((r) => r.json() as Promise<ApiResult<AuditEntry[]>>)
      .then((r) => { if (!cancelled && r.ok) setServer(r.data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [reload]);

  const tokenOf = (id?: string) => patients.find((p) => p.id === id)?.token;
  const seen = new Set<string>();
  const all = [...server, ...local]
    .filter((e) => (seen.has(e.id) ? false : (seen.add(e.id), true)))
    .sort((a, b) => b.ts.localeCompare(a.ts));
  const rows = all.filter((e) =>
    (actor === "all" || e.actor === actor) &&
    (action === "all" || e.action === action) &&
    (patient === "all" || e.patientId === patient));
  const patientIds = [...new Set(all.map((e) => e.patientId).filter(Boolean))] as string[];

  const download = () => {
    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `awaaz-audit-${new Date().toISOString().slice(0, 19).replace(/:/g, "")}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const toggle = (id: string) => setOpen((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  return (
    <main className="mx-auto w-full max-w-[1800px] flex-1 space-y-5 px-6 py-5">
      <header className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card px-5 py-4 shadow-sm">
        <div className="mr-auto">
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><ScrollText className="size-6 text-teal-600" /> Audit log</h1>
          <p className="text-muted-foreground">Every AI output, rule fired, cache hit, fallback, confirmation and override.</p>
        </div>
        <Select label="Actor" value={actor} onChange={setActor} options={ACTORS} />
        <Select label="Action" value={action} onChange={setAction} options={ACTIONS} />
        <label className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Patient</span>
          <select value={patient} onChange={(e) => setPatient(e.target.value)} className="h-10 rounded-xl border bg-background px-3 text-base">
            <option value="all">All</option>
            {patientIds.map((id) => <option key={id} value={id}>{tokenOf(id) ? `Token ${tokenOf(id)}` : id.slice(0, 10)}</option>)}
          </select>
        </label>
        {!USE_MOCK && <Button variant="outline" className="h-10 rounded-xl" onClick={() => setReload((n) => n + 1)}><RefreshCw className="size-4" /> Refresh</Button>}
        <Button className="h-10 rounded-xl bg-teal-600 text-white hover:bg-teal-700" onClick={download} disabled={!rows.length}><Download className="size-4" /> Download JSON</Button>
      </header>

      <section className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full text-left text-base">
          <thead className="border-b bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5">Time</th>
              <th className="px-3 py-2.5">Actor</th>
              <th className="px-3 py-2.5">Action</th>
              <th className="px-3 py-2.5">Patient</th>
              <th className="px-3 py-2.5">Model / prompt</th>
              <th className="px-3 py-2.5">Rules</th>
              <th className="px-3 py-2.5">Reason</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {!hydrated ? (
              [0, 1, 2].map((i) => <tr key={i}><td colSpan={8} className="p-3"><Skeleton className="h-8" /></td></tr>)
            ) : rows.length === 0 ? (
              <tr><td colSpan={8} className="p-12 text-center text-muted-foreground">No entries yet. Run a patient through Intake or the Doctor screen.</td></tr>
            ) : rows.map((e) => {
              const Icon = ACTOR_ICON[e.actor];
              const isOpen = open.has(e.id);
              return (
                <Fragment key={e.id}>
                  <tr onClick={() => toggle(e.id)} className="cursor-pointer hover:bg-muted/40">
                    <td className="px-3 py-2.5"><ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} /></td>
                    <td className="px-3 py-2.5 whitespace-nowrap tabular-nums">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</td>
                    <td className="px-3 py-2.5"><span className="flex items-center gap-2 capitalize"><Icon className="size-4 text-muted-foreground" />{e.actor}</span></td>
                    <td className="px-3 py-2.5">
                      <span className={cn("rounded-full bg-muted px-2.5 py-0.5 text-sm font-medium", ACTION_STYLE[e.action])}>{e.action}</span>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums">{tokenOf(e.patientId) ?? "—"}</td>
                    <td className="px-3 py-2.5 text-sm text-muted-foreground">{[e.model, e.promptVersion].filter(Boolean).join(" · ") || "—"}</td>
                    <td className="px-3 py-2.5 text-sm">{e.ruleIds?.join(", ") || "—"}</td>
                    <td className="max-w-80 truncate px-3 py-2.5 text-sm text-muted-foreground">{e.reason ?? ""}</td>
                  </tr>
                  {isOpen && (
                    <tr className="bg-muted/30">
                      <td />
                      <td colSpan={7} className="px-3 pb-4">
                        <pre className="max-h-80 overflow-auto rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-100">
                          {JSON.stringify(e, null, 2)}
                        </pre>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
