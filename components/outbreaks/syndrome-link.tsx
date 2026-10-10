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
          className="inline-flex items-center gap-1 rounded-full border border-teal-600/40 bg-teal-50 px-2 py-0.5 text-xs font-semibold text-teal-800 hover:bg-teal-100 dark:bg-teal-950 dark:text-teal-300"
          title="See other patients with this syndrome and where it is spreading"
        >
          <Radar className="size-3.5" /> {SYNDROME[id].label}
        </Link>
      ))}
    </span>
  );
}
