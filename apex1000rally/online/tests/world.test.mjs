import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  addDirector,
  BOT_PROFILES,
  events,
  command,
  advanceWorld,
  makeBots,
  publicWorld,
  privateWorld,
} from "../server/world.js";
import { activeCar } from "../../src/workshop.js";
const start = Date.parse("2026-10-06T12:00:00Z");
const fresh = () => createWorld(start, new Date(start + 60000).toISOString());
const player = (w, id = "u1") =>
  addDirector(w, id, `director_${id}`, `Equipo ${id}`, 1);
test("cinco BOT fijos con niveles distintos; sorteo por carrera común y reproducible", () => {
  const w = fresh();
  advanceWorld(w, start + 120000);
  const r = Object.values(w.races)[0];
  assert.equal(r.bots.length, 5);
  assert.deepEqual(
    r.bots.map((t) => t.id),
    BOT_PROFILES.map((b) => b.id),
  );
  assert.deepEqual(
    BOT_PROFILES.map((b) => b.level),
    [1, 1, 2, 3, 5],
  );
  const a = makeBots(w, r),
    b = makeBots(w, r);
  assert.deepEqual(a, b);
  assert.ok(
    a.every(
      (t) => activeCar(t).condition >= 65 && activeCar(t).condition <= 100,
    ),
  );
  assert.equal(new Set(a.map((t) => t.parts.engine.condition)).size, 5);
  const changed = makeBots(w, {
    ...r,
    event: { ...r.event, eventId: r.event.eventId + "-next" },
  });
  assert.notEqual(
    changed[0].parts.engine.condition,
    a[0].parts.engine.condition,
  );
});
test("el tiempo es del servidor, recuperar en lotes y repetir un tick no duplica avance", () => {
  const w = fresh();
  player(w);
  advanceWorld(w, start + 120000);
  const before = JSON.stringify(w);
  advanceWorld(w, start + 120000);
  assert.equal(JSON.stringify(w), before);
  const x = structuredClone(w),
    y = structuredClone(w);
  advanceWorld(x, start + 600000);
  for (let at = start + 150000; at <= start + 600000; at += 30000)
    advanceWorld(y, at);
  assert.deepEqual(x, y);
  const sync = advanceWorld(w, start + 3600000, 600);
  assert.equal(sync.caughtUp, false);
  assert.equal(sync.at, start + 720000);
});
test("registro crea academia única y compras comparten stock y propiedad", () => {
  const w = fresh(),
    a = player(w),
    b = player(w, "u2");
  assert.notEqual(a.drivers[0].personId, b.drivers[0].personId);
  assert.notEqual(a.parts.engine.id, b.parts.engine.id);
  const ref = w.engine.management.catalog.parts.find(
    (p) => p.type === "engine" && p.grade === "endurance" && p.condition === 50,
  );
  w.engine.management.stocks[ref.id] = 1;
  const p = command(w, a.id, {
    type: "buy-part",
    partType: "engine",
    grade: "endurance",
    condition: 50,
  });
  assert.equal(w.engine.management.stocks[ref.id], 0);
  assert.throws(
    () =>
      command(w, b.id, {
        type: "buy-part",
        partType: "engine",
        grade: "endurance",
        condition: 50,
      }),
    /stock/,
  );
  assert.throws(
    () => command(w, b.id, { type: "sell-part", id: p.id }),
    /desconocida/,
  );
  command(w, a.id, { type: "sell-part", id: p.id });
  assert.equal(w.engine.management.stocks[ref.id], 0);
});
test("inscripción independiente, intervalos máximos bloqueados y planes validados", () => {
  const w = fresh(),
    t = player(w),
    e = events(w).find((e) => e.id === "andes");
  command(w, t.id, {
    type: "enroll",
    eventId: e.eventId,
    driverId: t.activeDriver,
  });
  const short = events(w).find((e) => e.kind === "short");
  assert.throws(
    () =>
      command(w, t.id, {
        type: "enroll",
        eventId: short.eventId,
        driverId: t.activeDriver,
      }),
    /superpone/,
  );
  const plan = w.races[e.eventId].entries[t.id].plans[0];
  command(w, t.id, {
    type: "save-plan",
    eventId: e.eventId,
    stageIndex: 0,
    plan: { ...plan, pace: "conserve" },
  });
  assert.equal(w.races[e.eventId].entries[t.id].plans[0].pace, "conserve");
  advanceWorld(w, start + 120000);
  assert.equal(t.onlineRace, e.eventId);
  assert.equal(w.races[e.eventId].bots.length, 5);
  assert.throws(
    () => command(w, t.id, { type: "cancel-enrollment", eventId: e.eventId }),
    /cancelar/,
  );
});
test("cierre máximo paga una vez y repara todos los BOT; rankings congelan modelo", () => {
  const w = fresh(),
    t = player(w),
    e = events(w).find((e) => e.id === "andes");
  command(w, t.id, {
    type: "enroll",
    eventId: e.eventId,
    driverId: t.activeDriver,
  });
  advanceWorld(w, start + 120000);
  const r = w.races[e.eventId],
    budget = t.budget;
  r.event.end = w.at;
  advanceWorld(w, w.at + 30000);
  assert.equal(r.status, "closed");
  assert.equal(r.reason, "maximum");
  assert.equal(r.results.length, 6);
  assert.equal(r.results.find((x) => x.teamId === t.id).vehicleId, "niva");
  assert.ok(
    r.bots.every(
      (b) =>
        activeCar(b).condition === 100 &&
        Object.values(b.parts).every((p) => p.condition === 100 && !p.broken),
    ),
  );
  assert.ok(t.budget > budget);
  const paid = t.budget;
  advanceWorld(w, w.at + 30000);
  assert.equal(t.budget, paid);
  assert.equal(w.stats[t.id].starts, 1);
});
test("primer finalista activa corte 24 h aunque el resto siga en ruta", () => {
  const w = fresh();
  advanceWorld(w, start + 120000);
  const r = Object.values(w.races)[0];
  r.bots[0].finishTime = 30.25;
  r.bots[0].phase = "finished";
  r.firstFinish = 30.25;
  w.at = r.event.start + 86460000;
  w.engine.clock = (w.at - Date.parse(w.epoch)) / 1000;
  advanceWorld(w, w.at + 30000);
  assert.equal(r.status, "closed");
  assert.equal(r.reason, "first-finisher");
  assert.equal(r.closedAt, r.event.start + 86430250);
  assert.equal(r.results[0].teamId, "bot-1");
});
test("contrataciones globales eligen mejor oferta sin duplicar empleado", () => {
  const w = fresh(),
    a = player(w),
    b = player(w, "u2"),
    person = w.engine.management.catalog.mechanics[3];
  command(w, a.id, {
    type: "bid",
    kind: "mechanic",
    personId: person.id,
    salary: person.salary,
  });
  command(w, b.id, {
    type: "bid",
    kind: "mechanic",
    personId: person.id,
    salary: person.salary + 500,
  });
  assert.equal(w.engine.management.auctions.length, 1);
  const auction = w.engine.management.auctions[0];
  assert.equal(auction.bids.length, 2);
  assert.ok(auction.bids.every((b) => b.escrow > 0));
  // Shorten only the test auction, preserving the same settlement logic.
  auction.closesAt = w.engine.clock + 30;
  advanceWorld(w, w.at + 60000);
  assert.equal(w.engine.management.owners[person.id], b.id);
  assert.equal(a.mechanics.filter((m) => m.id === person.id).length, 0);
  assert.equal(b.mechanics.filter((m) => m.id === person.id).length, 1);
  assert.throws(
    () =>
      command(w, a.id, {
        type: "bid",
        kind: "mechanic",
        personId: person.id,
        salary: person.salary + 1000,
      }),
    /disponible/,
  );
});
test("API de dominio rechaza admin e importaciones; snapshots públicos no filtran finanzas ni azar", () => {
  const w = fresh(),
    t = player(w);
  for (const type of [
    "advance",
    "next-camp",
    "next-event",
    "next-payroll",
    "inject-money",
    "reset",
    "import",
  ])
    assert.throws(() => command(w, t.id, { type }), /no permitido/);
  const publicJSON = JSON.stringify(publicWorld(w));
  for (const key of [
    "budget",
    "inventory",
    "salary",
    "rng",
    "password",
    "email",
  ])
    assert.equal(publicJSON.includes(`"${key}"`), false, key);
  assert.equal(Object.hasOwn(privateWorld(w, t.id).team, "rng"), false);
  assert.equal(privateWorld(w, t.id).team.budget, t.budget);
});

