"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { PenLine, Printer, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TriageBadge } from "@/components/triage";
import { handoverQrText } from "@/lib/handover";
import { tokenCode } from "@/lib/overrides";
import { effectiveLevel, useQueue } from "@/store/queue";
import type { Patient } from "@/types/contracts";
import type { HandoverRes } from "@/types/features";

const SECTIONS = [["situation", "S · Situation"], ["background", "B · Background"], ["assessment", "A · Assessment"], ["recommendation", "R · Recommendation"]] as const;

/** One-page SBAR referral letter: AI drafted, doctor signs. Printable (only the letter prints) and as a QR code. */
export function HandoverLetter({ patient, note, facility }: { patient: Patient; note: HandoverRes; facility?: string }) {
  const log = useQueue((s) => s.log);
  const [qr, setQr] = useState<string | null>(null);
  const [signer, setSigner] = useState("");
  const [signedAt, setSignedAt] = useState<string | null>(null);
  const e = patient.extraction;

  useEffect(() => {
    QRCode.toDataURL(handoverQrText(patient, note.sbar, facility), { margin: 1, width: 220, errorCorrectionLevel: "L" }).then(setQr).catch(() => setQr(null));
  }, [patient, note, facility]);

  const sign = () => {
    const ts = new Date().toISOString();
    setSignedAt(ts);
    log({ actor: "doctor", action: "confirm", patientId: patient.id, reason: `Referral letter signed by ${signer.trim()}${facility ? ` → ${facility}` : ""}`,
      payload: { sbar: note.sbar, generatedBy: note.generatedBy, facility } });
  };

  return (
    <div className="space-y-3">
      <style>{`@media print {
        body * { visibility: hidden !important; }
        .awaaz-letter, .awaaz-letter * { visibility: visible !important; }
        .awaaz-letter { position: fixed; inset: 0; padding: 24px; background: white; color: black; }
        .awaaz-no-print { display: none !important; }
      }`}</style>
      <article className="awaaz-letter space-y-3 rounded-md border bg-background p-5 text-base">
        <header className="flex items-start justify-between gap-4 border-b pb-3">
          <div>
            <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">PIMS Medicine OPD · Referral / handover</div>
            <h3 className="text-xl font-bold">{patient.name} · Token {patient.token} <span className="font-mono text-sm text-muted-foreground">#{tokenCode(patient)}</span></h3>
            <div className="text-sm text-muted-foreground">
              {e.age_years !== undefined ? `${e.age_years} y` : "age not recorded"} · {e.sex ?? "sex not recorded"} · {new Date().toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
              {facility && <> · <b className="text-foreground">To: {facility}</b></>}
            </div>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-2">
            <TriageBadge level={effectiveLevel(patient)} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {qr && <img src={qr} alt="QR code of this handover" className="size-24 rounded border" />}
          </div>
        </header>
        <p className="urdu rounded-lg bg-muted/60 px-3 text-lg" dir="rtl">{e.transcript_ur}</p>
        {SECTIONS.map(([k, label]) => (
          <section key={k}>
            <h4 className="text-xs font-bold tracking-widest text-scrub uppercase">{label}</h4>
            <p className="leading-relaxed">{note.sbar[k]}</p>
          </section>
        ))}
        <footer className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
            <Sparkles className="size-4" /> {note.generatedBy === "ai" ? "AI drafted from the record" : "Drafted from the record (template)"} · doctor signs
          </span>
          <span className="font-medium">{signedAt ? `Signed: ${signer} · ${new Date(signedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Not signed yet"}</span>
        </footer>
      </article>
      <div className="awaaz-no-print flex flex-wrap items-center justify-end gap-2">
        {!signedAt && (
          <>
            <input value={signer} onChange={(ev) => setSigner(ev.target.value)} placeholder="Doctor's name" aria-label="Doctor's name"
              className="h-10 w-56 rounded-md border bg-background px-3 outline-none focus:ring-3 focus:ring-scrub/30" />
            <Button className="h-10 rounded-md bg-scrub text-primary-foreground hover:bg-scrub-deep" disabled={signer.trim().length < 2} onClick={sign}>
              <PenLine className="size-4" /> Sign
            </Button>
          </>
        )}
        <Button variant="outline" className="h-10 rounded-md" onClick={() => window.print()}><Printer className="size-4" /> Print</Button>
      </div>
    </div>
  );
}
