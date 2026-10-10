"use client";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/mock";
import { useQueue } from "@/store/queue";
import goldenIns from "@/fixtures/golden/rx-demo.instructions.json";

const FALLBACK_WAV = "/fallback/rx-demo.wav";
// The pre-recorded WAV speaks exactly these instructions; never play it for different text (e.g. a doctor-edited dose).
const FALLBACK_TEXT = goldenIns.urdu;
const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === "true";

function play(url: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const a = new Audio(url);
    a.onended = () => resolve();
    a.onerror = () => reject(new Error("audio failed"));
    a.play().catch(reject);
  });
}

/** Browser speech as a last resort, only if an Urdu voice is installed. */
function speakBrowser(text: string): boolean {
  if (typeof speechSynthesis === "undefined") return false;
  const voice = speechSynthesis.getVoices().find((v) => v.lang.toLowerCase().startsWith("ur"));
  if (!voice) return false;
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  speechSynthesis.speak(u);
  return true;
}

/** Urdu instructions + "Play in Urdu": Gemini TTS → pre-recorded WAV → browser voice → text on screen. */
export function VoiceBack({ rxId, urdu, patientId }: { rxId: string; urdu: string; patientId?: string }) {
  const [state, setState] = useState<"idle" | "loading" | "playing">("idle");
  const audioUrl = useRef<string | null>(null);
  const log = useQueue((s) => s.log);
  const box = useRef<HTMLElement>(null);
  useEffect(() => { box.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, []);

  async function onPlay() {
    setState("loading");
    try {
      if (!audioUrl.current) {
        const r = await api.tts({ text: urdu, cacheKey: rxId });
        if (r.ok) {
          audioUrl.current = r.data.audioUrl;
          if (USE_MOCK) log({ actor: "ai", action: "tts", patientId, model: r.meta.model, payload: { audioUrl: r.data.audioUrl } });
        }
      }
      setState("playing");
      try {
        if (!audioUrl.current) throw new Error("no tts");
        await play(audioUrl.current);
      } catch {
        try {
          if (urdu.trim() !== FALLBACK_TEXT.trim()) throw new Error("fallback WAV is for different instructions");
          await play(FALLBACK_WAV);
        } catch {
          if (!speakBrowser(urdu)) toast("Audio unavailable", { description: "Please read the instructions on screen to the patient." });
        }
      }
    } finally {
      setState("idle");
    }
  }

  return (
    <motion.section
      ref={box}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4 rounded-lg border-2 border-scrub bg-scrub-tint p-6"
    >
      <div className="flex items-center justify-between gap-4">
        <h3 className="text-lg font-semibold">Patient instructions · اردو</h3>
        <Button onClick={onPlay} disabled={state !== "idle"} className="h-12 rounded-md bg-scrub px-5 text-base text-primary-foreground hover:bg-scrub-deep">
          {state === "loading" ? <Loader2 className="size-5 animate-spin" /> : <Volume2 className={state === "playing" ? "size-5 animate-pulse" : "size-5"} />}
          {state === "playing" ? "Playing…" : "Play in Urdu"}
        </Button>
      </div>
      <div className="urdu space-y-1 text-[1.6rem] leading-[2.4]">
        {urdu.split("\n").map((line, i) => <p key={i}>{line}</p>)}
      </div>
    </motion.section>
  );
}
