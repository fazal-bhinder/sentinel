/**
 * The demo IS the acceptance test. `npm run seed` reproduces all five steps
 * from a clean DB and asserts the differentiators (dedup, late backfill,
 * silent-null on cost, no-regression replay) actually hold.
 */
import { openaiV2 } from "../core/parsers";
import { buildRegistry } from "../core/registry";
import { type CellResult, runReplay } from "../core/replay";
import { ingest } from "../db/ingest";
import { pool } from "./../db/pool";
import { listAlerts, loadCorpus, resetAll } from "../db/queries";
import {
  makeAnthropicClean,
  makeCursorClean,
  makeOpenAIBackfill,
  makeOpenAIBad,
  makeOpenAIClean,
  makeOpenAINullCost,
} from "./fixtures";

const N = 150;

function assert(cond: unknown, msg: string): void {
  if (!cond) throw new Error(`✗ ASSERTION FAILED: ${msg}`);
}

function step(n: number, title: string): void {
  console.log(`\n\x1b[1m\x1b[36m[${n}] ${title}\x1b[0m`);
}

function ok(msg: string): void {
  console.log(`    \x1b[32m✓\x1b[0m ${msg}`);
}

async function eventCount(): Promise<number> {
  const r = await pool.query<{ c: string }>("SELECT count(*)::int AS c FROM events");
  return Number(r.rows[0]!.c);
}

function nonOpenai(cells: CellResult[]): CellResult[] {
  return cells
    .filter((c) => c.provider !== "openai")
    .map((c) => ({ ...c, throwReasons: [] }))
    .sort((a, b) => `${a.provider}${a.version}`.localeCompare(`${b.provider}${b.version}`));
}

async function main() {
  console.log("\x1b[1mOXIMY — seeding the demo (this is the acceptance test)\x1b[0m");
  await resetAll();

  // Steps 1-4 run against a registry that only knows v1 — the v2 fix arrives in step 5.
  const registry = buildRegistry();

  /* 1 — clean corpus -------------------------------------------------- */
  step(1, "Seed ~150 clean payloads each for openai / anthropic / cursor");
  for (let i = 0; i < N; i++) {
    const a = await ingest("openai", makeOpenAIClean(i), registry);
    const b = await ingest("anthropic", makeAnthropicClean(i), registry);
    const c = await ingest("cursor", makeCursorClean(i), registry);
    assert(a.inserted && b.inserted && c.inserted, "every clean payload is a new row");
  }
  assert((await eventCount()) === N * 3, `expected ${N * 3} events`);
  ok(`${N * 3} events ingested, all parsed`);

  const baseline = runReplay(registry, await loadCorpus());
  assert(
    baseline.every((c) => c.status === "green"),
    "replay matrix all green on the clean corpus",
  );
  ok("replay matrix all green");
  const baselineNonOpenai = nonOpenai(baseline);

  /* 2 — redelivery (dedup) ------------------------------------------- */
  step(2, "Re-send 30 openai payloads → expect 0 new rows");
  const before2 = await eventCount();
  for (let i = 0; i < 30; i++) {
    const r = await ingest("openai", makeOpenAIClean(i), registry);
    assert(!r.inserted, `redelivery of oa_${i} must not insert`);
  }
  assert((await eventCount()) === before2, "row count unchanged after redelivery");
  ok("30 redelivered, 0 new rows (dedup works)");

  /* 3 — late cost backfill ------------------------------------------- */
  step(3, "cost=null arrives, a follow-up backfills the same dedup_key");
  const id = "oa_backfill_demo";
  const first = await ingest("openai", makeOpenAINullCost(id), registry);
  assert(first.inserted && first.revision === 1, "null-cost payload inserts at revision 1");
  ok(`inserted ${id} at revision ${first.revision} (cost null)`);

  const before3 = await eventCount();
  const back = await ingest("openai", makeOpenAIBackfill(id), registry);
  assert(!back.inserted, "backfill must not create a new row");
  assert(back.revision === 2, `expected revision 2, got ${back.revision}`);
  assert((await eventCount()) === before3, "no duplicate row from backfill");
  ok(`same dedup_key → revision 1 → ${back.revision}, cost corrected, NO duplicate`);

  /* 4 — silent null on cost ------------------------------------------ */
  step(4, "openai ships 'bad' payloads: cost moved to pricing.cost (v1 reads null)");
  for (let i = 0; i < 30; i++) {
    const r = await ingest("openai", makeOpenAIBad(i), registry); // v1 — does NOT throw
    assert(r.inserted, "bad payloads are genuinely new rows");
  }
  const alerts = await listAlerts();
  const silent = alerts.find(
    (a) => a.type === "SILENT_NULL" && a.field === "cost.amount_usd" && a.severity === "critical",
  );
  assert(silent, "SILENT_NULL critical on cost.amount_usd must fire");
  const structural = alerts.find((a) => a.type === "STRUCTURAL" && a.provider === "openai");
  assert(structural, "STRUCTURAL warn on the moved path must fire");
  ok("drift fired: SILENT_NULL cost.amount_usd \x1b[31mCRITICAL\x1b[0m + STRUCTURAL warn");
  ok(`  "${silent!.message}"`);

  /* 5 — register v2, replay, prove no regression --------------------- */
  step(5, "Register openai parser v2 and re-run replay");
  registry.register(openaiV2);
  const finalMatrix = runReplay(registry, await loadCorpus());

  assert(
    finalMatrix.every((c) => c.throw === 0),
    "no parser version throws on any historical payload",
  );
  ok("all historical payloads still parse (zero throws)");

  assert(
    JSON.stringify(baselineNonOpenai) === JSON.stringify(nonOpenai(finalMatrix)),
    "anthropic + cursor cells UNCHANGED after the openai v2 change",
  );
  ok("anthropic + cursor matrix cells unchanged — no regression");

  const oaV2 = finalMatrix.find((c) => c.provider === "openai" && c.version === 2)!;
  assert(oaV2.throw === 0, "openai v2 parses the bad payloads without throwing");
  ok(`openai v2 reparses corpus: ${oaV2.ok} ok, ${oaV2.drift} corrected (the bad payloads)`);

  printMatrix(finalMatrix);
  console.log(
    "\n\x1b[1m\x1b[32mDONE.\x1b[0m Dashboard: start the api + web, open http://localhost:3000\n",
  );
  await pool.end();
}

function printMatrix(cells: CellResult[]): void {
  console.log("\n    replay matrix (provider × version)");
  for (const c of cells) {
    const color = c.status === "green" ? "\x1b[32m" : c.status === "amber" ? "\x1b[33m" : "\x1b[31m";
    const dot = c.status === "green" ? "●" : c.status === "amber" ? "◐" : "✕";
    console.log(
      `      ${color}${dot}\x1b[0m ${c.provider.padEnd(10)} v${c.version}  ` +
        `${String(c.ok).padStart(3)} ok  ${String(c.drift).padStart(3)} drift  ${c.throw} throw`,
    );
  }
}

main().catch((err) => {
  console.error("\n\x1b[31m" + (err as Error).message + "\x1b[0m");
  pool.end().finally(() => process.exit(1));
});
