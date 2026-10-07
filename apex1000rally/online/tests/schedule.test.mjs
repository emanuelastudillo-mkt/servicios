import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.js";
import { RaceRoom } from "../server/room.js";
import {
  createWorld,
  addDirector,
  events,
  command,
  advanceWorld,
} from "../server/world.js";
import {
  forecastNext,
  projectTime,
  transitionKey,
} from "../server/schedule.js";
import { participant } from "../server/resources.js";
import { performance } from "../../src/engine.js";
import { readWorld, commit } from "../server/store.js";
import { database } from "./d1.mjs";
const NOW = Date.parse("2026-10-06T12:00:00Z"),
  DAY = 86400000;
function fixture(offset = DAY) {
  const w = createWorld(NOW, new Date(NOW + offset).toISOString());
  const t = addDirector(
    w,
    "scheduler-test",
    "director_test",
    "Equipo eventos",
    1,
  );
  return { w, t };
}
function context() {
  const store = new Map();
  let alarm = null,
    alarmWrites = 0;
  return {
    waitUntil() {},
    storage: {
      get: async (k) => store.get(k),
      put: async (k, v) => store.set(k, v),
      getAlarm: async () => alarm,
      setAlarm: async (at) => {
        alarm = at;
        alarmWrites++;
      },
    },
    state: () => ({ alarm, alarmWrites }),
  };
}
async function atTime(at, fn) {
  const old = Date.now;
  Date.now = () => at;
  try {
    return await fn();
  } finally {
    Date.now = old;
  }
}
async function persisted(offset = DAY) {
  const { w, t } = fixture(offset),
    DB = database();
  await commit(DB, { revision: -1 }, w, "initial");
  const ctx = context(),
    env = {
      DB,
      SEASON_EPOCH: w.epoch,
      ASSETS: { fetch: async () => new Response("assets") },
    };
  return { w, t, DB, ctx, env, room: new RaceRoom(ctx, env) };
}
test("sin actividad programa la próxima largada o mantenimiento, sin tick por minuto", () => {
  const { w } = fixture();
  const before = JSON.stringify(w),
    forecast = forecastNext(w);
  assert.equal(JSON.stringify(w), before);
  assert.equal(forecast.at, Date.parse("2026-10-07T00:00:00Z"));
  assert.ok(forecast.at - w.at > 60 * 1000);
});
test("una D1 nueva no adelanta el reloj hasta el próximo evento al inicializar", async () => {
  const DB = database(),
    ctx = context(),
    room = new RaceRoom(ctx, {
      DB,
      SEASON_EPOCH: new Date(NOW + DAY).toISOString(),
    });
  const data = await atTime(NOW, () => room.current(NOW));
  assert.equal(data.world.at, NOW);
  assert.equal(
    DB.sql.prepare("SELECT updated_at FROM world").get().updated_at,
    NOW,
  );
});
test("salto inactivo conserva sueldos, energía, forma y decaimiento", () => {
  const { w } = fixture();
  const fine = structuredClone(w),
    fast = structuredClone(w);
  const end = NOW + 4 * 3600000;
  advanceWorld(fine, end, 4 * 3600);
  projectTime(fast, end);
  assert.equal(fast.at, fine.at);
  const a = fast.engine.teams[0],
    b = fine.engine.teams[0];
  assert.deepEqual(a.ledger, b.ledger);
  assert.ok(
    Math.abs(a.finance.accrued.drivers - b.finance.accrued.drivers) < 1e-8,
  );
  assert.ok(Math.abs(a.progression.xp - b.progression.xp) < 1e-8);
  a.drivers.forEach((d, i) => {
    assert.equal(d.energy, b.drivers[i].energy);
    assert.ok(Math.abs(d.form - b.drivers[i].form) < 1e-8);
  });
});
test("consultas repetidas en reposo no leen ni escriben el mundo en D1", async () => {
  const { room, DB, ctx } = await persisted();
  await atTime(NOW, () =>
    room.fetch(new Request("https://apex.test/api/public")),
  );
  const metrics = DB.metrics(),
    alarms = ctx.state().alarmWrites;
  for (let i = 1; i <= 20; i++) {
    const response = await atTime(NOW + i * 60000, () =>
      room.fetch(new Request("https://apex.test/api/public")),
    );
    assert.equal(response.status, 200);
    assert.equal((await response.json()).at, NOW + i * 60000);
  }
  assert.deepEqual(DB.metrics(), metrics);
  assert.equal(ctx.state().alarmWrites, alarms);
});
test("reiniciar el coordinador reconstruye el mismo avance desde D1", async () => {
  const { room, DB, ctx, env } = await persisted();
  const at = NOW + 2 * 3600000;
  const first = await atTime(at, () => room.current(at));
  const restarted = new RaceRoom(ctx, env);
  const second = await atTime(at, () => restarted.current(at));
  assert.equal(first.world.at, second.world.at);
  assert.deepEqual(
    first.world.engine.teams[0].drivers,
    second.world.engine.teams[0].drivers,
  );
  assert.ok(
    Math.abs(
      first.world.engine.teams[0].finance.accrued.drivers -
        second.world.engine.teams[0].finance.accrued.drivers,
    ) < 1e-8,
  );
  assert.equal(DB.sql.prepare("SELECT revision FROM world").get().revision, 0);
});
test("largadas y llegadas previstas conservan averías y no dependen de nuevas escuderías", () => {
  const { w, t } = fixture(60000),
    e = events(w).find((e) => e.id === "andes");
  command(w, t.id, {
    type: "enroll",
    eventId: e.eventId,
    driverId: t.activeDriver,
  });
  projectTime(w, NOW + 120000);
  const base = structuredClone(w),
    withNew = structuredClone(w);
  addDirector(withNew, "new-team", "new_director", "Nuevo equipo", 2);
  projectTime(base, NOW + 3600000);
  projectTime(withNew, NOW + 3600000);
  const a = base.races[e.eventId].entries[t.id],
    b = withNew.races[e.eventId].entries[t.id];
  assert.deepEqual(a.runtime, b.runtime);
  const before = JSON.stringify(base),
    future = forecastNext(base);
  assert.equal(JSON.stringify(base), before);
  assert.ok(future.at > base.at && future.at - base.at > 60000);
  const replay = structuredClone(base);
  projectTime(replay, future.at);
  assert.equal(transitionKey(replay), transitionKey(future.world));
  assert.deepEqual(
    replay.races[e.eventId].entries[t.id].runtime,
    future.world.races[e.eventId].entries[t.id].runtime,
  );
});
test("la etapa actual queda fija y las futuras se editan durante carrera y asistencia", () => {
  const { w, t } = fixture(6 * 3600000),
    e = events(w).find((e) => e.id === "andes");
  command(w, t.id, {
    type: "enroll",
    eventId: e.eventId,
    driverId: t.activeDriver,
  });
  projectTime(w, Date.parse(w.epoch));
  projectTime(w, Date.parse(w.epoch) + 120000);
  const r = w.races[e.eventId],
    p = participant(w, r, t.id),
    plan = r.entries[t.id].plans[1];
  assert.equal(p.phase, "racing");
  const active = structuredClone(p.activePlan);
  command(w, t.id, {
    type: "save-plan", eventId: e.eventId, stageIndex: 1,
    plan: { ...plan, rest: 2, pace: "conserve" },
  });
  assert.equal(r.entries[t.id].plans[1].rest, 2);
  assert.deepEqual(participant(w, r, t.id).activePlan, active);
  assert.throws(() => command(w, t.id, {
        type: "save-plan",
        eventId: e.eventId,
        stageIndex: 0,
        plan: r.entries[t.id].plans[0],
      }), /marcha/);
  const speed = performance(p).speed;
  const driver = p.drivers.find((d) => d.id === p.activeDriver);
  driver.morale = Math.min(100, driver.morale + 3);
  assert.equal(performance(p).speed, speed);
  r.entries[t.id].runtime.phase = "service";
  t.phase = "service";
  assert.throws(() => command(w, t.id, {
    type: "save-plan", eventId: e.eventId, stageIndex: 0, plan,
  }), /marcha/);
  command(w, t.id, {
    type: "save-plan",
    eventId: e.eventId,
    stageIndex: 1,
    plan,
  });
  assert.equal(r.entries[t.id].plans[1].rest, plan.rest);
});
test("alarmas repetidas no duplican avances ni registros contables", async () => {
  const { room, DB, ctx } = await persisted();
  await atTime(NOW, () => room.current(NOW));
  const at = ctx.state().alarm;
  await atTime(at, () => room.alarm());
  const row = DB.sql.prepare("SELECT revision,state_json FROM world").get();
  await atTime(at, () => room.alarm());
  assert.deepEqual(
    DB.sql.prepare("SELECT revision,state_json FROM world").get(),
    row,
  );
});

