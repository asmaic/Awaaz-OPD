"use client";
import { useEffect, useRef } from "react";

/** Live mirrored-bar waveform from an AnalyserNode; gentle idle shimmer when null. */
export function Waveform({ analyser, className }: { analyser: AnalyserNode | null; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    let raf = 0;
    const data = analyser ? new Uint8Array(analyser.fftSize) : null;
    const BARS = 48;

    const draw = (t: number) => {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      if (analyser && data) analyser.getByteTimeDomainData(data);
      const gap = 4, bw = (w - gap * (BARS - 1)) / BARS;
      for (let i = 0; i < BARS; i++) {
        let amp: number;
        if (data) {
          const slice = Math.floor(data.length / BARS);
          let peak = 0;
          for (let j = 0; j < slice; j++) peak = Math.max(peak, Math.abs(data[i * slice + j] - 128));
          amp = Math.min(1, (peak / 128) * 2.2);
        } else {
          amp = 0.06 + 0.04 * Math.sin(t / 400 + i / 3);
        }
        const bh = Math.max(4, amp * h);
        ctx.fillStyle = data ? "#0d9488" : "rgba(100,116,139,0.35)";
        ctx.beginPath();
        ctx.roundRect(i * (bw + gap), (h - bh) / 2, bw, bh, bw / 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  return <canvas ref={ref} className={className} aria-hidden />;
}
