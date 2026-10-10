import { describe, expect, it } from "vitest";
import type { AuditEntry, TriageLevel } from "@/types/contracts";
import type { OverrideEvent } from "@/types/features";
import { flagsFor, overrideEvents, reviewOverrides, tokenCode } from "@/lib/overrides";

let n = 0;
const ev = (p: Partial<OverrideEvent> & { from: TriageLevel; to: TriageLevel }): OverrideEvent => ({
  id: `e${n++}`, ts: `2026-10-10T0${n % 10}:00:00Z`, patientId: `p${n}`, by: "Nurse Ayesha", rulesLevel: p.from,
  reason: "Looks pale and drowsy on re-assessment", ...p,
});
const codes = (e: OverrideEvent) => flagsFor(e).map((f) => f.code);

describe("flagsFor", () => {
  it("a clinical one-level upgrade is clean", () => {
    expect(codes(ev({ from: "YELLOW", to: "ORANGE" }))).toEqual([]);
  });
  it("vague or non-clinical reasons are flagged", () => {
    expect(codes(ev({ from: "YELLOW", to: "ORANGE", reason: "VIP" }))).toEqual(["vague_reason"]);
    expect(codes(ev({ from: "YELLOW", to: "ORANGE", reason: "Relative of staff member, please see first" }))).toEqual(["vague_reason"]);
    expect(codes(ev({ from: "YELLOW", to: "ORANGE", reason: "short reason" }))).toEqual(["vague_reason"]);
  });
  it("GREEN → RED without rule support is a high-severity jump", () => {
    const f = flagsFor(ev({ from: "GREEN", to: "RED", reason: "sifarish" }));
    expect(f.map((x) => x.code)).toEqual(["vague_reason", "unsupported_jump"]);
    expect(f[1]).toMatchObject({ severity: "high", message: "Raised 3 levels above what the rules found (GREEN → RED)" });
  });
  it("lowering an urgent patient is flagged; lowering YELLOW is not", () => {
    expect(codes(ev({ from: "RED", to: "YELLOW" }))).toEqual(["urgent_downgrade"]);
    expect(codes(ev({ from: "YELLOW", to: "GREEN" }))).toEqual([]);
  });
  it("jump is measured from the rules level, not the previous override", () => {
    expect(codes(ev({ from: "ORANGE", to: "RED", rulesLevel: "GREEN" }))).toContain("unsupported_jump");
  });
});

describe("reviewOverrides", () => {
  it("flags the 3rd GREEN upgrade by the same person on the same day", () => {
    const evs = [1, 2, 3].map((i) => ev({ from: "GREEN", to: "YELLOW", by: i === 2 ? "nurse ayesha" : "Nurse Ayesha", ts: `2026-10-10T0${i}:00:00Z` }));
    const r = reviewOverrides(evs);
    expect(r.map((x) => x.flags.some((f) => f.code === "staff_pattern"))).toEqual([false, false, true]);
    expect(r[2].flags.at(-1)?.message).toBe("Nurse Ayesha has raised 3 GREEN patients today");
  });
  it("different days or people don't count together", () => {
    const evs = [
      ev({ from: "GREEN", to: "YELLOW", ts: "2026-10-09T09:00:00Z" }),
      ev({ from: "GREEN", to: "YELLOW", by: "Dr. Bilal" }),
      ev({ from: "GREEN", to: "YELLOW" }),
    ];
    expect(reviewOverrides(evs).flatMap((x) => x.flags).some((f) => f.code === "staff_pattern")).toBe(false);
  });
});

describe("overrideEvents", () => {
  it("reads override payloads from the audit trail and skips malformed ones", () => {
    const audit = [
      { id: "a", ts: "2026-10-10T02:00:00Z", actor: "nurse", action: "override", patientId: "p1", reason: "VIP", payload: { from: "GREEN", to: "RED", rulesLevel: "GREEN", by: "Nurse X", token: 44 } },
      { id: "b", ts: "2026-10-10T01:00:00Z", actor: "nurse", action: "override", patientId: "p2", reason: "old", payload: { from: "GREEN", to: "YELLOW" } },
      { id: "c", ts: "2026-10-10T03:00:00Z", actor: "system", action: "notify_er", patientId: "p1", payload: {} },
    ] as AuditEntry[];
    expect(overrideEvents(audit)).toEqual([expect.objectContaining({ id: "a", token: 44, by: "Nurse X", to: "RED" })]);
  });
});

describe("tokenCode", () => {
  const p = { id: "p-abc", token: 48, arrivedAt: "2026-10-10T06:00:00Z" };
  it("is stable, 4 chars, unambiguous alphabet", () => {
    expect(tokenCode(p)).toBe(tokenCode({ ...p }));
    expect(tokenCode(p)).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}$/);
  });
  it("changes if the token or patient changes", () => {
    expect(tokenCode({ ...p, token: 49 })).not.toBe(tokenCode(p));
    expect(tokenCode({ ...p, id: "p-abd" })).not.toBe(tokenCode(p));
  });
});

describe("clinical reasons with everyday words are not flagged", () => {
  it("'urgent' / 'please' alone don't make a reason vague", () => {
    expect(flagsFor({ id: "x", ts: "2026-10-10T01:00:00Z", patientId: "p", by: "Dr. Bilal", from: "YELLOW", to: "ORANGE", rulesLevel: "YELLOW",
      reason: "Collapsed in waiting area, urgent, please reassess" })).toEqual([]);
    expect(flagsFor({ id: "y", ts: "2026-10-10T01:00:00Z", patientId: "p", by: "Dr. Bilal", from: "YELLOW", to: "ORANGE", rulesLevel: "YELLOW",
      reason: "Known diabetic, family history of MI, now sweaty" })).toEqual([]);
  });
});

describe("NON_CLINICAL list (review note)", () => {
  it("'staff nurse noticed…' style reasons are not flagged", () => {
    expect(flagsFor({ id: "z", ts: "2026-10-10T01:00:00Z", patientId: "p", by: "Nurse Hina", from: "YELLOW", to: "ORANGE", rulesLevel: "YELLOW",
      reason: "Staff nurse noticed new confusion, as per request of ward sahab on referral" })).toEqual([]);
  });
});
