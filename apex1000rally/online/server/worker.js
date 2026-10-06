import { passkeyOptions, verifyPasskey, toBase64 } from "./passkeys.js";
import { viewWorld } from "./view.js";
import { allowedOrigin, cors, browserSession } from "./origins.js";
import {
  addDirector,
  advanceWorld,
  command,
  privateWorld,
  createWorld,
  publicWorld,
  syncCatalog,
  RULES_VERSION,
} from "./world.js";
import { readWorld, commit } from "./store.js";
export { RaceRoom } from "./room.js";
const currentWorld = (env, now) =>
  env.ROOM_RUNTIME
    ? env.ROOM_RUNTIME.current(now)
    : readWorld(env.DB, now, env.SEASON_EPOCH);
const saveWorld = (env, previous, w, key, extras = []) =>
  env.ROOM_RUNTIME
    ? env.ROOM_RUNTIME.persist(previous, w, key, extras)
    : commit(env.DB, previous, w, key, extras);
import {
  cookie,
  digest,
  passwordHash,
  verifyPassword,
  randomToken,
  session,
  limitAuth,
  sessionToken,
} from "./auth.js";
import { directorName } from "../../src/identity.js";
const SESSION_SECONDS = 7 * 86400;
const json = (data, status = 200, headers = {}) =>
  Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...headers,
    },
  });
