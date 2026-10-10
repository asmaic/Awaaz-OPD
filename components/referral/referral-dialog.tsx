"use client";
import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { Ban, Check, Clock, Hospital, Loader2, PhoneCall, Route, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { TriageBadge } from "@/components/triage";
import { HandoverLetter } from "@/components/referral/handover-letter";
import { api } from "@/lib/mock";
import { planReferral } from "@/lib/referral";
import { cn } from "@/lib/utils";
import { effectiveLevel, useQueue } from "@/store/queue";
import type { Patient, Prescription } from "@/types/contracts";
import { CAPABILITY_LABEL, type FacilityStatus, type HandoverRes } from "@/types/features";

const ReferralMap = dynamic(() => import("@/components/referral/referral-map"), { ssr: false, loading: () => <Skeleton className="size-full rounded-none" /> });

/** "Where should this patient go?" — live facility board, rules-based pick, route, and a one-tap call-ahead handover letter. */
export function ReferralDialog({ patient, prescription, onClose }: { patient: Patient | null; prescription?: Prescription; onClose: () => void }) {
  const log = useQueue((s) => s.log);
  const [facilities, setFacilities] = useState<FacilityStatus[] | null>(null);
  const [asOf, setAsOf] = useState("");
  const [note, setNote] = useState<HandoverRes | null>(null);
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState("");
  const open = !!patient;

  // Poll the (simulated) live board while open.
  useEffect(() => {
    if (!open) return;
    let alive = true;
    const load = async () => {
      const r = await api.facilities();
      if (!alive) return;
      if (r.ok) { setFacilities(r.data.facilities); setAsOf(r.data.asOf); } else setError(r.error);
    };
    void load();
    const id = setInterval(load, 30_000);
    return () => { alive = false; clearInterval(id); };
  }, [open]);

  const plan = useMemo(() => (patient && facilities ? planReferral(patient, facilities) : null), [patient, facilities]);
  const close = () => { setNote(null); setError(""); onClose(); };

  async function callAhead() {
    if (!patient || !plan?.best) return;
    setWriting(true);
    setError("");
    const facility = plan.best.facility.name;
    const needs = plan.needs.filter((n) => n.capability !== "er").map((n) => CAPABILITY_LABEL[n.capability].toLowerCase());
    const r = await api.handover({ patient, prescription, referral: { facility, needs } });
    setWriting(false);
    if (!r.ok) { setError(r.error); return; }
    setNote(r.data);
    log({ actor: "nurse", action: "notify_er", patientId: patient.id, reason: `Call-ahead handover to ${facility}`,
      payload: { facility, why: plan.best.why, generatedBy: r.data.generatedBy } });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto rounded-2xl p-6 sm:max-w-6xl">
        <DialogHeader>
          <DialogTitle className="flex flex-wrap items-center gap-3 text-xl">
            <Hospital className="size-6 text-teal-600" /> Where should Token {patient?.token} go?
            {patient && <TriageBadge level={effectiveLevel(patient)} size="sm" />}
          </DialogTitle>
          <DialogDescription className="text-base">
            Rules pick the facility from capability, travel time, ER load and free beds. Facility status is <b>simulated</b> for the demo
            {asOf && ` · updated ${new Date(asOf).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}.
          </DialogDescription>
        </DialogHeader>

        {!plan ? (
          error ? <p className="text-triage-red">{error}</p> : <div className="grid gap-3"><Skeleton className="h-24 rounded-xl" /><Skeleton className="h-64 rounded-xl" /></div>
        ) : note && patient ? (
          <HandoverLetter patient={patient} note={note} facility={plan.best?.facility.name} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-sm">
                <span className="text-muted-foreground">Needs:</span>
                {plan.needs.map((n) => (
                  <span key={n.capability} className="rounded-full bg-muted px-2.5 py-0.5 font-medium" title={n.because}>{CAPABILITY_LABEL[n.capability]}</span>
                ))}
                <span className="text-muted-foreground">· from {plan.origin.label}{plan.origin.isPatientLocality ? "" : " (this OPD)"}</span>
              </div>

              {plan.best ? (
                <div className="rounded-2xl border-2 border-teal-600 bg-teal-50 p-4 dark:bg-teal-950/40">
                  <div className="text-xs font-semibold tracking-widest text-teal-700 uppercase dark:text-teal-400">Recommended</div>
                  <div className="text-2xl font-bold">Send to {plan.best.facility.name}</div>
                  <div className="mt-1 text-base">{plan.best.why}</div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Button onClick={callAhead} disabled={writing} className="h-11 rounded-xl bg-teal-600 px-4 text-base text-white hover:bg-teal-700">
                      {writing ? <Loader2 className="size-5 animate-spin" /> : <PhoneCall className="size-5" />} Call ahead + handover note
                    </Button>
                    {error && <span className="text-sm text-triage-red">{error}</span>}
                  </div>
                </div>
              ) : (
                <div className="flex gap-2 rounded-2xl border-2 border-triage-red bg-triage-red/5 p-4">
                  <TriangleAlert className="size-5 shrink-0 text-triage-red" />
                  <div>No facility offers every capability this patient needs. Stabilise here and escalate to the on-call consultant.</div>
                </div>
              )}

              <div className="overflow-hidden rounded-xl border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs tracking-wide text-muted-foreground uppercase">
                    <tr><th className="px-3 py-2 text-left">Facility</th><th className="px-2 text-left">Capability</th><th className="px-2 text-left">ER load</th><th className="px-2">Beds</th><th className="px-3 text-right">Travel</th></tr>
                  </thead>
                  <tbody className="divide-y">
                    {plan.options.map((o) => {
                      const ok = Number.isFinite(o.score);
                      return (
                        <tr key={o.facility.id} className={cn(o === plan.best && "bg-teal-50/70 dark:bg-teal-950/30", !ok && "text-muted-foreground")}>
                          <td className="px-3 py-2 font-medium">{o.facility.short}<div className="text-xs font-normal text-muted-foreground">{o.facility.city}</div></td>
                          <td className="px-2">
                            {o.missing.length ? <span className="flex items-center gap-1"><Ban className="size-3.5" /> no {o.missing.map((c) => CAPABILITY_LABEL[c].toLowerCase()).join(", ")}</span>
                              : o.busy.length ? <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400"><Clock className="size-3.5" /> {o.busy.map((c) => CAPABILITY_LABEL[c].toLowerCase()).join(", ")} busy</span>
                              : <span className="flex items-center gap-1 text-teal-700 dark:text-teal-400"><Check className="size-3.5" /> available</span>}
                          </td>
                          <td className="px-2">
                            <div className="flex items-center gap-2">
                              <div className="h-2 w-16 overflow-hidden rounded-full bg-muted">
                                <div className={cn("h-full", o.facility.erLoad > 0.85 ? "bg-triage-red" : o.facility.erLoad > 0.65 ? "bg-triage-orange" : "bg-teal-600")} style={{ width: `${o.facility.erLoad * 100}%` }} />
                              </div>
                              <span className="tabular-nums">{Math.round(o.facility.erLoad * 100)}%</span>
                            </div>
                          </td>
                          <td className="px-2 text-center tabular-nums">{o.facility.freeBeds}</td>
                          <td className="px-3 text-right tabular-nums">{o.travelMin} min</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="space-y-2">
              <div className="relative z-0 h-80 overflow-hidden rounded-xl border lg:h-full lg:min-h-96"><ReferralMap plan={plan} /></div>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Route className="size-3.5" /> Straight-line route; travel = distance × 1.4 at 30 km/h + 3 min (no live traffic).</p>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
