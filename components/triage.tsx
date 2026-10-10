import { AlertOctagon, AlertTriangle, CircleAlert, CircleCheck, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { RuleHit, TriageLevel } from "@/types/contracts";

export const LEVEL_META: Record<TriageLevel, { label: string; hint: string; icon: LucideIcon; hex: string; bg: string; text: string; soft: string; ring: string; border: string }> = {
  RED: { label: "Red", hint: "Immediate", icon: AlertOctagon, hex: "#DC2626", bg: "bg-triage-red", text: "text-triage-red", soft: "bg-triage-red/10", ring: "ring-triage-red", border: "border-triage-red" },
  ORANGE: { label: "Orange", hint: "Very urgent", icon: AlertTriangle, hex: "#EA580C", bg: "bg-triage-orange", text: "text-triage-orange", soft: "bg-triage-orange/10", ring: "ring-triage-orange", border: "border-triage-orange" },
  YELLOW: { label: "Yellow", hint: "Urgent", icon: CircleAlert, hex: "#CA8A04", bg: "bg-triage-yellow", text: "text-triage-yellow", soft: "bg-triage-yellow/10", ring: "ring-triage-yellow", border: "border-triage-yellow" },
  GREEN: { label: "Green", hint: "Standard", icon: CircleCheck, hex: "#16A34A", bg: "bg-triage-green", text: "text-triage-green", soft: "bg-triage-green/10", ring: "ring-triage-green", border: "border-triage-green" },
};

/** Colour + icon + text label, always together. */
export function TriageBadge({ level, size = "md", className }: { level: TriageLevel; size?: "sm" | "md" | "xl"; className?: string }) {
  const m = LEVEL_META[level];
  const Icon = m.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[3px] font-semibold text-white uppercase",
        m.bg,
        size === "sm" && "px-1.5 py-0.5 font-mono text-[11px] tracking-[0.1em]",
        size === "md" && "px-2 py-1 font-mono text-xs tracking-[0.12em]",
        size === "xl" && "signage gap-3 px-5 py-3 text-5xl font-extrabold",
        className,
      )}
    >
      <Icon className={cn(size === "xl" ? "size-9" : size === "md" ? "size-3.5" : "size-3")} aria-hidden />
      {m.label}
      {size === "xl" && <span className="font-sans text-xl font-semibold tracking-normal normal-case opacity-90">{m.hint}</span>}
    </span>
  );
}

/** Lists every rule that fired with its "why" and source. */
export function RuleExplainer({ hits, escalated, className }: { hits: RuleHit[]; escalated?: boolean; className?: string }) {
  return (
    <ul className={cn("divide-y border-y", className)}>
      {hits.map((h) => {
        const m = LEVEL_META[h.level];
        const Icon = m.icon;
        return (
          <li key={h.id} className="grid grid-cols-[auto_1fr] gap-x-3 py-3">
            <span className={cn("mt-0.5 inline-flex h-6 items-center gap-1 rounded-[3px] border px-1.5 font-mono text-xs font-semibold", m.text, m.border)}>
              <Icon className="size-3" aria-hidden />{h.id}
            </span>
            <div className="min-w-0">
              <div className="font-semibold">{h.title}</div>
              <div className="text-muted-foreground">{h.why}</div>
              <div className="mt-1 font-mono text-[11px] tracking-wide text-mute uppercase">{h.source}</div>
            </div>
          </li>
        );
      })}
      {escalated && (
        <li className="grid grid-cols-[auto_1fr] gap-x-3 py-3 text-sm">
          <span className="mt-0.5 inline-flex h-6 items-center gap-1 rounded-[3px] border border-dashed px-1.5 font-mono text-xs font-semibold">
            <AlertTriangle className="size-3" aria-hidden />R20
          </span>
          <div>
            <span className="font-semibold">Escalated for uncertainty</span>
            <div className="text-muted-foreground">Low confidence or missing info — level raised one step. Missing data never lowers a level.</div>
          </div>
        </li>
      )}
    </ul>
  );
}

export const prettySymptom = (s: string) => s.replaceAll("_", " ");
