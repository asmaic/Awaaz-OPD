"use client";
import { useState } from "react";
import { ArrowRight, Check, OctagonAlert, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Interaction, RxField, RxItem } from "@/types/contracts";

export type FieldKey = "drug_raw" | "strength" | "frequency" | "duration";
export const FIELDS: { key: FieldKey; label: string }[] = [
  { key: "strength", label: "Strength" },
  { key: "frequency", label: "Frequency" },
  { key: "duration", label: "Duration" },
];

export const UNCLEAR = "[UNCLEAR]";
export const needsReview = (f: RxField<string>) => f.value === UNCLEAR || f.confidence < 0.6;

function ConfChip({ c }: { c: number }) {
  const pct = Math.round(c * 100);
  return (
    <span
      title="Model confidence"
      className={cn(
        "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
        c >= 0.8 ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : c >= 0.6 ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
          : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      )}
    >
      {pct}%
    </span>
  );
}

/** One editable field. Flagged fields (UNCLEAR or < 60 %) are amber until the doctor edits or confirms them. */
function FieldCell({ field, resolved, onChange, onResolve }: { field: RxField<string>; resolved: boolean; onChange: (v: string) => void; onResolve: () => void }) {
  const flagged = needsReview(field) && !resolved;
  const [draft, setDraft] = useState(field.value === UNCLEAR ? "" : field.value);
  const canConfirm = draft.trim().length > 0;

  return (
    <div className="flex flex-col gap-1">
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg border px-2 transition-colors",
          flagged ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300/50 dark:bg-amber-950/40" : "border-transparent bg-transparent hover:border-border",
        )}
      >
        <input
          value={draft}
          placeholder={field.value === UNCLEAR ? "[UNCLEAR] — type it" : ""}
          onChange={(e) => { setDraft(e.target.value); onChange(e.target.value); }}
          onKeyDown={(e) => { if (e.key === "Enter" && flagged && canConfirm) onResolve(); }}
          className={cn("h-9 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-amber-700/70", flagged && "font-medium")}
        />
        {flagged && (
          <button
            type="button"
            disabled={!canConfirm}
            onClick={onResolve}
            title="Confirm this value"
            className="grid size-7 shrink-0 place-items-center rounded-md bg-amber-500 text-white disabled:opacity-30"
          >
            <Check className="size-4" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5 pl-2">
        {resolved ? <span className="text-[11px] font-semibold text-scrub">✓ doctor-confirmed</span> : <ConfChip c={field.confidence} />}
      </div>
    </div>
  );
}

export function InteractionBanners({ interactions }: { interactions: Interaction[] }) {
  if (!interactions.length) return null;
  return (
    <div className="space-y-2">
      {interactions.map((x) => {
        const major = x.severity === "major";
        const Icon = major ? OctagonAlert : TriangleAlert;
        return (
          <div
            key={x.pair.join("+")}
            role="alert"
            className={cn(
              "flex gap-3 rounded-md border-l-4 p-4",
              major ? "border-triage-red bg-triage-red/10" : "border-amber-500 bg-amber-50 dark:bg-amber-950/40",
            )}
          >
            <Icon className={cn("mt-0.5 size-5 shrink-0", major ? "text-triage-red" : "text-amber-600")} />
            <div>
              <div className="font-semibold capitalize">
                {major ? "Major" : "Moderate"} interaction · {x.pair[0]} + {x.pair[1]}
              </div>
              <div className="text-muted-foreground">{x.note}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function RxTable({
  items, resolved, onField, onResolve,
}: {
  items: RxItem[];
  resolved: Set<string>;
  onField: (i: number, k: FieldKey, v: string) => void;
  onResolve: (i: number, k: FieldKey) => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border">
      <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr] gap-3 border-b bg-muted/50 px-4 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        <span>Drug as written → generic</span>
        {FIELDS.map((f) => <span key={f.key}>{f.label}</span>)}
      </div>
      <ul className="divide-y">
        {items.map((it, i) => (
          <li key={i} className="grid grid-cols-[1.5fr_1fr_1fr_1fr] items-start gap-3 px-4 py-3">
            <div className="min-w-0">
              <FieldCell
                field={it.drug_raw}
                resolved={resolved.has(`${i}.drug_raw`)}
                onChange={(v) => onField(i, "drug_raw", v)}
                onResolve={() => onResolve(i, "drug_raw")}
              />
              <div className="mt-1 flex flex-wrap items-center gap-1 pl-2 text-sm text-muted-foreground">
                {it.brand_match ? <span className="font-medium text-foreground">{it.brand_match}</span> : <span className="italic">no brand match</span>}
                <ArrowRight className="size-3.5" />
                <span className="rounded bg-scrub-tint px-1.5 font-medium text-scrub">{it.generic ?? "unknown generic"}</span>
              </div>
            </div>
            {FIELDS.map((f) => (
              <FieldCell
                key={f.key}
                field={it[f.key]}
                resolved={resolved.has(`${i}.${f.key}`)}
                onChange={(v) => onField(i, f.key, v)}
                onResolve={() => onResolve(i, f.key)}
              />
            ))}
          </li>
        ))}
      </ul>
    </div>
  );
}
