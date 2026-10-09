import Link from "next/link";

const screens = [
  { href: "/intake", title: "Intake kiosk", desc: "Patient speaks in Urdu; AI extracts, rules triage" },
  { href: "/dashboard", title: "Queue dashboard", desc: "Live colour-coded queue and dengue map" },
  { href: "/doctor", title: "Doctor", desc: "Read prescription photo, confirm, Urdu voice-back" },
  { href: "/audit", title: "Audit log", desc: "Every AI output, rule and human decision" },
];

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 p-8">
      <div>
        <h1 className="text-4xl font-bold tracking-tight">Awaaz OPD</h1>
        <p className="mt-2 text-lg text-muted-foreground">Har awaaz suni jaye — every voice heard.</p>
        <p className="urdu mt-1 text-2xl">ہر آواز سنی جائے</p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        {screens.map((s) => (
          <li key={s.href}>
            <Link href={s.href} className="block rounded-2xl border p-5 transition-colors hover:bg-muted">
              <div className="text-lg font-semibold">{s.title}</div>
              <div className="text-sm text-muted-foreground">{s.desc}</div>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