function bad(message, status = 400) {
  const e = Error(message);
  e.status = status;
  throw e;
}
async function body(request) {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    bad("Usá JSON.", 415);
  const text = await request.text();
  if (new TextEncoder().encode(text).length > 16384)
    bad("Solicitud demasiado grande.", 413);
  try {
    return JSON.parse(text);
  } catch {
    bad("JSON inválido.");
  }
}
function sameOrigin(request, env) {
  allowedOrigin(request, env);
}
async function mutate(env, now, key, work, extras = []) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const previous = await currentWorld(env, now),
      w = previous.world;
    if (!env.ROOM_RUNTIME) syncCatalog(w);
    const sync = advanceWorld(w, now, Number(env.MAX_TICK_SECONDS || 60));
    if (!sync.caughtUp) {
      if (await saveWorld(env, previous, w, crypto.randomUUID()))
        bad(
          "El servidor está recuperando tiempo pendiente. Reintentá en un minuto.",
          503,
        );
      continue;
    }
    const result = await work(w, previous.revision + 1);
    if (await saveWorld(env, previous, w, key, extras)) return result;
  }
  bad("Otra operación actualizó la sala. Reintentá con la misma clave.", 409);
}
async function register(request, env, now) {
  await limitAuth(request, env.DB, now);
  const b = await body(request),
    username = directorName(b.username);
  const email = typeof b.email === "string" ? b.email.trim().toLowerCase() : "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254)
    bad("Email inválido.");
  const password = await passwordHash(b.password, env.AUTH_PEPPER),
    id = crypto.randomUUID(),
    key = crypto.randomUUID(),
    token = randomToken(),
    tokenHash = await digest(token);
  await mutate(
    env,
    now,
    key,
    (w) => {
      if (w.engine.teams.length >= Number(env.MAX_PLAYERS || 20))
        bad("Sala completa.", 409);
      addDirector(
        w,
        id,
        username,
        b.teamName,
        b.shieldId,
        b.vehicleId || "niva",
      );
      return null;
    },
    [
      (guard, k) =>
        env.DB.prepare(
          `INSERT INTO users(id,username,username_key,email,password_hash,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`,
        ).bind(id, username, username.toLowerCase(), email, password, now, k),
      (guard, k) =>
        env.DB.prepare(
          `INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,?,? WHERE ${guard}`,
        ).bind(tokenHash, id, now + SESSION_SECONDS * 1000, k),
    ],
  );
  return json(
    { ok: true, ...browserSession(request, token), user: { id, username } },
    201,
    {
      "Set-Cookie": cookie(request, token, SESSION_SECONDS),
    },
  );
}
async function login(request, env, now) {
  await limitAuth(request, env.DB, now);
  const b = await body(request),
    key =
      typeof b.login === "string"
        ? b.login.trim().normalize("NFKC").toLowerCase()
        : "";
  const user = await env.DB.prepare(
    "SELECT * FROM users WHERE username_key=? OR email=? LIMIT 1",
  )
    .bind(key, key)
    .first();
  // A real password derivation also runs for nonexistent users.
  const fallback =
    "pbkdf2-sha256$100000$" + "0".repeat(64) + "$" + "0".repeat(64);
  const valid = await verifyPassword(
    b.password,
    user?.password_hash || fallback,
    env.AUTH_PEPPER,
  );
  if (!user || !valid) bad("Usuario o clave incorrectos.", 401);
  const token = randomToken();
  await env.DB.prepare(
    "INSERT INTO sessions(token_hash,user_id,expires_at) VALUES(?,?,?)",
  )
    .bind(await digest(token), user.id, now + SESSION_SECONDS * 1000)
    .run();
  return json(
    {
      ok: true,
      ...browserSession(request, token),
      user: { id: user.id, username: user.username },
    },
    200,
    { "Set-Cookie": cookie(request, token, SESSION_SECONDS) },
  );
}
async function passkeyAccess(request, env, now, kind, step) {
  const b = await body(request);
  if (step === "options")
    return json(await passkeyOptions(request, env, now, kind, b));
  const result = await verifyPasskey(env, now, kind, b),
    token = randomToken(),
    tokenHash = await digest(token);
  const p = result.registration,
    user = p ? { id: p.id, username: p.username } : result.user;
  if (p) {
    await mutate(
      env,
      now,
      crypto.randomUUID(),
      (w) => {
        if (w.engine.teams.length >= Number(env.MAX_PLAYERS || 20))
          bad("Sala completa.", 409);
        addDirector(w, p.id, p.username, p.teamName, p.shieldId, p.vehicleId);
      },
      [
        (guard, k) =>
          env.DB.prepare(
            `INSERT INTO users(id,username,username_key,email,password_hash,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`,
          ).bind(
            p.id,
            p.username,
            p.username.normalize("NFKC").toLowerCase(),
            p.email,
            "passkey-only",
            now,
            k,
          ),
        (guard, k) =>
          env.DB.prepare(
            `INSERT INTO passkeys(credential_id,user_id,public_key,counter,transports_json,created_at) SELECT ?,?,?,?,?,? WHERE ${guard}`,
          ).bind(
            result.credential.id,
            p.id,
            toBase64(result.credential.publicKey),
            result.credential.counter,
            JSON.stringify(result.credential.transports || []),
            now,
            k,
          ),
        (guard, k) =>
          env.DB.prepare(
            `INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,?,? WHERE ${guard}`,
          ).bind(tokenHash, p.id, now + SESSION_SECONDS * 1000, k),
      ],
    );
  } else {
    const out = await env.DB.batch([
      env.DB.prepare(
        "UPDATE passkeys SET counter=? WHERE credential_id=? AND counter=?",
      ).bind(result.newCounter, result.credentialId, result.oldCounter),
      env.DB.prepare(
        "INSERT INTO sessions(token_hash,user_id,expires_at) SELECT ?,?,? WHERE changes()=1",
      ).bind(tokenHash, user.id, now + SESSION_SECONDS * 1000),
    ]);
    if (!out[0].meta.changes)
      bad("Hubo otro acceso simultáneo. Intentá nuevamente.", 409);
  }
  return json(
    { ok: true, user, ...browserSession(request, token) },
    p ? 201 : 200,
    { "Set-Cookie": cookie(request, token, SESSION_SECONDS) },
  );
}
async function publicSnapshot(request, env, ctx) {
  if (env.ROOM_RUNTIME) {
    const data = await currentWorld(env, Date.now());
    return json({ ...publicWorld(data.world), revision: data.revision }, 200, {
      "Cache-Control": "public, max-age=30",
    });
  }
  const cacheKey = new Request(new URL("/api/public", request.url).href),
    cache = globalThis.caches?.default;
  if (cache) {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
  }
  const row = await env.DB.prepare(
    "SELECT revision,payload_json FROM snapshots WHERE id=1",
  ).first();
  const payload = row
    ? JSON.parse(row.payload_json)
    : publicWorld(createWorld(Date.now(), env.SEASON_EPOCH));
  const response = json({ ...payload, revision: row?.revision || 0 }, 200, {
    "Cache-Control": "public, max-age=30",
  });
  if (cache) ctx.waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}
