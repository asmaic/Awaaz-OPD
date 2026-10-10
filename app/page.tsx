import Link from "next/link";
import { AlertOctagon, AlertTriangle, ArrowRight, CircleAlert, CircleCheck } from "lucide-react";
import { Brand } from "@/components/shell/app-shell";

// The thesis, drawn as the board itself: tokens in arrival order on the left, the order they are seen on the right.
const ARRIVALS = [
  { token: 41, label: "Green", complaint: "Diabetes medicine refill", icon: CircleCheck, bg: "bg-triage-green" },
  { token: 43, label: "Yellow", complaint: "Fever and body ache, 2 days", icon: CircleAlert, bg: "bg-triage-yellow" },
  { token: 47, label: "Orange", complaint: "Fever, bleeding gums, Dhok Hassu", icon: AlertTriangle, bg: "bg-triage-orange" },
  { token: 48, label: "Red", complaint: "Chest pain to the left arm, sweating", icon: AlertOctagon, bg: "bg-triage-red" },
] as const;
const SEEN = [...ARRIVALS].reverse();

const FLOW = [
  { en: "Patient speaks", ur: "مریض بولتا ہے", note: "Urdu or Urdu–English, into the kiosk mic" },
  { en: "AI writes it down", ur: "اے آئی لکھتا ہے", note: "Gemini transcribes and fills the intake form" },
  { en: "Rules decide", ur: "اصول طے کرتے ہیں", note: "20 published triage rules set the level, with reasons" },
  { en: "Doctor confirms", ur: "ڈاکٹر تصدیق کرتا ہے", note: "Prescription read; anything unclear must be checked" },
  { en: "Spoken back", ur: "مریض سنتا ہے", note: "Instructions spoken back in Urdu" },
];

const SCREENS = [
  { href: "/intake", en: "Intake kiosk", ur: "داخلہ" },
  { href: "/dashboard", en: "Queue board", ur: "قطار" },
  { href: "/doctor", en: "Doctor's room", ur: "ڈاکٹر" },
  { href: "/audit", en: "Audit log", ur: "ریکارڈ" },
];

function Tag({ t, dim }: { t: (typeof ARRIVALS)[number]; dim?: boolean }) {
  const Icon = t.icon;
  return (
    <li className={`flex items-stretch overflow-hidden rounded-[4px] border bg-card ${dim ? "opacity-55" : ""}`}>
      <div className="relative flex w-20 shrink-0 items-center pl-6">
        <span aria-hidden className="absolute top-1/2 left-2 size-2.5 -translate-y-1/2 rounded-full border bg-background" />
        <span className="signage text-4xl font-extrabold tabular-nums">{t.token}</span>
      </div>
      <span aria-hidden className="perforation w-[2px] shrink-0" />
      <div className={`flex flex-1 items-center gap-1.5 px-3 font-mono text-xs font-semibold tracking-[0.12em] text-white uppercase ${t.bg}`} title={t.complaint}>
        <Icon className="size-4" />{t.label}
      </div>
    </li>
  );
}

export default function Home() {
  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-background">
      <header className="bg-[#15201d] text-[#f2f4f1]">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Brand />
          <Link href="/intake" className="flex items-center gap-2 rounded-[4px] bg-[#f2f4f1] px-4 py-2 text-sm font-bold text-[#15201d] hover:bg-white">
            Open the kiosk <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-6xl flex-1 px-6">
        {/* Thesis */}
        <section className="grid gap-12 border-b-2 border-ink py-14 lg:grid-cols-[1.05fr_1fr] lg:items-center">
          <div>
            <p className="urdu w-fit text-4xl leading-[2.2] text-scrub" lang="ur">ہر آواز سنی جائے</p>
            <h1 className="signage text-[5.5rem] font-extrabold uppercase">The sickest patient is seen first.</h1>
            <p className="mt-6 max-w-xl text-xl leading-relaxed text-mute">
              PIMS Islamabad was built for 2,000–3,000 outpatients a day and now gets more than 8,000. In that line, order is decided by
              who arrived first. Awaaz OPD listens to each patient in Urdu and lets published triage rules decide who goes in next.
            </p>
          </div>

          <figure aria-label="Arrival order compared with the order patients are seen" className="lg:pl-6">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <div className="register-label mb-2">Arrived</div>
                <ol className="space-y-2">{ARRIVALS.map((t) => <Tag key={t.token} t={t} dim />)}</ol>
              </div>
              <div>
                <div className="register-label mb-2 text-scrub">Seen</div>
                <ol className="space-y-2">{SEEN.map((t) => <Tag key={t.token} t={t} />)}</ol>
              </div>
            </div>
            <figcaption className="mt-3 font-mono text-xs text-mute">
              Token 48 arrived last with heart-attack signs. Rule R02 puts him first and alerts the ER.
            </figcaption>
          </figure>
        </section>

        {/* Route: an actual sequence, so it is numbered */}
        <section className="py-12" aria-labelledby="route">
          <h2 id="route" className="register-label mb-5">From a voice to a decision</h2>
          <ol className="grid border-y md:grid-cols-5">
            {FLOW.map((f, i) => (
              <li key={f.en} className={`flex flex-col gap-1 py-5 md:px-5 ${i ? "border-t md:border-t-0 md:border-l" : ""} ${i === 2 ? "bg-ink text-paper" : ""}`}>
                <span className={`font-mono text-xs ${i === 2 ? "text-paper/60" : "text-mute"}`}>{i + 1}</span>
                <span className="signage text-3xl font-extrabold uppercase">{f.en}</span>
                <span className="urdu text-base leading-[2]" lang="ur">{f.ur}</span>
                <span className={`text-sm ${i === 2 ? "text-paper/75" : "text-mute"}`}>{f.note}</span>
              </li>
            ))}
          </ol>
          <p className="mt-4 max-w-3xl text-base text-mute">
            The language model writes things down; it never sets a patient’s priority. That is done by rules a clinician can read, test and override.
          </p>
        </section>

        {/* Wayfinding to the four screens */}
        <nav aria-label="Screens" className="grid border-t-2 border-ink sm:grid-cols-2 lg:grid-cols-4">
          {SCREENS.map((s) => (
            <Link key={s.href} href={s.href} className="group flex items-center justify-between gap-4 border-b py-5 sm:px-4 lg:border-r lg:first:pl-0">
              <span>
                <span className="block text-lg font-bold">{s.en}</span>
                <span className="urdu block text-base leading-[1.8] text-mute" lang="ur">{s.ur}</span>
              </span>
              <ArrowRight className="size-5 text-mute transition-transform group-hover:translate-x-1 group-hover:text-scrub" />
            </Link>
          ))}
        </nav>
        <p className="py-6 font-mono text-[11px] tracking-wide text-mute uppercase">AICON’26 · Build With AI · Health Operations · synthetic data only</p>
      </div>
    </main>
  );
}
