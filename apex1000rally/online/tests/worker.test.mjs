import test from "node:test";
import assert from "node:assert/strict";
import worker from "../server/worker.js";
import { database } from "./d1.mjs";
import { readWorld, commit } from "../server/store.js";
import { addDirector, advanceWorld, command, events } from "../server/world.js";
import { passwordHash, verifyPassword } from "../server/auth.js";
const NOW = Date.parse("2026-10-06T12:00:00Z"),
  epoch = "2026-10-06T12:01:00Z";
const env = () => ({
  DB: database(),
  AUTH_PEPPER: "local-test-pepper-only-12345678901234567890",
  SEASON_EPOCH: epoch,
  MAX_PLAYERS: "20",
  ASSETS: { fetch: async () => new Response("assets") },
});
const ctx = { waitUntil() {} };
async function request(e, path, options = {}) {
  const old = Date.now;
  Date.now = () => NOW;
  try {
    return await worker.fetch(
      new Request("https://apex.test" + path, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          Origin: "https://apex.test",
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      }),
      e,
      ctx,
    );
  } finally {
    Date.now = old;
  }
}
async function register(e, username = "qa_director") {
  const r = await request(e, "/api/register", {
    method: "POST",
    body: {
      username,
      email: username + "@example.test",
      password: "MiClaveSoloDePrueba123",
      teamName: "Equipo QA",
      shieldId: 1,
    },
  });
  assert.equal(r.status, 201, await r.clone().text());
  return {
    user: (await r.json()).user,
    cookie: r.headers.get("Set-Cookie").split(";")[0],
  };
}
test("migración SQLite, registro, cookies, login y logout sin guardar clave en claro", async () => {
  const e = env(),
    a = await register(e);
  const user = e.DB.sql.prepare("SELECT * FROM users").get();
  assert.notEqual(user.password_hash, "MiClaveSoloDePrueba123");
  assert.equal((await request(e, "/api/bootstrap")).status, 401);
  const boot = await request(e, "/api/bootstrap", {
    headers: { Cookie: a.cookie },
  });
  assert.equal(boot.status, 200);
  assert.equal((await boot.json()).team.directorName, "qa_director");
  const wrong = await request(e, "/api/login", {
    method: "POST",
    body: { login: "qa_director", password: "ClaveIncorrecta12345" },
  });
  assert.equal(wrong.status, 401);
  const good = await request(e, "/api/login", {
    method: "POST",
    body: { login: "qa_director", password: "MiClaveSoloDePrueba123" },
  });
  assert.equal(good.status, 200);
  assert.match(
    good.headers.get("Set-Cookie"),
    /HttpOnly; SameSite=Strict.*Secure/,
  );
  assert.equal(
    (
      await request(e, "/api/logout", {
        method: "POST",
        headers: { Cookie: a.cookie },
      })
    ).status,
    200,
  );
  assert.equal(
    (await request(e, "/api/bootstrap", { headers: { Cookie: a.cookie } }))
      .status,
    401,
  );
});
test("CAS impide perder cambios; proyecciones y movimientos se guardan en la misma transacción", async () => {
  const e = env(),
    a = await register(e),
    one = await readWorld(e.DB, NOW, epoch),
    two = await readWorld(e.DB, NOW, epoch);
  command(one.world, a.user.id, {
    type: "buy-part",
    partType: "engine",
    grade: "standard",
    condition: 50,
  });
  command(two.world, a.user.id, {
    type: "buy-part",
    partType: "tyres",
    grade: "standard",
    condition: 50,
  });
  assert.equal(await commit(e.DB, one, one.world, "commit-one"), true);
  assert.equal(await commit(e.DB, two, two.world, "commit-two"), false);
  const stored = await readWorld(e.DB, NOW, epoch);
  assert.equal(stored.world.engine.teams[0].inventory.length, 7);
  assert.equal(stored.world.engine.teams[0].inventory.at(-1).type, "engine");
  assert.equal(
    e.DB.sql.prepare("SELECT revision FROM snapshots").get().revision,
    stored.revision,
  );
  assert.equal(e.DB.sql.prepare("SELECT COUNT(*) n FROM ledger").get().n, 2);
});
test("reintentar y enviar comandos concurrentes con la misma clave sólo compra una pieza", async () => {
  const e = env(),
    a = await register(e),
    headers = {
      Cookie: a.cookie,
      "Idempotency-Key": "same-command-key-123456",
    },
    body = {
      type: "buy-part",
      partType: "engine",
      grade: "standard",
      condition: 50,
    };
  const responses = await Promise.all([
    request(e, "/api/command", { method: "POST", headers, body }),
    request(e, "/api/command", { method: "POST", headers, body }),
  ]);
  assert.deepEqual(
    responses.map((r) => r.status),
    [200, 200],
  );
  const saved = await readWorld(e.DB, NOW, epoch);
  assert.equal(saved.world.engine.teams[0].inventory.length, 7);
  const retry = await request(e, "/api/command", {
    method: "POST",
    headers,
    body,
  });
  assert.equal(retry.status, 200);
  const different = await request(e, "/api/command", {
    method: "POST",
    headers,
    body: { ...body, partType: "tyres" },
  });
  assert.equal(different.status, 409);
  assert.equal(e.DB.sql.prepare("SELECT COUNT(*) n FROM receipts").get().n, 1);
});
test("propiedad, límite de sala, origen y comandos admin se validan en servidor", async () => {
  const e = env(),
    a = await register(e),
    b = await register(e, "qa_other");
  const base = await readWorld(e.DB, NOW, epoch),
    foreign = base.world.engine.teams.find((t) => t.id === a.user.id).parts
      .engine.id;
  const headers = {
    Cookie: b.cookie,
    "Idempotency-Key": "ownership-test-key-123",
  };
  assert.equal(
    (
      await request(e, "/api/command", {
        method: "POST",
        headers,
        body: { type: "sell-part", id: foreign },
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await request(e, "/api/command", {
        method: "POST",
        headers: { ...headers, Origin: "https://evil.test" },
        body: { type: "advance", seconds: 3600 },
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(e, "/api/command", {
        method: "POST",
        headers,
        body: { type: "advance", seconds: 3600 },
      })
    ).status,
    400,
  );
  e.MAX_PLAYERS = "2";
  assert.equal(
    (
      await request(e, "/api/register", {
        method: "POST",
        body: {
          username: "third_qa",
          email: "third@example.test",
          password: "ClaveNueva123456",
          teamName: "Tercero",
          shieldId: 1,
        },
      })
    ).status,
    409,
  );
  assert.equal(e.DB.sql.prepare("SELECT COUNT(*) n FROM users").get().n, 2);
});
test("duplicación de usuario revierte estado, stock y sesión", async () => {
  const e = env();
  await register(e);
  const before = await readWorld(e.DB, NOW, epoch);
  const r = await request(e, "/api/register", {
    method: "POST",
    body: {
      username: "QA_DIRECTOR",
      email: "another@example.test",
      password: "NuevaClave123456",
      teamName: "Otro",
      shieldId: 2,
    },
  });
  assert.equal(r.status, 409);
  assert.deepEqual(await readWorld(e.DB, NOW, epoch), before);
});
test("resultados y ranking por circuito/modelo quedan en SQL y conservan historia", async () => {
  const e = env(),
    a = await register(e),
    base = await readWorld(e.DB, NOW, epoch),
    w = base.world,
    t = w.engine.teams[0];
  const event = events(w).find((x) => x.id === "andes");
  command(w, t.id, {
    type: "enroll",
    eventId: event.eventId,
    driverId: t.activeDriver,
  });
  advanceWorld(w, NOW + 120000);
  w.races[event.eventId].event.end = w.at;
  advanceWorld(w, w.at + 30000);
  await commit(e.DB, base, w, "race-results-commit");
  assert.equal(e.DB.sql.prepare("SELECT COUNT(*) n FROM results").get().n, 6);
  const r = await request(
    e,
    "/api/rankings?race=" + encodeURIComponent(event.eventId) + "&vehicle=niva",
  );
  const rows = (await r.json()).results;
  assert.equal(rows.length, 1);
  assert.equal(rows[0].team_id, a.user.id);
  const bots = await request(
    e,
    "/api/rankings?race=" + encodeURIComponent(event.eventId) + "&bots=1",
  );
  assert.equal((await bots.json()).results.length, 6);
  const profile = await request(e, "/api/profile?id=" + a.user.id);
  assert.equal((await profile.json()).byCircuitAndVehicle[0].starts, 1);
});
test("hashes salados verifican la clave y limitación de intentos devuelve 429", async () => {
  const pepper = "local-test-pepper-12345678901234567890",
    password = "OtraClaveLarga123";
  const a = await passwordHash(password, pepper),
    b = await passwordHash(password, pepper);
  assert.notEqual(a, b);
  assert.equal(await verifyPassword(password, a, pepper), true);
  assert.equal(await verifyPassword("ClaveIncorrecta123", a, pepper), false);
  const e = env();
  let status;
  for (let i = 0; i < 13; i++)
    status = (
      await request(e, "/api/login", {
        method: "POST",
        body: { login: "unknown", password },
      })
    ).status;
  assert.equal(status, 429);
});

test("sala nueva publica cinco BOT y modelos sin crear partidas ni escribir D1", async () => {
  const e = env(),
    r = await request(e, "/api/public");
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.bots.length, 5);
  assert.equal(d.vehicles.length, 7);
  assert.equal(e.DB.sql.prepare("SELECT COUNT(*) n FROM world").get().n, 0);
  assert.equal(e.DB.metrics().writes, 0);
});
