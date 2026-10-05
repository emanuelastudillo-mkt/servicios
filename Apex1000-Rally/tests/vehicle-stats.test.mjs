import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../data/catalog.js";
import {
  createRace,
  performance,
  advance,
  getPlayer,
  publicSnapshot,
} from "../src/engine.js";
import {
  STAT_KEYS,
  modelStats,
  statFactors,
  teamVehicleStats,
} from "../src/vehicle-stats.js";
import { validateCatalog } from "../src/catalog-schema.js";
import { validateSave } from "../src/storage.js";
import {
  activeCar,
  purchaseVehicle,
  assignMechanic,
  enqueueJob,
} from "../src/workshop.js";
import { currentEvent, enroll } from "../src/competition.js";
import { defaultPlan } from "../src/catalog.js";
import { routeFor } from "../src/route.js";
import { vehicleStatsHTML } from "../src/vehicle-stats-ui.js";

test("cuatro índices 0–100 y peso en kg tienen validación independiente", () => {
  for (const v of CATALOG.vehicles)
    for (const k of STAT_KEYS.slice(0, 4))
      assert.ok(Number.isInteger(v[k]) && v[k] >= 0 && v[k] <= 100);
  for (const val of [0, 100]) {
    const c = structuredClone(CATALOG);
    for (const k of STAT_KEYS.slice(0, 4)) c.vehicles[0][k] = val;
    assert.equal(validateCatalog(c), c);
  }
  for (const val of [-1, 101, 50.1, "70", NaN]) {
    const c = structuredClone(CATALOG);
    c.vehicles[0].control = val;
    assert.throws(() => validateCatalog(c), /estadísticas/);
  }
  for (const val of [0, 100, 699, 6001, 2010.5, "2010", NaN]) {
    const c = structuredClone(CATALOG);
    c.vehicles[0].weightKg = val;
    assert.throws(() => validateCatalog(c), /estadísticas/);
  }
  for (const v of CATALOG.vehicles) {
    assert.ok(
      Number.isInteger(v.weightKg) && v.weightKg >= 700 && v.weightKg <= 6000,
    );
    assert.equal(v.weightKg, modelStats(v.id).weightKg);
  }
  const partial = structuredClone(CATALOG);
  delete partial.vehicles[0].weightKg;
  assert.throws(() => validateCatalog(partial), /estadísticas/);
});
test("cada atributo tiene efecto útil y aceleración/control/peso pesan más en sectores técnicos", () => {
  const s = {
    speed: 50,
    acceleration: 50,
    comfort: 50,
    control: 50,
    weightKg: 2010,
  };
  const low = statFactors(s, "rock");
  assert.ok(statFactors({ ...s, speed: 100 }, "rock").speed > low.speed);
  assert.ok(statFactors({ ...s, acceleration: 100 }, "rock").speed > low.speed);
  assert.ok(statFactors({ ...s, control: 100 }, "rock").risk < low.risk);
  assert.ok(statFactors({ ...s, comfort: 100 }, "rock").fatigue < low.fatigue);
  assert.ok(statFactors({ ...s, weightKg: 2600 }, "rock").speed < low.speed);
  assert.ok(statFactors({ ...s, weightKg: 2600 }, "rock").fuel > low.fuel);
  assert.ok(statFactors({ ...s, weightKg: 2600 }, "rock").wear > low.wear);
  const gain = (terrain) =>
    statFactors({ ...s, acceleration: 100 }, terrain).speed /
    statFactors(s, terrain).speed;
  assert.ok(gain("rock") > gain("asphalt"));
});
test("los atributos se usan en el motor; la avería conserva 30 km/h", () => {
  const t = getPlayer(createRace());
  const c = activeCar(t),
    stage = routeFor(t).stages[0],
    plan = defaultPlan();
  c.stats = {
    speed: 50,
    acceleration: 50,
    comfort: 50,
    control: 50,
    weightKg: 2010,
  };
  const base = performance(t, stage, plan, 0);
  for (const key of ["speed", "acceleration"]) {
    c.stats[key] = 100;
    assert.ok(performance(t, stage, plan, 0).speed > base.speed);
    c.stats[key] = 50;
  }
  c.stats.control = 100;
  assert.ok(performance(t, stage, plan, 0).risk < base.risk);
  c.stats.control = 50;
  c.stats.weightKg = 2600;
  assert.ok(performance(t, stage, plan, 0).fuelPer100 > base.fuelPer100);
  assert.ok(performance(t, stage, plan, 0).wear > base.wear);
  t.parts.engine.broken = true;
  assert.equal(performance(t, stage, plan, 0).speed, 30);
});
test("comodidad reduce la fatiga real sin acelerar el descanso de los relevos", () => {
  const s = createRace(),
    t = getPlayer(s);
  enroll(s, currentEvent(s).eventId, t.activeDriver);
  s.clock = 0;
  s.competition.started = true;
  t.phase = "racing";
  t.fuel = 540;
  t.stageStart = 0;
  t.activePlan = { ...defaultPlan(), driverId: t.activeDriver };
  t.drivers[1].energy = 50;
  const a = structuredClone(s),
    b = structuredClone(s);
  activeCar(getPlayer(a)).stats.comfort = 0;
  activeCar(getPlayer(b)).stats.comfort = 100;
  advance(a, 30);
  advance(b, 30);
  assert.ok(getPlayer(b).drivers[0].energy > getPlayer(a).drivers[0].energy);
  assert.equal(getPlayer(b).drivers[1].energy, getPlayer(a).drivers[1].energy);
});
test("desgaste y mejoras no modifican los atributos; las compras toman el catálogo de la partida", () => {
  const s = createRace(),
    t = getPlayer(s),
    c = activeCar(t),
    stats = structuredClone(c.stats);
  assignMechanic(s, t.mechanics[0].id, "workshop");
  enqueueJob(s, "performance", c.id, 1);
  advance(s, 24 * 3600);
  assert.ok(c.performance > 50);
  assert.deepEqual(c.stats, stats);
  s.management.catalog.vehicles.find((v) => v.id === "niva").comfort = 99;
  const bought = purchaseVehicle(s, "niva");
  assert.equal(bought.stats.comfort, 99);
  assert.deepEqual(c.stats, stats);
});
test("migra v0.4.0 sin tocar saldo/daños/trabajos; conserva atributos personalizados y rechaza corruptos", () => {
  const s = createRace(),
    t = getPlayer(s),
    c = activeCar(t);
  c.condition = 63;
  const saldo = t.budget;
  for (const team of s.teams) for (const car of team.garage) delete car.stats;
  for (const row of s.management.catalog.vehicles)
    for (const k of STAT_KEYS) delete row[k];
  const loaded = validateSave(s),
    p = getPlayer(loaded);
  assert.deepEqual(activeCar(p).stats, modelStats(p.vehicleId));
  assert.equal(p.budget, saldo);
  assert.equal(activeCar(p).condition, 63);
  activeCar(p).stats.comfort = 93;
  activeCar(p).stats.weightKg = 2490;
  assert.equal(activeCar(getPlayer(validateSave(loaded))).stats.comfort, 93);
  assert.equal(activeCar(getPlayer(validateSave(loaded))).stats.weightKg, 2490);
  assert.match(
    vehicleStatsHTML(activeCar(p).stats, p.vehicleId),
    /Peso base configurado/,
  );
  activeCar(p).stats.weightKg = 101;
  assert.throws(() => validateSave(loaded), /Vehículo de taller/);
});
test("snapshot online y ficha muestran los mismos atributos base guardados", () => {
  const s = createRace(),
    t = getPlayer(s);
  enroll(s, currentEvent(s).eventId);
  activeCar(t).stats.control = 97;
  const snap = publicSnapshot(s).entries.find((e) => e.entryId === "player");
  assert.deepEqual(snap.vehicleStats, teamVehicleStats(t));
  const html = vehicleStatsHTML(teamVehicleStats(t));
  assert.match(html, /97<small>\/100/);
  assert.match(html, /2\.010 <small>kg/);
  assert.equal((html.match(/<small>\/100/g) || []).length, 4);
});
test("migra columnas nuevas importadas como texto por v0.4.0, pero un guardado moderno sigue siendo estricto", () => {
  const legacy = createRace(),
    budget = getPlayer(legacy).budget;
  for (const team of legacy.teams)
    for (const car of team.garage) delete car.stats;
  for (const row of legacy.management.catalog.vehicles)
    for (const k of STAT_KEYS) row[k] = String(row[k]);
  const migrated = validateSave(legacy);
  assert.equal(getPlayer(migrated).budget, budget);
  assert.deepEqual(activeCar(getPlayer(migrated)).stats, modelStats("hilux"));
  assert.equal(
    typeof migrated.management.catalog.vehicles[0].weightKg,
    "number",
  );
  migrated.management.catalog.vehicles[0].weightKg = "2010";
  assert.throws(() => validateSave(migrated), /estadísticas/);
  legacy.management.catalog.vehicles[0].weightKg = "2010kg";
  assert.throws(() => validateSave(legacy), /estadísticas/);
});
