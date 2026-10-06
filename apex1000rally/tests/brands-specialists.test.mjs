import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../data/catalog.js";
import { createCurrentRace as createRace } from "./fixture.mjs";
import {
  getPlayer,
  buyPart,
  estimateService,
  advanceTeam,
  performance,
} from "../src/engine.js";
import { partSpec, partName } from "../src/part-brands.js";
import {
  partProtected,
  raceRepairBonus,
  traitDescription,
} from "../src/staff.js";
import { PART_TYPES, defaultPlan } from "../src/catalog.js";
import { routeFor } from "../src/route.js";
import { validateSave } from "../src/storage.js";
import { activeCar } from "../src/workshop.js";
import {
  migrateVehicleBalance,
  OPERATING_WEIGHTS,
} from "../src/vehicle-stats.js";
import { enroll, currentEvent } from "../src/competition.js";

test("ocho vehículos: pesos distintos y Manx económico, rápido y exigente", () => {
  assert.equal(CATALOG.vehicles.length, 8);
  assert.equal(new Set(CATALOG.vehicles.map((v) => v.weightKg)).size, 8);
  const v = CATALOG.vehicles.find((v) => v.id === "manx");
  assert.equal(v.price, 36000);
  assert.equal(v.speed, 93);
  for (const key of ["acceleration", "comfort", "control"])
    assert.ok(v[key] < 20);
  const s = createRace({
    vehicleId: "manx",
    catalog: {
      ...CATALOG,
      settings: CATALOG.settings.map((x) =>
        x.key === "startingBudget" ? { ...x, value: 100000 } : x,
      ),
    },
  });
  assert.equal(activeCar(getPlayer(s)).stats.weightKg, 960);
});
test("migración de pesos conserva daños, dinero, mejoras y pesos personalizados", () => {
  const s = createRace(),
    t = getPlayer(s),
    c = activeCar(t);
  s.vehicleBalance = 2;
  c.stats.weightKg = 2010;
  c.condition = 43;
  c.performance = 72;
  const money = t.budget;
  migrateVehicleBalance(s);
  assert.equal(c.stats.weightKg, OPERATING_WEIGHTS.hilux);
  assert.equal(c.condition, 43);
  assert.equal(c.performance, 72);
  assert.equal(t.budget, money);
  s.vehicleBalance = 2;
  c.stats.weightKg = 2490;
  migrateVehicleBalance(s);
  assert.equal(c.stats.weightKg, 2490);
});
test("cada tipo tiene tres marcas, tres imágenes y perfiles de rendimiento independientes", () => {
  for (const type of PART_TYPES) {
    const rows = CATALOG.parts.filter(
      (p) => p.type === type.id && p.condition === 100,
    );
    assert.equal(new Set(rows.map((p) => p.brand)).size, 3);
    assert.equal(new Set(rows.map((p) => p.image)).size, 3);
    const by = Object.fromEntries(rows.map((p) => [p.grade, p]));
    assert.ok(by.endurance.durability > by.standard.durability);
    assert.ok(by.racing.performance > by.standard.performance);
    assert.ok(by.racing.failure > by.endurance.failure);
  }
});
test("compra conserva marca y estadísticas editadas en el catálogo de la partida", () => {
  const s = createRace(),
    t = getPlayer(s);
  t.budget = 100000;
  const offer = s.management.catalog.parts.find(
    (p) => p.id === "engine-racing-100",
  );
  offer.performance = 1.33;
  offer.failure = 0.026;
  offer.price = 32000;
  const p = buyPart(s, "engine", "racing");
  assert.equal(partSpec(p).performance, 1.33);
  assert.equal(partSpec(p).failure, 0.026);
  assert.equal(partSpec(p).price, 32000);
  assert.match(partName(p), /Cosworth/);
  const original = t.parts.engine;
  t.parts.engine = p;
  t.inventory = t.inventory.filter((x) => x.id !== p.id);
  t.inventory.push(original);
  const stage = routeFor(t).stages[0],
    plan = { ...defaultPlan(), driverId: t.activeDriver };
  const fast = performance(t, stage, plan, 0).speed;
  p.spec.performance = 0.7;
  assert.ok(performance(t, stage, plan, 0).speed < fast);
  validateSave(s);
});
test("sólo piloto activo protege; mecánico y piloto de descanso no aplican", () => {
  const t = getPlayer(createRace());
  t.drivers.forEach((d) => (d.traits = ""));
  t.mechanics[0].traits = "part:suspension";
  t.drivers[1].traits = "part:suspension";
  assert.equal(partProtected(t, "suspension"), false);
  t.activeDriver = t.drivers[1].id;
  assert.equal(partProtected(t, "suspension"), true);
  assert.equal(partProtected(t, "engine"), false);
  t.activeDriver = t.drivers[0].id;
  assert.equal(partProtected(t, "suspension"), false);
  assert.match(traitDescription("part:suspension", "mechanic"), /reparación/);
});
test("especialista acelera sólo reparación de su pieza y presupuesto coincide con checklist real", () => {
  const s = createRace(),
    t = getPlayer(s);
  enroll(s, currentEvent(s).eventId);
  t.stageIndex = 1;
  t.phase = "camp";
  s.clock = 0;
  t.budget = 100000;
  t.fuel = 400;
  t.drivers.forEach((d) => (d.energy = 100));
  t.mechanics[0].traits = "";
  t.parts.suspension.condition = 30;
  t.parts.engine.condition = 30;
  const plan = {
    ...defaultPlan(1),
    driverId: t.activeDriver,
    rest: 0,
    fuelTarget: 400,
    actions: Object.fromEntries(
      PART_TYPES.map((p) => [
        p.id,
        p.id === "suspension" || p.id === "engine" ? "repair" : "none",
      ]),
    ),
  };
  const plain = estimateService(t, plan, 1);
  t.mechanics[0].traits = "part:suspension";
  assert.equal(raceRepairBonus(t, "suspension"), 1.5);
  const better = estimateService(t, plan, 1);
  assert.ok(better.workHours < plain.workHours);
  assert.equal(better.cost, plain.cost);
  assert.equal(
    better.lines.find((x) => x.type === "engine").hours,
    plain.lines.find((x) => x.type === "engine").hours,
  );
  assert.equal(
    better.lines.find((x) => x.type === "suspension").hours,
    plain.lines.find((x) => x.type === "suspension").hours / 1.5,
  );
  t.plans[1] = plan;
  advanceTeam(s, t, 30);
  assert.equal(t.phase, "service");
  assert.equal(t.service.until, better.serviceHours * 3600);
  assert.ok(
    Math.abs(t.service.mechanicalSeconds - better.workHours * 3600) < 1e-6,
  );
  assert.match(
    t.service.tasks.find((x) => x.label.includes("suspensión")).detail,
    /Especialista/,
  );
  t.mechanics[0].assignment = "workshop";
  assert.equal(raceRepairBonus(t, "suspension"), 1);
});
