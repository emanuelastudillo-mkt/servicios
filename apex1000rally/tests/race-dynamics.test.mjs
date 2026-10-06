import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentRace as createRace } from "./fixture.mjs";
import {
  getPlayer,
  performance,
  estimateService,
  estimateStage,
  advance,
  savePlan,
  nextPlayerCamp,
} from "../src/engine.js";
import { driverRhythm, terrainPartFactors } from "../src/race-dynamics.js";
import { defaultPlan } from "../src/catalog.js";
import { routeFor } from "../src/route.js";
import {
  activeCar,
  enqueueJob,
  advanceWorkshops,
  jobQuote,
  assignMechanic,
  workshopPieces,
} from "../src/workshop.js";
import { repairQuote } from "../src/part-maintenance.js";
import { validateSave, encodeSave } from "../src/storage.js";
import {
  VEHICLE_BALANCE,
  migrateVehicleBalance,
} from "../src/vehicle-stats.js";
import { workshopPage } from "../src/workshop-ui.js";
const fresh = () =>
  createRace({
    startAt: "2026-10-20T12:00:00Z",
    now: Date.parse("2026-10-10T12:00:00Z"),
  });

test("las curvas son suaves, acotadas, distintas y no consumen aleatoriedad de averías", () => {
  const t = getPlayer(fresh()),
    d = t.drivers[0],
    rng = t.rng;
  const a = [],
    b = [];
  for (let seconds = 0; seconds < 86400; seconds += 30) {
    a.push(driverRhythm(t, d, seconds));
    b.push(driverRhythm(t, t.drivers[1], seconds));
    assert.ok(a.at(-1) >= 0.905 && a.at(-1) <= 1.095);
    if (a.length > 1) assert.ok(Math.abs(a.at(-1) - a.at(-2)) < 0.03);
  }
  assert.ok(Math.max(...a) - Math.min(...a) > 0.05);
  assert.notDeepEqual(a, b);
  assert.equal(t.rng, rng);
  assert.equal(
    driverRhythm(t, d, 1234),
    driverRhythm(structuredClone(t), structuredClone(d), 1234),
  );
  assert.ok(Math.abs(a.reduce((x, y) => x + y) / a.length - 1) < 0.003);
});

test("dos pilotos con capacidad media comparable pueden intercambiar posiciones por su ritmo", () => {
  const a = getPlayer(fresh()),
    b = structuredClone(a),
    stage = structuredClone(routeFor(a).stages[0]),
    plan = defaultPlan();
  b.id = "rival";
  b.drivers[0].personId = "rival-driver";
  stage.segments = [{ type: "gravel", start: 0, end: 10000, km: 10000 }];
  let kmA = 0,
    kmB = 0,
    previous = 0,
    passes = 0;
  for (let seconds = 0; seconds < 4 * 3600; seconds += 30) {
    kmA += performance(a, stage, plan, 0, seconds).speed / 120;
    kmB += performance(b, stage, plan, 0, seconds).speed / 120;
    const order = Math.sign(kmA - kmB);
    if (previous && order !== previous) passes++;
    previous = order;
  }
  assert.ok(passes >= 2, `Sólo ${passes} cambios de posición`);
});

test("la estimación de etapa usa ritmo medio y los 30 km/h por avería tienen prioridad", () => {
  const t = getPlayer(fresh()),
    stage = routeFor(t).stages[0],
    plan = defaultPlan();
  const estimate = estimateStage(t, stage, plan);
  t.statistics.driving = 98765;
  assert.deepEqual(estimateStage(t, stage, plan), estimate);
  t.parts.engine.broken = true;
  for (const seconds of [0, 180, 900, 5400])
    assert.equal(performance(t, stage, plan, 0, seconds).speed, 30);
});

test("cada tipo de pieza influye y su importancia depende de la superficie", () => {
  const pristine = {
    engine: 1,
    transmission: 1,
    suspension: 1,
    tyres: 1,
    brakes: 1,
    cooling: 1,
  };
  for (const type of Object.keys(pristine)) {
    assert.ok(
      terrainPartFactors({ ...pristine, [type]: 0.4 }, "gravel").speed < 1,
    );
  }
  const weakEngine = { ...pristine, engine: 0.4 },
    weakSuspension = { ...pristine, suspension: 0.4 },
    weakBrakes = { ...pristine, brakes: 0.4 };
  assert.ok(
    terrainPartFactors(weakEngine, "asphalt").speed <
      terrainPartFactors(weakEngine, "rock").speed,
  );
  assert.ok(
    terrainPartFactors(weakSuspension, "rock").speed <
      terrainPartFactors(weakSuspension, "asphalt").speed,
  );
  assert.ok(
    terrainPartFactors(weakBrakes, "mountain").speed <
      terrainPartFactors(weakBrakes, "sand").speed,
  );
  assert.ok(terrainPartFactors(weakBrakes, "mountain").risk > 1);
});

