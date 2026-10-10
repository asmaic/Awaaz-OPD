"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LEVEL_META } from "@/components/triage";
import { cn } from "@/lib/utils";
import { effectiveLevel, useQueue } from "@/store/queue";
import { TRIAGE_LEVELS, type Patient, type TriageLevel } from "@/types/contracts";

/** Clinician override of the rules engine's level. A reason is mandatory and goes to the audit log. */
export function OverrideDialog({ patient, onClose }: { patient: Patient | null; onClose: () => void }) {
  const override = useQueue((s) => s.override);
  const [level, setLevel] = useState<TriageLevel | null>(null);
  const [reason, setReason] = useState("");
  const current = patient ? effectiveLevel(patient) : null;
  const chosen = level ?? current;
  const valid = !!patient && !!chosen && chosen !== current && reason.trim().length >= 5;

  const close = () => { setLevel(null); setReason(""); onClose(); };

  return (
    <Dialog open={!!patient} onOpenChange={(o) => !o && close()}>
      <DialogContent className="rounded-2xl p-6 sm:max-w-lg">
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
                  "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-sm font-semibold transition-all",
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
            className="rounded-xl border bg-background p-3 text-base outline-none focus:ring-3 focus:ring-teal-600/30"
          />
        </label>
        <DialogFooter className="-mx-6 -mb-6 rounded-b-2xl p-4">
          <Button variant="outline" className="h-10 rounded-xl" onClick={close}>Cancel</Button>
          <Button
            className="h-10 rounded-xl bg-teal-600 text-white hover:bg-teal-700"
            disabled={!valid}
            onClick={() => { if (patient && chosen) { override(patient.id, chosen, reason); close(); } }}
          >
            Save override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
