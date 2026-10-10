"use client";
import { useState } from "react";

/**
 * Epidemic curve: one bar per day, single series (the title names it, so no legend).
 * This week's bars use the darker step of the same hue; hover any day for its count.
 */
export function EpiCurve({ daily, label }: { daily: { date: string; count: number }[]; label: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 640, H = 200, PAD_L = 28, PAD_B = 22, PAD_T = 10;
  const max = Math.max(4, ...daily.map((d) => d.count));
  const step = Math.ceil(max / 4);
  const ticks = [0, step, step * 2, step * 3, step * 4].filter((t) => t <= max + step);
  const top = ticks.at(-1) ?? max;
  const bw = (W - PAD_L) / daily.length;
  const y = (v: number) => PAD_T + (H - PAD_T - PAD_B) * (1 - v / top);
  const fmt = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString([], { day: "numeric", month: "short" });
  const h = hover !== null ? daily[hover] : null;

  return (
    <figure className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${label}: daily cases over ${daily.length} days`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD_L} x2={W} y1={y(t)} y2={y(t)} className="stroke-border" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(t) + 4} textAnchor="end" className="fill-muted-foreground text-[11px] tabular-nums">{t}</text>
          </g>
        ))}
        {daily.map((d, i) => {
          const thisWeek = i >= daily.length - 7;
          const x = PAD_L + i * bw + 1; // 2px surface gap between bars
          const bh = Math.max(0, y(0) - y(d.count));
          return (
            <g key={d.date} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={PAD_L + i * bw} y={PAD_T} width={bw} height={H - PAD_T - PAD_B} fill="transparent" />
              {d.count > 0 && (
                <path
                  d={`M${x},${y(0)} V${y(d.count) + Math.min(4, bh)} q0,-${Math.min(4, bh)} ${Math.min(4, bh)},-${Math.min(4, bh)} H${x + bw - 2 - Math.min(4, bh)} q${Math.min(4, bh)},0 ${Math.min(4, bh)},${Math.min(4, bh)} V${y(0)} Z`}
                  className={thisWeek ? "fill-scrub" : "fill-scrub/35"}
                  opacity={hover === null || hover === i ? 1 : 0.55}
                />
              )}
            </g>
          );
        })}
        <line x1={PAD_L} x2={W} y1={y(0)} y2={y(0)} className="stroke-muted-foreground" strokeWidth={1} />
        {[0, 7, 14, 21, daily.length - 1].map((i) => daily[i] && (
          <text key={i} x={PAD_L + i * bw + bw / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground text-[11px]">{i === daily.length - 1 ? "Today" : fmt(daily[i].date)}</text>
        ))}
        <text x={W - 2} y={PAD_T + 2} textAnchor="end" className="fill-muted-foreground text-[11px]">darker = this week</text>
      </svg>
      {h && hover !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 rounded-lg border bg-popover px-2.5 py-1.5 text-sm shadow-md"
          style={{ left: `${((PAD_L + hover * bw + bw / 2) / W) * 100}%`, top: 0 }}
        >
          <div className="font-semibold tabular-nums">{h.count} case{h.count === 1 ? "" : "s"}</div>
          <div className="text-xs text-muted-foreground">{fmt(h.date)}</div>
        </div>
      )}
    </figure>
  );
}
