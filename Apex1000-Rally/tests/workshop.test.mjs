import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRace, TEST_CATALOG } from "./fixture.mjs";
import {
  advance,
  getPlayer,
  buyPart,
  savePlan,
  performance,
  estimateService,
  nextPlayerCamp,
} from "../src/engine.js";
import {
  activeCar,
  purchaseVehicle,
  selectVehicle,
  sellVehicle,
  vehicleSaleValue,
  assignMechanic,
  enqueueJob,
  cancelJob,
  vehicleFactors,
  wearVehicle,
} from "../src/workshop.js";
import { repairQuote, repairPiece } from "../src/part-maintenance.js";
import { validateSave } from "../src/storage.js";
import { defaultPlan } from "../src/catalog.js";
import { routeFor } from "../src/route.js";
import { homeProgress, homePage } from "../src/home-ui.js";
import { bid } from "../src/management.js";
const fresh = () =>
  createRace({
    startAt: "2026-10-20T12:00:00Z",
    now: Date.parse("2026-10-10T12:00:00Z"),
  });
const crew = (s, count = 2) => {
  const t = getPlayer(s);
  for (const m of TEST_CATALOG.mechanics
    .filter((m) => m.id !== "elena")
    .slice(0, count - 1)) {
    t.mechanics.push({ ...m, assignment: "workshop" });
    s.management.owners[m.id] = t.id;
  }
  return t;
};
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-6, `${a} != ${b}`);
test("autos nuevos tienen estado 100 y mejoras 50; hay instancias únicas y máximo tres", () => {
  const s = fresh(),
    t = getPlayer(s),
    first = activeCar(t);
  assert.deepEqual(
    [first.condition, first.performance, first.reliability],
    [100, 50, 50],
  );
  const second = purchaseVehicle(s, "hilux");
  purchaseVehicle(s, "mini");
  assert.notEqual(first.id, second.id);
  assert.equal(t.garage.length, 3);
  const before = JSON.stringify(s);
  assert.throws(() => purchaseVehicle(s, "raptor"), /3 autos/);
  assert.equal(JSON.stringify(s), before);
  validateSave(s);
});
test("venta y entrega permiten bajar de precio y validan la operación completa antes de cobrar", () => {
  const s = fresh(),
    t = getPlayer(s),
    current = activeCar(t);
  const spare = purchaseVehicle(s, "mini"),
    budget = t.budget,
    price = vehicleSaleValue(s, spare);
  sellVehicle(s, spare.id);
  near(t.budget, budget + price);
  assert.throws(() => sellVehicle(s, current.id), /último/);
  t.budget = 0;
  const before = JSON.stringify(s);
  assert.throws(
    () => purchaseVehicle(s, "raptor", { tradeId: current.id }),
    /Saldo/,
  );
  assert.equal(JSON.stringify(s), before);
  t.budget = 20000;
  const net =
    20000 +
    vehicleSaleValue(s, current) -
    s.management.catalog.vehicles.find((v) => v.id === "mini").price;
  const replacement = purchaseVehicle(s, "mini", { tradeId: current.id });
  assert.equal(t.activeCarId, replacement.id);
  near(t.budget, net);
  assert.equal(t.garage.length, 1);
  assert.equal(t.vehicleId, "mini");
  assert.equal(replacement.condition, 100);
});
test("sólo el auto activo se desgasta; estado, performance y fiabilidad afectan el rendimiento", () => {
  const s = fresh(),
    t = getPlayer(s),
    spare = purchaseVehicle(s, "mini"),
    car = activeCar(t);
  const stage = routeFor(s).stages[0],
    plan = defaultPlan();
  const initial = performance(t, stage, plan).speed;
  wearVehicle(t, 10000, 1.5);
  assert.ok(car.condition < 100);
  assert.equal(spare.condition, 100);
  assert.equal(car.odometer, 10000);
  assert.ok(performance(t, stage, plan).speed < initial);
  const slow = performance(t, stage, plan).speed,
    risk = vehicleFactors(t).risk;
  car.performance = 100;
  car.reliability = 100;
  assert.ok(performance(t, stage, plan).speed > slow);
  assert.ok(vehicleFactors(t).risk < risk);
});
test("separar mecánicos modifica asistencia, respeta 1–4 en carrera y 0–4 en taller", () => {
  const s = fresh(),
    t = crew(s, 5),
    plan = defaultPlan();
  Object.values(t.parts).forEach((p) => (p.condition = 20));
  const slow = estimateService(t, plan, 2).workHours;
  for (const m of t.mechanics.slice(1, 4)) assignMechanic(s, m.id, "race");
  assert.ok(estimateService(t, plan, 2).workHours < slow);
  assert.throws(() => assignMechanic(s, t.mechanics[4].id, "race"), /1–4/);
  for (const m of t.mechanics.slice(1, 4)) assignMechanic(s, m.id, "workshop");
  assert.throws(() => assignMechanic(s, t.mechanics[0].id, "workshop"), /1–4/);
  validateSave(s);
});
test("cero mecánicos pausa la cola sin perder progreso y reasignar permite terminar", () => {
  const s = fresh(),
    t = crew(s),
    spare = purchaseVehicle(s, "mini");
  const j = enqueueJob(s, "performance", spare.id);
  advance(s, 3600);
  const worked = j.worked;
  assert.ok(worked > 0);
  assignMechanic(s, t.mechanics[1].id, "race");
  advance(s, 7200);
  assert.equal(j.worked, worked);
  validateSave(s);
  assignMechanic(s, t.mechanics[1].id, "workshop");
  advance(s, 24 * 3600);
  assert.equal(spare.performance, 55);
  assert.equal(t.workshop.jobs.length, 0);
  assert.equal(t.workshop.completed.length, 1);
  validateSave(s);
});
test("performance y fiabilidad se desarrollan hasta 100; la reparación del auto recupera estado", () => {
  const s = fresh(),
    t = crew(s),
    spare = purchaseVehicle(s, "mini");
  spare.performance = 95;
  spare.reliability = 95;
  spare.condition = 40;
  for (const kind of ["condition", "performance", "reliability"]) {
    enqueueJob(s, kind, spare.id);
    advance(s, 48 * 3600);
  }
  assert.deepEqual(
    [spare.condition, spare.performance, spare.reliability],
    [100, 100, 100],
  );
  for (const kind of ["condition", "performance", "reliability"])
    assert.throws(() => enqueueJob(s, kind, spare.id), /mejora posible/);
  validateSave(s);
});
test("original baja con cada reparación y disminuye la siguiente recuperación mientras aumenta el tiempo", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = t.parts.engine;
  piece.condition = 50;
  const first = repairQuote(piece);
  repairPiece(piece);
  assert.equal(piece.original, 96);
  assert.equal(piece.condition, 100);
  const original = piece.original;
  repairPiece(piece);
  assert.equal(piece.original, original);
  piece.condition = 50;
  const second = repairQuote(piece);
  assert.ok(second.target < first.target);
  assert.ok(second.hours > first.hours);
  piece.broken = true;
  repairPiece(piece);
  assert.equal(piece.original, 89);
  assert.equal(piece.broken, false);
  piece.original = 0;
  piece.condition = 0;
  repairPiece(piece);
  assert.equal(piece.condition, 40);
  assert.equal(piece.original, 0);
});
test("piezas en trabajo no se pueden montar ni duplicar, y terminar libera el repuesto", () => {
  const s = fresh(),
    t = crew(s),
    part = buyPart(s, "engine", "standard", 50);
  enqueueJob(s, "part", part.id);
  assert.throws(() => enqueueJob(s, "part", part.id), /pendiente/);
  const p = defaultPlan();
  p.actions.engine = "replace";
  p.replacements.engine = part.id;
  assert.throws(() => savePlan(s, 0, p), /taller/);
  advance(s, 24 * 3600);
  assert.equal(part.condition, 100);
  assert.equal(part.original, 96);
  savePlan(s, 0, p);
  assert.throws(() => enqueueJob(s, "part", part.id), /reservada/);
  validateSave(s);
});
test("cancelar devuelve sólo lo no trabajado; un auto en trabajo no puede venderse ni elegirse", () => {
  const s = fresh(),
    t = crew(s),
    spare = purchaseVehicle(s, "mini"),
    budget = t.budget,
    j = enqueueJob(s, "performance", spare.id);
  assert.throws(() => selectVehicle(s, spare.id), /trabajo/);
  assert.throws(() => sellVehicle(s, spare.id), /trabajo/);
  advance(s, 3600);
  const due = Math.floor(j.cost * (1 - j.worked / j.workHours));
  const refund = cancelJob(s, j.id);
  assert.equal(refund, due);
  near(t.budget, budget - j.cost + refund);
  assert.equal(spare.performance, 50);
  assert.throws(() => cancelJob(s, j.id), /desconocido/);
  selectVehicle(s, spare.id);
  assert.equal(t.activeCarId, spare.id);
  validateSave(s);
});
test("guardado rechaza original, métricas, personal y presupuestos corruptos", () => {
  const s = fresh(),
    t = crew(s),
    spare = purchaseVehicle(s, "mini");
  enqueueJob(s, "performance", spare.id);
  for (const corrupt of [
    (x) => (getPlayer(x).parts.engine.original = 101),
    (x) => (getPlayer(x).garage[0].performance = 101),
    (x) => (getPlayer(x).mechanics[0].assignment = "workshop"),
    (x) => (getPlayer(x).workshop.jobs[0].cost = 0),
    (x) => (getPlayer(x).workshop.jobs[0].worked = Infinity),
  ]) {
    const bad = structuredClone(s);
    corrupt(bad);
    assert.throws(() => validateSave(bad));
  }
  assert.deepEqual(validateSave(s), s);
});
test("el reloj de taller es determinista por bloques y los hitos no cuentan dos veces la carrera", () => {
  const a = fresh(),
    t = crew(a),
    spare = purchaseVehicle(a, "mini");
  enqueueJob(a, "performance", spare.id);
  const b = structuredClone(a);
  advance(a, 7200);
  for (let i = 0; i < 240; i++) advance(b, 30);
  assert.deepEqual(a, b);
  t.totalKm = routeFor(a).totalKm;
  t.history = Array.from({ length: 15 }, () => ({}));
  t.phase = "finished";
  const before = homeProgress(a);
  a.championship.results.push({ round: 0, routeId: "andes" });
  assert.deepEqual(homeProgress(a), before);
  a.championship.round = 7;
  a.clock = 0;
  t.phase = "racing";
  assert.match(homePage(a), /Última carrera en curso/);
  assert.doesNotMatch(homePage(a), /Calendario completado/);
});