async function api(request, env, ctx, now) {
  const url = new URL(request.url),
    path = url.pathname;
  if (request.method === "GET" && path === "/api/health")
    return json({
      ok: true,
      version: RULES_VERSION,
      ...(env.ROOM_RUNTIME
        ? { scheduler: "events", nextEventAt: env.ROOM_RUNTIME.forecast?.at }
        : {}),
    });
  if (request.method === "GET" && path === "/api/public")
    return publicSnapshot(request, env, ctx);
  if (request.method === "GET" && path === "/api/rankings") {
    const circuit = url.searchParams.get("circuit"),
      vehicle = url.searchParams.get("vehicle"),
      edition = url.searchParams.get("race"),
      bots = url.searchParams.get("bots") === "1";
    if (!circuit && !edition) bad("Elegí un circuito o una edición.");
    const where = ["rules_version=?"],
      args = [url.searchParams.get("rules") || RULES_VERSION];
    if (circuit) {
      where.push("circuit_id=?");
      args.push(circuit);
    }
    if (vehicle) {
      where.push("vehicle_id=?");
      args.push(vehicle);
    }
    if (edition) {
      where.push("race_id=?");
      args.push(edition);
    } else where.push("finished=1");
    if (!bots) where.push("is_bot=0");
    const rows = await env.DB.prepare(
      `SELECT race_id,circuit_id,team_id,director,team_name,is_bot,vehicle_id,rules_version,catalog_revision,position,finished,finish_seconds,distance_km,driving_seconds,prize_cents,closed_at FROM results WHERE ${where.join(" AND ")} ORDER BY ${edition ? "position ASC" : "finish_seconds ASC,closed_at ASC"} LIMIT 100`,
    )
      .bind(...args)
      .all();
    return json({ results: rows.results }, 200, {
      "Cache-Control": "public, max-age=60",
    });
  }
  if (request.method === "GET" && path === "/api/profile") {
    const id = url.searchParams.get("id");
    if (!id || id.length > 80) bad("Elegí un director o BOT.");
    const rows = await env.DB.prepare(
      "SELECT circuit_id,vehicle_id,COUNT(*) starts,SUM(finished) finishes,SUM(position=1) wins,SUM(position<=3) podiums,MIN(CASE WHEN finished=1 THEN finish_seconds END) best_seconds,SUM(distance_km) km FROM results WHERE team_id=? GROUP BY circuit_id,vehicle_id ORDER BY circuit_id,vehicle_id",
    )
      .bind(id)
      .all();
    return json({ teamId: id, byCircuitAndVehicle: rows.results }, 200, {
      "Cache-Control": "public, max-age=60",
    });
  }
  const user = await session(request, env.DB, now);
  if (!user) bad("Iniciá sesión.", 401);
  if (request.method === "GET" && path === "/api/bootstrap") {
    const data = await currentWorld(env, now);
    return json({
      user,
      revision: data.revision,
      ...privateWorld(data.world, user.id),
      view: viewWorld(data.world, user.id, url.searchParams.get("race")),
    });
  }
  if (request.method === "GET" && path === "/api/ledger") {
    const limit = Math.max(
        1,
        Math.min(100, Number(url.searchParams.get("limit")) || 50),
      ),
      before =
        Number(url.searchParams.get("before")) || Number.MAX_SAFE_INTEGER;
    const rows = await env.DB.prepare(
      "SELECT sequence,at,amount_cents,label FROM ledger WHERE team_id=? AND sequence<? ORDER BY sequence DESC LIMIT ?",
    )
      .bind(user.id, before, limit)
      .all();
    const data = env.ROOM_RUNTIME ? await currentWorld(env, now) : null;
    const team = data?.world.engine.teams.find((t) => t.id === user.id);
    const pending = (team?.ledger || [])
      .map((l, i) => ({
        sequence: (team.ledgerOffset || 0) + i,
        at: l.at,
        amount_cents: Math.round(l.amount * 100),
        label: l.label,
      }))
      .filter(
        (l) => l.sequence >= (team.ledgerSaved || 0) && l.sequence < before,
      );
    return json({
      movements: [...pending, ...rows.results]
        .sort((a, b) => b.sequence - a.sequence)
        .slice(0, limit),
    });
  }
  if (request.method === "POST" && path === "/api/command") {
    sameOrigin(request, env);
    if (
      env.COMMAND_LIMIT &&
      !(await env.COMMAND_LIMIT.limit({ key: user.id })).success
    )
      bad("Demasiadas acciones. Esperá un minuto.", 429);
    const key = request.headers.get("Idempotency-Key");
    if (!key || !/^[a-zA-Z0-9_-]{16,80}$/.test(key))
      bad("Falta Idempotency-Key de 16 a 80 caracteres.");
    const b = await body(request),
      requestHash = await digest(JSON.stringify(b));
    const receipt = await env.DB.prepare(
      "SELECT request_hash,response_json FROM receipts WHERE user_id=? AND command_key=?",
    )
      .bind(user.id, key)
      .first();
    if (receipt) {
      if (receipt.request_hash !== requestHash)
        bad("Esa clave ya se usó con otro comando.", 409);
      return json(JSON.parse(receipt.response_json));
    }
    const response = { ok: true, commandKey: key };
    try {
      await mutate(
        env,
        now,
        crypto.randomUUID(),
        (w, revision) => {
          command(w, user.id, b);
          response.revision = revision;
        },
        [
          (guard, k) =>
            env.DB.prepare(
              `INSERT INTO receipts(user_id,command_key,request_hash,response_json,created_at) SELECT ?,?,?,?,? WHERE ${guard}`,
            ).bind(user.id, key, requestHash, JSON.stringify(response), now, k),
        ],
      );
    } catch (e) {
      if (!/UNIQUE constraint failed/.test(e.message)) throw e;
      const previous = await env.DB.prepare(
        "SELECT request_hash,response_json FROM receipts WHERE user_id=? AND command_key=?",
      )
        .bind(user.id, key)
        .first();
      if (!previous || previous.request_hash !== requestHash)
        bad("Conflicto de comando.", 409);
      return json(JSON.parse(previous.response_json));
    }
    return json(response);
  }
  if (request.method === "POST" && path === "/api/logout") {
    sameOrigin(request, env);
    const token = sessionToken(request);
    if (token)
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash=?")
        .bind(await digest(token))
        .run();
    return json({ ok: true }, 200, { "Set-Cookie": cookie(request) });
  }
  bad("Ruta inexistente.", 404);
}
const handler = {
  async fetch(request, env, ctx) {
    if (!new URL(request.url).pathname.startsWith("/api/"))
      return env.ASSETS.fetch(request);
    try {
      allowedOrigin(request, env);
      if (request.method === "OPTIONS")
        return cors(new Response(null, { status: 204 }), request, env);
      const response = env.ROOM
        ? await env.ROOM.getByName("main").fetch(request)
        : await this.handle(request, env, ctx);
      return cors(response, request, env);
    } catch (e) {
      return json({ error: e.message }, e.status || 500);
    }
  },
  async handle(request, env, ctx) {
    const path = new URL(request.url).pathname,
      now = Date.now();
    if (!path.startsWith("/api/")) return env.ASSETS.fetch(request);
    try {
      if (request.method === "POST") sameOrigin(request, env);
      const passkey = path.match(
        /^\/api\/passkey\/(register|login)\/(options|verify)$/,
      );
      if (request.method === "POST" && passkey)
        return await passkeyAccess(request, env, now, passkey[1], passkey[2]);
      if (
        (path === "/api/register" || path === "/api/login") &&
        env.AUTH_MODE !== "password-test"
      )
        bad("El acceso online utiliza passkeys.", 410);
      if (request.method === "POST" && path === "/api/register")
        return await register(request, env, now);
      if (request.method === "POST" && path === "/api/login")
        return await login(request, env, now);
      return await api(request, env, ctx, now);
    } catch (e) {
      if (/UNIQUE constraint failed/.test(e.message))
        return json(
          {
            error:
              "El usuario o email ya está registrado, o el comando ya se procesó. Reintentá el mismo comando.",
          },
          409,
        );
      if (/AUTH_PEPPER/.test(e.message))
        return json(
          { error: "El servidor requiere configurar AUTH_PEPPER." },
          503,
        );
      if (e.status || !/^D1_|SQLITE|database/i.test(e.message))
        return json({ error: e.message }, e.status || 400);
      console.error("api_failure", e.message);
      return json({ error: "No se pudo completar la operación." }, 500);
    }
  },
  async scheduled(controller, env, ctx) {
    if (env.ROOM) {
      // Daily recovery only: the room's durable alarm runs the actual event schedule.
      const response = await env.ROOM.getByName("main").fetch(
        new Request("https://apex.internal/api/health"),
      );
      if (!response.ok)
        throw Error("No se pudo recuperar el coordinador de eventos.");
      return;
    }
    const now = Date.now();
    for (let attempt = 0; attempt < 4; attempt++) {
      const previous = await readWorld(env.DB, now, env.SEASON_EPOCH),
        w = previous.world;
      const before = w.at;
      const catalogChanged = syncCatalog(w);
      advanceWorld(w, now, Number(env.MAX_TICK_SECONDS || 60));
      if (previous.revision >= 0 && w.at === before && !catalogChanged) break;
      if (await commit(env.DB, previous, w, crypto.randomUUID())) break;
      if (attempt === 3)
        throw Error("No se pudo guardar el tick tras cuatro conflictos.");
    }
    if (Math.floor(now / 60000) % 1440 === 0)
      await env.DB.batch([
        env.DB.prepare("DELETE FROM sessions WHERE expires_at<=?").bind(now),
        env.DB.prepare("DELETE FROM auth_limits WHERE expires_at<=?").bind(now),
        env.DB.prepare(
          "DELETE FROM passkey_challenges WHERE expires_at<=?",
        ).bind(now),
      ]);
  },
};
export const handleRoomRequest = (request, env, ctx) =>
  handler.handle(request, env, ctx);
export default handler;
