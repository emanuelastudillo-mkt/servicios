import test from "node:test";
import fs from "node:fs/promises";
import assert from "node:assert/strict";
import {
  getPlayer,
  buyPart,
  savePlan,
  advance,
  nextChampionshipRace,
  estimateService,
} from "../src/engine.js";
import {
  bid,
  releasePerson,
  cancelBid,
  settleAuctions,
  seasonTime,
  buyVehicle,
} from "../src/management.js";
import { defaultPlan, vehicle } from "../src/catalog.js";
import { routeFor, locationAt } from "../src/route.js";
import { validateSave, encodeSave } from "../src/storage.js";
import { validateCatalog } from "../src/catalog-schema.js";
import { CATALOG } from "../data/catalog.js";
import { shieldSVG } from "../src/shields.js";
import { createRace, TEST_CATALOG } from "./fixture.mjs";
import { createRace as createWithCatalog } from "../src/engine.js";
const create = () =>
  createRace({
    startAt: "2026-10-05T12:00:00Z",
    now: Date.parse("2026-10-05T11:00:00Z"),
  });
test("catálogo válido, ocho recorridos distintos y 100 escudos distintos", () => {
  validateCatalog(CATALOG);
  assert.equal(
    new Set(Array.from({ length: 100 }, (_, i) => shieldSVG(i + 1))).size,
    100,
  );
  const paths = new Set();
  for (const race of CATALOG.races) {
    const r = routeFor(race.id);
    assert.equal(r.stages.length, 15);
    assert.ok(r.totalKm >= 9000 && r.totalKm <= 14000);
    assert.ok(Number.isFinite(locationAt(r.totalKm, race.id).lon));
    paths.add(JSON.stringify(r.cities));
  }
  assert.equal(paths.size, 8);
});
test("compra descuenta stock y no permite sobreventa ni doble compra de vehículo", () => {
  const s = create(),
    p = getPlayer(s),
    id = "engine-standard-100";
  s.management.stocks[id] = 1;
  buyPart(s, "engine", "standard", 100);
  assert.equal(s.management.stocks[id], 0);
  const before = p.budget;
  assert.throws(() => buyPart(s, "engine", "standard", 100), /stock/);
  assert.equal(p.budget, before);
  buyVehicle(s, "mini");
  const after = p.budget;
  buyVehicle(s, "mini");
  assert.equal(p.budget, after);
  assert.equal(p.vehicleId, "mini");
});
test("oferta de piloto exige cupo, reserva fondos y se adjudica una sola vez al cierre", () => {
  const s = create(),
    p = getPlayer(s);
  assert.throws(() => bid(s, "driver", "ines", 10000), /Máximo/);
  releasePerson(s, "driver", "fast");
  const before = p.budget;
  const a = bid(s, "driver", "ines", 10000);
  assert.equal(p.budget, before - 10000);
  assert.equal(p.drivers.length, 2);
  advance(s, 5 * 3600);
  assert.equal(p.drivers.length, 2);
  advance(s, 3600);
  assert.equal(a.status, "closed");
  assert.equal(a.winnerId, "player");
  assert.equal(p.drivers.length, 3);
  assert.equal(s.management.owners.ines, "player");
  settleAuctions(s);
  assert.equal(p.drivers.length, 3);
  assert.equal(p.budget, before - 10000);
  assert.throws(() => bid(s, "driver", "ines", 11000), /equipo/);
  validateSave(JSON.parse(encodeSave(s)));
});
test("oferta perdedora devuelve toda la reserva y no duplica el contrato", () => {
  const s = create(),
    p = getPlayer(s),
    before = p.budget;
  const a = bid(s, "mechanic", "nora", 3900);
  advance(s, 6 * 3600);
  assert.equal(a.status, "closed");
  assert.notEqual(a.winnerId, "player");
  assert.equal(p.budget, before);
  assert.equal(
    s.teams.flatMap((t) => t.mechanics).filter((m) => m.id === "nora").length,
    1,
  );
  settleAuctions(s);
  assert.equal(p.budget, before);
});
test("cancelación, mejora y reservas simultáneas respetan fondos y máximo 5 mecánicos", () => {
  const s = create(),
    p = getPlayer(s),
    before = p.budget;
  const a = bid(s, "mechanic", "nora", 10000);
  bid(s, "mechanic", "nora", 12000);
  assert.equal(p.budget, before - 12000);
  cancelBid(s, a.id);
  assert.equal(p.budget, before);
  for (const id of ["nora", "omar", "eva", "leo"])
    bid(s, "mechanic", id, 13000);
  assert.throws(() => bid(s, "mechanic", "emma", 14000), /Máximo/);
  advance(s, 6 * 3600);
  assert.equal(p.mechanics.length, 5);
  assert.throws(() => bid(s, "mechanic", "emma", 14000), /Máximo/);
  validateSave(JSON.parse(encodeSave(s)));
});
test("mecánicos reducen trabajo pero el descanso sigue siendo un mínimo independiente", () => {
  const s = create(),
    p = getPlayer(s);
  Object.values(p.parts).forEach((x) => (x.condition = 30));
  p.drivers[0].energy = 0;
  const plan = { ...defaultPlan(), driverId: p.drivers[0].id };
  p.mechanics = [];
  const a = estimateService(p, plan, 2);
  p.mechanics = TEST_CATALOG.mechanics.slice(0, 5);
  const b = estimateService(p, plan, 2);
  assert.ok(b.workHours < a.workHours);
  assert.equal(b.restHours, a.restHours);
  assert.ok(b.serviceHours >= b.restHours);
});
test("guardado anterior migra sin cobrar sueldos ni perder energía, caja o planes", async () => {
  const old = JSON.parse(
    await fs.readFile(
      new URL("fixtures/v0.2-save.json", import.meta.url),
      "utf8",
    ),
  );
  const migrated = validateSave(old);
  assert.ok(migrated.management);
  assert.equal(migrated.championship.round, 0);
  old.teams.forEach((t, i) => {
    const next = migrated.teams[i];
    assert.equal(t.budget, next.budget);
    assert.equal(t.totalKm, next.totalKm);
    assert.deepEqual(t.plans, next.plans);
    assert.deepEqual(
      t.drivers.map((d) => d.energy),
      next.drivers.map((d) => d.energy),
    );
    assert.deepEqual(t.inventory, next.inventory);
  });
  assert.equal(old.management, undefined);
  advance(migrated, 3600);
  validateSave(JSON.parse(encodeSave(migrated)));
});
test("validador rechaza contratos duplicados, stock negativo y catálogo con precios inválidos", () => {
  const s = create(),
    a = structuredClone(s);
  a.teams[0].mechanics.push(a.teams[0].mechanics[0]);
  assert.throws(() => validateSave(a), /duplicado/);
  const b = structuredClone(s);
  b.management.stocks.hilux = -1;
  assert.throws(() => validateSave(b), /Stock/);
  const c = structuredClone(CATALOG);
  c.vehicles[0].price = NaN;
  assert.throws(() => validateCatalog(c), /precio/);
  const d = structuredClone(s);
  d.teams[0].drivers[0].id = "<invalid>";
  assert.throws(() => validateSave(d));
  const e = structuredClone(TEST_CATALOG);
  e.vehicles[0].image = "assets/art/missing.webp";
  assert.throws(() => validateCatalog(e), /imagen/);
});
test("la inscripción usa precios y presupuesto del catálogo de la temporada", () => {
  const catalog = structuredClone(TEST_CATALOG);
  catalog.settings.find((x) => x.key === "startingBudget").value = 500000;
  catalog.vehicles.find((x) => x.id === "hilux").price = 70000;
  const s = createWithCatalog({
    catalog,
    startAt: "2026-10-05T12:00:00Z",
    now: Date.parse("2026-10-05T11:00:00Z"),
  });
  const p = getPlayer(s);
  const wages = [...p.drivers, ...p.mechanics].reduce(
    (n, x) => n + x.salary,
    0,
  );
  assert.equal(p.initialBudget, 500000);
  assert.equal(p.budget, 500000 - 70000 - wages);
  catalog.vehicles[0].price = 1;
  assert.equal(s.management.catalog.vehicles[0].price, 70000);
});
test("campeonato completo: ocho rutas, caja y piezas persistentes, puntos y pago final único", () => {
  let s = create();
  const raceIds = [];
  const initialReserve = getPlayer(s).inventory.find(
    (p) => p.grade === "reserve",
  ).id;
  for (let round = 0; round < 8; round++) {
    raceIds.push(s.routeId);
    assert.equal(s.championship.round, round);
    const p = getPlayer(s);
    for (const stage of routeFor(s).stages)
      savePlan(s, stage.index, {
        ...defaultPlan(stage.index),
        driverId: p.drivers[stage.index % p.drivers.length].id,
        fuelTarget: vehicle(p.vehicleId).tank,
      });
    for (let i = 0; i < 4 && !s.teams.every((t) => t.phase === "finished"); i++)
      advance(s, 30 * 86400, { stopAtAllFinished: true });
    assert.ok(
      s.teams.every((t) => t.phase === "finished"),
      `round ${round}`,
    );
    assert.equal(s.championship.results.length, round + 1);
    validateSave(JSON.parse(encodeSave(s)));
    assert.ok(
      [...p.inventory, ...Object.values(p.parts)].some(
        (p) => p.id === initialReserve,
      ),
    );
    if (round < 7) {
      const budget = p.budget,
        dues = [...p.drivers, ...p.mechanics].reduce((n, x) => n + x.salary, 0);
      s = nextChampionshipRace(s);
      assert.equal(getPlayer(s).budget, Math.max(0, budget - dues));
    }
  }
  assert.equal(new Set(raceIds).size, 8);
  assert.ok(s.championship.paid);
  assert.equal(s.championship.final.length, 12);
  const total = getPlayer(s).budget;
  advance(s, 86400);
  assert.equal(getPlayer(s).budget, total);
  assert.throws(() => nextChampionshipRace(s), /ocho/);
});
