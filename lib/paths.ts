// Writable runtime root. Serverless hosts (Vercel) only allow writes under /tmp; AWAAZ_WRITE_DIR overrides.
// On such hosts the runtime cache and audit log are per-instance and reset on cold start (fine for a demo).
export const WRITE_ROOT = process.env.AWAAZ_WRITE_DIR ?? (process.env.VERCEL ? "/tmp/awaaz" : process.cwd());
