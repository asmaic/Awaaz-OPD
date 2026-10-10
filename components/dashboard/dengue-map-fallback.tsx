"use client";
import { motion } from "motion/react";
import { LEVEL_META } from "@/components/triage";
import { LOCALITIES, effectiveLevel } from "@/store/queue";
import type { Patient } from "@/types/contracts";

// Bounding box of the twin cities (approximate) for a linear projection.
const BOX = { minLat: 33.5, maxLat: 33.78, minLng: 72.92, maxLng: 73.22 };
const proj = (lat: number, lng: number) => ({
  x: ((lng - BOX.minLng) / (BOX.maxLng - BOX.minLng)) * 100,
  y: ((BOX.maxLat - lat) / (BOX.maxLat - BOX.minLat)) * 100,
});

/** Offline map: schematic of twin-city localities with positioned pins. No network needed. */
export function DengueMapFallback({ patients }: { patients: Patient[] }) {
  return (
    <div className="relative size-full overflow-hidden bg-[linear-gradient(135deg,#f1f5f9,#e2e8f0)] dark:bg-[linear-gradient(135deg,#1e293b,#0f172a)]">
      <svg className="absolute inset-0 size-full opacity-40" aria-hidden>
        <defs>
          <pattern id="grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-slate-400" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
      </svg>
      <span className="absolute top-[18%] left-[18%] text-xs font-semibold tracking-widest text-slate-400 uppercase">Islamabad</span>
      <span className="absolute bottom-[14%] right-[16%] text-xs font-semibold tracking-widest text-slate-400 uppercase">Rawalpindi</span>
      {LOCALITIES.map((l) => {
        const { x, y } = proj(l.lat, l.lng);
        return <span key={l.name} className="absolute size-1.5 rounded-full bg-slate-400/60" style={{ left: `${x}%`, top: `${y}%` }} title={l.name} />;
      })}
      {patients.map((p) => {
        if (!p.geo) return null;
        const { x, y } = proj(p.geo.lat, p.geo.lng);
        return (
          <motion.span
            key={p.id}
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 500, damping: 18 }}
            className="absolute -translate-x-1/2 -translate-y-full"
            style={{ left: `${x}%`, top: `${y}%` }}
            title={`Token ${p.token} · ${p.geo.label}`}
          >
            <svg viewBox="0 0 24 32" width="20" height="27" className="drop-shadow">
              <path d="M12 0C5.4 0 0 5.2 0 11.7 0 20.5 12 32 12 32s12-11.5 12-20.3C24 5.2 18.6 0 12 0z" fill={LEVEL_META[effectiveLevel(p)].hex} stroke="white" strokeWidth="2" />
              <circle cx="12" cy="11.5" r="4" fill="white" />
            </svg>
          </motion.span>
        );
      })}
      <span className="absolute bottom-2 left-2 rounded bg-background/80 px-1.5 py-0.5 text-[10px] text-muted-foreground">offline schematic · approx.</span>
    </div>
  );
}
