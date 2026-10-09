// Person B: Zustand queue store. Persisted to localStorage and mirrored across windows via BroadcastChannel "awaaz-queue".
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuditEntry, Extraction, Patient, Prescription, RxItem, TriageLevel, TriageResult } from "@/types/contracts";
import { setDemoMode as setApiDemoMode } from "@/lib/mock";
import seedPatients from "@/fixtures/seed-patients.json";
import localitiesFile from "@/fixtures/localities.json";

export const LEVEL_RANK: Record<TriageLevel, number> = { RED: 0, ORANGE: 1, YELLOW: 2, GREEN: 3 };
/** Average consult minutes per level, used for the "est." wait. */
export const CONSULT_MIN: Record<TriageLevel, number> = { RED: 0, ORANGE: 10, YELLOW: 15, GREEN: 8 };
/** Rules whose hits put a pin on the dengue map. */
export const DENGUE_RULES = ["R09", "R10", "R17"];

type Locality = { name: string; ur?: string; city: string; lat: number; lng: number };
export const LOCALITIES = (localitiesFile as { localities: Locality[] }).localities;

export const effectiveLevel = (p: Patient): TriageLevel => p.override?.level ?? p.triage.level;
const isActive = (p: Patient) => p.status === "waiting" || p.status === "with_doctor";

/** Sort: level (override wins) RED→GREEN, then arrival time. */
export function sortQueue(ps: Patient[]): Patient[] {
  return [...ps].sort(
    (a, b) => LEVEL_RANK[effectiveLevel(a)] - LEVEL_RANK[effectiveLevel(b)] || a.arrivedAt.localeCompare(b.arrivedAt),
  );
}

/** est. wait = consult minutes of waiting patients ahead (same or higher level) ÷ doctors on duty. */
function withWaits(ps: Patient[], doctors: number): Patient[] {
  const queue = sortQueue(ps.filter((p) => p.status === "waiting"));
  const wait = new Map<string, number>();
  let ahead = 0;
  for (const p of queue) {
    wait.set(p.id, Math.round(ahead / Math.max(1, doctors)));
    ahead += CONSULT_MIN[effectiveLevel(p)];
  }
  return ps.map((p) => ({ ...p, estWaitMin: wait.get(p.id) ?? 0 }));
}

function geoFor(e: Extraction, t: TriageResult): Patient["geo"] {
  if (!e.locality || !t.hits.some((h) => DENGUE_RULES.includes(h.id))) return undefined;
  const key = e.locality.toLowerCase().replace(/[^a-z0-9]/g, "");
  const l = LOCALITIES.find((x) => x.name.toLowerCase().replace(/[^a-z0-9]/g, "") === key);
  // Small jitter so several patients from one locality don't stack on one pixel.
  return l ? { lat: l.lat + (Math.random() - 0.5) * 0.006, lng: l.lng + (Math.random() - 0.5) * 0.006, label: l.name } : undefined;
}

function seeds(): Patient[] {
  return (seedPatients as Patient[]).map((p) => ({ ...p, geo: p.geo ?? geoFor(p.extraction, p.triage) }));
}

const uid = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

type NewAudit = Omit<AuditEntry, "id" | "ts">;

export interface QueueState {
  patients: Patient[];
  prescriptions: Prescription[];
  audit: AuditEntry[];
  demoMode: boolean;
  doctorsOnDuty: number;
  addPatient(input: { name: string; extraction: Extraction; triage: TriageResult }): Patient;
  updateStatus(id: string, status: Patient["status"]): void;
  override(id: string, level: TriageLevel, reason: string, by?: string): void;
  notifyER(id: string): void;
  addPrescription(rx: Prescription): void;
  updatePrescription(id: string, patch: Partial<Prescription>): void;
  confirmRxItem(rxId: string, index: number, patch?: Partial<RxItem>): void;
  log(entry: NewAudit): void;
  setDemoMode(on: boolean): void;
  setDoctorsOnDuty(n: number): void;
  reset(): void;
}

