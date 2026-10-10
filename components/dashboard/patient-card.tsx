"use client";
import { forwardRef } from "react";
import { motion } from "motion/react";
import { Ambulance, Check, Clock, Hand, Hospital, PhoneCall, Siren, Stethoscope } from "lucide-react";
import { tokenCode } from "@/lib/overrides";
import { LEVEL_META, ageSexLabel } from "@/components/triage";
import { cn } from "@/lib/utils";
import { effectiveLevel } from "@/store/queue";
import type { Patient } from "@/types/contracts";


/** The first clause that carries the complaint: skips short openers like "ڈاکٹر صاحب" (Doctor sahab) and "… سے آیا ہوں" (I've come from …). */
const firstClause = (ur: string) => {
  const parts = ur.split(/[۔،.؟?!]/).map((s) => s.trim()).filter(Boolean);
  return parts.find((s) => s.split(/\s+/).length >= 3 && !/(آیا|آئی) ہوں/.test(s)) ?? parts[0] ?? "";
};

type Props = {
  patient: Patient;
  fresh: boolean;
  onCallIn: () => void;
  onDone: () => void;
  onSendER: () => void;
  onOverride: () => void;
  onRefer?: () => void;
};

export const PatientCard = forwardRef<HTMLLIElement, Props>(function PatientCard({ patient: p, fresh, onCallIn, onDone, onSendER, onOverride, onRefer }, ref) {
  const level = effectiveLevel(p);
  const m = LEVEL_META[level];
  const top = p.triage.hits[0];
  const withDoc = p.status === "with_doctor";

  const Icon = m.icon;

  // A paper triage tag: punched stub with the token, the patient's details, and a coloured tear-off strip.
  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: -24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={cn("relative flex items-stretch overflow-hidden rounded-md border bg-card", withDoc && "opacity-70")}
    >
      {fresh && level === "RED" && <span className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-md ring-4 ring-triage-red ring-inset" />}

      {/* Stub: the punched end of the tag */}
      <div className="relative flex w-28 shrink-0 flex-col justify-center pr-3 pl-7">
        <span aria-hidden className="absolute top-1/2 left-2.5 size-3 -translate-y-1/2 rounded-full border bg-background" />
        <span className="register-label">Token</span>
        <span className="signage text-6xl font-extrabold tabular-nums">{p.token}</span>
        <span className="font-mono text-[11px] tracking-wider text-mute" title="Check code printed on the token slip">#{tokenCode(p)}</span>
      </div>
      <span aria-hidden className="perforation w-[2px] shrink-0" />

      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-5 px-5 py-3">
        <div className="min-w-0 space-y-0.5">
          <div className="flex min-w-0 items-baseline gap-2">
            <span className="truncate text-xl font-bold">{p.name}</span>
            {ageSexLabel(p.extraction) && <span className="shrink-0 font-mono text-sm text-mute">{ageSexLabel(p.extraction)}</span>}
            {p.override && <span className="shrink-0 rounded-[3px] border border-dashed px-1.5 font-mono text-[11px] tracking-wide uppercase" title={p.override.reason}>Overridden</span>}
          </div>
          <div className="truncate text-base">{p.extraction.chief_complaint}</div>
          <div className="urdu truncate text-base leading-[2] text-mute" dir="rtl">{firstClause(p.extraction.transcript_ur)}</div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pt-0.5 text-sm">
            {top && <span className="font-mono text-xs text-mute" title={top.why}>{top.id} · {top.title}</span>}
            <span className="flex items-center gap-1 font-semibold">
              {withDoc ? <><Stethoscope className="size-4 text-scrub" /> With doctor</> : <><Clock className="size-4 text-mute" /> {p.estWaitMin === 0 ? "Next" : `est. ${p.estWaitMin} min`}</>}
            </span>
            {p.erNotifiedAt && <span className="flex items-center gap-1 font-semibold text-triage-red"><Siren className="size-4" /> ER notified</span>}
          </div>
        </div>
        <div className="flex w-32 flex-col justify-center gap-1">
          {withDoc ? <CardAction icon={Check} label="Done" onClick={onDone} primary /> : <CardAction icon={PhoneCall} label="Call in" onClick={onCallIn} primary />}
          <CardAction icon={Ambulance} label="Send to ER" onClick={onSendER} danger />
          {onRefer && (level === "RED" || level === "ORANGE") && <CardAction icon={Hospital} label="Transfer?" onClick={onRefer} />}
          <CardAction icon={Hand} label="Override" onClick={onOverride} />
        </div>
      </div>

      {/* Tear-off strip: the triage colour, with icon and word so colour never speaks alone */}
      <span aria-hidden className="perforation w-[2px] shrink-0" />
      <div className={cn("flex w-14 shrink-0 flex-col items-center justify-center gap-2 text-white", m.bg)} aria-label={`${m.label}, ${m.hint}`}>
        <Icon className="size-5" />
        <span className="signage text-2xl font-extrabold tracking-wider uppercase [writing-mode:vertical-rl] rotate-180">{m.label}</span>
      </div>
    </motion.li>
  );
});

function CardAction({ icon: Icon, label, onClick, primary, danger }: { icon: typeof Check; label: string; onClick: () => void; primary?: boolean; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-7 items-center gap-2 rounded-[3px] px-2 text-sm font-semibold transition-colors",
        primary ? "bg-scrub text-primary-foreground hover:bg-scrub-deep" : danger ? "text-triage-red hover:bg-triage-red/10" : "text-mute hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}
