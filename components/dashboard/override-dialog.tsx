"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEVEL_META } from "@/components/triage";
import { cn } from "@/lib/utils";
import { effectiveLevel, useQueue } from "@/store/queue";
import { TRIAGE_LEVELS, type Patient, type TriageLevel } from "@/types/contracts";
import { ShieldAlert } from "lucide-react";
import { flagsFor } from "@/lib/overrides";

/** Clinician override of the rules engine's level. A reason is mandatory and goes to the audit log. */
export function OverrideDialog({ patient, onClose }: { patient: Patient | null; onClose: () => void }) {
  const override = useQueue((s) => s.override);
  const [level, setLevel] = useState<TriageLevel | null>(null);
  const [reason, setReason] = useState("");
  const [by, setBy] = useState("");
  const current = patient ? effectiveLevel(patient) : null;
  const chosen = level ?? current;
  const valid = !!patient && !!chosen && chosen !== current && reason.trim().length >= 5 && by.trim().length >= 2;
  // Preview what the public "Priority changes" panel will flag, before saving (nothing is blocked).
  const flags = patient && chosen && current && chosen !== current && reason.trim()
    ? flagsFor({ id: "", ts: "", patientId: patient.id, by, from: current, to: chosen, rulesLevel: patient.triage.level, reason })
    : [];

  const close = () => { setLevel(null); setReason(""); onClose(); };

  return (
    <Dialog open={!!patient} onOpenChange={(o) => !o && close()}>
      <DialogContent className="rounded-lg p-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-xl">Override triage · Token {patient?.token}</DialogTitle>
          <DialogDescription className="text-base">
            Rules said <b>{patient?.triage.level}</b>. Your override and reason are recorded in the audit log.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-4 gap-2">
          {TRIAGE_LEVELS.map((l) => {
            const m = LEVEL_META[l];
            const Icon = m.icon;
            return (
              <button
                key={l}
                type="button"
                onClick={() => setLevel(l)}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md border-2 p-3 text-sm font-semibold transition-all",
                  chosen === l ? cn(m.bg, "border-transparent text-white shadow-md") : "hover:bg-muted",
                )}
              >
                <Icon className={cn("size-5", chosen !== l && m.text)} />
                {m.label}
              </button>
            );
          })}
        </div>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Reason (required)</span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. Patient looks pale and drowsy on re-assessment"
            className="rounded-md border bg-background p-3 text-base outline-none focus:ring-3 focus:ring-scrub/30"
          />
        </label>
        <label className="grid gap-1.5">
          <span className="text-sm font-medium">Your name (required, shown publicly)</span>
          <input
            value={by}
            onChange={(e) => setBy(e.target.value)}
            placeholder="e.g. Nurse Ayesha or Dr. Bilal"
            className="h-11 rounded-md border bg-background px-3 text-base outline-none focus:ring-3 focus:ring-scrub/30"
          />
        </label>
        {flags.length > 0 && (
          <div role="status" className="flex gap-2 rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
            <ShieldAlert className="mt-0.5 size-4 shrink-0" />
            <div>
              <div className="font-semibold">This change will be flagged on the public “Priority changes” panel:</div>
              <ul className="list-disc pl-4">{flags.map((f) => <li key={f.code}>{f.message}</li>)}</ul>
            </div>
          </div>
        )}
        <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl p-4">
          <Button variant="outline" className="h-10 rounded-md" onClick={close}>Cancel</Button>
          <Button
            className="h-10 rounded-md bg-scrub text-white hover:bg-scrub-deep"
            disabled={!valid}
            onClick={() => { if (patient && chosen) { override(patient.id, chosen, reason, by.trim()); close(); } }}
          >
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
