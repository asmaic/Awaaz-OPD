"use client";
import { useCallback, useEffect, useRef, useState } from "react";

const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

export function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m));
}

export function blobToB64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1] ?? "");
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** MediaRecorder + AnalyserNode for a live waveform. Auto-stops at maxMs. */
export function useRecorder(onDone: (blob: Blob, mime: string) => void, maxMs = 30_000) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<MediaRecorder | null>(null);
  const cleanup = useRef<() => void>(() => {});
  const onDoneRef = useRef(onDone);
  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  const stop = useCallback(() => {
    if (rec.current?.state === "recording") rec.current.stop();
  }, []);

  const start = useCallback(async () => {
    if (rec.current?.state === "recording") return;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const mime = pickMime();
      const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      const ctx = new AudioContext();
      const node = ctx.createAnalyser();
      node.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(node);

      const chunks: Blob[] = [];
      const t0 = performance.now();
      const tick = setInterval(() => setElapsed(performance.now() - t0), 100);
      const auto = setTimeout(() => recorder.state === "recording" && recorder.stop(), maxMs);

      cleanup.current = () => {
        clearInterval(tick);
        clearTimeout(auto);
        stream.getTracks().forEach((t) => t.stop());
        void ctx.close();
      };
      recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      recorder.onstop = () => {
        cleanup.current();
        setRecording(false);
        setAnalyser(null);
        const type = recorder.mimeType || mime || "audio/webm";
        onDoneRef.current(new Blob(chunks, { type }), type);
      };
      rec.current = recorder;
      recorder.start(250);
      setElapsed(0);
      setAnalyser(node);
      setRecording(true);
    } catch (e) {
      setError(e instanceof Error && e.name === "NotAllowedError" ? "Microphone permission was denied." : "Could not start the microphone.");
    }
  }, [maxMs]);

  useEffect(() => () => cleanup.current(), []);

  return { recording, elapsed, analyser, error, start, stop };
}
