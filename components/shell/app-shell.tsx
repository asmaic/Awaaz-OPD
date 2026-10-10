"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { startQueueSync, useQueue } from "@/store/queue";


/** True once the persisted store has been loaded from localStorage (client only). */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useQueue.persist.onFinishHydration(cb),
    () => useQueue.persist.hasHydrated(),
    () => false,
  );
}

function StoreSync() {
  useEffect(() => {
    void useQueue.persist.rehydrate();
    return startQueueSync();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ctrl+Shift+D/R per spec; Alt+Shift+D/R as backups because Chrome reserves Ctrl+Shift+D (bookmark all) and Ctrl+Shift+R (hard reload).
      if (!(e.ctrlKey || e.metaKey || e.altKey) || !e.shiftKey) return;
      const k = e.code === "KeyD" ? "d" : e.code === "KeyR" ? "r" : e.key.toLowerCase();
      if (k === "d") {
        e.preventDefault();
        const s = useQueue.getState();
        s.setDemoMode(!s.demoMode);
      } else if (k === "r") {
        e.preventDefault();
        useQueue.getState().reset();
        toast("Demo reset", { description: "Seed patients reloaded." });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return null;
}

const THEME_KEY = "awaaz-theme";
const themeListeners = new Set<() => void>();
function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  try { localStorage.setItem(THEME_KEY, dark ? "dark" : "light"); } catch {}
  themeListeners.forEach((l) => l());
}
function useDark() {
  return useSyncExternalStore(
    (cb) => { themeListeners.add(cb); return () => themeListeners.delete(cb); },
    () => document.documentElement.classList.contains("dark"),
    () => false,
  );
}

function ThemeToggle() {
  const dark = useDark();
  useEffect(() => {
    try { if (localStorage.getItem(THEME_KEY) === "dark") applyTheme(true); } catch {}
  }, []);
  return (
    <button
      type="button"
      onClick={() => applyTheme(!dark)}
      className="grid size-10 place-items-center self-center rounded-md text-white/60 transition-colors hover:bg-white/10 hover:text-white"
      aria-label="Toggle dark mode"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

export function Brand({ className, inverted = true }: { className?: string; inverted?: boolean }) {
  return (
    <Link href="/" className={cn("group flex items-baseline gap-2", className)} aria-label="Awaaz OPD home">
      <span className={cn("signage text-[2rem] font-extrabold uppercase", inverted ? "text-[#f2f4f1]" : "text-ink")}>Awaaz</span>
      <span className={cn("signage rounded-[3px] px-1.5 py-0.5 text-base font-bold uppercase", inverted ? "bg-[#f2f4f1] text-[#15201d]" : "bg-ink text-paper")}>OPD</span>
      <span className={cn("urdu text-lg leading-none", inverted ? "text-[#f2f4f1]/70" : "text-mute")}>آواز</span>
    </Link>
  );
}

/** Bilingual wayfinding, the way Pakistani hospital signs are written: English over Urdu. */
const NAV = [
  { href: "/intake", label: "Intake", ur: "داخلہ" },
  { href: "/dashboard", label: "Queue board", ur: "قطار" },
  { href: "/doctor", label: "Doctor", ur: "ڈاکٹر" },
  { href: "/outbreaks", label: "Outbreaks", ur: "وبا" },
  { href: "/audit", label: "Audit log", ur: "ریکارڈ" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const demo = useQueue((s) => s.demoMode);
  return (
    <>
      <StoreSync />
      <div className="flex min-h-dvh flex-col bg-background">
        <header className="sticky top-0 z-40 print:hidden bg-[#15201d] text-[#f2f4f1] dark:bg-[#0a100e]">
          <div className="mx-auto flex h-16 max-w-[1800px] items-stretch gap-10 px-6">
            <Brand className="self-center" />
            <nav className="flex flex-1 items-stretch" aria-label="Screens">
              {NAV.map(({ href, label, ur }) => {
                const active = path?.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex flex-col justify-center border-l border-white/10 px-5 transition-colors last:border-r",
                      active ? "bg-white/10 text-white" : "text-white/60 hover:bg-white/5 hover:text-white",
                    )}
                  >
                    <span className="text-[15px] leading-tight font-semibold">{label}</span>
                    <span className="urdu text-[13px] leading-[1.5] text-current/70" dir="rtl">{ur}</span>
                    {active && <span className="absolute inset-x-0 bottom-0 h-[3px] bg-scrub dark:bg-scrub" />}
                  </Link>
                );
              })}
            </nav>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="flex items-center justify-between print:hidden border-t px-6 py-2 font-mono text-[11px] tracking-wide text-mute">
          <span>SYNTHETIC DATA · AI EXTRACTS · RULES DECIDE · CLINICIANS CONFIRM</span>
          <span
            aria-label={demo ? "demo mode on" : undefined}
            className={cn("size-1.5 rounded-full transition-colors", demo ? "bg-scrub" : "bg-transparent")}
          />
        </footer>
      </div>
    </>
  );
}
