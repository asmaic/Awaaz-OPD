"use client";
import { motion } from "motion/react";
import { Check, Ear, FileText, Brain, ShieldCheck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const STEPS = [
  { label: "Listening", icon: Ear },
  { label: "Transcribing", icon: FileText },
  { label: "Understanding", icon: Brain },
  { label: "Triage", icon: ShieldCheck },
];

/** current = index of the step in progress; STEPS.length means all done. */
export function ProcessingSteps({ current }: { current: number }) {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <ol className="grid grid-cols-4 gap-3">
        {STEPS.map((s, i) => {
          const done = i < current, active = i === current;
          const Icon = done ? Check : s.icon;
          return (
            <li key={s.label} className="flex flex-col items-center gap-2 text-center">
              <motion.span
                animate={active ? { scale: [1, 1.08, 1] } : { scale: 1 }}
                transition={active ? { repeat: Infinity, duration: 1.1 } : { duration: 0.2 }}
                className={cn(
                  "grid size-14 place-items-center rounded-lg border-2 transition-colors duration-300",
                  done && "border-scrub bg-scrub text-primary-foreground",
                  active && "border-scrub bg-scrub-tint text-scrub",
                  !done && !active && "border-border text-muted-foreground",
                )}
              >
                <Icon className="size-6" />
              </motion.span>
              <span className={cn("text-base font-medium", !done && !active && "text-muted-foreground")}>{s.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="grid gap-4 rounded-lg border bg-card p-6 shadow-sm">
        <Skeleton className="ml-auto h-8 w-3/4" />
        <Skeleton className="ml-auto h-8 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
        <div className="flex gap-2">
          {[80, 110, 70].map((w) => <Skeleton key={w} className="h-8 rounded-full" style={{ width: w }} />)}
        </div>
      </div>
    </div>
  );
}
