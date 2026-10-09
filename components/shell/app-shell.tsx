"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useSyncExternalStore } from "react";
import { Activity, LayoutDashboard, Mic, Moon, ScrollText, Stethoscope, Sun } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { startQueueSync, useQueue } from "@/store/queue";

const NAV = [
  { href: "/intake", label: "Intake", icon: Mic },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/doctor", label: "Doctor", icon: Stethoscope },
  { href: "/audit", label: "Audit", icon: ScrollText },
];

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
      className="grid size-10 place-items-center rounded-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      aria-label="Toggle dark mode"
    >
      {dark ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </button>
  );
}

export function Brand({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5", className)}>
      <span className="grid size-9 place-items-center rounded-xl bg-teal-600 text-white shadow-sm shadow-teal-600/30">
        <Activity className="size-5" strokeWidth={2.5} />
      </span>
      <span className="leading-tight">
        <span className="block text-lg font-bold tracking-tight">Awaaz OPD</span>
        <span className="block text-xs text-muted-foreground">Har awaaz suni jaye</span>
      </span>
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const demo = useQueue((s) => s.demoMode);
  return (
    <>
      <StoreSync />
      <div className="flex min-h-dvh flex-col bg-slate-50 dark:bg-background">
        <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-[1800px] items-center gap-6 px-6">
            <Brand />
            <nav className="flex flex-1 items-center gap-1">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = path?.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-xl px-3.5 py-2 text-[15px] font-medium transition-colors",
                      active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                    {label}
                  </Link>
                );
              })}
            </nav>
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-1 flex-col">{children}</div>
        <footer className="flex items-center justify-between px-6 py-2 text-xs text-muted-foreground/70">
          <span>Synthetic data only · AI extracts, rules decide, clinicians confirm</span>
          <span
            aria-label={demo ? "demo mode on" : undefined}
            className={cn("size-1.5 rounded-full transition-colors", demo ? "bg-teal-500" : "bg-transparent")}
          />
        </footer>
      </div>
    </>
  );
}
