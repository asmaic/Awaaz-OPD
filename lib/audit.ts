import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEntry } from "@/types/contracts";

const DIR = path.join(process.cwd(), ".data");
const FILE = path.join(DIR, "audit.jsonl");

/** Append one event as a JSON line to .data/audit.jsonl. Never pass secrets or raw audio/image bytes. */
export async function audit(e: Omit<AuditEntry, "id" | "ts">): Promise<AuditEntry> {
  const entry: AuditEntry = { id: randomUUID(), ts: new Date().toISOString(), ...e };
  await mkdir(DIR, { recursive: true });
  await appendFile(FILE, `${JSON.stringify(entry)}\n`);
  return entry;
}

/** Latest entries, newest first. */
export async function readAudit(limit = 200): Promise<AuditEntry[]> {
  let text: string;
  try {
    text = await readFile(FILE, "utf8");
  } catch {
    return [];
  }
  return text.split("\n").filter(Boolean).slice(-limit).map((l) => JSON.parse(l) as AuditEntry).reverse();
}