test("migración real de v0.3.2 conserva cuatro autos, saldo y avance aunque no tenga mecánicos", () => {
  const old = JSON.parse(
    readFileSync(
      new URL("fixtures/v0.3.2-garage-save.json", import.meta.url),
      "utf8",
    ),
  );
  const previous = old.teams.find((t) => t.id === "player");
  const s = validateSave(old),
    t = getPlayer(s);
  assert.equal(s.version, 3);
  assert.deepEqual(
    t.garage.map((c) => c.modelId),
    previous.garage,
  );
  for (const field of ["budget", "totalKm", "history"]) {
    assert.deepEqual(t[field], previous[field]);
  }
  assert.deepEqual(
    t.inventory,
    previous.inventory.map((p) => ({ ...p, original: 100 })),
  );
  assert.deepEqual(
    t.parts,
    Object.fromEntries(
      Object.entries(previous.parts).map(([id, p]) => [
        id,
        { ...p, original: 100 },
      ]),
    ),
  );
  assert.equal(t.mechanics.length, 0);
  assert.equal(t.workshop.legacyOverflow, true);
  assert.equal(t.workshop.legacyNoMechanics, true);
  assert.ok(
    [...t.inventory, ...Object.values(t.parts)].every(
      (p) => p.original === 100,
    ),
  );
  assert.throws(() => purchaseVehicle(s, "mini"), /3 autos/);
  assert.throws(() => nextPlayerCamp(s), /mecánico/);
  const km = t.totalKm;
  savePlan(s, t.stageIndex, defaultPlan(t.stageIndex));
  advance(s, 3600);
  assert.equal(t.totalKm, km);
  bid(s, "mechanic", "elena", 10000);
  advance(s, 7 * 3600);
  assert.equal(t.mechanics.length, 1);
  assert.equal(t.mechanics[0].assignment, "race");
  assert.equal(t.workshop.legacyNoMechanics, false);
  sellVehicle(s, t.garage.find((c) => c.id !== t.activeCarId).id);
  assert.equal(t.garage.length, 3);
  assert.equal(t.workshop.legacyOverflow, false);
  validateSave(s);
});

