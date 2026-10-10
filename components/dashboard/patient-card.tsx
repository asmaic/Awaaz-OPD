"use client";
import { forwardRef } from "react";
import { motion } from "motion/react";
import { Ambulance, Check, Clock, Hand, PhoneCall, Siren, Stethoscope } from "lucide-react";
import { LEVEL_META, TriageBadge } from "@/components/triage";
import { cn } from "@/lib/utils";
import { effectiveLevel } from "@/store/queue";
import type { Patient } from "@/types/contracts";

const ageSex = (p: Patient) => {
  const a = p.extraction.age_years;
  const age = a === undefined ? "?" : a < 1 ? `${Math.round(a * 12)}mo` : `${a}y`;
  return `${age} · ${p.extraction.sex ?? "?"}`;
};

const firstClause = (ur: string) => ur.split(/[۔،.]/)[0];

type Props = {
  patient: Patient;
  fresh: boolean;
  onCallIn: () => void;
  onDone: () => void;
  onSendER: () => void;
  onOverride: () => void;
};

export const PatientCard = forwardRef<HTMLLIElement, Props>(function PatientCard({ patient: p, fresh, onCallIn, onDone, onSendER, onOverride }, ref) {
  const level = effectiveLevel(p);
  const m = LEVEL_META[level];
  const top = p.triage.hits[0];
  const withDoc = p.status === "with_doctor";

  return (
    <motion.li
      ref={ref}
      layout
      initial={{ opacity: 0, y: -24, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, transition: { duration: 0.25 } }}
      transition={{ type: "spring", stiffness: 500, damping: 40 }}
      className={cn(
        "relative flex items-stretch overflow-hidden rounded-2xl border bg-card shadow-sm",
        withDoc && "opacity-75",
      )}
    >
      {fresh && level === "RED" && <span className="pointer-events-none absolute inset-0 z-10 animate-pulse rounded-2xl ring-4 ring-triage-red ring-inset" />}
      <div className={cn("flex w-24 shrink-0 flex-col items-center justify-center gap-0.5 text-white", m.bg)}>
        <span className="text-xs font-medium tracking-widest uppercase opacity-80">Token</span>
        <span className="text-4xl leading-none font-bold tabular-nums">{p.token}</span>
      </div>

      <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xl font-semibold">{p.name}</span>
          <span className="shrink-0 text-base text-muted-foreground">{ageSex(p)}</span>
        </div>
        <div className="flex items-center justify-end gap-2">
          {p.override && <span className="rounded-full border border-dashed px-2 py-0.5 text-xs font-medium" title={p.override.reason}>overridden</span>}
          <TriageBadge level={level} />
        </div>

        <div className="min-w-0">
          <div className="truncate text-base">{p.extraction.chief_complaint}</div>
          <div className="urdu truncate text-base leading-[2] text-muted-foreground" dir="rtl">{firstClause(p.extraction.transcript_ur)}</div>
        </div>
        <div className="flex flex-col items-end justify-center gap-1 text-sm">
          {top && <span className="text-muted-foreground" title={top.why}>{top.id} · {top.title}</span>}
          <span className="flex items-center gap-1 font-medium">
            {withDoc ? <><Stethoscope className="size-4 text-teal-600" /> With doctor</> : <><Clock className="size-4" /> est. {p.estWaitMin} min</>}
          </span>
          {p.erNotifiedAt && <span className="flex items-center gap-1 font-medium text-triage-red"><Siren className="size-4" /> ER notified</span>}
        </div>
      </div>

      <div className="flex w-36 shrink-0 flex-col justify-center gap-1.5 border-l bg-muted/30 p-2">
        {withDoc ? (
          <CardAction icon={Check} label="Done" onClick={onDone} />
        ) : (
          <CardAction icon={PhoneCall} label="Call in" onClick={onCallIn} primary />
        )}
        <CardAction icon={Ambulance} label="Send to ER" onClick={onSendER} danger />
        <CardAction icon={Hand} label="Override" onClick={onOverride} />
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
        "flex h-8 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors",
        primary ? "bg-teal-600 text-white hover:bg-teal-700" : danger ? "text-triage-red hover:bg-triage-red/10" : "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      <Icon className="size-4" /> {label}
    </button>
  );
}
