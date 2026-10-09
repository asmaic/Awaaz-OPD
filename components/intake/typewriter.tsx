"use client";
import { useEffect, useState } from "react";

/** Reveals text word by word (Nastaliq joins letters, so words read better than characters). Key it by text to restart. */
export function Typewriter({ text, className, msPerWord = 70, onDone }: { text: string; className?: string; msPerWord?: number; onDone?: () => void }) {
  const words = text.split(/(\s+)/);
  const total = words.length;
  const [n, setN] = useState(0);
  const finished = n >= total;

  useEffect(() => {
    const id = setInterval(() => setN((x) => Math.min(total, x + 2)), msPerWord);
    return () => clearInterval(id);
  }, [total, msPerWord]);

  useEffect(() => {
    if (finished) onDone?.();
  }, [finished, onDone]);

  return (
    <p className={className}>
      {words.slice(0, n).join("")}
      {!finished && <span className="ms-1 inline-block h-[1em] w-0.5 animate-pulse bg-teal-600 align-middle" />}
    </p>
  );
}
