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
        "inline-flex items-center gap-1.5 rounded-full font-semibold tracking-wide text-white uppercase shadow-sm",
        m.bg,
        size === "sm" && "px-2 py-0.5 text-xs",
        size === "md" && "px-3 py-1 text-sm",
        size === "xl" && "gap-3 px-6 py-3 text-3xl",
        className,
      )}
    >
      <Icon className={cn(size === "xl" ? "size-8" : size === "md" ? "size-4" : "size-3.5")} aria-hidden />
      {m.label}
      {size === "xl" && <span className="text-xl font-medium normal-case opacity-90">· {m.hint}</span>}
    </span>
  );
}

/** Lists every rule that fired with its "why" and source. */
export function RuleExplainer({ hits, escalated, className }: { hits: RuleHit[]; escalated?: boolean; className?: string }) {
  return (
    <ul className={cn("space-y-2", className)}>
      {hits.map((h) => {
        const m = LEVEL_META[h.level];
        const Icon = m.icon;
        return (
          <li key={h.id} className={cn("flex gap-3 rounded-xl border-l-4 bg-muted/50 p-3", m.border)}>
            <Icon className={cn("mt-0.5 size-5 shrink-0", m.text)} aria-hidden />
            <div className="min-w-0">
              <div className="font-semibold">
                <span className="font-mono">{h.id}</span> · {h.title}
              </div>
              <div className="text-muted-foreground">{h.why}</div>
              <div className="mt-0.5 text-xs text-muted-foreground/80">Source: {h.source}</div>
            </div>
          </li>
        );
      })}
      {escalated && (
        <li className="flex gap-3 rounded-xl border-l-4 border-dashed border-foreground/30 bg-muted/50 p-3 text-sm">
          <AlertTriangle className="mt-0.5 size-5 shrink-0" aria-hidden />
          <div>
            <span className="font-semibold">R20 · Escalated for uncertainty</span>
            <div className="text-muted-foreground">Low confidence or missing info — level raised one step. Missing data never lowers a level.</div>
          </div>
        </li>
      )}
    </ul>
  );
}

export const prettySymptom = (s: string) => s.replaceAll("_", " ");
