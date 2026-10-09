import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditEntry } from "@/types/contracts";
import { RULES_VERSION } from "@/lib/rules/rules";
import { audit } from "@/lib/audit";

const CACHE = path.join(process.cwd(), ".cache");
const GOLDEN = path.join(CACHE, "golden"); // committed: the demo path must work from a fresh clone

/** sha256(route | model | promptVersion | rulesVersion | input bytes…) */
export function cacheKey(route: string, model: string, promptVersion: string, input: (string | Buffer)[]): string {
  const h = createHash("sha256");
  for (const p of [route, model, promptVersion, RULES_VERSION, ...input]) h.update(p).update("|");
  return h.digest("hex");
}

const tryRead = async (file: string) => readFile(file).catch(() => null);

interface Stored<T> { model?: string; data: T }

export async function cacheGet<T>(key: string): Promise<Stored<T> | null> {
  const buf = (await tryRead(path.join(GOLDEN, `${key}.json`))) ?? (await tryRead(path.join(CACHE, `${key}.json`)));
  return buf ? (JSON.parse(buf.toString("utf8")) as Stored<T>) : null;
}

export async function cacheSet<T>(key: string, value: Stored<T>): Promise<void> {
  await mkdir(CACHE, { recursive: true });
  await writeFile(path.join(CACHE, `${key}.json`), JSON.stringify(value));
}

// Binary blobs (TTS audio) live next to the JSON entries: .cache/audio/<key>.wav, .cache/golden/audio/<key>.wav
export async function blobGet(key: string): Promise<Buffer | null> {
  return (await tryRead(path.join(GOLDEN, "audio", `${key}.wav`))) ?? tryRead(path.join(CACHE, "audio", `${key}.wav`));
}
export async function blobSet(key: string, data: Buffer): Promise<void> {
  await mkdir(path.join(CACHE, "audio"), { recursive: true });
  await writeFile(path.join(CACHE, "audio", `${key}.wav`), data);
}

/** Copy a cache entry (and its audio, if any) into .cache/golden so it is committed. Used by scripts/warm-cache. */
export async function promote(key: string): Promise<boolean> {
  await mkdir(path.join(GOLDEN, "audio"), { recursive: true });
  try {
    await copyFile(path.join(CACHE, `${key}.json`), path.join(GOLDEN, `${key}.json`));
  } catch {
    return (await tryRead(path.join(GOLDEN, `${key}.json`))) !== null; // already golden
  }
  await copyFile(path.join(CACHE, "audio", `${key}.wav`), path.join(GOLDEN, "audio", `${key}.wav`)).catch(() => {});
  return true;
}

/** Golden fixture file in fixtures/golden, e.g. ("c07-dengue-dhok-hassu", "extract"). */
export async function goldenFixture<T>(caseId: string | undefined, kind: string): Promise<T | null> {
  if (!caseId || !/^[\w-]+$/.test(caseId)) return null;
  const buf = await tryRead(path.join(process.cwd(), "fixtures", "golden", `${caseId}.${kind}.json`));
  return buf ? (JSON.parse(buf.toString("utf8")) as T) : null;
}

// ---------- the one path every AI call takes ----------

/** `run` receives the cache key (TTS uses it to name the audio file). */
export interface Attempt<T> { label: string; model?: string; run: (key: string) => Promise<T> }
export interface RunMeta { cached: boolean; model?: string; ms: number; fallback?: string }
export interface RunOpts<T> {
  route: string;
  model: string; // primary model, part of the cache key
  promptVersion: string;
  input: (string | Buffer)[];
  demo: boolean;
  action: AuditEntry["action"];
  patientId?: string;
  attempts: Attempt<T>[]; // primary first
  golden?: () => Promise<T | null>;
}

export class DemoMissError extends Error {}

const demoDelay = () => new Promise((r) => setTimeout(r, 900 + Math.random() * 500));
const msg = (e: unknown) => (e instanceof Error ? e.message : String(e)).slice(0, 300);

/**
 * cache → primary → fallbacks (in order) → golden fixture → error.
 * Demo mode never calls an API: cache, else golden, with a simulated delay.
 */
export async function runAi<T>(o: RunOpts<T>): Promise<{ data: T; meta: RunMeta; key: string }> {
  const t0 = Date.now();
  const key = cacheKey(o.route, o.model, o.promptVersion, o.input);
  const base = { patientId: o.patientId, inputHash: key, promptVersion: o.promptVersion };

  const hit = await cacheGet<T>(key);
  if (hit) {
    if (o.demo) await demoDelay();
    await audit({ ...base, actor: "system", action: "cache_hit", model: hit.model, payload: { route: o.route } });
    return { data: hit.data, key, meta: { cached: true, model: hit.model, ms: Date.now() - t0 } };
  }

  const fromGolden = async (why: string) => {
    const g = await o.golden?.();
    if (!g) return null;
    if (o.demo) await demoDelay();
    await audit({ ...base, actor: "system", action: "fallback", payload: { route: o.route, to: "golden" }, reason: why });
    return { data: g, key, meta: { cached: true, ms: Date.now() - t0, fallback: "golden" } };
  };

  if (o.demo) {
    const g = await fromGolden("demo mode: no cache entry");
    if (g) return g;
    throw new DemoMissError(`demo mode: no cached or golden response for this ${o.route} input`);
  }

  const errors: string[] = [];
  for (const [i, a] of o.attempts.entries()) {
    try {
      const data = await a.run(key);
      await cacheSet(key, { model: a.model, data });
      await audit({ ...base, actor: "ai", action: o.action, model: a.model, payload: data });
      return { data, key, meta: { cached: false, model: a.model, ms: Date.now() - t0, fallback: i > 0 ? a.label : undefined } };
    } catch (e) {
      errors.push(`${a.label}: ${msg(e)}`);
      await audit({ ...base, actor: "system", action: "fallback", model: a.model, payload: { route: o.route, failed: a.label }, reason: msg(e) });
    }
  }

  const g = await fromGolden(`all models failed: ${errors.join(" | ")}`);
  if (g) return g;
  throw new Error(`all AI paths failed — ${errors.join(" | ")}`);
}
