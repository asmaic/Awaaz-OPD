"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import QRCode from "qrcode";
import { PenLine, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TriageBadge, prettySymptom } from "@/components/triage";
import { handoverQrText, humanDuration } from "@/lib/handover";
import { tokenCode } from "@/lib/overrides";
import { effectiveLevel, useQueue } from "@/store/queue";
import type { Patient, Prescription } from "@/types/contracts";
import type { HandoverRes } from "@/types/features";

/** Wrap Urdu runs inside English text in <bdi> so quotes/punctuation don't jump around (mixed-direction text). */
function Mixed({ text }: { text: string }) {
  return <>{text.split(/([\u0600-\u06FF][\u0600-\u06FF\s،۔]*)/).map((part, i) =>
    i % 2 ? <bdi key={i} dir="rtl" className="urdu">{part.trim()}</bdi> : part)}</>;
}

const SECTIONS = [["situation", "S · Situation"], ["background", "B · Background"], ["assessment", "A · Assessment"], ["recommendation", "R · Recommendation"]] as const;

/** Transfer context from the referral plan, printed with the letter. */
export interface TransferDetails { needs: string[]; whyNotHere: string[]; destinationWhy?: string }

/**
 * SBAR referral letter: AI drafted, doctor signs. On screen it is a compact letter inside the dialog; Print renders a
 * full one-page copy (patient details, findings, rules, transfer reason, medicines, SBAR, signature lines) into a
 * print-only node directly under <body>, because content inside the scrolling dialog was clipped when printed.
 */
