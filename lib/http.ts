import { ZodError, type ZodType } from "zod";
import type { ApiResult } from "@/types/contracts";
import { DEMO_HEADER } from "@/types/contracts";
import type { RunMeta } from "@/lib/cache";
import { DemoMissError } from "@/lib/cache";

export const isDemo = (req: Request) => process.env.DEMO_MODE === "true" || req.headers.get(DEMO_HEADER) === "1";

/** Parse + validate the JSON body, run the pipeline, wrap everything as ApiResult<T>. */
export async function handle<B, T>(req: Request, schema: ZodType<B>, fn: (body: B, demo: boolean) => Promise<{ data: T; meta: RunMeta }>) {
  try {
    const body = schema.parse(await req.json());
    const { data, meta } = await fn(body, isDemo(req));
    return Response.json({ ok: true, data, meta } satisfies ApiResult<T>);
  } catch (e) {
    const status = e instanceof ZodError || e instanceof SyntaxError ? 400 : e instanceof DemoMissError ? 404 : 502;
    const raw = e instanceof ZodError ? `invalid request: ${e.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` : e instanceof Error ? e.message : "unknown error";
    console.error(`[api] ${req.url}: ${raw}`); // full technical detail stays in the server log (and the audit log)
    const error = friendlyError(raw);
    return Response.json({ ok: false, error } satisfies ApiResult<T>, { status });
  }
}

/** What staff see when every AI path failed: what to do next, not the internals. */
export function friendlyError(raw: string): string {
  if (raw.startsWith("all AI paths failed")) {
    return "The AI couldn't understand this one. Please try again (speak a little longer, closer to the mic), or use a sample case.";
  }
  if (raw.startsWith("demo mode:")) return "Demo mode is on and this input has no saved answer. Use a sample case, or turn demo mode off (Alt+Shift+D).";
  return raw;
}
