import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentRace as createRace } from "./fixture.mjs";
import {
  getPlayer,
  advance,
  savePlan,
  updateRaceClosure,
  activateEvent,
  nextScheduledRace,
  standings,
  estimateStage,
} from "../src/engine.js";
import {
  calendar,
  currentEvent,
  enroll,
  cancelEnrollment,
  enrollmentReason,
  raceNow,
  raceDeadline,
  initializeCompetition,
} from "../src/competition.js";
import {
  activeCar,
  assignMechanic,
  enqueueJob,
  jobQuote,
  sellVehicle,
  purchaseVehicle,
} from "../src/workshop.js";
import { defaultPlan, vehicle, PART_TYPES } from "../src/catalog.js";
import { routeFor } from "../src/route.js";
import { validateSave } from "../src/storage.js";
import { CATALOG } from "../data/catalog.js";
import { createRace as oldRace } from "./fixture.mjs";
const epoch = Date.parse("2026-10-05T12:00:00Z");
const fresh = () =>
  createRace({ startAt: new Date(epoch).toISOString(), now: epoch - 3600000 });
const sprint = (s, n = 0) =>
  calendar(s, epoch, epoch + 60 * 86400000).filter((e) => e.kind === "short")[
    n
  ];
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test("no inscripción: cero kilómetros, sin sueldos ni premio; el taller sí avanza", () => {
  const s = fresh(),
    t = getPlayer(s),
    budget = t.budget;
  assert.equal(t.participating, false);
  assignMechanic(s, t.mechanics[0].id, "workshop");
  const j = enqueueJob(s, "performance", t.activeCarId, 1);
  advance(s, 30 * 3600);
  assert.equal(t.totalKm, 0);
  assert.equal(t.phase, "unregistered");
  assert.equal(t.prizePaid, false);
  assert.equal(activeCar(t).performance, 51);
  assert.equal(t.budget, budget - j.cost);
  validateSave(s);
});
test("24 sprints distintos, cada 48 h, 4 h máximas y una etapa detallada", () => {
  const s = fresh(),
    events = calendar(s, epoch + 1, epoch + 48 * 86400000).filter(
      (e) => e.kind === "short",
    );
  assert.equal(events.length, 24);
  assert.equal(new Set(events.map((e) => e.id)).size, 24);
  for (let i = 0; i < 24; i++) {
    assert.equal(events[i].end - events[i].start, 4 * 3600000);
    assert.equal(routeFor(events[i].id).stages.length, 1);
    assert.ok(routeFor(events[i].id).stages[0].path.length > 17);
    if (i) assert.equal(events[i].start - events[i - 1].start, 48 * 3600000);
  }
  assert.equal(sprint(s, 24).id, sprint(s, 0).id);
});
test("inscripción fija, cancela antes de largar y prohíbe inscripción tardía", () => {
  const s = fresh(),
    e = currentEvent(s);
  enroll(s, e.eventId);
  assert.equal(getPlayer(s).participating, true);
  cancelEnrollment(s, e.eventId);
  assert.equal(getPlayer(s).participating, false);
  advance(s, 3600);
  assert.throws(() => enroll(s, e.eventId), /cerró/);
  validateSave(s);
});
test("bloqueo usa intervalo máximo, permite sprints consecutivos y no libera al terminar temprano", () => {
  const s = fresh(),
    raid = currentEvent(s),
    short = sprint(s);
  enroll(s, raid.eventId);
  assert.match(enrollmentReason(s, short), /superpone/);
  cancelEnrollment(s, raid.eventId);
  enroll(s, short.eventId);
  enroll(s, sprint(s, 1).eventId);
  assert.equal(s.competition.registrations.length, 2);
  assert.throws(() => enroll(s, raid.eventId), /superpone/);
  const t = getPlayer(s);
  t.finishTime = 100;
  t.phase = "finished";
  assert.match(enrollmentReason(s, raid), /superpone/);
});
test("cierre exacto a las 24 h del primer finalista; pendientes por distancia, pago único", () => {
  const s = fresh();
  enroll(s, currentEvent(s).eventId);
  const a = s.teams[1],
    b = s.teams[2],
    d = s.teams[3];
  // Synthetic arrival isolates deadline accounting from the long simulation.
  s.clock = 100;
  a.finishTime = 100;
  a.phase = "finished";
  a.totalKm = routeFor(s).totalKm;
  b.totalKm = 1000;
  d.totalKm = 500;
  updateRaceClosure(s);
  assert.equal(raceDeadline(s), 86500);
  s.clock = 86499;
  updateRaceClosure(s);
  assert.equal(s.competition.closed, false);
  s.clock = 86500;
  updateRaceClosure(s);
  assert.equal(s.competition.closed, true);
  assert.equal(b.phase, "cutoff");
  const order = standings(s);
  assert.equal(order[0].id, a.id);
  assert.equal(order[1].id, b.id);
  assert.equal(order[2].id, d.id);
  const cash = s.teams.map((t) => t.budget);
  updateRaceClosure(s);
  advance(s, 3600);
  assert.deepEqual(
    s.teams.map((t) => t.budget),
    cash,
  );
  assert.equal(s.competition.results.length, 1);
  assert.ok(s.teams.every((t) => t.prizePaid));
  assert.equal(s.championship.paid, false);
});
test("raid real: jugador detenido no impide cierre por ganador o por máximo de ocho días ni reimportar", () => {
  const s = fresh();
  enroll(s, currentEvent(s).eventId);
  savePlan(s, 0, { ...defaultPlan(0), fuelTarget: 540 });
  for (let i = 0; i < 70 && !s.competition.closed; i++)
    advance(s, 10 * 3600, { stopAtAllFinished: true });
  assert.equal(s.competition.closed, true);
  near(
    s.clock,
    Math.min(
      currentEvent(s).maxHours * 3600,
      s.competition.firstFinishAt === null
        ? Infinity
        : s.competition.firstFinishAt + 86400,
    ),
  );
  assert.equal(
    s.competition.results[0].reason,
    s.competition.firstFinishAt === null ? "maximum" : "first-finisher",
  );
  const t = getPlayer(s);
  assert.equal(t.phase, "cutoff");
  assert.equal(t.stageIndex, 1);
  assert.ok(t.prizePaid);
  validateSave(structuredClone(s));
  const budget = t.budget;
  advance(s, 24 * 3600);
  assert.equal(t.budget, budget);
});
test("sin finalistas, vence el máximo y clasifica según progreso; guardado real válido", () => {
  const s = fresh(),
    e = sprint(s);
  enroll(s, e.eventId);
  activateEvent(s, e);
  const t = getPlayer(s);
  t.parts.engine.broken = true;
  t.parts.engine.condition = 0;
  advance(s, 53 * 3600);
  assert.equal(s.competition.closed, true);
  assert.ok(s.competition.closedAt <= e.end);
  assert.equal(t.phase, "cutoff");
  assert.ok(t.totalKm < routeFor(s).totalKm);
  assert.equal(t.parts.engine.broken, true);
  validateSave(s);
});
test("sprint usa un piloto, sin servicio, reparaciones, cambios de piezas o rescate", () => {
  const s = fresh(),
    e = sprint(s);
  const t = getPlayer(s),
    driver = t.drivers[1];
  enroll(s, e.eventId, driver.id);
  activateEvent(s, e);
  t.parts.engine.condition = 40;
  const id = t.parts.engine.id;
  savePlan(s, 0, { ...defaultPlan(), driverId: driver.id, fuelTarget: 1 });
  advance(s, 50 * 3600);
  assert.equal(t.activeDriver, driver.id);
  assert.equal(t.service, null);
  assert.equal(t.parts.engine.id, id);
  assert.ok(t.parts.engine.condition <= 40);
  assert.equal(t.statistics.service, 0);
  assert.ok(!t.ledger.some((l) => /reparación|cambio|Rescate/.test(l.label)));
  const fuel = t.fuel;
  advance(s, 3 * 3600);
  assert.equal(t.fuel, fuel);
  assert.equal(s.competition.closed, true);
  validateSave(s);
});
test("inscripción futura inicia automáticamente a la hora compartida y conserva economía", () => {
  const s = fresh(),
    e = sprint(s);
  enroll(s, e.eventId);
  const t = getPlayer(s),
    carId = t.activeCarId,
    budget = t.budget;
  advance(s, 49 * 3600 + 30);
  assert.equal(s.id, e.eventId);
  assert.equal(s.routeId, e.id);
  assert.ok(t.totalKm > 0);
  assert.equal(t.activeCarId, carId);
  assert.ok(t.budget < budget);
  assert.equal(t.stageIndex, 0);
  validateSave(s);
});
test("vender el auto seleccionado y último es válido; comprar después permite inscribirse", () => {
  const s = fresh(),
    t = getPlayer(s),
    id = t.activeCarId;
  enroll(s, sprint(s).eventId);
  sellVehicle(s, id);
  assert.equal(t.garage.length, 0);
  assert.equal(t.activeCarId, null);
  assert.equal(s.competition.registrations.length, 0);
  assert.match(enrollmentReason(s, sprint(s)), /vehículo/);
  validateSave(s);
  const car = purchaseVehicle(s, "niva");
  assert.equal(t.activeCarId, car.id);
  enroll(s, sprint(s).eventId);
  validateSave(s);
});
test("venta del auto participante está bloqueada durante el trayecto", () => {
  const s = fresh();
  enroll(s, currentEvent(s).eventId);
  savePlan(s, 0, { ...defaultPlan(), fuelTarget: 540 });
  advance(s, 3630);
  assert.equal(getPlayer(s).phase, "racing");
  assert.throws(() => sellVehicle(s, getPlayer(s).activeCarId), /participando/);
});
test("entregar el auto seleccionado cancela inscripciones futuras y conserva fondos", () => {
  const s = fresh(),
    t = getPlayer(s),
    old = t.activeCarId;
  enroll(s, sprint(s).eventId);
  const next = purchaseVehicle(s, "niva", { tradeId: old });
  assert.equal(t.activeCarId, next.id);
  assert.equal(s.competition.registrations.length, 0);
  assert.equal(t.garage.length, 1);
  validateSave(s);
  enroll(s, sprint(s).eventId);
  assert.equal(s.competition.registrations[0].carId, next.id);
});
test("mejoras elegibles 1 a 5, diez veces más lentas como mínimo y crecientes; cap 100", () => {
  const s = fresh(),
    t = getPlayer(s),
    c = activeCar(t);
  const low = jobQuote(s, t, "performance", c.id, 1);
  assert.equal(low.workHours, 20);
  assert.equal(low.target, 51);
  c.performance = 90;
  const high = jobQuote(s, t, "performance", c.id, 1),
    old = jobQuote(s, t, "performance", c.id, 1, 1);
  assert.ok(high.workHours > low.workHours * 5);
  assert.ok(high.workHours >= old.workHours * 10);
  c.performance = 98;
  assert.equal(jobQuote(s, t, "performance", c.id, 5).target, 100);
  assert.throws(() => enqueueJob(s, "performance", c.id, 6), /1 y 5/);
  assignMechanic(s, t.mechanics[0].id, "workshop");
  const j = enqueueJob(s, "performance", c.id, 1);
  assert.equal(j.target, 99);
  validateSave(s);
});
test("acompañantes descansan al 0.1 en movimiento y al 1 en base; activo conserva energía", () => {
  const s = fresh(),
    e = sprint(s),
    t = getPlayer(s);
  enroll(s, e.eventId);
  activateEvent(s, e);
  s.clock = 0;
  t.drivers.forEach((d) => (d.energy = 50));
  advance(s, 30);
  const standby = t.drivers.find((d) => d.id !== t.activeDriver);
  near(standby.energy, 50 + (standby.recovery * 0.1) / 120);
  const before = standby.energy;
  t.participating = false;
  t.phase = "unregistered";
  advance(s, 30);
  near(standby.energy, before + standby.recovery / 120);
});
test("energía completa alcanza todas las etapas normales con margen, incluso en Niva", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.vehicleId = "niva";
  t.garage[0].modelId = "niva";
  for (const r of CATALOG.races)
    for (const stage of routeFor(r.id).stages)
      for (const d of t.drivers) {
        const hours = estimateStage(t, stage, {
          ...defaultPlan(),
          driverId: d.id,
          fuelTarget: 300,
        }).hours;
        assert.ok(
          hours * 3 * d.fatigue * 1.2 < 90,
          `${r.id} E${stage.index + 1} ${d.name}: ${hours}`,
        );
      }
});
test("migración conserva dinero, daños y cola vieja; amplía catálogos sin repetir pagos", () => {
  const s = oldRace({
    startAt: new Date(epoch).toISOString(),
    now: epoch - 3600000,
  });
  const t = getPlayer(s);
  t.parts.engine.condition = 35;
  const job = enqueueJob(s, "performance", t.activeCarId);
  job.pricingVersion = 1;
  job.workHours = 10;
  job.points = 5;
  const before = t.budget;
  validateSave(s);
  initializeCompetition(s, { legacy: true });
  assert.equal(t.budget, before);
  assert.equal(t.parts.engine.condition, 35);
  assert.equal(t.participating, true);
  assert.equal(s.management.catalog.mechanics.length, 28);
  validateSave(s);
});
test("rechaza inscripción duplicada, falsa fecha, superposición y cierre falsificado", () => {
  const s = fresh();
  enroll(s, sprint(s).eventId);
  let a = structuredClone(s);
  a.competition.registrations.push(a.competition.registrations[0]);
  assert.throws(() => validateSave(a), /calendario/);
  a = structuredClone(s);
  a.competition.registrations[0].eventId = "sprint-salta@123";
  assert.throws(() => validateSave(a));
  a = structuredClone(s);
  a.competition.closed = true;
  a.competition.closedAt = raceNow(s);
  assert.throws(() => validateSave(a));
});
