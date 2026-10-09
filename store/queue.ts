// Person B: Zustand store (persist + BroadcastChannel "awaaz-queue"). TODO.
import type { Patient, Prescription } from "@/types/contracts";

export interface QueueState { patients: Patient[]; prescriptions: Prescription[]; demoMode: boolean; doctorsOnDuty: number }
