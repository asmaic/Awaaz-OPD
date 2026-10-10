"use client";
import { useEffect } from "react";
import { toast } from "sonner";
import { useQueue } from "@/store/queue";
import type { ApiResult } from "@/types/contracts";
import type { RemoteIntake } from "@/lib/whatsapp";

const SEEN_KEY = "awaaz-remote-seen"; // last receivedAt pulled into this browser's queue

/**
 * Polls /api/remote-intake and adds new WhatsApp patients to the queue (name shows the masked phone + counter code).
 * Mount once on the dashboard: `useRemoteIntake();`
 */
export function useRemoteIntake(intervalMs = 5000) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_USE_MOCK === "true") return;
    let alive = true;
    const tick = async () => {
      let after = "";
      try { after = localStorage.getItem(SEEN_KEY) ?? ""; } catch {}
      const r = (await fetch(`/api/remote-intake${after ? `?after=${encodeURIComponent(after)}` : ""}`).then((x) => x.json()).catch(() => null)) as ApiResult<RemoteIntake[]> | null;
      if (!alive || !r?.ok) return;
      for (const rec of r.data) {
        const p = useQueue.getState().addPatient({ name: `WhatsApp ${rec.phone} · ${rec.code}`, extraction: rec.extraction, triage: rec.triage });
        toast(`📱 WhatsApp patient · Token ${p.token}`, { description: `${rec.triage.level} · ${rec.extraction.chief_complaint} · code ${rec.code}` });
        try { localStorage.setItem(SEEN_KEY, rec.receivedAt); } catch {}
      }
    };
    void tick();
    const id = setInterval(tick, intervalMs);
    return () => { alive = false; clearInterval(id); };
  }, [intervalMs]);
}
