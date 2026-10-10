"use client";
import { motion } from "motion/react";
import { ArrowRight, Clock, Printer } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { TriageBadge } from "@/components/triage";
import { effectiveLevel } from "@/store/queue";
import { tokenCode } from "@/lib/overrides";
import type { Patient } from "@/types/contracts";

/** Printable-style token slip shown after a patient joins the queue. */
export function TokenCard({ patient, onNext }: { patient: Patient; onNext: () => void }) {
  const level = effectiveLevel(patient);
  return (
    <motion.div
      initial={{ opacity: 0, y: 30, rotate: -1 }}
      animate={{ opacity: 1, y: 0, rotate: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 24 }}
      className="mx-auto w-full max-w-md"
    >
      <div className="relative overflow-hidden rounded-lg border bg-card shadow-sm">
        <div className="bg-scrub px-6 py-3 text-center text-sm font-medium tracking-widest text-white uppercase">
          PIMS Medicine OPD · Token
        </div>
        <div className="space-y-4 px-6 py-8 text-center">
          <div className="text-[7rem] leading-none font-bold tracking-tighter tabular-nums">{patient.token}</div>
          <div className="text-xl font-semibold">{patient.name}</div>
          <div className="font-mono text-sm tracking-[0.3em] text-muted-foreground" title="Shown on the queue board when you are called">CHECK #{tokenCode(patient)}</div>
          <div className="flex items-center justify-center gap-3">
            <TriageBadge level={level} />
            <span className="flex items-center gap-1 text-muted-foreground"><Clock className="size-4" /> est. {patient.estWaitMin} min</span>
          </div>
          <p className="urdu text-xl text-muted-foreground">اپنی باری کا انتظار کریں، اسکرین پر نمبر دیکھیں۔</p>
          {level === "RED" && (
            <p className="rounded-md bg-triage-red/10 px-4 py-2 font-semibold text-triage-red">Emergency team has been notified</p>
          )}
        </div>
        <div className="border-t border-dashed" />
        <div className="flex gap-2 p-4">
          <Button variant="outline" className="h-11 flex-1 rounded-md" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
          <Button variant="outline" className="h-11 flex-1 rounded-md" nativeButton={false} render={<Link href="/dashboard" />}>Queue board</Button>
          <Button className="h-11 flex-1 rounded-md bg-scrub text-white hover:bg-scrub-deep" onClick={onNext}>Next patient <ArrowRight className="size-4" /></Button>
        </div>
      </div>
    </motion.div>
  );
}