export function HandoverLetter({ patient, note, facility, prescription, transfer }: {
  patient: Patient; note: HandoverRes; facility?: string; prescription?: Prescription; transfer?: TransferDetails;
}) {
  const log = useQueue((s) => s.log);
  const [qr, setQr] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const [printedAt] = useState(() => new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" }));
  const e = patient.extraction;
  const level = effectiveLevel(patient);

  useEffect(() => {
    QRCode.toDataURL(handoverQrText(patient, note.sbar, facility), { margin: 1, width: 220, errorCorrectionLevel: "L" }).then(setQr).catch(() => setQr(null));
  }, [patient, note, facility]);

  const sign = () => {
    const ts = new Date().toISOString();
    setSignedAt(ts);
    log({ actor: "doctor", action: "confirm", patientId: patient.id, reason: `Referral letter signed by ${signer.trim()}${facility ? ` → ${facility}` : ""}`,
      payload: { sbar: note.sbar, generatedBy: note.generatedBy, facility } });
  };
  const signedLabel = signedAt ? `${signer} · ${new Date(signedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}` : null;

  const vitals = Object.entries(e.vitals).filter(([, v]) => v !== undefined)
    .map(([k, v]) => ({ spo2: `SpO₂ ${v}%`, tempC: `Temp ${v} °C`, hr: `HR ${v}/min`, sbp: `Systolic BP ${v}`, dbp: `Diastolic BP ${v}`, rr: `RR ${v}/min` } as Record<string, string>)[k] ?? `${k} ${v}`);
  const meds = prescription?.items.filter((i) => i.confirmedByDoctor) ?? [];

  const printable = (
    <div className="awaaz-print-root">
      <article className="space-y-2 text-[10pt] leading-snug text-black">
        <header className="flex items-start justify-between gap-4 border-b-2 border-black pb-2">
          <div>
            <div className="text-[9pt] font-semibold tracking-widest uppercase">PIMS Islamabad · Medicine OPD · Referral / handover letter</div>
            <h1 className="text-[18pt] font-bold">{patient.name} · Token {patient.token} <span className="font-mono text-[11pt]">#{tokenCode(patient)}</span></h1>
            <div>Triage: <b>{level}</b>{patient.override ? ` (overridden from ${patient.triage.level}: ${patient.override.reason})` : ""} · Printed {printedAt}</div>
            {facility && <div className="mt-1 text-[13pt]">To: <b>{facility}</b></div>}
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {qr && <img src={qr} alt="QR code of this handover" className="size-24 shrink-0" />}
        </header>

        <table className="w-full border-collapse text-[10pt]">
          <tbody>
            <PrintRow k="Age / sex" v={`${e.age_years !== undefined ? `${e.age_years} years` : "not recorded"} · ${e.sex === "M" ? "male" : e.sex === "F" ? "female" : "not recorded"}`} />
            <PrintRow k="Locality" v={e.locality ?? "not recorded"} />
            <PrintRow k="Arrived" v={new Date(patient.arrivedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} />
            <PrintRow k="ER notified" v={patient.erNotifiedAt ? new Date(patient.erNotifiedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "no"} />
          </tbody>
        </table>

        <PrintSection title="Presenting complaint">
          <p><b>{e.chief_complaint}</b></p>
          <p className="italic">“{e.translation_en}”</p>
          <p className="urdu text-[13pt]" dir="rtl">{e.transcript_ur}</p>
        </PrintSection>

        <PrintSection title="Findings recorded at intake">
          <p>Symptoms: {e.symptoms.length ? e.symptoms.map(prettySymptom).join(", ") : "none recorded"}{e.duration_days !== undefined ? ` · for ${humanDuration(e.duration_days)}` : ""}</p>
          <p>Vitals: {vitals.length ? vitals.join(" · ") : "none recorded"}</p>
          {e.red_flags_mentioned.length > 0 && <p>Red flags said: {e.red_flags_mentioned.map((f, i) => <bdi key={i} dir="auto" className="urdu mx-1 text-[12pt]">“{f}”</bdi>)}</p>}
        </PrintSection>

        <PrintSection title="Why urgent: triage rules that fired">
          <ul className="list-disc pl-5">
            {patient.triage.hits.map((h) => <li key={h.id}><b>{h.id} {h.title}</b> ({h.level}): {h.why} <span className="text-[9pt]">[{h.source}]</span></li>)}
          </ul>
        </PrintSection>

        {transfer && (
          <PrintSection title="Why transfer">
            {transfer.needs.length > 0 && <p>Patient needs: <b>{transfer.needs.join(", ")}</b></p>}
            {transfer.whyNotHere.length > 0 && <p>Not available at PIMS now: {transfer.whyNotHere.join("; ")}</p>}
            {transfer.destinationWhy && <p>{facility}: {transfer.destinationWhy}</p>}
          </PrintSection>
        )}

        <PrintSection title="Handover (SBAR)">
          {SECTIONS.map(([k, label]) => <p key={k}><b>{label.split(" · ")[1]}:</b> <Mixed text={note.sbar[k]} /></p>)}
        </PrintSection>

        <PrintSection title="Medicines (doctor-confirmed)">
          {meds.length ? (
            <ul className="list-disc pl-5">{meds.map((m, i) => <li key={i}>{m.brand_match ?? m.drug_raw.value}{m.generic ? ` (${m.generic})` : ""} {m.strength.value}, {m.frequency.value}, {m.duration.value}</li>)}</ul>
          ) : <p>None prescribed yet.</p>}
          {prescription?.interactions.map((x) => <p key={x.pair.join("+")}><b>{x.severity === "major" ? "Major" : "Moderate"} interaction: {x.pair.join(" + ")}.</b> {x.note}</p>)}
        </PrintSection>

        <section className="grid grid-cols-2 gap-6 pt-4 text-[10pt]">
          <div>
            <div className="h-8 border-b border-black">{signedLabel}</div>
            <div>Referring doctor (name, signature, stamp)</div>
          </div>
          <div>
            <div className="h-8 border-b border-black" />
            <div>Received by (name, time)</div>
          </div>
        </section>
        <footer className="border-t border-black pt-1 text-[8pt]">
          {note.generatedBy === "ai" ? "AI drafted from the patient record" : "Drafted from the patient record (template)"}; any number not in the record is rejected. The referring doctor reviews and signs. Awaaz OPD · synthetic demo data.
        </footer>
      </article>
    </div>
  );

  return (
    <div className="space-y-3">
      <style>{`
        @media screen { .awaaz-print-root { display: none; } }
        @media print {
          @page { size: A4; margin: 12mm; }
          html, body { background: #fff !important; }
          body > *:not(.awaaz-print-root) { display: none !important; }
          .awaaz-print-root { display: block !important; }
        }
      `}</style>
      <article className="space-y-3 rounded-md border bg-background p-5 text-base">
        <header className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">PIMS Medicine OPD · Referral / handover</div>
            <h3 className="text-xl font-bold">{patient.name} · Token {patient.token} <span className="font-mono text-sm text-muted-foreground">#{tokenCode(patient)}</span></h3>
            <div className="text-sm text-muted-foreground">
              {e.age_years !== undefined ? `${e.age_years} y` : "age not recorded"} · {e.sex ?? "sex not recorded"} · {printedAt}
              {facility && <> · <b className="text-foreground">To: {facility}</b></>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <TriageBadge level={level} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR code of this handover" className="size-24 rounded border" />}
          </div>
        </header>
        <p className="urdu rounded-lg bg-muted/60 px-3 text-lg" dir="rtl">{e.transcript_ur}</p>
        {SECTIONS.map(([k, label]) => (
          <section key={k}>
            <h4 className="text-xs font-bold tracking-widest text-scrub uppercase">{label}</h4>
            <p className="leading-relaxed"><Mixed text={note.sbar[k]} /></p>
          </section>
        ))}
        <footer className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Sparkles className="size-4" /> {note.generatedBy === "ai" ? "AI drafted from the record" : "Drafted from the record (template)"} · doctor signs
          </span>
          <span className="font-medium">{signedLabel ? `Signed: ${signedLabel}` : "Not signed yet"}</span>
        </footer>
      </article>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {!signedAt && (
          <>
            <input value={signer} onChange={(ev) => setSigner(ev.target.value)} placeholder="Doctor's name" aria-label="Doctor's name"
              className="h-10 w-56 rounded-md border bg-background px-3 outline-none focus:ring-3 focus:ring-scrub/30" />
            <Button className="h-10 rounded-md bg-scrub text-primary-foreground hover:bg-scrub-deep" disabled={signer.trim().length < 2} onClick={sign}>
              <PenLine className="size-4" /> Sign
            </Button>
          </>
        )}
        <Button variant="outline" className="h-10 rounded-md" onClick={() => window.print()}><Printer className="size-4" /> Print full letter</Button>
      </div>
      {typeof document !== "undefined" && createPortal(printable, document.body)}
    </div>
  );
}

function PrintRow({ k, v }: { k: string; v: string }) {
  return <tr><td className="w-32 py-0.5 pr-3 align-top font-semibold">{k}</td><td className="py-0.5">{v}</td></tr>;
}

function PrintSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-0.5">
      <h2 className="text-[9pt] font-bold tracking-widest uppercase">{title}</h2>
      {children}
    </section>
  );
}
