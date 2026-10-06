import { CATALOG } from "../../data/catalog.js";
import {
  createRace,
  getPlayer,
  advanceTeam,
  publicSnapshot,
  standings,
  savePlan,
  buyPart,
} from "../../src/engine.js";
import { calendar, eventById } from "../../src/competition.js";
import {
  activeCar,
  jobFor,
  crewRate,
  purchaseVehicle,
  selectVehicle,
  sellVehicle,
  sellPart,
  enqueueJob,
  cancelJob,
  assignMechanic,
  advanceWorkshops,
} from "../../src/workshop.js";
import {
  advanceEmployment,
  startContract,
  recordCash,
  renewContract,
} from "../../src/employment.js";
import {
  settleAuctions,
  cancelBid,
  releasePerson as releaseEmployee,
} from "../../src/management.js";
import {
  advanceProgression,
  awardProgression,
  teamLevel,
  markParticipation,
} from "../../src/progression.js";
import { chooseShield } from "../../src/identity.js";
import { modelStats } from "../../src/vehicle-stats.js";
import {
  defaultPlan,
  vehicle,
  PART_TYPES,
  ENGINE_VERSION,
} from "../../src/catalog.js";
import { routeFor, recommendedSetup } from "../../src/route.js";

export const RULES_VERSION = "online-1";
export const BOT_PROFILES = [
  {
    id: "bot-1",
    name: "Polvo Sur",
    level: 1,
    model: "niva",
    performance: 50,
    skill: 0.76,
    shield: 9,
  },
  {
    id: "bot-2",
    name: "Ruta Vieja",
    level: 1,
    model: "niva",
    performance: 52,
    skill: 0.82,
    shield: 17,
  },
  {
    id: "bot-3",
    name: "Pampa Taller",
    level: 2,
    model: "mini",
    performance: 55,
    skill: 0.87,
    shield: 24,
  },
  {
    id: "bot-4",
    name: "Horizonte Amateur",
    level: 3,
    model: "hilux",
    performance: 58,
    skill: 0.92,
    shield: 32,
  },
  {
    id: "bot-5",
    name: "Cóndor Club",
    level: 5,
    model: "hilux",
    performance: 64,
    skill: 0.98,
    shield: 41,
  },
];
const copy = (x) => structuredClone(x);
const minute30 = (at) => Math.floor(at / 30000) * 30000;
const emptyStats = () => ({
  starts: 0,
  wins: 0,
  podiums: 0,
  finishes: 0,
  km: 0,
  prizes: 0,
});
function hash(s) {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0 || 1;
}
function rng(seed) {
  let x = hash(seed);
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return (x >>> 0) / 4294967296;
  };
}
function template(now, options = {}) {
  return createRace({
    now,
    startAt: new Date(now + 3600000).toISOString(),
    continuation: true,
    ...options,
  });
}
export function createWorld(
  now,
  epoch = new Date(Math.ceil((now + 3600000) / 60000) * 60000).toISOString(),
) {
  if (!Number.isFinite(Date.parse(epoch)) || Date.parse(epoch) % 60000 !== 0)
    throw Error("SEASON_EPOCH debe ser una fecha UTC con segundos 00.");
  const at = minute30(now),
    engine = template(at);
  engine.teams = [];
  engine.mode = "online";
  engine.startAt = epoch;
  engine.clock = (at - Date.parse(epoch)) / 1000;
  engine.championship.startAt = epoch;
  engine.management.owners = {};
  engine.management.stocks = Object.fromEntries(
    [...CATALOG.vehicles, ...CATALOG.parts].map((p) => [p.id, p.stock]),
  );
  engine.management.auctions = [];
  engine.events = [];
  engine.eventCounter = 0;
  engine.employment.lastAt = at;
  engine.competition = {
    ...engine.competition,
    epoch,
    currentId: `andes@${Date.parse(epoch)}`,
    closed: false,
    started: true,
    registrations: [],
    results: [],
  };
  return {
    version: RULES_VERSION,
    seed: crypto.getRandomValues(new Uint32Array(1))[0] || 1,
    createdAt: at,
    at,
    epoch,
    engine,
    races: {},
    stats: Object.fromEntries(BOT_PROFILES.map((b) => [b.id, emptyStats()])),
    processed: [],
  };
}
function rekey(t, id) {
  const ids = new Map();
  for (const p of [...t.inventory, ...Object.values(t.parts), ...t.garage]) {
    const next = `${id}-${p.id}`;
    ids.set(p.id, next);
    p.id = next;
  }
  t.activeCarId = ids.get(t.activeCarId);
  t.id = id;
  return t;
}
export function addDirector(w, id, username, name, shieldId, modelId = "niva") {
  if (w.engine.teams.some((t) => t.id === id))
    throw Error("Ya existe la escudería.");
  const offer = w.engine.management.catalog.vehicles.find(
    (v) => v.id === modelId,
  );
  if (!offer?.available || w.engine.management.stocks[modelId] < 1)
    throw Error("Auto inicial sin stock.");
  const initialBudget = w.engine.management.catalog.settings.find(
    (s) => s.key === "startingBudget",
  ).value;
  if (offer.price > initialBudget - 1500)
    throw Error("Presupuesto insuficiente para este auto inicial.");
  const source = template(w.at, {
    seed: hash(`${w.seed}/${id}`),
    vehicleId: modelId,
    name,
    director: username,
    shieldId,
    catalog: w.engine.management.catalog,
  });
  const t = rekey(getPlayer(source), id);
  // Personal de academia exclusivo por equipo; los empleados del mercado sí son globalmente únicos.
  t.drivers.forEach((d, i) => {
    d.id = `${id}-academy-driver-${i + 1}`;
    d.personId = d.id;
    d.name = `${["Alex", "Dani", "Sol"][i]} · Academia`;
    d.salary = 1000 + i * 200;
    d.traits = "";
    startContract(w.engine, t, d, "driver", w.at, i);
  });
  t.activeDriver = t.drivers[0].id;
  t.mechanics.forEach((m) => {
    m.id = `${id}-academy-mechanic`;
    m.name = "Asistencia de academia";
    m.salary = 1000;
    m.traits = "";
    startContract(w.engine, t, m, "mechanic", w.at);
  });
  t.participating = false;
  t.phase = "unregistered";
  t.plans = routeFor(t).stages.map(() => null);
  t.finance.accrued = { drivers: 0, mechanics: 0 };
  t.finance.bills = [];
  t.ledger.forEach((l) => {
    l.at = w.at;
    l.time = w.engine.clock;
  });
  w.engine.management.stocks[modelId]--;
  w.engine.teams.push(t);
  w.stats[id] = emptyStats();
  return t;
}
export function events(w, from = w.at, to = w.at + 60 * 86400000) {
  return calendar(w.engine, from, to);
}
function raceFor(w, eventId) {
  const e = eventById(w.engine, eventId);
  if (!e) throw Error("Carrera desconocida.");
  return (w.races[eventId] ||= {
    event: e,
    status: "scheduled",
    entries: {},
    bots: [],
    firstFinish: null,
    closedAt: null,
    reason: null,
    catalog: null,
    nextAt: e.start,
  });
}
function frame(w, r, teams = null) {
  return {
    ...w.engine,
    id: r.event.eventId,
    startAt: new Date(r.event.start).toISOString(),
    clock: (w.at - r.event.start) / 1000,
    routeId: r.event.id,
    teams: teams || [
      ...Object.keys(r.entries)
        .map((id) => w.engine.teams.find((t) => t.id === id))
        .filter(Boolean),
      ...r.bots,
    ],
    management: {
      ...w.engine.management,
      catalog: r.catalog || w.engine.management.catalog,
    },
    competition: {
      ...w.engine.competition,
      currentId: r.event.eventId,
      closed: r.status === "closed",
      registrations: [],
      started: r.status === "running",
    },
  };
}
function resetEntry(t, e, plans) {
  t.routeId = e.id;
  Object.assign(t, {
    participating: true,
    phase: "waiting",
    stageIndex: 0,
    stageKm: 0,
    totalKm: 0,
    speed: 0,
    heat: 25,
    holdUntil: 0,
    service: null,
    stageStart: null,
    finishTime: null,
    prizePaid: false,
    history: [],
    journal: [],
    stageNotes: null,
    activePlan: null,
  });
  delete t.prize;
  t.statistics = {
    driving: 0,
    service: 0,
    waiting: 0,
    errors: 0,
    failures: 0,
    fuelUsed: 0,
  };
  t.plans = copy(plans);
}
export function makeBots(w, r) {
  const source = template(w.at, { seed: hash(`${w.seed}/${r.event.eventId}`) }),
    random = rng(`${w.seed}/${w.epoch}/${r.event.eventId}`);
  return BOT_PROFILES.map((b, i) => {
    const t = rekey(copy(source.teams[i + 1]), b.id);
    t.name = b.name;
    t.directorName = "BOT";
    t.vehicleId = b.model;
    t.ai = true;
    t.shieldId = b.shield;
    t.botLevel = b.level;
    t.budget = 2000000;
    t.debt = 0;
    const car = activeCar(t);
    car.modelId = b.model;
    car.stats = modelStats(b.model, w.engine.management.catalog);
    car.condition = 65 + random() * 35;
    car.performance = b.performance;
    car.reliability = 50 + random() * 25;
    for (const p of Object.values(t.parts)) {
      p.condition = 55 + random() * 40;
      p.original = 70 + random() * 30;
      p.broken = false;
      p.grade = "standard";
    }
    for (const d of t.drivers) {
      d.energy = 75 + random() * 25;
      d.speed *= b.skill;
      d.form = 55 + random() * 35;
      d.morale = 60 + random() * 30;
    }
    t.progression.xp = b.level === 1 ? 0 : 100 * (b.level - 1) ** 2.4;
    const plans = routeFor(r.event.id).stages.map((s, j) => ({
      ...defaultPlan(j),
      ...recommendedSetup(s),
      driverId: t.drivers[j % t.drivers.length].id,
      fuelTarget: vehicle(b.model).tank,
      pace: i < 3 ? "conserve" : "balanced",
      boost: 0,
      rest: "full",
      actions: Object.fromEntries(PART_TYPES.map((p) => [p.id, "repair"])),
    }));
    resetEntry(t, r.event, plans);
    t.ledger = [];
    t.ai = true;
    return t;
  });
}
function startRace(w, r) {
  r.catalog = copy(w.engine.management.catalog);
  r.status = "running";
  r.bots = makeBots(w, r);
  for (const [id, entry] of Object.entries(r.entries)) {
    const t = w.engine.teams.find((t) => t.id === id),
      car = t.garage.find((c) => c.id === entry.carId);
    if (
      !car ||
      jobFor(t, car.id) ||
      !crewRate(t, "race") ||
      !t.drivers.some((d) => d.id === entry.driverId)
    ) {
      entry.dns = true;
      continue;
    }
    t.activeCarId = car.id;
    t.vehicleId = car.modelId;
    t.activeDriver = entry.driverId;
    const plans = entry.plans.map(
      (p) =>
        p && {
          ...p,
          driverId: t.drivers.some((d) => d.id === p.driverId)
            ? p.driverId
            : entry.driverId,
        },
    );
    resetEntry(t, r.event, plans);
    t.onlineRace = r.event.eventId;
    entry.vehicleId = t.vehicleId;
    markParticipation(frame(w, r, [t]), t);
  }
}
function closeRace(w, r, f, reason, closedAt = w.at) {
  f = { ...f, clock: (closedAt - r.event.start) / 1000 };
  r.snapshot = publicSnapshot(f).entries;
  r.status = "closed";
  r.closedAt = closedAt;
  r.reason = reason;
  const ordered = standings(f),
    result = [];
  ordered.forEach((t, index) => {
    const pos = index + 1,
      ref = r.catalog.prizes[index];
    const gross = ref
      ? Math.round(
          (r.event.kind === "short" ? ref.short : ref.race) *
            r.event.prizeFactor,
        )
      : 0;
    const settled = Math.min(gross, t.debt);
    t.debt -= settled;
    t.prizePaid = true;
    t.prize = { position: pos, gross, settled, net: gross - settled };
    recordCash(f, t, gross - settled, `Premio de carrera P${pos}`);
    const row = {
      raceId: r.event.eventId,
      circuitId: r.event.id,
      teamId: t.id,
      director: t.directorName,
      name: t.name,
      isBot: t.ai,
      vehicleId: r.entries[t.id]?.vehicleId || t.vehicleId,
      rulesVersion: RULES_VERSION,
      catalogRevision: r.catalog.revision,
      position: pos,
      finished: t.finishTime !== null,
      finishSeconds: t.finishTime,
      distanceKm: t.totalKm,
      drivingSeconds: t.statistics.driving,
      prizeCents: Math.round((gross - settled) * 100),
      closedAt,
      details: {
        car: copy(activeCar(t)),
        statistics: copy(t.statistics),
        stages: copy(t.history),
        gross,
        settled,
        reason,
      },
    };
    result.push(row);
    const stats = (w.stats[t.id] ||= emptyStats());
    stats.starts++;
    stats.wins += pos === 1 ? 1 : 0;
    stats.podiums += pos <= 3 ? 1 : 0;
    stats.finishes += row.finished ? 1 : 0;
    stats.km += t.totalKm;
    stats.prizes += gross - settled;
    if (!t.ai) {
      awardProgression(
        f,
        t,
        r.event,
        { finished: row.finished, position: Math.min(pos, 12), km: t.totalKm },
        routeFor(r.event.id).totalKm,
      );
      t.progression.lastResult.position = pos;
      t.phase = row.finished ? "finished" : "cutoff";
      t.participating = false;
      t.speed = 0;
      t.service = null;
      t.activePlan = null;
      t.onlineRace = null;
    } else {
      // Asistencia virtual del BOT después del cierre; el próximo sorteo ocurre sólo en la siguiente carrera.
      activeCar(t).condition = 100;
      for (const p of [...t.inventory, ...Object.values(t.parts)]) {
        p.condition = 100;
        p.broken = false;
      }
      t.drivers.forEach((d) => (d.energy = 100));
      t.speed = 0;
    }
  });
  r.results = result;
  w.processed.push(...result);
}
export function advanceWorld(w, now, maxSeconds = 600) {
  const target = Math.min(minute30(now), w.at + maxSeconds * 1000);
  while (w.at < target) {
    // Calendar generated once per minute; no request per car, sector or player.
    if (w.at % 60000 === 0)
      for (const e of events(w, w.at, w.at + 60000))
        if (e.start >= w.createdAt && e.start <= target && e.start >= w.at)
          raceFor(w, e.eventId);
    for (const r of Object.values(w.races))
      if (r.status === "scheduled" && r.event.start <= w.at) startRace(w, r);
    const active = new Set();
    for (const r of Object.values(w.races).filter(
      (r) => r.status === "running",
    )) {
      const teams = [
        ...Object.entries(r.entries)
          .filter(([, e]) => !e.dns)
          .map(([id]) => w.engine.teams.find((t) => t.id === id)),
        ...r.bots,
      ];
      const f = frame(w, r, teams),
        deadline = Math.min(
          r.event.end,
          r.firstFinish === null
            ? Infinity
            : r.event.start + (r.firstFinish + 86400) * 1000,
        );
      if (w.at >= deadline || teams.every((t) => t.finishTime !== null)) {
        closeRace(
          w,
          r,
          f,
          w.at >= r.event.end
            ? "maximum"
            : w.at >= deadline
              ? "first-finisher"
              : "all-finished",
          w.at >= deadline
            ? deadline
            : r.event.start +
                Math.max(...teams.map((t) => t.finishTime)) * 1000,
        );
        continue;
      }
      const dt = Math.min(30, (deadline - w.at) / 1000);
      for (const t of teams) {
        advanceTeam(f, t, dt);
        if (!t.ai) active.add(t.id);
      }
      w.engine.eventCounter = f.eventCounter;
      const times = teams
        .filter((t) => t.finishTime !== null)
        .map((t) => t.finishTime);
      if (times.length) r.firstFinish = Math.min(...times);
      if (teams.every((t) => t.finishTime !== null)) {
        w.at += dt * 1000;
        closeRace(
          w,
          r,
          frame(w, r, teams),
          "all-finished",
          r.event.start + Math.max(...times) * 1000,
        );
        w.at -= dt * 1000;
      }
    }
    for (const t of w.engine.teams)
      if (!active.has(t.id))
        advanceTeam(
          {
            ...w.engine,
            competition: { ...w.engine.competition, closed: true },
          },
          t,
          30,
        );
    advanceWorkshops(w.engine, 30);
    w.at += 30000;
    w.engine.clock = (w.at - Date.parse(w.epoch)) / 1000;
    advanceEmployment(w.engine);
    advanceProgression(w.engine);
    settleAuctions(w.engine);
  }
  return { caughtUp: w.at >= minute30(now), at: w.at };
}
export function syncCatalog(w) {
  const m = w.engine.management;
  if (m.catalog.revision === CATALOG.revision) return false;
  // New defaults are added once. Existing stock, ownership, salaries and car attributes remain authoritative.
  for (const p of [...CATALOG.vehicles, ...CATALOG.parts])
    if (!(p.id in m.stocks)) m.stocks[p.id] = p.stock;
  m.catalog = copy(CATALOG);
  return true;
}
function withPlayer(w, t, fn, r = null) {
  const id = t.id,
    m = w.engine.management;
  const replace = (from, to) => {
    for (const p of Object.keys(m.owners))
      if (m.owners[p] === from) m.owners[p] = to;
    for (const a of m.auctions)
      for (const b of a.bids) if (b.teamId === from) b.teamId = to;
  };
  t.id = "player";
  replace(id, "player");
  const s = r ? frame(w, r, [t]) : { ...w.engine, teams: [t] };
  try {
    return fn(s);
  } finally {
    t.id = id;
    replace("player", id);
    w.engine.itemCounter = s.itemCounter;
    w.engine.eventCounter = s.eventCounter;
  }
}
function bidOnline(w, t, command) {
  const { kind, personId, salary } = command,
    m = w.engine.management;
  if (!["driver", "mechanic"].includes(kind))
    throw Error("Tipo de empleado inválido.");
  const pool = kind === "driver" ? m.catalog.drivers : m.catalog.mechanics,
    list = kind === "driver" ? t.drivers : t.mechanics;
  const person = pool.find((p) => p.id === personId);
  if (!person?.available || m.owners[personId])
    throw Error("Empleado no disponible.");
  if (
    !Number.isSafeInteger(salary) ||
    salary < person.salary ||
    salary > 1000000
  )
    throw Error("Sueldo inválido.");
  let a = m.auctions.find(
    (a) => a.personId === personId && a.status === "open",
  );
  const previous = a?.bids.find((b) => b.teamId === t.id);
  const pending = m.auctions.filter(
    (a) =>
      a.status === "open" &&
      a.kind === kind &&
      a.personId !== personId &&
      a.bids.some((b) => b.teamId === t.id),
  ).length;
  if (list.length + pending >= (kind === "driver" ? 3 : 5))
    throw Error("Cupo de empleados completo.");
  if (previous && salary <= previous.salary)
    throw Error("Mejorá tu oferta anterior.");
  const difference = salary - (previous?.escrow || 0);
  if (t.budget < difference) throw Error("Saldo insuficiente.");
  const clock = w.engine.clock;
  if (!a) {
    a = {
      id: `offer-${++m.sequence}`,
      kind,
      personId,
      status: "open",
      openedAt: clock,
      closesAt:
        clock +
        m.catalog.settings.find((s) => s.key === "auctionHours").value * 3600,
      bids: [],
    };
    m.auctions.push(a);
  }
  if (clock >= a.closesAt) throw Error("La oferta ya cerró.");
  recordCash(w.engine, t, -difference, `Reserva de oferta: ${person.name}`);
  if (previous) Object.assign(previous, { salary, escrow: salary });
  else
    a.bids.push({
      teamId: t.id,
      salary,
      escrow: salary,
      sequence: ++m.sequence,
    });
  return { auctionId: a.id, closesAt: Date.parse(w.epoch) + a.closesAt * 1000 };
}
export function command(w, id, c) {
  const t = w.engine.teams.find((t) => t.id === id);
  if (!t) throw Error("Escudería desconocida.");
  if (!c || typeof c.type !== "string") throw Error("Comando inválido.");
  const r = t.onlineRace ? w.races[t.onlineRace] : null;
  if (
    r?.status === "running" &&
    (c.type === "select-car" ||
      (c.type === "sell-car" && c.id === t.activeCarId) ||
      (c.type === "purchase-car" && c.tradeId === t.activeCarId) ||
      (["sell-part", "enqueue-work"].includes(c.type) &&
        (c.id === t.activeCarId ||
          Object.values(t.parts).some((p) => p.id === c.id))))
  )
    throw Error(
      "Esperá el cierre de la carrera antes de modificar el kit o auto de carrera.",
    );
  if (
    ["sell-part", "enqueue-work"].includes(c.type) &&
    Object.values(w.races).some(
      (x) =>
        x.status === "scheduled" &&
        x.entries[id]?.plans.some(
          (p) =>
            p &&
            Object.entries(p.replacements || {}).some(
              ([type, piece]) =>
                piece === c.id && p.actions[type] === "replace",
            ),
        ),
    )
  )
    throw Error("La pieza está reservada en una carrera futura.");
  switch (c.type) {
    case "enroll": {
      const race = raceFor(w, c.eventId),
        e = race.event,
        car = activeCar(t);
      if (w.at >= e.start || race.entries[id])
        throw Error("Inscripción cerrada o duplicada.");
      if (
        Object.values(w.races).some(
          (x) =>
            x.entries[id] && e.start < x.event.end && x.event.start < e.end,
        )
      )
        throw Error("Se superpone con otra inscripción.");
      if (
        !car ||
        jobFor(t, car.id) ||
        !crewRate(t, "race") ||
        !t.drivers.some((d) => d.id === c.driverId) ||
        t.budget < 1500
      )
        throw Error("Necesitás auto disponible, piloto, mecánico y 1.500 cr.");
      const plans = routeFor(e.id).stages.map((s, i) => ({
        ...defaultPlan(i),
        ...recommendedSetup(s),
        driverId: c.driverId,
        fuelTarget: vehicle(t.vehicleId).tank,
      }));
      race.entries[id] = {
        carId: car.id,
        vehicleId: car.modelId,
        driverId: c.driverId,
        plans,
        dns: false,
      };
      return { eventId: e.eventId };
    }
    case "cancel-enrollment": {
      const race = w.races[c.eventId];
      if (!race?.entries[id] || w.at >= race.event.start)
        throw Error("No se puede cancelar la inscripción.");
      delete race.entries[id];
      return { cancelled: true };
    }
    case "save-plan": {
      const race = c.eventId ? w.races[c.eventId] : r;
      if (!race?.entries[id] || race.status === "closed")
        throw Error("Inscribite antes de configurar.");
      if (race.status === "scheduled") {
        const preview = copy(t);
        preview.routeId = race.event.id;
        preview.phase = "waiting";
        preview.stageIndex = 0;
        preview.plans = copy(race.entries[id].plans);
        withPlayer(w, preview, (s) => savePlan(s, c.stageIndex, c.plan), race);
        race.entries[id].plans = preview.plans;
      } else withPlayer(w, t, (s) => savePlan(s, c.stageIndex, c.plan), race);
      return { saved: true };
    }
    case "bid":
      return bidOnline(w, t, c);
    case "buy-part":
      return withPlayer(w, t, (s) =>
        buyPart(s, c.partType, c.grade, c.condition),
      );
    case "sell-part":
      return withPlayer(w, t, (s) => sellPart(s, c.id));
    case "purchase-car": {
      const out = withPlayer(w, t, (s) =>
        purchaseVehicle(s, c.modelId, { tradeId: c.tradeId || null }),
      );
      if (c.tradeId)
        for (const race of Object.values(w.races))
          if (
            race.status === "scheduled" &&
            race.entries[id]?.carId === c.tradeId
          )
            delete race.entries[id];
      return out;
    }
    case "select-car":
      return withPlayer(w, t, (s) => selectVehicle(s, c.id));
    case "sell-car": {
      const out = withPlayer(w, t, (s) => sellVehicle(s, c.id));
      for (const race of Object.values(w.races))
        if (race.status === "scheduled" && race.entries[id]?.carId === c.id)
          delete race.entries[id];
      return out;
    }
    case "enqueue-work":
      return withPlayer(w, t, (s) =>
        enqueueJob(s, c.kind, c.id, c.points ?? 5),
      );
    case "cancel-work":
      return withPlayer(w, t, (s) => cancelJob(s, c.id));
    case "assign-mechanic":
      return withPlayer(w, t, (s) => assignMechanic(s, c.id, c.place));
    case "renew-contract":
      return withPlayer(w, t, (s) => renewContract(s, c.kind, c.id));
    case "cancel-bid":
      return withPlayer(w, t, (s) => cancelBid(s, c.id));
    case "release":
      return withPlayer(w, t, (s) => releaseEmployee(s, c.kind, c.id));
    case "choose-shield":
      return withPlayer(w, t, (s) => chooseShield(s, c.shieldId));
    case "rename-team": {
      if (
        typeof c.name !== "string" ||
        !c.name.trim() ||
        c.name.trim().length > 40 ||
        /[\x00-\x1f\x7f]/.test(c.name)
      )
        throw Error("Nombre inválido.");
      t.name = c.name.trim();
      return { name: t.name };
    }
    default:
      throw Error(
        "Comando no permitido online. No hay importación, dinero admin ni aceleración.",
      );
  }
}
export function publicWorld(w) {
  return {
    version: RULES_VERSION,
    at: w.at,
    epoch: w.epoch,
    vehicles: w.engine.management.catalog.vehicles.map((v) => ({
      id: v.id,
      name: v.name,
      price: v.price,
      stock: w.engine.management.stocks[v.id],
      available: v.available,
    })),
    bots: BOT_PROFILES.map((b) => ({ ...b, stats: w.stats[b.id] })),
    races: Object.values(w.races).map((r) => ({
      eventId: r.event.eventId,
      name: r.event.name,
      circuitId: r.event.id,
      kind: r.event.kind,
      start: r.event.start,
      end: r.event.end,
      status: r.status,
      closedAt: r.closedAt,
      firstFinish: r.firstFinish,
      positions:
        r.status === "scheduled"
          ? []
          : r.snapshot || publicSnapshot(frame(w, r)).entries,
      results: (r.results || []).map(({ details, ...row }) => row),
    })),
    directors: w.engine.teams.map((t) => ({
      id: t.id,
      name: t.name,
      director: t.directorName,
      shieldId: t.shieldId,
      level: teamLevel(t).level,
      stats: w.stats[t.id],
    })),
  };
}
export function privateWorld(w, id) {
  const t = w.engine.teams.find((t) => t.id === id);
  if (!t) throw Error("Escudería desconocida.");
  const own = copy(t);
  delete own.rng;
  delete own.ledgerSaved;
  delete own.ledgerOffset;
  return {
    version: RULES_VERSION,
    at: w.at,
    team: own,
    stats: w.stats[id],
    catalog: w.engine.management.catalog,
    stocks: w.engine.management.stocks,
    owners: w.engine.management.owners,
    offers: w.engine.management.auctions
      .filter((a) => a.status === "open")
      .map((a) => ({
        id: a.id,
        kind: a.kind,
        personId: a.personId,
        closesAt: Date.parse(w.epoch) + a.closesAt * 1000,
        ownSalary: a.bids.find((b) => b.teamId === id)?.salary || null,
      })),
    calendar: events(w),
    entries: Object.values(w.races)
      .filter((r) => r.entries[id])
      .map((r) => ({
        eventId: r.event.eventId,
        status: r.status,
        ...r.entries[id],
      })),
    public: publicWorld(w),
  };
}
