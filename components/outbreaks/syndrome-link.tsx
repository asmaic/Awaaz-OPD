"use client";
import Link from "next/link";
import { Radar } from "lucide-react";
import { SYNDROME, fromPatient, syndromesOf } from "@/lib/surveillance";
import type { Patient } from "@/types/contracts";

/**
 * Clickable chips for a patient's surveillance syndromes (e.g. "Suspected dengue") → the outbreak explorer,
 * focused on this patient's locality. Renders nothing if no syndrome applies. Drop it on any patient view.
 */
export function SyndromeLinks({ patient, className }: { patient: Patient; className?: string }) {
  const ids = syndromesOf(fromPatient(patient));
  if (!ids.length) return null;
  return (
    <span className={className ?? "flex flex-wrap gap-1.5"}>
      {ids.map((id) => (
        <Link
          key={id}
          href={`/outbreaks?syndrome=${id}&focus=${encodeURIComponent(patient.id)}`}
          className="inline-flex items-center gap-1 rounded-[3px] border border-scrub/40 bg-scrub-tint px-1.5 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-scrub uppercase transition-colors hover:bg-scrub hover:text-primary-foreground"
          title="See other patients with this syndrome and where it is spreading"
        >
          <Radar className="size-3.5" /> {SYNDROME[id].label}
        </Link>
      ))}
    </span>
  );
}
