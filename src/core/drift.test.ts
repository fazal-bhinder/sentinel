import { describe, expect, it } from "vitest";
import { silentNullDrift, structuralDrift, type FieldStat } from "./drift";
import { fingerprint } from "./fingerprint";
import { makeOpenAIBad, makeOpenAIClean, makeOpenAINullCost } from "../seed/fixtures";

describe("fingerprint (path-based)", () => {
  it("treats a nullable field going null as the SAME shape (no false drift)", () => {
    const clean = fingerprint(makeOpenAIClean(1));
    const nullCost = fingerprint(makeOpenAINullCost("x"));
    expect(nullCost).toBe(clean); // cost.amount_usd path still present
  });

  it("flags a genuinely moved path (cost -> pricing.cost)", () => {
    expect(fingerprint(makeOpenAIBad(1))).not.toBe(fingerprint(makeOpenAIClean(1)));
  });
});

describe("structuralDrift", () => {
  it("emits a warn listing the moved paths", () => {
    const known = fingerprint(makeOpenAIClean(1));
    const alert = structuralDrift({
      provider: "openai",
      current: makeOpenAIBad(1),
      knownFingerprints: new Set([known]),
      knownPaths: new Set(known.split("\n")),
    });
    expect(alert?.severity).toBe("warn");
    expect((alert?.details.added as string[]) ?? []).toContain("pricing.cost.amount_usd");
    expect((alert?.details.removed as string[]) ?? []).toContain("cost.amount_usd");
  });

  it("stays silent on the first ever payload", () => {
    expect(
      structuralDrift({
        provider: "openai",
        current: makeOpenAIClean(1),
        knownFingerprints: new Set(),
        knownPaths: new Set(),
      }),
    ).toBeNull();
  });
});

describe("silentNullDrift", () => {
  const baseline = (field: string, recentPopulated: number): FieldStat => ({
    field,
    overallSeen: 160,
    overallPopulated: 150, // ~94% historically
    recentSeen: 20,
    recentPopulated, // recently
  });

  it("fires CRITICAL when cost goes dark without throwing", () => {
    const alerts = silentNullDrift("openai", [baseline("cost.amount_usd", 0)]);
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.severity).toBe("critical");
  });

  it("fires only warn for non-cost fields", () => {
    const alerts = silentNullDrift("openai", [baseline("model", 0)]);
    expect(alerts[0]!.severity).toBe("warn");
  });

  it("does not fire while the field is still populated", () => {
    expect(silentNullDrift("openai", [baseline("cost.amount_usd", 20)])).toHaveLength(0);
  });
});
