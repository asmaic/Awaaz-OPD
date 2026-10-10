import Link from "next/link";
import { ArrowRight, Bot, LayoutDashboard, Mic, ScrollText, Stethoscope, Scale, UserCheck, Volume2 } from "lucide-react";
import { Brand } from "@/components/shell/app-shell";

const flow = [
  { icon: Mic, title: "Patient speaks", desc: "Urdu or Urdu–English, into the kiosk mic" },
  { icon: Bot, title: "AI extracts", desc: "Gemini transcribes + fills a structured intake form" },
  { icon: Scale, title: "Rules decide", desc: "20 deterministic rules (WHO ETAT, dengue, ESI) set the level" },
  { icon: UserCheck, title: "Doctor confirms", desc: "Handwritten Rx read, unclear fields flagged, interactions checked" },
  { icon: Volume2, title: "Urdu voice", desc: "Confirmed instructions spoken back in simple Urdu" },
];

const stats = [
  { value: "8,000+", label: "outpatients a day at PIMS Islamabad" },
  { value: "2–3k", label: "the daily load it was designed for" },
  { value: "Sep–Nov", label: "dengue season adds to the crush" },
];

const screens = [
  { href: "/intake", title: "Intake kiosk", desc: "Voice triage in Urdu", icon: Mic },
  { href: "/dashboard", title: "Queue board", desc: "Live, colour-coded, dengue map", icon: LayoutDashboard },
  { href: "/doctor", title: "Doctor", desc: "Prescription reader + voice-back", icon: Stethoscope },
  { href: "/audit", title: "Audit log", desc: "Every AI and human decision", icon: ScrollText },
];

const levels = [
  { name: "Red", c: "bg-triage-red" },
  { name: "Orange", c: "bg-triage-orange" },
  { name: "Yellow", c: "bg-triage-yellow" },
  { name: "Green", c: "bg-triage-green" },
];

export default function Home() {
  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-background">
      <div aria-hidden className="pointer-events-none absolute -top-40 -right-40 size-[38rem] rounded-full bg-scrub/10 blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -left-40 size-[32rem] rounded-full bg-triage-orange/10 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center gap-10 px-6 py-10">
        <Brand />

        <section className="grid items-end gap-8 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="urdu mb-4 w-fit text-4xl leading-[2.6] text-scrub">ہر آواز سنی جائے</p>
            <h1 className="mt-2 text-5xl leading-[1.05] font-bold tracking-tight text-balance">
              The sickest patient in the OPD line shouldn’t wait behind the earliest.
            </h1>
            <p className="mt-4 max-w-2xl text-xl text-muted-foreground">
              Awaaz OPD listens to patients in their own language, turns what they say into a structured intake,
              and lets transparent clinical rules — not a black box — decide who is seen first.
            </p>
            <div className="mt-5 flex items-center gap-2">
              {levels.map((l) => <span key={l.name} className={`${l.c} rounded-full px-3 py-1 text-sm font-semibold text-white`}>{l.name}</span>)}
            </div>
          </div>
          <ul className="grid grid-cols-3 gap-3">
            {stats.map((s) => (
              <li key={s.label} className="rounded-lg border bg-card p-4 shadow-sm">
                <div className="text-[1.7rem] font-bold tracking-tight whitespace-nowrap tabular-nums">{s.value}</div>
                <div className="mt-1 text-sm text-muted-foreground">{s.label}</div>
              </li>
            ))}
          </ul>
        </section>

        <section aria-label="How it works" className="rounded-lg border bg-card p-5 shadow-sm">
          <ol className="grid gap-3 md:grid-cols-5">
            {flow.map((f, i) => (
              <li key={f.title} className="relative flex flex-col gap-2 rounded-md bg-muted/50 p-4">
                <span className="flex items-center gap-2">
                  <span className="grid size-9 place-items-center rounded-lg bg-scrub text-white"><f.icon className="size-5" /></span>
                  <span className="text-xs font-semibold text-muted-foreground">0{i + 1}</span>
                </span>
                <span className="text-lg font-semibold">{f.title}</span>
                <span className="text-sm text-muted-foreground">{f.desc}</span>
                {i < flow.length - 1 && <ArrowRight className="absolute top-1/2 -right-3 z-10 hidden size-5 -translate-y-1/2 text-scrub md:block" />}
              </li>
            ))}
          </ol>
        </section>

        <nav className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {screens.map((s) => (
            <Link
              key={s.href}
              href={s.href}
              className="group flex items-center gap-4 rounded-lg border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-scrub hover:shadow-md"
            >
              <span className="grid size-11 place-items-center rounded-md bg-muted text-foreground transition group-hover:bg-scrub group-hover:text-white"><s.icon className="size-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{s.title}</span>
                <span className="block truncate text-sm text-muted-foreground">{s.desc}</span>
              </span>
              <ArrowRight className="size-4 text-muted-foreground transition group-hover:translate-x-0.5" />
            </Link>
          ))}
        </nav>
        <p className="text-sm text-muted-foreground">AICON’26 · Build With AI · Health Operations · synthetic data only</p>
      </div>
    </main>
  );
}
