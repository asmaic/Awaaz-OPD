"use client";
import { useEffect, useRef, useState } from "react";
import { Camera, FileImage, ImageUp, Images } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { fileToJpeg, toJpeg, urlToJpeg, type Captured } from "./image";

export const SAMPLES = [
  { url: "/fallback/rx-sample.svg", caseId: "rx-demo", label: "Klaricid · Lipiget · Risek" },
];

function CameraCapture({ onCapture }: { onCapture: (c: Captured) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let cancelled = false;
    navigator.mediaDevices
      ?.getUserMedia({ video: { width: 1920, facingMode: "environment" } })
      .then((s) => {
        if (cancelled) { s.getTracks().forEach((t) => t.stop()); return; }
        stream = s;
        if (video.current) { video.current.srcObject = s; void video.current.play(); }
        setReady(true);
      })
      .catch(() => setError("Camera unavailable — use Upload or a sample instead."));
    return () => { cancelled = true; stream?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const snap = () => {
    const v = video.current;
    if (v && v.videoWidth) onCapture(toJpeg(v, v.videoWidth, v.videoHeight));
  };

  return (
    <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-slate-900">
      <video ref={video} playsInline muted className="size-full object-cover" />
      {/* guide frame */}
      <div className="pointer-events-none absolute inset-[8%_18%] rounded-lg border-2 border-dashed border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
      <span className="absolute top-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-white">Fit the prescription inside the frame</span>
      {error && <div className="absolute inset-0 grid place-items-center p-6 text-center text-white/80">{error}</div>}
      <button
        type="button"
        disabled={!ready}
        onClick={snap}
        aria-label="Capture photo"
        className="absolute bottom-4 left-1/2 grid size-16 -translate-x-1/2 place-items-center rounded-full border-4 border-white bg-white/20 backdrop-blur transition hover:bg-white/40 disabled:opacity-40"
      >
        <Camera className="size-6 text-white" />
      </button>
    </div>
  );
}

export function CapturePanel({ onCapture }: { onCapture: (c: Captured) => void }) {
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState<string>("samples");

  const onFile = async (f?: File) => { if (f) onCapture(await fileToJpeg(f)); };

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(String(v))} className="gap-3">
      <TabsList className="h-10 w-full">
        <TabsTrigger value="samples" className="h-8 gap-2 text-sm"><Images className="size-4" />Samples</TabsTrigger>
        <TabsTrigger value="upload" className="h-8 gap-2 text-sm"><ImageUp className="size-4" />Upload</TabsTrigger>
        <TabsTrigger value="camera" className="h-8 gap-2 text-sm"><Camera className="size-4" />Camera</TabsTrigger>
      </TabsList>

      <TabsContent value="samples">
        <div className="grid grid-cols-2 gap-3">
          {SAMPLES.map((s) => (
            <button
              key={s.url}
              type="button"
              onClick={async () => onCapture(await urlToJpeg(s.url, s.caseId))}
              className="group overflow-hidden rounded-xl border bg-card text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={s.url} alt="" className="aspect-[3/4] w-full object-cover object-top" />
              <div className="flex items-center gap-2 p-2.5 text-sm font-medium"><FileImage className="size-4 text-teal-600" />{s.label}</div>
            </button>
          ))}
        </div>
      </TabsContent>

      <TabsContent value="upload">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); void onFile(e.dataTransfer.files[0]); }}
          className={cn(
            "flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed text-muted-foreground transition",
            drag ? "border-teal-600 bg-teal-50 dark:bg-teal-950/40" : "hover:bg-muted/60",
          )}
        >
          <ImageUp className="size-10" />
          <span className="text-base font-medium">Drop a prescription photo, or click to choose</span>
          <span className="text-sm">JPEG / PNG · resized to 1600 px</span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => onFile(e.target.files?.[0])} />
      </TabsContent>

      <TabsContent value="camera">{tab === "camera" && <CameraCapture onCapture={onCapture} />}</TabsContent>
    </Tabs>
  );
}