test("una selección de repuesto desactivada no reserva la pieza para carrera", () => {
  const s = fresh(),
    t = getPlayer(s),
    p = buyPart(s, "engine", "standard", 50),
    plan = defaultPlan();
  plan.replacements.engine = p.id;
  plan.actions.engine = "none";
  savePlan(s, 0, plan);
  enqueueJob(s, "part", p.id);
  validateSave(s);
});

test("el auto activo espera su trabajo y el taller desarrolla otro auto durante la carrera", () => {
  const s = fresh(),
    t = crew(s),
    car = activeCar(t),
    spare = purchaseVehicle(s, "mini");
  s.clock = 0;
  savePlan(s, 0, defaultPlan());
  const j = enqueueJob(s, "performance", car.id);
  const other = enqueueJob(s, "reliability", spare.id);
  j.worked = j.workHours - 0.001;
  advance(s, 30);
  assert.equal(t.phase, "camp");
  assert.equal(t.totalKm, 0);
  assert.equal(car.performance, 55);
  advance(s, 3600);
  assert.ok(t.totalKm > 0);
  assert.ok(other.worked > 0);
  assert.ok(car.condition < 100);
  assert.equal(spare.condition, 100);
  validateSave(s);
});

test("próxima parada no consume cien horas con el auto bloqueado en un taller sin personal", () => {
  const s = fresh(),
    t = getPlayer(s);
  savePlan(s, 0, defaultPlan());
  enqueueJob(s, "performance", activeCar(t).id);
  const clock = s.clock;
  assert.throws(() => nextPlayerCamp(s), /sin mecánicos/);
  assert.equal(s.clock, clock);
});