test("20 jugadores y cinco BOT: seis horas de simulación, estado compacto y avance continuo", async () => {
  const { performance } = await import("node:perf_hooks");
  const { commit } = await import("../server/store.js");
  const { database } = await import("./d1.mjs");
  const w = fresh(),
    e = events(w).find((e) => e.id === "andes");
  // This load test covers several car classes independently of the live starting funds.
  w.engine.management.catalog.settings.find(s => s.key === "startingBudget").value = 8500000;
  for (let i = 0; i < 20; i++) {
    const t = addDirector(
      w,
      `load-${i}`,
      `director_${i}`,
      `Equipo ${i}`,
      i + 1,
      i < 12 ? "niva" : i < 18 ? "hilux" : "mini",
    );
    command(w, t.id, {
      type: "enroll",
      eventId: e.eventId,
      driverId: t.activeDriver,
    });
  }
  const begin = performance.now();
  while (w.at < start + 6 * 3600000) advanceWorld(w, start + 6 * 3600000);
  const r = w.races[e.eventId];
  assert.equal(Object.keys(r.entries).length, 20);
  assert.equal(r.bots.length, 5);
  assert.ok(
    w.engine.teams.every((t) => t.totalKm > 0 && Number.isFinite(t.budget)),
  );
  const db = database();
  assert.equal(await commit(db, { revision: -1 }, w, "load-commit"), true);
  const bytes = Buffer.byteLength(
    db.sql.prepare("SELECT state_json FROM world").get().state_json,
  );
  assert.ok(bytes < 1800000, `Estado demasiado grande: ${bytes}`);
  assert.ok(db.metrics().writes <= 40, 'La sala completa debe caber en un lote Free');
  console.log(
    JSON.stringify({
      loadPlayers: 20,
      bots: 5,
      simulatedHours: 6,
      stateBytes: bytes,
      elapsedMs: Math.round(performance.now() - begin),
      sql: db.metrics(),
    }),
  );
});
test("auto inicial debe caber en el presupuesto y piloto de plan vencido se reemplaza al largar", () => {
  const w = fresh();
  w.engine.management.catalog.settings.find(
    (s) => s.key === "startingBudget",
  ).value = 10000;
  assert.throws(() => player(w), /Presupuesto/);
  w.engine.management.catalog.settings.find(
    (s) => s.key === "startingBudget",
  ).value = 8500000;
  const t = player(w),
    e = events(w).find((e) => e.id === "andes");
  command(w, t.id, {
    type: "enroll",
    eventId: e.eventId,
    driverId: t.activeDriver,
  });
  w.races[e.eventId].entries[t.id].plans[1].driverId = "expired";
  advanceWorld(w, start + 120000);
  assert.equal(t.plans[1].driverId, t.activeDriver);
});

test("día 1 ART cobra sueldos y gastos aun sin inscripción, una sola vez", () => {
  const at = Date.parse("2026-11-01T02:59:30Z");
  const w = createWorld(at, "2026-11-02T03:00:00Z"),
    t = player(w),
    before = t.budget;
  advanceWorld(w, at + 60000);
  assert.equal(t.finance.bills.length, 1);
  assert.equal(t.finance.bills[0].at, Date.parse("2026-11-01T03:00:00Z"));
  assert.ok(t.budget < before);
  assert.equal(t.totalKm, 0);
  advanceWorld(w, at + 120000);
  assert.equal(t.finance.bills.length, 1);
});
