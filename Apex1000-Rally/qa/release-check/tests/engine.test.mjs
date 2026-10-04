import test from "node:test";
import assert from "node:assert/strict";
import {
  createRace,
  getPlayer,
  savePlan,
  buyPart,
  advance,
  nextPlayerCamp,
  performance,
  estimateService,
  estimateStage,
  standings,
  publicSnapshot,
} from "../src/engine.js";
import {
  STAGES,
  TOTAL_KM,
  locationAt,
  recommendedSetup,
} from "../src/route.js";
import {
  PART_TYPES,
  GRADES,
  STARTING_BUDGET,
  defaultPlan,
  vehicle,
  priceFor,
  partEffect,
} from "../src/catalog.js";
import { validateSave, encodeSave } from "../src/storage.js";
const fresh = (seed = 1729) =>
  createRace({
    seed,
    startAt: "2026-10-10T12:00:00Z",
    now: Date.parse("2026-10-10T12:00:00Z"),
  });
const plan = (i = 0) => ({
  ...defaultPlan(i),
  ...recommendedSetup(STAGES[i]),
  fuelTarget: 540,
});
const prepare = (s) => {
  for (let i = 0; i < 15; i++) savePlan(s, i, plan(i));
  return s;
};
const near = (a, b, tol = 1e-8) =>
  assert.ok(Math.abs(a - b) <= tol, `${a} != ${b}`);