test("el taller permite recuperar una reserva instalada, pausa sin personal y bloquea la largada", () => {
  const s = fresh(),
    t = getPlayer(s),
    standard = t.inventory.find(
      (x) => x.type === "engine" && x.grade === "reserve",
    );
  t.inventory = t.inventory.filter((x) => x !== standard);
  t.inventory.push(t.parts.engine);
  t.parts.engine = standard;
  standard.condition = 25;
  const html = workshopPage(s);
  assert.match(html, /Estándar irrompible · INSTALADA/);
  assert.equal(
    new Set(workshopPieces(t).map((p) => p.id)).size,
    workshopPieces(t).length,
  );
  const j = enqueueJob(s, "part", standard.id);
  advanceWorkshops(s, 86400);
  assert.equal(j.worked, 0);
  assert.throws(
    () =>
      nextPlayerCamp({
        ...s,
        teams: s.teams.map((x) =>
          x.id === "player"
            ? { ...x, phase: "waiting", participating: true }
            : x,
        ),
      }),
    /taller sin mecánicos/,
  );
  const saved = validateSave(JSON.parse(encodeSave(s)));
  assert.equal(getPlayer(saved).workshop.jobs[0].targetId, standard.id);
  assignMechanic(s, t.mechanics[0].id, "workshop");
  advanceWorkshops(s, (j.workHours * 3600) / t.mechanics[0].efficiency + 86400);
  assert.equal(standard.condition, 100);
  assert.equal(standard.original, 96);
  assert.equal(standard.broken, false);
  assert.equal(t.workshop.jobs.length, 0);
  t.phase = "racing";
  standard.condition = 20;
  assert.throws(() => enqueueJob(s, "part", standard.id), /sólo se repara/);
});

test("las reparaciones nuevas duran diez veces más; las mejoras y trabajos anteriores mantienen sus acuerdos", () => {
  const s = fresh(),
    t = getPlayer(s),
    car = activeCar(t),
    part = t.inventory[0];
  car.condition = 50;
  part.condition = 20;
  assert.equal(
    jobQuote(s, t, "condition", car.id).workHours,
    10 * jobQuote(s, t, "condition", car.id, 5, 2).workHours,
  );
  assert.equal(
    jobQuote(s, t, "part", part.id).workHours,
    10 * jobQuote(s, t, "part", part.id, 5, 2).workHours,
  );
  assert.equal(
    jobQuote(s, t, "performance", car.id).workHours,
    jobQuote(s, t, "performance", car.id, 5, 2).workHours,
  );
  assert.equal(
    repairQuote(part, { timeMultiplier: 10 }).hours,
    10 * repairQuote(part, { timeMultiplier: 1 }).hours,
  );
  const old = jobQuote(s, t, "part", part.id, 5, 2),
    j = enqueueJob(s, "part", part.id);
  Object.assign(j, { workHours: old.workHours, pricingVersion: 2 });
  assert.equal(
    getPlayer(validateSave(s)).workshop.jobs[0].workHours,
    old.workHours,
  );
  t.mechanics.forEach((m) => {
    m.traits = "";
  });
  const q = estimateService(t, defaultPlan(), 2);
  assert.ok(
    q.lines
      .filter((x) => x.action === "repair")
      .every((x) => x.hours === repairQuote(t.parts[x.type]).hours),
  );
});

test("el nuevo balance conserva dinero, desgaste, mejoras, peso y personalizaciones; se migra una sola vez", () => {
  const s = fresh(),
    t = getPlayer(s),
    c = activeCar(t),
    budget = t.budget;
  delete s.vehicleBalance;
  Object.assign(c.stats, {
    speed: 70,
    acceleration: 72,
    comfort: 78,
    control: 80,
    weightKg: 2490,
  });
  c.condition = 34;
  c.performance = 91;
  c.reliability = 82;
  const custom = structuredClone(c);
  custom.id = "custom";
  custom.stats.comfort = 99;
  t.garage.push(custom);
  migrateVehicleBalance(s);
  assert.deepEqual(
    [c.stats.speed, c.stats.acceleration, c.stats.comfort, c.stats.control],
    VEHICLE_BALANCE.hilux,
  );
  assert.equal(c.stats.weightKg, 2490);
  assert.equal(custom.stats.comfort, 99);
  assert.equal(t.budget, budget);
  assert.deepEqual([c.condition, c.performance, c.reliability], [34, 91, 82]);
  c.stats.speed = 71;
  migrateVehicleBalance(s);
  assert.equal(c.stats.speed, 71);
});
