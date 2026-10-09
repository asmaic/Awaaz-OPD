"use client";
import { useCallback, useState } from "react";
import { motion } from "motion/react";
import { Building2, ClipboardList, Cpu, Languages, MapPin, Plus, Scale, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Typewriter } from "@/components/intake/typewriter";
import { LEVEL_META, RuleExplainer, TriageBadge, prettySymptom } from "@/components/triage";
import { cn } from "@/lib/utils";
import type { ApiResult, ExtractRes } from "@/types/contracts";

type Meta = Extract<ApiResult<ExtractRes>, { ok: true }>["meta"];

const fade = (delay: number) => ({ initial: { opacity: 0, y: 12 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.3, delay } });

export function IntakeResult({ res, meta, onAdd, onReset }: { res: ExtractRes; meta: Meta; onAdd: (name: string) => void; onReset: () => void }) {
  const { extraction: e, triage: t } = res;
  const [typed, setTyped] = useState(false);
  const [name, setName] = useState("");
  const onTyped = useCallback(() => setTyped(true), []);
  const m = LEVEL_META[t.level];

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1fr]">
      {/* What the patient said */}
      <section className="space-y-5 rounded-2xl border bg-card p-6 shadow-sm">
        <header className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Languages className="size-5 text-teal-600" /> What the patient said</h2>
          <span className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
            <Cpu className="size-3.5" /> {meta.model ?? "model"} · {meta.cached ? "cached" : `${meta.ms} ms`}{meta.fallback ? ` · fallback: ${meta.fallback}` : ""}
          </span>
        </header>
        <Typewriter key={e.transcript_ur} text={e.transcript_ur} onDone={onTyped} className="urdu min-h-20 text-[1.7rem] text-foreground" />
        {typed && (
          <>
            <motion.p {...fade(0)} className="border-l-4 border-teal-600/40 pl-4 text-lg text-muted-foreground italic">
              “{e.translation_en}”
            </motion.p>
            <motion.div {...fade(0.1)} className="flex flex-wrap gap-2">
              {e.symptoms.map((s) => (
                <span key={s} className="rounded-full border bg-background px-3 py-1 text-sm font-medium capitalize">{prettySymptom(s)}</span>
              ))}
              {e.duration_days !== undefined && <span className="rounded-full bg-muted px-3 py-1 text-sm">{e.duration_days} days</span>}
              {e.locality && <span className="flex items-center gap-1 rounded-full bg-muted px-3 py-1 text-sm"><MapPin className="size-3.5" />{e.locality}</span>}
              {Object.entries(e.vitals).map(([k, v]) => (
                <span key={k} className="rounded-full bg-muted px-3 py-1 font-mono text-sm">{k} {v}</span>
              ))}
            </motion.div>
            {e.missing_info.length > 0 && (
              <motion.div {...fade(0.2)} className="rounded-xl bg-amber-50 p-4 dark:bg-amber-950/40">
                <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-amber-800 dark:text-amber-300">
                  <ClipboardList className="size-4" /> Nurse, please ask:
                </div>
                <div className="flex flex-wrap gap-2">
                  {e.missing_info.map((q) => (
                    <span key={q} className="rounded-full border border-amber-300 bg-white px-3 py-1 text-sm dark:border-amber-800 dark:bg-transparent">{q}</span>
                  ))}
                </div>
              </motion.div>
            )}
          </>
        )}
      </section>

      {/* Triage card */}
      {typed && (
        <motion.section
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 30, delay: 0.3 }}
          className={cn("flex flex-col gap-5 rounded-2xl border-2 bg-card p-6 shadow-lg", m.border)}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TriageBadge level={t.level} size="xl" />
            <span className="flex items-center gap-1.5 rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
              <Scale className="size-3.5" /> AI extracted · rules decided
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3 text-base">
            <div className="rounded-xl bg-muted/60 p-3">
              <div className="text-xs text-muted-foreground uppercase">Department</div>
              <div className="flex items-center gap-2 font-semibold"><Building2 className="size-4" />{e.suggested_department}</div>
            </div>
            <div className="rounded-xl bg-muted/60 p-3">
              <div className="text-xs text-muted-foreground uppercase">Patient</div>
              <div className="font-semibold">{e.age_years !== undefined ? `${e.age_years < 1 ? `${Math.round(e.age_years * 12)} mo` : `${e.age_years} y`}` : "age ?"} · {e.sex ?? "?"}</div>
            </div>
          </div>
          <div>
            <div className="mb-2 text-sm font-semibold text-muted-foreground">Why this level ({t.rulesVersion})</div>
            <RuleExplainer hits={t.hits} escalated={t.escalatedForUncertainty} />
          </div>
          <form
            className="mt-auto flex gap-3"
            onSubmit={(ev) => { ev.preventDefault(); onAdd(name); }}
          >
            <label className="relative flex-1">
              <User className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={name}
                onChange={(ev) => setName(ev.target.value)}
                placeholder="Patient name (optional)"
                className="h-12 w-full rounded-xl border bg-background pr-3 pl-9 text-base outline-none focus:ring-3 focus:ring-teal-600/30"
              />
            </label>
            <Button type="submit" className="h-12 rounded-xl bg-teal-600 px-5 text-base text-white hover:bg-teal-700">
              <Plus className="size-5" /> Add to queue
            </Button>
          </form>
          <button type="button" onClick={onReset} className="self-start text-sm text-muted-foreground underline-offset-4 hover:underline">
            Discard and start over
          </button>
        </motion.section>
      )}
    </div>
  );
}