test("15 etapas continuas, 10.240 km y posiciones geográficas finitas", () => {
  assert.equal(STAGES.length, 15);
  assert.equal(TOTAL_KM, 10240);
  for (let i = 0; i < 15; i++) {
    const s = STAGES[i];
    near(s.startKm, i ? STAGES[i - 1].endKm : 0);
    near(
      s.segments.reduce((a, x) => a + x.km, 0),
      s.km,
    );
  }
  for (let km = 0; km <= TOTAL_KM; km += 37) {
    const pos = locationAt(km);
    assert.ok(Number.isFinite(pos.lon) && Number.isFinite(pos.lat));
  }
  const pos = locationAt(TOTAL_KM);
  near(pos.lon, STAGES.at(-1).to.lon);
  near(pos.lat, STAGES.at(-1).to.lat);
});
test("largada única: nadie se mueve antes y todos los preparados salen en el mismo tick", () => {
  const s = fresh();
  s.clock = -3600;
  savePlan(s, 0, plan());
  advance(s, 3599);
  assert.ok(s.teams.every((t) => t.totalKm === 0));
  advance(s, 1);
  assert.equal(s.clock, 0);
  assert.ok(s.teams.every((t) => t.totalKm === 0));
  advance(s, 30);
  assert.ok(s.teams.every((t) => t.totalKm > 0 && t.stageStart === 0));
});
test("sin plan el jugador espera mientras los rivales avanzan", () => {
  const s = fresh();
  advance(s, 20 * 3600);
  assert.equal(getPlayer(s).totalKm, 0);
  assert.equal(getPlayer(s).phase, "camp");
  assert.ok(s.teams.slice(1).some((t) => t.stageIndex >= 2));
  assert.throws(() => nextPlayerCamp(s), /Guardá/);
});
test("guardar y cerrar etapas: futuras editables, actuales en carrera y pasadas bloqueadas", () => {
  const s = fresh();
  savePlan(s, 0, plan());
  advance(s, 30);
  assert.throws(() => savePlan(s, 0, plan()), /marcha/);
  savePlan(s, 1, plan(1));
  nextPlayerCamp(s);
  assert.equal(getPlayer(s).stageIndex, 1);
  assert.throws(() => savePlan(s, 0, plan()), /terminó/);
});
test("la semilla y los pasos fijos dan el mismo resultado con distintos tamaños de avance", () => {
  const a = prepare(fresh(843)),
    b = structuredClone(a);
  advance(a, 12 * 3600 + 17);
  for (let i = 0; i < 1440; i++) advance(b, 30);
  advance(b, 17);
  assert.deepEqual(a, b);
});
test("el terreno favorece diferentes configuraciones", () => {
  const t = getPlayer(fresh()),
    sand = STAGES.find((s) => s.segments.some((x) => x.type === "sand"));
  const km = sand.segments.find((x) => x.type === "sand").start + 0.1;
  const fast = performance(
      t,
      sand,
      { ...plan(), ride: "high", pressure: "soft", gearing: "short" },
      km,
    ),
    slow = performance(
      t,
      sand,
      { ...plan(), ride: "low", pressure: "firm", gearing: "long" },
      km,
    );
  assert.ok(fast.speed > slow.speed * 1.25);
  const asphalt = performance(
    t,
    STAGES[0],
    { ...plan(), ride: "low", pressure: "firm", gearing: "long" },
    0,
  );
  assert.ok(
    asphalt.speed >
      performance(
        t,
        STAGES[0],
        { ...plan(), ride: "high", pressure: "soft", gearing: "short" },
        0,
      ).speed,
  );
});
test("exigir las piezas gana velocidad y aumenta desgaste, calor, combustible y riesgo", () => {
  const t = getPlayer(fresh()),
    a = performance(t, STAGES[0], { ...plan(), boost: 0 }),
    b = performance(t, STAGES[0], { ...plan(), boost: 2 });
  for (const k of ["speed", "wear", "heatTarget", "fuelPer100", "risk"])
    assert.ok(b[k] > a[k], k);
});
test("tres pilotos: técnico cuida piezas, velocista arriesga, navegante reduce errores", () => {
  const t = getPlayer(fresh()),
    stats = Object.fromEntries(
      t.drivers.map((d) => [
        d.id,
        performance(t, STAGES[0], { ...plan(), driverId: d.id }),
      ]),
    );
  assert.ok(stats.fast.speed > stats.technical.speed);
  assert.ok(stats.technical.wear < stats.fast.wear);
  assert.ok(stats.navigator.risk < stats.technical.risk);
  assert.ok(stats.fast.risk > stats.technical.risk);
});
test("velocidad de emergencia 30 km/h y límite de asfalto 250 km/h", () => {
  const t = getPlayer(fresh());
  for (const p of Object.values(t.parts)) {
    p.grade = "racing";
    p.condition = 100;
  }
  const setup = {
    ...plan(),
    pace: "attack",
    boost: 2,
    driverId: "fast",
    ride: "low",
    pressure: "firm",
    gearing: "long",
  };
  near(performance(t, STAGES[0], setup).speed, 250);
  t.parts.engine.broken = true;
  near(performance(t, STAGES[0], setup).speed, 30);
});
test("calidad y estado son distintos; repuestos usados cuestan menos y rinden menos", () => {
  assert.ok(
    priceFor("engine", "racing", 50) < priceFor("engine", "racing", 100),
  );
  assert.ok(
    partEffect({ grade: "racing", condition: 100 }) >
      partEffect({ grade: "racing", condition: 50 }),
  );
  assert.ok(GRADES.endurance.durability > GRADES.racing.durability);
  assert.ok(GRADES.endurance.failure < GRADES.racing.failure);
});
test("compra y montaje conservan todas las piezas y el presupuesto contable", () => {
  const s = fresh(),
    t = getPlayer(s),
    old = t.parts.engine.id,
    before = t.budget,
    item = buyPart(s, "engine", "endurance", 75);
  assert.equal(t.budget, before - priceFor("engine", "endurance", 75));
  const p = plan();
  p.actions.engine = "replace";
  p.replacements.engine = item.id;
  savePlan(s, 0, p);
  advance(s, 30);
  assert.equal(t.parts.engine.id, item.id);
  assert.ok(t.inventory.some((i) => i.id === old));
  const ids = [...Object.values(t.parts), ...t.inventory].map((i) => i.id);
  assert.equal(new Set(ids).size, 13);
  near(t.budget, STARTING_BUDGET + t.ledger.reduce((a, l) => a + l.amount, 0));
  assert.throws(() => buyPart(s, "engine", "reserve", 100), /inválida/);
});
test("reparación y descanso ocurren en paralelo, limitados por energía completa", () => {
  const t = getPlayer(fresh());
  t.stageIndex = 1;
  t.drivers[0].energy = 12;
  t.parts.engine.condition = 50;
  const p = {
    ...plan(1),
    driverId: "technical",
    rest: 12,
    actions: Object.fromEntries(
      PART_TYPES.map((x) => [x.id, x.id === "engine" ? "repair" : "none"]),
    ),
  };
  const q = estimateService(t, p);
  near(q.restHours, 8);
  near(q.serviceHours, Math.max(q.workHours, 8));
  assert.ok(q.serviceHours < q.workHours + q.restHours);
  t.drivers[0].energy = 100;
  assert.equal(estimateService(t, p).restHours, 0);
});
test("el pronóstico de salida toma en cuenta reparaciones, cambios y energía recuperada", () => {
  const t = getPlayer(fresh()),
    base = estimateStage(t, STAGES[0], plan());
  t.parts.engine.broken = true;
  t.parts.engine.condition = 0;
  const repaired = estimateStage(t, STAGES[0], plan());
  near(base.hours, repaired.hours);
  assert.equal(t.parts.engine.broken, true);
  assert.equal(t.parts.engine.condition, 0);
});
test("el servicio real espera la mayor duración y recupera energía antes de salir", () => {
  const s = fresh(),
    t = getPlayer(s);
  savePlan(s, 0, plan());
  nextPlayerCamp(s);
  t.drivers[0].energy = 10;
  const p = { ...plan(1), driverId: "technical", rest: "full" };
  savePlan(s, 1, p);
  const q = estimateService(t, p),
    start = s.clock;
  advance(s, 30);
  assert.equal(t.phase, "service");
  near(t.service.until - start, q.serviceHours * 3600);
  advance(s, Math.ceil(q.serviceHours * 120) * 30);
  assert.equal(t.phase, "racing");
  assert.ok(t.drivers[0].energy > 99);
  assert.equal(t.parts.engine.broken, false);
});
test("reservas gastadas nunca se averían y permiten completar una etapa", () => {
  const s = fresh(7),
    t = getPlayer(s),
    p = plan();
  for (const type of PART_TYPES) {
    const spare = t.inventory.find((x) => x.type === type.id);
    spare.condition = 0;
    p.actions[type.id] = "replace";
    p.replacements[type.id] = spare.id;
  }
  p.boost = 2;
  p.pace = "attack";
  savePlan(s, 0, p);
  nextPlayerCamp(s);
  assert.equal(t.stageIndex, 1);
  for (const piece of Object.values(t.parts)) {
    assert.equal(piece.grade, "reserve");
    assert.equal(piece.broken, false);
  }
  assert.equal(t.statistics.failures, 0);
});
test("averías sin dinero instalan reservas y falta de combustible no bloquea la carrera", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.budget = 0;
  for (const p of Object.values(t.parts)) {
    p.condition = 0;
    p.broken = true;
  }
  savePlan(s, 0, { ...plan(), fuelTarget: 0 });
  nextPlayerCamp(s);
  assert.equal(t.stageIndex, 1);
  assert.ok(t.debt > 0);
  assert.equal(t.budget, 0);
  assert.ok(Object.values(t.parts).every((x) => x.grade === "reserve"));
  assert.ok(
    s.events.some((e) => e.teamId === "player" && e.type === "assistance"),
  );
});
test("sin incidentes los gastos de combustible y desgaste se acumulan y la energía cae", () => {
  const s = fresh(),
    t = getPlayer(s);
  savePlan(s, 0, plan());
  advance(s, 3600);
  assert.ok(t.fuel < 540);
  assert.ok(t.parts.tyres.condition < 100);
  assert.ok(t.drivers[0].energy < 100);
  assert.equal(t.drivers[1].energy, 100);
  assert.ok(t.statistics.driving > 0);
  assert.ok(t.statistics.fuelUsed > 0);
  assert.equal(t.prizePaid, false);
});
test("carrera completa: 12 llegadas independientes, premios sólo al final y sin duplicados", () => {
  const s = prepare(fresh());
  advance(s, 3600);
  assert.ok(s.teams.every((t) => !t.prizePaid));
  advance(s, 500 * 3600);
  assert.ok(s.teams.every((t) => t.phase === "finished"));
  for (const [i, t] of standings(s).entries()) {
    assert.equal(t.history.length, 15);
    assert.equal(t.totalKm, TOTAL_KM);
    assert.equal(t.prize.position, i + 1);
    assert.ok(t.budget >= 0);
    near(
      t.budget,
      STARTING_BUDGET + t.ledger.reduce((a, l) => a + l.amount, 0),
    );
    assert.ok(t.finishTime > 3 * 86400);
  }
  assert.ok(new Set(s.teams.map((t) => t.finishTime)).size > 1);
  const budgets = s.teams.map((t) => t.budget);
  advance(s, 3600);
  assert.deepEqual(
    s.teams.map((t) => t.budget),
    budgets,
  );
  assert.deepEqual(validateSave(JSON.parse(encodeSave(s))), s);
});
test("guardado válido en campamento, carrera y asistencia; copia independiente", () => {
  const s = prepare(fresh());
  for (let i = 0; i < 3; i++) {
    const restored = validateSave(JSON.parse(encodeSave(s)));
    assert.deepEqual(restored, s);
    assert.notEqual(restored.teams, s.teams);
    advance(s, i === 0 ? 30 : 12 * 3600);
  }
});
test("importación rechaza planes corruptos, duplicados, NaN, colores e inventario inválido", () => {
  for (const corrupt of [
    (s) => (s.teams[0].budget = NaN),
    (s) => (s.teams[0].plans[0].pace = "warp"),
    (s) => (s.teams[0].color = 'red" onload="alert(1)'),
    (s) => s.teams[0].inventory.push(s.teams[0].inventory[0]),
    (s) => (s.teams[0].inventory[0].broken = true),
    (s) => (s.teams[0].activeDriver = "desconocido"),
    (s) => (s.teams[0].statistics = null),
    (s) => (s.teams[0].history = [{}]),
  ]) {
    const s = prepare(fresh());
    corrupt(s);
    assert.throws(() => validateSave(s));
  }
});
test("contrato público del visor no incluye economía, planes, semilla ni inventario", () => {
  const s = prepare(fresh());
  advance(s, 20 * 3600);
  const view = publicSnapshot(s),
    json = JSON.stringify(view);
  assert.equal(view.entries.length, 12);
  assert.ok(new Set(view.entries.map((t) => t.stageIndex)).size > 1);
  for (const word of [
    '"budget"',
    '"plans"',
    '"inventory"',
    '"rng"',
    '"seed"',
    '"parts"',
  ])
    assert.ok(!json.includes(word));
  assert.ok(
    view.entries.every(
      (t) => Number.isFinite(t.position.lon) && Number.isFinite(t.speedKmh),
    ),
  );
});
test("modo online impide que el cliente adelante el reloj", () => {
  const s = fresh();
  s.mode = "online";
  assert.throws(() => advance(s, 3600), /servidor/);
});
test("una inscripción posterior a la fecha común recupera el avance de los rivales", () => {
  const s = createRace({
    startAt: "2026-10-10T12:00:00Z",
    now: Date.parse("2026-10-11T12:00:00Z"),
  });
  assert.equal(s.clock, 86400);
  assert.equal(getPlayer(s).totalKm, 0);
  assert.ok(s.teams.slice(1).every((t) => t.totalKm > 450));
});
test("el combustible impago conserva la penalización de cuatro horas en la largada", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.budget = 0;
  savePlan(s, 0, plan());
  advance(s, 30);
  assert.equal(t.phase, "service");
  assert.equal(t.totalKm, 0);
  assert.equal(t.service.until, 14400);
  assert.ok(t.debt > 0);
});
test("calidad de refrigeración Endurance reduce la temperatura objetivo", () => {
  const t = getPlayer(fresh()),
    p = plan();
  t.parts.cooling.condition = 100;
  t.parts.cooling.grade = "endurance";
  const cool = performance(t, STAGES[0], p).heatTarget;
  t.parts.cooling.grade = "racing";
  assert.ok(performance(t, STAGES[0], p).heatTarget > cool);
});
