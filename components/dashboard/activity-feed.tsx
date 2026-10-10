"use client";
import { AnimatePresence, motion } from "motion/react";
import { Bot, Cog, Hand, ScrollText, Siren, Stethoscope, UserRound } from "lucide-react";
import type { AuditEntry, Patient } from "@/types/contracts";

export const ACTOR_ICON = { ai: Bot, rules: ScrollText, nurse: UserRound, doctor: Stethoscope, system: Cog } as const;

function describe(e: AuditEntry, token?: number): string {
  const t = token ? `Token ${token}` : "";
  switch (e.action) {
    case "extract": return `AI extracted intake ${t}`.trim();
    case "cache_hit": return `Served from cache ${t}`.trim();
    case "triage": return `Rules fired ${e.ruleIds?.join(", ") ?? ""}`;
    case "notify_er": return `ER notified · ${t}`;
    case "override": return `Override ${t}: ${e.reason ?? ""}`;
    case "rx_read": return "Prescription read by vision";
    case "tts": return "Urdu instructions voiced";
    case "fallback": return "Fell back to backup model";
    case "confirm": return e.reason ? `${e.reason} ${t}`.trim() : `Confirmed ${t}`.trim();
  }
}

export function ActivityFeed({ entries, patients }: { entries: AuditEntry[]; patients: Patient[] }) {
  const tokenOf = (id?: string) => patients.find((p) => p.id === id)?.token;
  if (!entries.length) return <p className="py-6 text-center text-sm text-muted-foreground">No activity yet — register a patient at Intake.</p>;
  return (
    <ul className="space-y-1">
      <AnimatePresence initial={false}>
        {entries.slice(0, 7).map((e) => {
          const Icon = e.action === "notify_er" ? Siren : e.action === "override" ? Hand : ACTOR_ICON[e.actor];
          return (
            <motion.li
              key={e.id}
              layout
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 rounded-lg px-2 py-1.5 text-sm"
            >
              <Icon className={e.action === "notify_er" ? "size-4 shrink-0 text-triage-red" : "size-4 shrink-0 text-muted-foreground"} />
              <span className="min-w-0 flex-1 truncate">{describe(e, tokenOf(e.patientId))}</span>
              <time className="shrink-0 text-xs text-muted-foreground">{new Date(e.ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time>
            </motion.li>
          );
        })}
      </AnimatePresence>
    </ul>
  );
}
