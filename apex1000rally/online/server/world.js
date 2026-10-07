import {
  defaultTunings,
  validateTunings,
  tuningEffects,
  preparationWindow,
} from "../../src/race-tuning.js";
import { optimalTunings } from "./race-tuning.js";
import {
  normalizeEntries,
  allocation,
  participant,
  saveParticipant,
  refreshAssignments,
  protectResources,
  RUNTIME_KEYS,
} from "./resources.js";
import { migrateVehicleBalance } from "../../src/vehicle-stats.js";
import { CATALOG } from "../../data/catalog.js";
import { starterStaffName } from "./staff.js";
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
const ACADEMY_DRIVER_SALARIES = [1000, 1200, 1400];
const ACADEMY_MECHANIC_SALARY = 1000;
function initialFinance(w) {
  const settings = w.engine.management.catalog.settings;
  const startingBudget = settings.find((s) => s.key === "startingBudget").value;
  const initialMonthlySalary =
    ACADEMY_DRIVER_SALARIES.reduce((a, b) => a + b, 0) +
    ACADEMY_MECHANIC_SALARY;
  const initialMonthlyBaseCost =
    settings.find((s) => s.key === "monthlyBaseCost")?.value ?? 1500;
  return {
    startingBudget,
    initialMonthlySalary,
    initialMonthlyBaseCost,
    initialReserve: initialMonthlySalary + initialMonthlyBaseCost,
  };
}
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
    rivalCount: 0,
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
  const { startingBudget, initialReserve } = initialFinance(w);
  if (offer.price > startingBudget - initialReserve)
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
    d.name = starterStaffName(id, "driver", i);
    d.salary = ACADEMY_DRIVER_SALARIES[i];
    d.traits = "";
    startContract(w.engine, t, d, "driver", w.at, i);
  });
  t.activeDriver = t.drivers[0].id;
  t.mechanics.forEach((m) => {
    m.id = `${id}-academy-mechanic`;
    m.name = starterStaffName(id, "mechanic");
    m.salary = ACADEMY_MECHANIC_SALARY;
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
        .map((id) => participant(w, r, id))
        .filter(Boolean),
      ...r.bots,
    ],
    management: {
      ...w.engine.management,
      catalog:
        r.catalog ||
        w.catalogs?.[r.catalogRevision] ||
        w.engine.management.catalog,
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
  delete t.stageStaff;
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
  const source = template(w.at, {
      seed: hash(`${w.seed}/${r.event.eventId}`),
      rivalCount: 5,
    }),
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
  r.optimalTunings ||= optimalTunings(w, r.event);
  for (const bot of r.bots)
    bot.raceTuningEffects = tuningEffects(defaultTunings(), r.optimalTunings);
  for (const [id, entry] of Object.entries(r.entries)) {
    const base = w.engine.teams.find((t) => t.id === id);
    const t = participant(w, r, id);
    if (
      !t ||
      !t.garage.length ||
      !t.drivers.length ||
      !t.mechanics.length ||
      Object.values(t.parts).some((p) => !p) ||
      jobFor(base, entry.carId) ||
      entry.reservedPartIds.some((id) => jobFor(base, id))
    ) {
      entry.dns = true;
      continue;
    }
    entry.driverId = t.drivers.some((d) => d.id === entry.driverId)
      ? entry.driverId
      : t.drivers[0].id;
    resetEntry(t, r.event, entry.plans);
    if (entry.tunings)
      t.raceTuningEffects = tuningEffects(entry.tunings, r.optimalTunings);
    else delete t.raceTuningEffects; // Already enrolled legacy teams retain their original neutral setup.
    t.preparation = entry.readyAt
      ? {
          start: (entry.preparationStart - r.event.start) / 1000,
          until: (entry.readyAt - r.event.start) / 1000,
        }
      : null;
    if (entry.readyAt > w.at) t.phase = "preparing";
    t.plans = t.plans.map(
      (p) =>
        p && {
          ...p,
          driverId: t.drivers.some((d) => d.id === p.driverId)
            ? p.driverId
            : entry.driverId,
        },
    );
    t.activeDriver = entry.driverId;
    t.fuel = t.garage[0].fuel || 0;
    t.rng = hash(`${w.seed}/${id}/${r.event.eventId}`) || 1;
    saveParticipant(w, r, t);
    markParticipation(frame(w, r, [t]), base);
  }
  refreshAssignments(w);
}
function closeRace(w, r, f, reason, closedAt = w.at) {
  const catalog =
    r.catalog || w.catalogs?.[r.catalogRevision] || w.engine.management.catalog;
  f = { ...f, clock: (closedAt - r.event.start) / 1000 };
  r.snapshot = publicSnapshot(f).entries;
  r.status = "closed";
  r.closedAt = closedAt;
  r.reason = reason;
  const ordered = standings(f),
    result = [];
  ordered.forEach((t, index) => {
    const pos = index + 1,
      ref = catalog.prizes[index];
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
      catalogRevision: catalog.revision,
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
      saveParticipant(w, r, t);
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
  refreshAssignments(w);
}
export function advanceWorld(w, now, maxSeconds = 600, options = {}) {
  normalizeEntries(w);
  refreshAssignments(w);
  const target = Math.min(minute30(now), w.at + maxSeconds * 1000);
  const boundary = options.boundary?.(w);
  while (w.at < target) {
    refreshAssignments(w);
    if (
      options.idleJump &&
      !Object.values(w.races).some((r) => r.status === "running") &&
      !w.engine.teams.some(
        (t) => t.workshop?.jobs.length && crewRate(t, "workshop") > 0,
      )
    ) {
      const future = events(
        w,
        w.at + 1,
        Math.min(target, w.at + 3 * 86400000),
      ).find((e) => e.start > w.at);
      const deadlines = [
        target,
        future?.start,
        w.engine.employment?.nextPayrollAt,
        ...Object.values(w.races)
          .filter((r) => r.status === "scheduled")
          .flatMap((r) => [
            r.event.start,
            ...Object.values(r.entries).map((e) => e.preparationStart),
          ]),
        ...w.engine.teams.flatMap((t) =>
          [...t.drivers, ...t.mechanics].map((p) => p.contract.expiresAt),
        ),
        ...w.engine.management.auctions
          .filter((a) => a.status === "open")
          .map((a) => Date.parse(w.epoch) + a.closesAt * 1000),
      ].filter((at) => Number.isFinite(at) && at > w.at);
      const stop = Math.min(...deadlines);
      // A due event still needs the ordinary 30-second transition below.
      const due =
        Object.values(w.races).some(
          (r) => r.status === "scheduled" && r.event.start <= w.at,
        ) || events(w, w.at, w.at + 1).some((e) => e.start === w.at);
      if (!due && stop - w.at >= 30000) {
        const seconds = (stop - w.at) / 1000;
        for (const t of w.engine.teams)
          advanceTeam(
            {
              ...w.engine,
              competition: { ...w.engine.competition, closed: true },
            },
            t,
            seconds,
          );
        w.at = stop;
        refreshAssignments(w);
        w.engine.clock = (w.at - Date.parse(w.epoch)) / 1000;
        advanceEmployment(w.engine);
        advanceProgression(w.engine);
        settleAuctions(w.engine);
        if (options.boundary && options.boundary(w) !== boundary) break;
        continue;
      }
    }
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
          .map(([id]) => participant(w, r, id))
          .filter(Boolean),
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
        if (!t.ai) {
          saveParticipant(w, r, t);
          for (const d of t.drivers) active.add(d.id);
        }
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
    refreshAssignments(w);
    for (const t of w.engine.teams) {
      const idle = {
        ...t,
        drivers: t.drivers.filter((d) => !active.has(d.id)),
        participating: false,
      };
      advanceTeam(
        { ...w.engine, competition: { ...w.engine.competition, closed: true } },
        idle,
        30,
      );
    }
    advanceWorkshops(w.engine, 30);
    w.at += 30000;
    w.engine.clock = (w.at - Date.parse(w.epoch)) / 1000;
    advanceEmployment(w.engine);
    advanceProgression(w.engine);
    settleAuctions(w.engine);
    if (options.boundary && options.boundary(w) !== boundary) break;
  }
  refreshAssignments(w);
  return { caughtUp: w.at >= minute30(now), at: w.at };
}
export function syncCatalog(w, catalog = CATALOG) {
  migrateVehicleBalance(w.engine);
  for (const r of Object.values(w.races))
    migrateVehicleBalance({ teams: r.bots });
  const m = w.engine.management;
  if (m.catalog.revision === catalog.revision) return false;
  // New defaults are added once. Existing stock, ownership, salaries and car attributes remain authoritative.
  for (const p of [...catalog.vehicles, ...catalog.parts])
    if (!(p.id in m.stocks)) m.stocks[p.id] = p.stock;
  m.catalog = copy(catalog);
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
  const prior = { phase: t.phase, participating: t.participating };
  const driving =
    !r && t.onlineRace
      ? Object.fromEntries(
          RUNTIME_KEYS.filter((k) => t[k] !== undefined).map((k) => [
            k,
            ["plans", "activePlan"].includes(k) ? copy(t[k]) : t[k],
          ]),
        )
      : null;
  if (!r && !t.plans) t.plans = [];
  if (!r) {
    t.phase = "unregistered";
    t.participating = false;
  }
  const s = r
    ? frame(w, r, [t])
    : {
        ...w.engine,
        teams: [t],
        competition: { ...w.engine.competition, closed: true },
      };
  try {
    return fn(s);
  } finally {
    t.id = id;
    if (!r) Object.assign(t, prior);
    if (driving)
      for (const k of RUNTIME_KEYS) {
        if (k in driving) t[k] = driving[k];
        else delete t[k];
      }
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
  normalizeEntries(w);
  protectResources(w, t, c);
  const r = t.onlineRace ? w.races[t.onlineRace] : null;
  switch (c.type) {
    case "enroll":
    case "configure-enrollment": {
      const race = raceFor(w, c.eventId),
        e = race.event,
        existing = race.entries[id];
      if (w.at >= e.start || (c.type === "enroll" ? !!existing : !existing))
        throw Error("Inscripción cerrada o duplicada.");
      if (existing?.preparationStart <= w.at)
        throw Error(
          "La puesta a punto ya comenzó: la asignación y los reglajes quedan fijos para toda la carrera.",
        );
      const preparation = existing?.readyAt
        ? {
            preparationStart: existing.preparationStart,
            readyAt: existing.readyAt,
          }
        : preparationWindow(w.at, e);
      const tunings = validateTunings(c.tunings ?? existing?.tunings);
      const assigned = allocation(w, t, race, { ...c, ...preparation });
      const plans = routeFor(e.id).stages.map((s, i) => ({
        ...(existing?.plans[i] || {
          ...defaultPlan(i),
          ...recommendedSetup(s),
        }),
        driverId:
          existing?.plans[i] &&
          assigned.driverIds.includes(existing.plans[i].driverId)
            ? existing.plans[i].driverId
            : assigned.driverIds[i % assigned.driverIds.length],
        fuelTarget: vehicle(assigned.vehicleId).tank,
      }));
      if (
        existing &&
        plans.some((p) =>
          Object.values(p.replacements || {}).some(
            (id) => !assigned.spareIds.includes(id),
          ),
        )
      )
        throw Error(
          "El nuevo lote debe conservar los repuestos usados en los planes, o quitarlos antes.",
        );
      race.entries[id] = {
        ...assigned,
        ...preparation,
        tunings,
        plans,
        dns: false,
      };
      refreshAssignments(w);
      return { eventId: e.eventId };
    }
    case "cancel-enrollment": {
      const race = w.races[c.eventId];
      if (!race?.entries[id] || w.at >= race.event.start)
        throw Error("No se puede cancelar la inscripción.");
      delete race.entries[id];
      refreshAssignments(w);
      return { cancelled: true };
    }
    case "save-plans": {
      if (!Array.isArray(c.plans) || c.plans.length < 1 || c.plans.length > 24)
        throw Error("Lote de planes inválido.");
      for (const row of c.plans)
        command(w, id, {
          type: "save-plan",
          eventId: c.eventId,
          stageIndex: row.stageIndex,
          plan: row.plan,
        });
      return { saved: c.plans.length };
    }
    case "save-plan": {
      const race = c.eventId ? w.races[c.eventId] : r;
      if (!race?.entries[id] || race.status === "closed")
        throw Error("Inscribite antes de configurar.");
      const preview = participant(w, race, id);
      if (!preview) throw Error("No hay equipo disponible en esta carrera.");
      if (!preview.drivers.some((d) => d.id === c.plan?.driverId))
        throw Error("El piloto no está asignado a esta carrera.");
      const allocated = new Set(race.entries[id].spareIds);
      if (
        Object.values(c.plan?.replacements || {}).some(
          (piece) => piece && !allocated.has(piece),
        )
      )
        throw Error("El repuesto no está asignado a esta carrera.");
      withPlayer(w, preview, (s) => savePlan(s, c.stageIndex, c.plan), race);
      if (race.status === "scheduled") race.entries[id].plans = preview.plans;
      else saveParticipant(w, race, preview);
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
      refreshAssignments(w);
      return out;
    }
    case "select-car":
      return withPlayer(w, t, (s) => {
        const out = selectVehicle(s, c.id),
          kit = activeCar(t).kitIds;
        if (kit) {
          const all = [...Object.values(t.parts), ...t.inventory];
          if (
            PART_TYPES.every((type) => all.some((p) => p.id === kit[type.id]))
          ) {
            t.parts = Object.fromEntries(
              Object.entries(kit).map(([type, id]) => [
                type,
                all.find((p) => p.id === id),
              ]),
            );
            t.inventory = all.filter((p) => !Object.values(kit).includes(p.id));
          }
        }
        return out;
      });
    case "sell-car": {
      const out = withPlayer(w, t, (s) => sellVehicle(s, c.id));
      for (const race of Object.values(w.races))
        if (race.status === "scheduled" && race.entries[id]?.carId === c.id)
          delete race.entries[id];
      refreshAssignments(w);
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
  normalizeEntries(w);
  return {
    ...initialFinance(w),
    version: RULES_VERSION,
    at: w.at,
    epoch: w.epoch,
    vehicles: [...w.engine.management.catalog.vehicles]
      .sort((a, b) => a.price - b.price)
      .map((v) => ({
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
  normalizeEntries(w);
  const t = w.engine.teams.find((t) => t.id === id);
  if (!t) throw Error("Escudería desconocida.");
  const own = copy(t);
  const runtime = w.races[t.onlineRace]?.entries[id]?.runtime;
  if (runtime)
    Object.assign(own, copy(runtime), {
      plans: copy(w.races[t.onlineRace].entries[id].plans),
    });
  delete own.rng;
  delete own.raceTuningEffects;
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
        ...Object.fromEntries(
          Object.entries(r.entries[id]).filter(([key]) => key !== "runtime"),
        ),
      })),
    public: publicWorld(w),
  };
}
