import test from "node:test";
import assert from "node:assert/strict";
import { DailyCatalog } from "../server/daily-catalog.js";
import { CATALOG } from "../../data/catalog.js";
const URL = "https://emanuelmkt.com.ar/apex1000rally/data/catalog.json";
const store = () => {
  const m = new Map();
  return {
    get: async (k) => m.get(k),
    put: async (k, v) => m.set(k, structuredClone(v)),
  };
};
test("catálogo diario: una descarga, persiste en reinicios y adopta precio validado sin desplegar", async () => {
  const storage = store();
  let reads = 0;
  const changed = structuredClone(CATALOG);
  changed.revision = "daily-price";
  changed.vehicles[0].price = 18000;
  const fetcher = async () => {
    reads++;
    return Response.json(changed);
  };
  const now = Date.parse("2026-10-06T12:00:00Z"),
    daily = new DailyCatalog(storage, URL, fetcher);
  assert.equal((await daily.current(now)).revision, CATALOG.revision);
  for (let i = 0; i < 20; i++) await daily.current(now + i * 60000);
  assert.equal(reads, 0);
  assert.equal((await daily.current(now + 86400000)).vehicles[0].price, 18000);
  assert.equal(reads, 1);
  const resumed = new DailyCatalog(storage, URL, fetcher);
  assert.equal((await resumed.current(now + 86401000)).revision, "daily-price");
  assert.equal(reads, 1);
});
test("catálogo corrupto conserva el anterior y no genera reintentos por visor", async () => {
  const storage = store();
  let reads = 0;
  const daily = new DailyCatalog(storage, URL, async () => {
    reads++;
    return Response.json({ vehicles: [] });
  });
  const now = Date.parse("2026-10-06T12:00:00Z");
  await daily.current(now);
  const old = await daily.current(now + 86400000);
  assert.equal(old.revision, CATALOG.revision);
  for (let i = 0; i < 10; i++) await daily.current(now + 86400000 + i * 60000);
  assert.equal(reads, 1);
});
