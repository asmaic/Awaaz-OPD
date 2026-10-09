"use client";
import { CloudOff, RotateCw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Friendly failure state: never a dead end — always Retry and Use sample. */
export function ErrorCard({ message, onRetry, onSample }: { message: string; onRetry?: () => void; onSample?: () => void }) {
  return (
    <div className="mx-auto flex w-full max-w-lg flex-col items-center gap-4 rounded-2xl border bg-card p-8 text-center shadow-sm">
      <span className="grid size-14 place-items-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
        <CloudOff className="size-7" />
      </span>
      <div>
        <h3 className="text-xl font-semibold">That didn’t go through</h3>
        <p className="mt-1 text-muted-foreground">{message}</p>
      </div>
      <div className="flex gap-3">
        {onRetry && <Button variant="outline" className="h-11 rounded-xl px-4" onClick={onRetry}><RotateCw className="size-4" /> Retry</Button>}
        {onSample && <Button className="h-11 rounded-xl bg-teal-600 px-4 text-white hover:bg-teal-700" onClick={onSample}><Sparkles className="size-4" /> Use sample</Button>}
      </div>
    </div>
  );
}