test("sin planes un raid continúa y sus campamentos se predicen sin escrituras por tick", () => {
  const {w,t}=fixture(6*3600000), e=events(w).find(e=>e.id==='andes');
  command(w,t.id,{type:'enroll',eventId:e.eventId,driverId:t.activeDriver});
  const r=w.races[e.eventId];
  r.entries[t.id].plans.fill(null);
  projectTime(w,e.start);
  projectTime(w,e.start+120000);
  const p=participant(w,r,t.id);
  assert.equal(p.phase,'racing');
  assert.ok(r.entries[t.id].plans[0]);
  const future=forecastNext(w), replay=structuredClone(w);
  projectTime(replay,future.at);
  assert.deepEqual(replay.races[e.eventId].entries[t.id].runtime,
    future.world.races[e.eventId].entries[t.id].runtime);
  assert.deepEqual(replay.races[e.eventId].entries[t.id].plans,
    future.world.races[e.eventId].entries[t.id].plans);
});
test("sueldos mensuales se liquidan una sola vez aunque no haya navegador abierto", async () => {
  const from = Date.parse("2026-10-31T22:00:00Z"),
    end = Date.parse("2026-11-01T03:00:00Z");
  const w = createWorld(from, "2026-11-02T03:00:00Z");
  addDirector(w, "payday-team", "payday_director", "Nómina", 1);
  const DB = database();
  await commit(DB, { revision: -1 }, w, "initial");
  const ctx = context(),
    room = new RaceRoom(ctx, { DB, SEASON_EPOCH: w.epoch });
  await atTime(from, () => room.current(from));
  await atTime(end, () => room.alarm());
  const count = DB.sql
    .prepare(
      "SELECT COUNT(*) n FROM ledger WHERE label LIKE 'Liquidación mensual%'",
    )
    .get().n;
  assert.equal(count, 3);
  await atTime(end, () => room.alarm());
  assert.equal(
    DB.sql
      .prepare(
        "SELECT COUNT(*) n FROM ledger WHERE label LIKE 'Liquidación mensual%'",
      )
      .get().n,
    count,
  );
});
test("las interrupciones largas se recuperan en tramos, sin aceptar acciones al pasado", async () => {
  const { w } = fixture();
  const result = projectTime(w, NOW + DAY);
  assert.equal(result.caughtUp, false);
  assert.equal(w.at, NOW + 6 * 3600000);
});
test("el Worker envía las consultas a la sala, conservando CORS y los assets", async () => {
  const calls = [];
  const env = {
    ROOM: {
      getByName(name) {
        assert.equal(name, "main");
        return {
          fetch: async (r) => {
            calls.push(r.url);
            return Response.json({ ok: true });
          },
        };
      },
    },
    ASSETS: { fetch: async () => new Response("assets") },
    ALLOWED_ORIGINS: "https://apex.test",
  };
  assert.equal(
    (
      await worker.fetch(
        new Request("https://apex.test/api/health", {
          headers: { Origin: "https://apex.test" },
        }),
        env,
        {},
      )
    ).status,
    200,
  );
  assert.equal(calls.length, 1);
  const forbidden = await worker.fetch(
    new Request("https://apex.test/api/health", {
      headers: { Origin: "https://evil.test" },
    }),
    env,
    {},
  );
  assert.equal(forbidden.status, 403);
  assert.equal(calls.length, 1);
  assert.equal(
    await (
      await worker.fetch(new Request("https://apex.test/"), env, {})
    ).text(),
    "assets",
  );
});
