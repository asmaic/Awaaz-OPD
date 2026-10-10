"use client";
import { ArrowRight, Eye, ShieldAlert, ShieldCheck } from "lucide-react";
import { LEVEL_META } from "@/components/triage";
import { cn } from "@/lib/utils";
import { localDay, overrideEvents, reviewOverrides } from "@/lib/overrides";
import type { AuditEntry, Patient, TriageLevel } from "@/types/contracts";

const Lvl = ({ l }: { l: TriageLevel }) => {
  const m = LEVEL_META[l];
  const Icon = m.icon;
  return <span className={cn("inline-flex items-center gap-1 font-semibold", m.text)}><Icon className="size-3.5" />{m.label}</span>;
};

/** Public "Priority changes today": every override, who made it and why, with automatic flags. Nothing is hidden. */
export function TransparencyPanel({ audit, patients, now }: { audit: AuditEntry[]; patients: Patient[]; now: number }) {
  const today = now ? localDay(now) : null; // `now` is 0 until mounted
  const reviewed = reviewOverrides(overrideEvents(audit, patients)).filter((r) => !today || localDay(r.ts) === today).reverse();
  const flagged = reviewed.filter((r) => r.flags.length).length;

  return (
    <div className="rounded-md border bg-card">
      <div className="flex items-center justify-between gap-2 border-b px-4 py-2.5">
        <h2 className="register-label flex items-center gap-1.5"><Eye className="size-3.5 text-scrub" /> Priority changes today</h2>
        <span className={cn("rounded-[3px] px-1.5 py-0.5 font-mono text-[11px] tracking-wide uppercase", flagged ? "bg-amber-100 font-semibold text-amber-800 dark:bg-amber-950 dark:text-amber-300" : "bg-muted text-mute")}>
          {reviewed.length} change{reviewed.length === 1 ? "" : "s"}{flagged ? ` · ${flagged} flagged` : ""}
        </span>
      </div>
      <div className="p-3">
      {reviewed.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><ShieldCheck className="size-4 text-scrub" /> No overrides today. Queue order is exactly what the rules decided.</p>
      ) : (
        <ul className="max-h-72 space-y-2 overflow-y-auto">
          {reviewed.map((r) => (
            <li key={r.id} className={cn("rounded-md border p-2.5 text-sm", r.flags.some((f) => f.severity === "high") ? "border-triage-red/50 bg-triage-red/5" : r.flags.length ? "border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/30" : "")}>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold">{r.token ? `Token ${r.token}` : "Patient no longer in queue"}</span>
                <Lvl l={r.from} /><ArrowRight className="size-3.5 text-muted-foreground" /><Lvl l={r.to} />
                <span className="ml-auto text-xs text-muted-foreground tabular-nums">{new Date(r.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
              </div>
              <div className="mt-0.5 text-muted-foreground">
                <span className="font-medium text-foreground">{r.by}</span>: “{r.reason}” <span className="text-xs">(rules said {r.rulesLevel})</span>
              </div>
              {r.flags.map((f) => (
                <div key={f.code} className={cn("mt-1 flex items-start gap-1.5 text-xs font-medium", f.severity === "high" ? "text-triage-red" : "text-amber-700 dark:text-amber-400")}>
                  <ShieldAlert className="mt-px size-3.5 shrink-0" /> {f.message}
                </div>
              ))}
            </li>
          ))}
        </ul>
      )}
      </div>
    </div>
  );
}
