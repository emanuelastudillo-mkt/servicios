import test from "node:test";
import assert from "node:assert/strict";
import { createRace } from "./fixture.mjs";
import {
  getPlayer,
  advance,
  savePlan,
  nextPlayerCamp,
  estimateService,
} from "../src/engine.js";
import { defaultPlan } from "../src/catalog.js";
import {
  arcadeRPM,
  speedAngle,
  dashboardHTML,
  stopChecklistHTML,
} from "../src/cockpit.js";
import { stopStatus, validServiceTimeline } from "../src/service-telemetry.js";
import { validateSave, encodeSave } from "../src/storage.js";
const fresh = () =>
  createRace({
    startAt: "2026-10-10T12:00:00Z",
    now: Date.parse("2026-10-10T12:00:00Z"),
  });
function camp() {
  const s = fresh(),
    t = getPlayer(s);
  savePlan(s, 0, { ...defaultPlan(0), fuelTarget: 540, auto: true });
  nextPlayerCamp(s);
  assert.equal(t.phase, "camp");
  return [s, t];
}
test("velocímetro usa la velocidad del motor; RPM arcade no muta la simulación", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.phase = "racing";
  t.speed = 140;
  const before = structuredClone(s);
  assert.equal(speedAngle(0), -130);
  assert.equal(speedAngle(140), 0);
  assert.equal(speedAngle(280), 130);
  assert.equal(speedAngle(500), 130);
  assert.notEqual(arcadeRPM(t, 0, 1).rpm, arcadeRPM(t, 0, 2).rpm);
  for (const speed of [0, 1, 15, 27, 28, 57, 58, 95, 190, 250]) {
    const a = arcadeRPM({ ...t, speed }, 0, 3);
    assert.ok(a.rpm >= 850 && a.rpm <= 6800);
  }
  assert.equal(arcadeRPM({ ...t, phase: "service" }, 0).rpm, 0);
  assert.equal(arcadeRPM({ ...t, holdUntil: 3600 }, 0).rpm, 0);
  assert.equal(arcadeRPM(t, 0, 1, true).rpm, arcadeRPM(t, 0, 8, true).rpm);
  assert.deepEqual(s, before);
});
test("testigos reflejan fallas reales y el tablero escapa nombres", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.name = "<img src=x onerror=alert(1)>";
  t.speed = 43.7;
  t.parts.engine.broken = true;
  t.parts.cooling.broken = true;
  t.heat = 130;
  t.fuel = 0;
  const html = dashboardHTML(t, s.clock);
  assert.match(html, /43,7/);
  assert.match(html, /Motor: avería/);
  assert.match(html, /Refrigeración: avería/);
  assert.match(html, /dash-lamp critical/);
  assert.ok(!html.includes("<img src=x"));
});
test("checklist mide reparaciones secuenciales y descanso paralelo hasta la salida real", () => {
  const [s, t] = camp();
  t.drivers[0].energy = 10;
  t.parts.engine.condition = 40;
  const plan = {
    ...defaultPlan(1),
    driverId: t.drivers[0].id,
    rest: "full",
    fuelTarget: 540,
    auto: true,
  };
  savePlan(s, 1, plan);
  const q = estimateService(t, plan);
  advance(s, 30);
  assert.equal(t.phase, "service");
  const service = structuredClone(t.service);
  assert.ok(validServiceTimeline(service));
  assert.ok(
    Math.abs(service.until - service.start - q.serviceHours * 3600) < 1e-6,
  );
  assert.ok(
    service.tasks.some((task) => task.kind === "repair" && task.duration > 0),
  );
  assert.ok(service.tasks.some((task) => task.kind === "fuel"));
  assert.equal(service.tasks.find((task) => task.kind === "rest").offset, 0);
  const parallel = stopStatus(
    { ...s, clock: service.start + service.mechanicalSeconds + 1 },
    t,
  );
  assert.ok(
    parallel.tasks
      .filter((task) => task.kind !== "rest")
      .every((task) => task.status === "done"),
  );
  assert.equal(
    parallel.tasks.find((task) => task.kind === "rest").status,
    "active",
  );
  assert.match(parallel.reason, /descanso/);
  const restored = validateSave(JSON.parse(encodeSave(s)));
  assert.deepEqual(getPlayer(restored).service.tasks, service.tasks);
  advance(s, Math.ceil((service.until - s.clock) / 30) * 30 + 30);
  assert.equal(t.phase, "racing");
  assert.equal(stopStatus(s, t), null);
});
test("parada sin fondos explica omisiones, reservas y cuatro horas de asistencia", () => {
  const [s, t] = camp();
  t.budget = 0;
  t.fuel = 0;
  t.parts.engine.condition = 0;
  t.parts.engine.broken = true;
  savePlan(s, 1, { ...defaultPlan(1), fuelTarget: 540, auto: true, rest: 0 });
  advance(s, 30);
  const status = stopStatus(s, t);
  assert.ok(
    status.tasks.some(
      (task) => task.kind === "repair" && task.status === "skipped",
    ),
  );
  assert.ok(status.tasks.some((task) => task.kind === "reserve"));
  assert.equal(
    status.tasks.find((task) => task.kind === "assistance").duration,
    14400,
  );
  assert.ok(validServiceTimeline(t.service));
  assert.match(stopChecklistHTML(s, t), /presupuesto insuficiente/i);
});
test("paradas antiguas mantienen su salida; guardados rechazan cronogramas corruptos", () => {
  const [s, t] = camp();
  savePlan(s, 1, {
    ...defaultPlan(1),
    rest: "full",
    fuelTarget: 540,
    auto: true,
  });
  advance(s, 30);
  const bad = JSON.parse(encodeSave(s));
  getPlayer(bad).service.tasks[0].duration = Infinity;
  assert.throws(() => validateSave(bad), /Servicio inválido/);
  delete t.service.tasks;
  const deadline = t.service.until;
  const restored = validateSave(JSON.parse(encodeSave(s)));
  assert.equal(getPlayer(restored).service.until, deadline);
  assert.equal(
    stopStatus(restored, getPlayer(restored)).tasks[0].kind,
    "legacy",
  );
});
test("campamento anuncia el plan automático o la salida manual guardada", () => {
  const [s, t] = camp();
  assert.match(stopStatus(s, t).reason, /plan automático/);
  savePlan(s, 1, { ...defaultPlan(1), auto: false });
  assert.match(stopStatus(s, t).reason, /desactivada/);
});
