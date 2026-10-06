import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  addDirector,
  events,
  command,
  advanceWorld,
} from "../server/world.js";
import { participant, pieces, reservations } from "../server/resources.js";
import { viewWorld } from "../server/view.js";
import { routeFor } from "../../src/route.js";
import { commit, readWorld } from "../server/store.js";
import { database } from "./d1.mjs";
const now = Date.parse("2026-10-06T12:00:00Z");
function fixture(at = now, lead = 60000) {
  const w = createWorld(at, new Date(at + lead).toISOString()),
    t = addDirector(w, "a", "director_a", "A", 1);
  t.budget = 1000000;
  command(w, t.id, { type: "purchase-car", modelId: "niva" });
  const mechanic = structuredClone(t.mechanics[0]);
  mechanic.id = "a-second-mechanic";
  mechanic.personId = mechanic.id;
  t.mechanics.push(mechanic);
  const long = events(w).find((e) => e.id === "andes"),
    short = events(w).find((e) => e.kind === "short");
  const kit = Object.fromEntries(
      Object.entries(t.parts).map(([type, p]) => [type, p.id]),
    ),
    reserve = Object.fromEntries(t.inventory.map((p) => [p.type, p.id]));
  const a = {
    type: "enroll",
    eventId: long.eventId,
    carId: t.garage[0].id,
    driverIds: t.drivers.slice(0, 2).map((p) => p.id),
    mechanicIds: [t.mechanics[0].id],
    partIds: kit,
    spareIds: [],
  };
  const b = {
    type: "enroll",
    eventId: short.eventId,
    carId: t.garage[1].id,
    driverIds: [t.drivers[2].id],
    mechanicIds: [t.mechanics[1].id],
    partIds: reserve,
    spareIds: [],
  };
  return { w, t, long, short, a, b };
}
test("ocho raids: 12 a 16 etapas y máximo de ocho días; sprints cada 48 h y hasta cuatro horas", () => {
  const w = createWorld(now, new Date(now + 60000).toISOString()),
    all = events(w, now, now + 230 * 86400000);
  for (const e of all) {
    assert.ok(e.end - e.start <= (e.kind === "short" ? 4 : 192) * 3600000);
    const n = routeFor(e.id).stages.length;
    if (e.kind === "raid") assert.ok(n >= 12 && n <= 16);
    else assert.equal(n, 1);
  }
  const starts = [
    ...new Set(all.filter((e) => e.kind === "short").map((e) => e.start)),
  ].sort((a, b) => a - b);
  assert.ok(starts.slice(1).every((n, i) => n - starts[i] === 48 * 3600000));
});
test("mínimos y máximos de personal: larga acepta un piloto; sprint exige exactamente uno de cada rol", () => {
  const { w, t, a, b } = fixture();
  for (const invalid of [
    { ...a, driverIds: [] },
    { ...a, mechanicIds: [] },
    { ...a, carId: "ajeno" },
    { ...b, driverIds: t.drivers.slice(0, 2).map((p) => p.id) },
    { ...b, mechanicIds: t.mechanics.map((p) => p.id) },
  ])
    assert.throws(() => command(w, t.id, invalid), /exige|Necesitás/);
  command(w, t.id, { ...a, driverIds: a.driverIds.slice(0, 1) });
  command(w, t.id, b);
  assert.equal(reservations(w, t.id).length, 2);
});
test("reservas independientes: rechaza compartir cada recurso y acepta dos pilotos más un piloto reservado", () => {
  const { w, t, a, b } = fixture();
  command(w, t.id, a);
  for (const invalid of [
    { ...b, carId: a.carId },
    { ...b, driverIds: [a.driverIds[0]] },
    { ...b, mechanicIds: a.mechanicIds },
    { ...b, partIds: { ...b.partIds, engine: a.partIds.engine } },
    { ...b, spareIds: [a.partIds.engine] },
  ])
    assert.throws(() => command(w, t.id, invalid), /superpone/);
  command(w, t.id, b);
  assert.deepEqual(w.races[a.eventId].entries[t.id].driverIds, a.driverIds);
  assert.deepEqual(w.races[b.eventId].entries[t.id].driverIds, b.driverIds);
  assert.throws(
    () => command(w, t.id, { type: "sell-car", id: b.carId }),
    /reservado/,
  );
  assert.throws(
    () =>
      command(w, t.id, {
        type: "enqueue-work",
        kind: "part",
        id: b.partIds.engine,
      }),
    /reservado/,
  );
  assert.throws(
    () =>
      command(w, t.id, { type: "release", kind: "driver", id: b.driverIds[0] }),
    /reservado/,
  );
});
test("kit completo, propiedad, tipo, piezas repetidas y trabajos pendientes se validan en servidor", () => {
  const { w, t, a } = fixture();
  for (const invalid of [
    { ...a, partIds: { ...a.partIds, engine: "ajena" } },
    { ...a, partIds: { ...a.partIds, engine: a.partIds.tyres } },
    { ...a, spareIds: [a.partIds.engine] },
    { ...a, partIds: { engine: a.partIds.engine } },
  ])
    assert.throws(() => command(w, t.id, invalid), /pieza|piezas/);
  t.inventory[0].condition = 30;
  command(w, t.id, {
    type: "enqueue-work",
    kind: "part",
    id: t.inventory[0].id,
  });
  assert.throws(
    () => command(w, t.id, { ...a, spareIds: [t.inventory[0].id] }),
    /pendientes/,
  );
});
test("configurar inscripción conserva planes y solo permite usar pilotos y repuestos enviados", () => {
  const { w, t, a, b } = fixture(now, 6 * 3600000);
  command(w, t.id, a);
  const entry = w.races[a.eventId].entries[t.id],
    plan = entry.plans[0];
  assert.throws(
    () =>
      command(w, t.id, {
        type: "save-plan",
        eventId: a.eventId,
        stageIndex: 0,
        plan: { ...plan, driverId: b.driverIds[0] },
      }),
    /piloto no/,
  );
  assert.throws(
    () =>
      command(w, t.id, {
        type: "save-plan",
        eventId: a.eventId,
        stageIndex: 0,
        plan: { ...plan, replacements: { engine: b.partIds.engine } },
      }),
    /repuesto no/,
  );
  command(w, t.id, {
    ...a,
    type: "configure-enrollment",
    driverIds: [a.driverIds[0]],
  });
  assert.ok(
    w.races[a.eventId].entries[t.id].plans.every(
      (p) => p.driverId === a.driverIds[0],
    ),
  );
});
test("dos runtimes avanzan sin duplicar dinero ni activos; sprint puede cerrar mientras sigue el raid", async () => {
  let { w, t, a, b, short } = fixture(now, 6 * 3600000);
  command(w, t.id, a);
  command(w, t.id, b);
  advanceWorld(w, Date.parse(w.epoch) + 180000, 6 * 3600 + 180, {
    idleJump: true,
  });
  const relief = t.drivers[1],
    idle = t.drivers[2];
  relief.energy = 50;
  idle.energy = 50;
  advanceWorld(w, w.at + 300000);
  assert.ok(
    idle.energy - 50 > (relief.energy - 50) * 5,
    "piloto de base descansa a 1x, relevo en ruta a 0.1x",
  );
  w.at = short.start;
  w.engine.clock = (w.at - Date.parse(w.epoch)) / 1000;
  advanceWorld(w, w.at + 120000);
  const raid = participant(w, w.races[a.eventId], t.id),
    sprint = participant(w, w.races[b.eventId], t.id);
  assert.ok(raid.totalKm > 0 && sprint.totalKm > 0);
  assert.notEqual(raid.activeCarId, sprint.activeCarId);
  assert.deepEqual(t.onlineRaces.sort(), [a.eventId, b.eventId].sort());
  assert.equal(new Set(pieces(t).map((p) => p.id)).size, pieces(t).length);
  const view = viewWorld(w, t.id, b.eventId);
  assert.equal(view.teams[0].drivers.length, 1);
  assert.equal(view.online.baseTeam.drivers.length, 3);
  assert.equal(view.teams[0].mechanics.length, 1);
  const db = database();
  await commit(db, { revision: -1 }, w, "two-races");
  w = (await readWorld(db, w.at, w.epoch)).world;
  t = w.engine.teams[0];
  const before = participant(w, w.races[a.eventId], t.id).totalKm,
    budget = t.budget;
  w.races[b.eventId].event.end = w.at;
  advanceWorld(w, w.at + 30000);
  assert.equal(w.races[b.eventId].status, "closed");
  assert.equal(w.races[a.eventId].status, "running");
  assert.ok(participant(w, w.races[a.eventId], t.id).totalKm >= before);
  assert.ok(t.budget > budget);
  assert.deepEqual(t.onlineRaces, [a.eventId]);
  assert.equal(w.stats[t.id].starts, 1);
  await commit(db, { revision: 0 }, w, "sprint-closed");
  assert.equal(
    db.sql.prepare("SELECT COUNT(*) n FROM results WHERE team_id=?").get(t.id)
      .n,
    1,
  );
  const paid = t.budget;
  advanceWorld(w, w.at + 30000);
  assert.ok(t.budget <= paid, "premio no se paga dos veces");
});
test("migración conserva recursos y avance de inscripciones anteriores sin crear copias de piezas", () => {
  const { w, t, a } = fixture();
  command(w, t.id, a);
  advanceWorld(w, now + 120000);
  const e = w.races[a.eventId].entries[t.id],
    before = t.totalKm;
  for (const k of [
    "driverIds",
    "mechanicIds",
    "partIds",
    "spareIds",
    "reservedPartIds",
    "runtime",
  ])
    delete e[k];
  advanceWorld(w, w.at + 30000);
  assert.ok(t.totalKm >= before);
  assert.equal(new Set(pieces(t).map((p) => p.id)).size, pieces(t).length);
});
test("gestionar recursos libres tras leer D1 conserva los planes del raid y mueve sólo el taller disponible", async () => {
  let { w, t, a, b } = fixture(now, 6 * 3600000);
  command(w, t.id, a);
  command(w, t.id, b);
  advanceWorld(w, Date.parse(w.epoch) + 120000, 6 * 3600 + 120, {
    idleJump: true,
  });
  const db = database();
  await commit(db, { revision: -1 }, w, "management-fixture");
  w = (await readWorld(db, w.at, w.epoch)).world;
  t = w.engine.teams[0];
  const before = participant(w, w.races[a.eventId], t.id),
    plans = structuredClone(before.plans);
  command(w, t.id, { type: "purchase-car", modelId: "hilux" });
  const car = t.garage.at(-1);
  command(w, t.id, { type: "select-car", id: car.id });
  command(w, t.id, {
    type: "enqueue-work",
    kind: "performance",
    id: car.id,
    points: 1,
  });
  const mechanic = structuredClone(t.mechanics[0]);
  mechanic.id = "third-mechanic";
  mechanic.personId = mechanic.id;
  mechanic.assignment = "workshop";
  delete mechanic.onlinePreviousAssignment;
  t.mechanics.push(mechanic);
  advanceWorld(w, w.at + 300000);
  const after = participant(w, w.races[a.eventId], t.id);
  assert.deepEqual(after.plans, plans);
  assert.equal(after.activeCarId, a.carId);
  assert.ok(after.totalKm > before.totalKm);
  assert.ok(t.workshop.jobs[0].worked > 0);
});
test("dos carreras simultáneas cobran la nómina una sola vez por empleado el día 1", () => {
  const at = Date.parse("2026-11-01T02:59:00Z"),
    { w, t, a, b } = fixture(at);
  command(w, t.id, a);
  command(w, t.id, b);
  w.races[b.eventId].event.start = w.races[a.eventId].event.start;
  w.races[b.eventId].event.end = w.races[a.eventId].event.start + 4 * 3600000;
  advanceWorld(w, at + 120000);
  assert.equal(t.onlineRaces.length, 2);
  assert.equal(t.finance.bills.length, 1);
  const bill = t.finance.bills[0];
  assert.ok(
    Math.abs(bill.due.drivers - (3600 * 60000) / (31 * 86400000)) < 0.02,
  );
  assert.ok(
    Math.abs(bill.due.mechanics - (2000 * 60000) / (31 * 86400000)) < 0.02,
  );
  assert.equal(bill.due.base, 1500);
  advanceWorld(w, w.at + 60000);
  assert.equal(t.finance.bills.length, 1);
});