export const useQueue = create<QueueState>()(
  persist(
    (set, get) => {
      const log = (entry: NewAudit) =>
        set((s) => ({ audit: [{ id: uid(), ts: new Date().toISOString(), ...entry }, ...s.audit].slice(0, 500) }));
      const setPatients = (fn: (ps: Patient[]) => Patient[]) =>
        set((s) => ({ patients: withWaits(fn(s.patients), s.doctorsOnDuty) }));

      return {
        patients: withWaits(seeds(), 3),
        prescriptions: [],
        audit: [],
        demoMode: false,
        doctorsOnDuty: 3,

        addPatient({ name, extraction, triage }) {
          const token = Math.max(40, ...get().patients.map((p) => p.token)) + 1;
          const patient: Patient = {
            id: `p-${uid()}`, token, name: name.trim() || `Patient ${token}`, arrivedAt: new Date().toISOString(),
            extraction, triage, status: "waiting", estWaitMin: 0, geo: geoFor(extraction, triage),
          };
          setPatients((ps) => [...ps, patient]);
          log({ actor: "nurse", action: "confirm", patientId: patient.id, payload: { token, level: triage.level }, reason: "Added to queue" });
          if (triage.level === "RED") get().notifyER(patient.id);
          return get().patients.find((p) => p.id === patient.id) ?? patient;
        },

        updateStatus(id, status) {
          setPatients((ps) => ps.map((p) => (p.id === id ? { ...p, status } : p)));
          if (status === "sent_to_er") get().notifyER(id);
        },

        override(id, level, reason, by = "nurse") {
          if (!reason.trim()) throw new Error("Override needs a reason");
          const before = get().patients.find((p) => p.id === id);
          setPatients((ps) => ps.map((p) => (p.id === id ? { ...p, override: { level, by, reason } } : p)));
          log({ actor: by === "doctor" ? "doctor" : "nurse", action: "override", patientId: id, reason,
            payload: { from: before ? effectiveLevel(before) : undefined, to: level } });
          if (level === "RED") get().notifyER(id);
        },

        notifyER(id) {
          const p = get().patients.find((x) => x.id === id);
          if (!p || p.erNotifiedAt) return;
          setPatients((ps) => ps.map((x) => (x.id === id ? { ...x, erNotifiedAt: new Date().toISOString() } : x)));
          log({ actor: "system", action: "notify_er", patientId: id, ruleIds: p.triage.hits.map((h) => h.id),
            payload: { token: p.token, title: p.triage.hits[0]?.title } });
        },

        addPrescription(rx) {
          set((s) => ({ prescriptions: [rx, ...s.prescriptions.filter((r) => r.id !== rx.id)] }));
        },

        updatePrescription(id, patch) {
          set((s) => ({ prescriptions: s.prescriptions.map((r) => (r.id === id ? { ...r, ...patch } : r)) }));
        },

        confirmRxItem(rxId, index, patch) {
          set((s) => ({
            prescriptions: s.prescriptions.map((r) =>
              r.id !== rxId ? r : { ...r, items: r.items.map((it, i) => (i === index ? { ...it, ...patch, confirmedByDoctor: true } : it)) },
            ),
          }));
        },

        log,

        setDemoMode(on) {
          setApiDemoMode(on);
          set({ demoMode: on });
        },

        setDoctorsOnDuty(n) {
          set((s) => ({ doctorsOnDuty: n, patients: withWaits(s.patients, n) }));
        },

        reset() {
          set((s) => ({ patients: withWaits(seeds(), s.doctorsOnDuty), prescriptions: [], audit: [] }));
          log({ actor: "system", action: "confirm", payload: { reset: true }, reason: "Demo reset" });
        },
      };
    },
    {
      name: "awaaz-queue",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ patients: s.patients, prescriptions: s.prescriptions, audit: s.audit, demoMode: s.demoMode, doctorsOnDuty: s.doctorsOnDuty }),
      skipHydration: true, // rehydrated on mount by <StoreSync/> to avoid SSR hydration mismatches
      onRehydrateStorage: () => (s) => { if (s) setApiDemoMode(s.demoMode); },
    },
  ),
);

export const activePatients = (ps: Patient[]) => sortQueue(ps.filter(isActive));

// ---------- cross-window sync ----------
type Synced = Pick<QueueState, "patients" | "prescriptions" | "audit" | "demoMode" | "doctorsOnDuty">;
let channel: BroadcastChannel | null = null;
let applyingRemote = false;

/** Starts BroadcastChannel sync; returns a cleanup. Call once from a client effect. */
export function startQueueSync(): () => void {
  if (typeof window === "undefined" || typeof BroadcastChannel === "undefined" || channel) return () => {};
  const ch = new BroadcastChannel("awaaz-queue");
  channel = ch;
  ch.onmessage = (ev: MessageEvent<{ type: "state"; state: Synced }>) => {
    if (ev.data?.type !== "state") return;
    applyingRemote = true;
    useQueue.setState(ev.data.state);
    setApiDemoMode(ev.data.state.demoMode);
    applyingRemote = false;
  };
  const unsub = useQueue.subscribe((s) => {
    if (applyingRemote) return;
    const state: Synced = { patients: s.patients, prescriptions: s.prescriptions, audit: s.audit, demoMode: s.demoMode, doctorsOnDuty: s.doctorsOnDuty };
    ch.postMessage({ type: "state", state });
  });
  return () => { unsub(); ch.close(); channel = null; };
}
