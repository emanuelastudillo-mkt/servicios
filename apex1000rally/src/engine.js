import { driverRhythm, terrainPartFactors } from "./race-dynamics.js";
import { directorName, chooseShield, renameIdentity } from "./identity.js";
import {
  teamLevel,
  advanceProgression,
  markParticipation,
  awardProgression,
} from "./progression.js";
import {
  initializeCompetition,
  currentEvent,
  calendar,
  eventById,
  raceNow,
  raceDeadline,
  enroll,
  cancelEnrollment,
} from "./competition.js";
import {
  initializeEmployment,
  advanceEmployment,
  processContracts,
  recordCash,
  renewContract,
} from "./employment.js";
import { staffFactors, partProtected } from "./staff.js";
import { CATALOG } from "../data/catalog.js";
import {
  statFactors,
  teamVehicleStats,
  migrateVehicleBalance,
} from "./vehicle-stats.js";
import { failureRate } from "./reliability.js";
import { serviceTimeline } from "./service-telemetry.js";
import { repairQuote, repairPiece } from "./part-maintenance.js";
export { repairQuote } from "./part-maintenance.js";
import {
  initializeWorkshop,
  advanceWorkshops,
  raceWorkPending,
  activeCar,
  jobFor,
  vehicleFactors,
  wearVehicle,
  crewRate,
  sellPart,
} from "./workshop.js";
import {
  startJournal,
  noteIncident,
  observeJournal,
  finishJournal,
} from "./journal.js";
import {
  initializeManagement,
  workshopRate,
  settleAuctions,
  recordRound,
  chargeSalaries,
  cash,
  bid,
  cancelBid,
  releasePerson,
  buyVehicle,
} from "./management.js";
import {
  ENGINE_VERSION,
  FUEL_PRICE,
  STEP,
  VEHICLES,
  PART_TYPES,
  GRADES,
  DRIVER_PROFILES,
  PACES,
  TERRAINS,
  PRIZES,
  clamp,
  vehicle,
  partType,
  partEffect,
  priceFor,
  defaultPlan,
} from "./catalog.js";
import {
  STAGES,
  TOTAL_KM,
  routeFor,
  segmentAt,
  recommendedSetup,
  locationAt,
} from "./route.js";
export function random(team) {
  let x = team.rng >>> 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  team.rng = x >>> 0;
  return team.rng / 4294967296;
}
const round = (n) => Math.round(n * 100) / 100 || 0;
const driverFor = (team, id = team.activeDriver) =>
  team.drivers.find((d) => d.id === id) || team.drivers[0];
export function log(state, team, type, text) {
  const e = {
    id: ++state.eventCounter,
    time: state.clock,
    teamId: team.id,
    type,
    text,
  };
  state.events.push(e);
  if (state.events.length > 600)
    state.events.splice(0, state.events.length - 600);
}
function transact(state, team, amount, label) {
  recordCash(state, team, amount, label);
}
function item(id, type, grade, condition = 100) {
  return { id, type, grade, condition, original: 100, broken: false };
}
function newTeam(id, name, vehicleId, seed, ai = false, catalog = CATALOG) {
  const v = vehicle(vehicleId),
    fee = catalog.vehicles.find((entry) => entry.id === vehicleId).price,
    initialBudget = catalog.settings.find(
      (entry) => entry.key === "startingBudget",
    ).value,
    parts = {},
    inventory = [];
  for (const p of PART_TYPES) {
    parts[p.id] = item(`${id}-${p.id}-sport`, p.id, "standard", 92);
    inventory.push(item(`${id}-${p.id}-reserve`, p.id, "reserve"));
  }
  return {
    id,
    name,
    vehicleId,
    ai,
    color: ai ? v.color : "#f1bb73",
    budget: Math.max(0, initialBudget - fee),
    debt: 0,
    parts,
    inventory,
    drivers: DRIVER_PROFILES.map((d) => ({ ...d, energy: 100 })),
    activeDriver: "technical",
    phase: "waiting",
    stageIndex: 0,
    stageKm: 0,
    totalKm: 0,
    speed: 0,
    fuel: 0,
    heat: 25,
    holdUntil: 0,
    service: null,
    stageStart: null,
    finishTime: null,
    prizePaid: false,
    history: [],
    journal: [],
    stageNotes: null,
    plans: STAGES.map(() => null),
    rng: seed >>> 0 || 1,
    ledger: [
      {
        time: -3600,
        amount: -fee,
        label: `Inscripción y vehículo: ${v.short}`,
      },
    ],
    statistics: {
      driving: 0,
      service: 0,
      waiting: 0,
      errors: 0,
      failures: 0,
      fuelUsed: 0,
    },
  };
}
export function createRace({
  vehicleId = "hilux",
  seed = 1729,
  startAt = new Date(Date.now() + 3600000).toISOString(),
  now = Date.now(),
  name = "Tu equipo",
  director = "Director",
  shieldId = 1,
  catalog = CATALOG,
  continuation = false,
  rivalCount = 11,
} = {}) {
  const username = directorName(director);
  if (
    typeof name !== "string" ||
    !name.trim() ||
    name.trim().length > 40 ||
    /[\x00-\x1f\x7f]/.test(name)
  )
    throw Error("Ingresá un nombre de escudería de 1 a 40 caracteres.");
  if (!Number.isInteger(shieldId) || shieldId < 1 || shieldId > 48)
    throw Error("Elegí uno de los 48 escudos disponibles.");
  if (!VEHICLES.some((v) => v.id === vehicleId))
    throw new Error("Vehículo desconocido.");
  const entry = catalog.vehicles.find((v) => v.id === vehicleId);
  if (
    !continuation &&
    (!entry?.available ||
      entry.stock < 1 ||
      entry.price >
        catalog.settings.find((x) => x.key === "startingBudget").value - 1500)
  )
    throw new Error("Vehículo sin stock para una nueva inscripción.");
  const start = Date.parse(startAt);
  if (!Number.isFinite(start) || !Number.isFinite(now))
    throw new Error("Horario de largada inválido.");
  if (start < now - 30 * 86400000 || start > now + 365 * 86400000)
    throw new Error(
      "Elegí una largada entre 30 días atrás y un año hacia adelante.",
    );
  const state = {
    format: "apex-rally",
    version: 3,
    engineVersion: ENGINE_VERSION,
    mode: "single",
    id: `andes-${seed}-${start}`,
    seed: seed >>> 0,
    startAt: new Date(start).toISOString(),
    clock: Math.min(0, Math.floor((now - start) / STEP / 1000) * STEP),
    remainder: 0,
    wallAt: now,
    speed: 0,
    eventCounter: 0,
    itemCounter: 0,
    events: [],
    teams: [
      newTeam(
        "player",
        String(name).slice(0, 40) || "Tu equipo",
        vehicleId,
        seed,
        false,
        catalog,
      ),
    ],
  };
  const names = [
    "Cóndor Racing",
    "Ruta Sur",
    "Atacama Works",
    "Horizonte Raid",
    "Pampa Motorsport",
    "Piedra Negra",
    "Nómada Team",
    "Andes Rally",
    "Pacífico Sport",
    "Estepa Racing",
    "Altiplano Crew",
  ];
  names.slice(0, rivalCount).forEach((n, i) => {
    const t = newTeam(
      `rival-${i + 1}`,
      n,
      VEHICLES[i % 4].id,
      seed + 991 * (i + 1),
      true,
      catalog,
    );
    t.aiStyle = i % 3;
    state.teams.push(t);
  });
  for (const t of state.teams.filter((t) => t.ai))
    for (let i = 0; i < STAGES.length; i++) {
      const p = defaultPlan(i);
      Object.assign(p, recommendedSetup(STAGES[i]), {
        pace:
          t.aiStyle === 0
            ? "conserve"
            : t.aiStyle === 1
              ? "balanced"
              : "attack",
        boost: t.aiStyle === 2 ? 1 : 0,
        rest: t.aiStyle === 2 ? 2 : "full",
        fuelTarget: vehicle(t.vehicleId).tank,
      });
      t.plans[i] = p;
    }
  log(
    state,
    state.teams[0],
    "system",
    "Inscripción completa. Guardá el plan de la primera etapa antes de la largada.",
  );
  initializeManagement(state, { catalog });
  getPlayer(state).directorName = username;
  getPlayer(state).name = name.trim();
  chooseShield(state, shieldId);
  initializeWorkshop(state);
  migrateVehicleBalance(state);
  for (const t of state.teams)
    for (const entry of t.ledger)
      if (entry.at === undefined)
        entry.at = Date.parse(state.startAt) + state.clock * 1000;
  if (catalog.schemaVersion === 2) {
    initializeCompetition(state);
    initializeEmployment(state);
  }
  if (now > start) advance(state, (now - start) / 1000);
  return state;
}
export function getPlayer(state) {
  return state.teams.find((t) => t.id === "player");
}
export function normalizePlan(raw = {}, team) {
  const s = defaultPlan(),
    v = vehicle(team.vehicleId);
  if (!team.drivers.length)
    throw Error("Contratá un piloto para preparar una etapa.");
  s.driverId = team.drivers[0].id;
  for (const [key, allowed] of Object.entries({
    driverId: team.drivers.map((d) => d.id),
    pace: Object.keys(PACES),
    ride: ["low", "balanced", "high"],
    pressure: ["firm", "mixed", "soft"],
    gearing: ["long", "mixed", "short"],
    cooling: ["closed", "balanced", "open"],
  }))
    if (allowed.includes(raw[key])) s[key] = raw[key];
  s.boost = clamp(Math.round(Number(raw.boost) || 0), 0, 2);
  s.fuelTarget = clamp(Number(raw.fuelTarget) || 0, 0, v.tank);
  s.rest = raw.rest === "full" ? "full" : clamp(Number(raw.rest) || 0, 0, 12);
  s.auto = raw.auto !== false;
  for (const p of PART_TYPES) {
    s.actions[p.id] = ["none", "repair", "replace"].includes(
      raw.actions?.[p.id],
    )
      ? raw.actions[p.id]
      : "none";
    if (typeof raw.replacements?.[p.id] === "string")
      s.replacements[p.id] = raw.replacements[p.id];
  }
  if (team.routeId?.startsWith("sprint-")) {
    s.actions = Object.fromEntries(PART_TYPES.map((p) => [p.id, "none"]));
    s.replacements = {};
    s.rest = 0;
  }
  return s;
}
export function savePlan(state, stageIndex, raw) {
  const { stages: STAGES, totalKm: TOTAL_KM } = routeFor(state);
  const t = getPlayer(state);
  if (
    !Number.isInteger(stageIndex) ||
    stageIndex < t.stageIndex ||
    stageIndex >= STAGES.length
  )
    throw new Error("Esa etapa ya terminó o no existe.");
  if (
    stageIndex === t.stageIndex &&
    ["racing", "service", "finished"].includes(t.phase)
  )
    throw new Error("La etapa ya está en marcha. Editá una etapa futura.");
  const p = normalizePlan(raw, t);
  for (const type of PART_TYPES) {
    if (p.actions[type.id] === "replace" && jobFor(t, p.replacements[type.id]))
      throw Error(
        "El repuesto elegido está en el taller. Esperá a que termine o cancelá su trabajo.",
      );
    if (
      p.actions[type.id] === "replace" &&
      !t.inventory.some(
        (i) => i.id === p.replacements[type.id] && i.type === type.id,
      ) &&
      t.parts[type.id].id !== p.replacements[type.id]
    )
      throw new Error(
        `Elegí un repuesto disponible para ${type.name.toLowerCase()}.`,
      );
  }
  t.plans[stageIndex] = p;
  if (state.competition && currentEvent(state)?.kind === "short") {
    const r = state.competition.registrations.find(
      (r) => r.eventId === state.competition.currentId,
    );
    if (r && state.clock < 0) r.driverId = p.driverId;
  }
  log(
    state,
    t,
    "plan",
    `Plan guardado para E${stageIndex + 1}: ${STAGES[stageIndex].to.name}.`,
  );
  return p;
}
export function buyPart(state, type, grade, condition = 100) {
  const t = getPlayer(state);
  if (t.inventory.length >= 500)
    throw new Error("El lote alcanzó el máximo de 500 repuestos.");

  if (
    !PART_TYPES.some((p) => p.id === type) ||
    !["endurance", "standard", "racing"].includes(grade) ||
    ![50, 75, 100].includes(condition)
  )
    throw new Error("Oferta inválida.");
  const offer = state.management?.catalog.parts.find(
    (x) => x.type === type && x.grade === grade && x.condition === condition,
  );
  if (
    state.management &&
    (!offer?.available || state.management.stocks[offer.id] < 1)
  )
    throw new Error("Repuesto sin stock.");
  const price = offer?.price ?? priceFor(type, grade, condition);
  if (price > t.budget)
    throw new Error("El presupuesto no alcanza para esta pieza.");
  const next = item(
    `player-shop-${++state.itemCounter}`,
    type,
    grade,
    condition,
  );
  if (offer) state.management.stocks[offer.id]--;
  t.inventory.push(next);
  transact(
    state,
    t,
    -price,
    `Compra: ${partType(type).name} ${GRADES[grade].name} ${condition}%`,
  );
  log(
    state,
    t,
    "purchase",
    `Compraste ${partType(type).name.toLowerCase()} ${GRADES[grade].name}, estado ${condition}%.`,
  );
  return next;
}
export function estimateService(team, raw, stageIndex = team.stageIndex) {
  const plan = normalizePlan(raw, team),
    driver = driverFor(team, plan.driverId);
  let cost = 0,
    workHours = 0;
  const lines = [];
  for (const type of PART_TYPES) {
    const current = team.parts[type.id],
      action = plan.actions[type.id];
    if (action === "repair") {
      const q = repairQuote(current);
      cost += q.cost;
      workHours += q.hours;
      lines.push({ type: type.id, action, ...q });
    } else if (action === "replace") {
      const replacement = team.inventory.find(
        (i) =>
          i.id === plan.replacements[type.id] &&
          i.type === type.id &&
          !jobFor(team, i.id),
      );
      if (replacement) {
        cost += 80;
        workHours += type.hours * 0.24;
        lines.push({
          type: type.id,
          action,
          cost: 80,
          hours: type.hours * 0.24,
          replacement,
        });
      }
    }
  }
  const litres = Math.max(0, plan.fuelTarget - team.fuel);
  const fuelCost = Math.ceil(litres * FUEL_PRICE);
  cost += fuelCost;
  workHours += litres * 0.0015;
  const fullRest = Math.max(0, (100 - driver.energy) / driver.recovery),
    restHours = Math.min(plan.rest === "full" ? fullRest : plan.rest, fullRest);
  workHours /= workshopRate(team);
  const serviceHours = Math.max(workHours, restHours);
  return {
    cost,
    workHours,
    restHours,
    fullRest,
    serviceHours: stageIndex === 0 ? 0 : serviceHours,
    litres,
    fuelCost,
    lines,
    plan,
  };
}
function swap(team, type, id) {
  if (team.parts[type].id === id) return true;
  if (jobFor(team, id)) return false;
  const at = team.inventory.findIndex((p) => p.id === id && p.type === type);
  if (at < 0) return false;
  const next = team.inventory[at];
  team.inventory.splice(at, 1, team.parts[type]);
  team.parts[type] = next;
  return true;
}
function beginService(state, t) {
  const { stages: STAGES, totalKm: TOTAL_KM } = routeFor(t);
  const plan = t.plans[t.stageIndex];
  if (!plan) return;
  const q = estimateService(t, plan),
    stage = STAGES[t.stageIndex];
  const tasks = [];
  let hours = 0,
    assistanceHours = 0;
  for (const line of q.lines) {
    if (line.cost <= t.budget) {
      if (line.action === "repair") {
        transact(
          state,
          t,
          -line.cost,
          `E${t.stageIndex + 1} reparación ${partType(line.type).name}`,
        );
        repairPiece(t.parts[line.type]);
      } else {
        swap(t, line.type, line.replacement.id);
        transact(
          state,
          t,
          -line.cost,
          `E${t.stageIndex + 1} cambio ${partType(line.type).name}`,
        );
      }
      hours += line.hours;
      tasks.push({
        kind: line.action,
        label: `${line.action === "repair" ? "Reparar" : "Cambiar"} ${partType(line.type).name.toLowerCase()}`,
        hours: line.hours,
        detail: line.hours
          ? "Trabajo programado de los mecánicos de carrera."
          : "La pieza no necesita reparación.",
      });
    } else {
      tasks.push({
        kind: line.action,
        label: `${line.action === "repair" ? "Reparar" : "Cambiar"} ${partType(line.type).name.toLowerCase()}`,
        hours: 0,
        skipped: true,
        detail:
          "Omitido: presupuesto insuficiente. Se conserva el estado de la pieza.",
      });
      log(
        state,
        t,
        "budget",
        `Sin presupuesto para ${partType(line.type).name.toLowerCase()}: se conserva su estado.`,
      );
    }
  }
  // Una reserva por tipo permite continuar sin convertir una avería en eliminación permanente.
  for (const p of PART_TYPES)
    if (t.parts[p.id].broken) {
      const spare = t.inventory.find(
        (i) => i.type === p.id && i.grade === "reserve" && !jobFor(t, i.id),
      );
      if (spare) {
        swap(t, p.id, spare.id);
        hours += p.hours * 0.24;
        tasks.push({
          kind: "reserve",
          label: `Montar reserva de ${p.name.toLowerCase()}`,
          hours: p.hours * 0.24,
          detail: "Pieza de emergencia irrompible para poder continuar.",
        });
        log(
          state,
          t,
          "reserve",
          `Montaje de emergencia: ${p.name.toLowerCase()} de reserva.`,
        );
      }
    }
  const litres = Math.max(0, plan.fuelTarget - t.fuel),
    fuelCost = Math.ceil(litres * FUEL_PRICE);
  const paid = Math.min(t.budget, fuelCost);
  if (paid > 0)
    transact(
      state,
      t,
      -paid,
      `E${t.stageIndex + 1} combustible ${litres.toFixed(0)} L`,
    );
  if (fuelCost > paid) {
    const debt = Math.ceil((fuelCost - paid) * 1.4);
    t.debt += debt;
    assistanceHours += 4;
    log(
      state,
      t,
      "assistance",
      `Asistencia de combustible: +4 h y ${debt} créditos a descontar del premio.`,
    );
  }
  t.fuel += litres;
  hours += litres * 0.0015;
  tasks.push({
    kind: "fuel",
    label: "Carga de combustible",
    hours: litres * 0.0015,
    detail: litres
      ? `${Math.round(litres)} L programados para la próxima etapa.`
      : "El tanque ya alcanza el objetivo elegido.",
  });
  if (assistanceHours)
    tasks.push({
      kind: "assistance",
      label: "Asistencia de combustible",
      hours: assistanceHours,
      detail: "Presupuesto insuficiente: recargo y 4 horas adicionales.",
    });
  hours = Math.max(hours / workshopRate(t) + assistanceHours, q.restHours);
  t.activeDriver = plan.driverId;
  t.activePlan = structuredClone(plan);
  t.speed = 0;
  t.phase = "service";
  t.service = {
    until:
      state.clock +
      (t.stageIndex === 0
        ? fuelCost > paid
          ? 4 * 3600
          : 0
        : Math.max(60, hours * 3600)),
    start: state.clock,
    workHours: hours,
    restHours: q.restHours,
  };
  Object.assign(
    t.service,
    serviceTimeline(tasks, {
      rate: workshopRate(t),
      restHours: q.restHours,
      first: t.stageIndex === 0,
      seconds: t.service.until - t.service.start,
    }),
  );
  if (t.stageIndex === 0) {
    t.heat = stage.temp;
    if (!state.competition) t.drivers.forEach((d) => (d.energy = 100));
  }
  log(
    state,
    t,
    "service",
    t.stageIndex === 0
      ? "Preparación previa completada. Listo para la largada."
      : `Asistencia de E${t.stageIndex + 1}: ${hours.toFixed(1)} h. Reparación y descanso en paralelo.`,
  );
}
function startStage(state, t) {
  const { stages: STAGES, totalKm: TOTAL_KM } = routeFor(t);
  t.phase = "racing";
  t.service = null;
  t.stageStart = state.clock;
  if (state.mode === "online") {
    const d = driverFor(t);
    t.stageStaff = { driverId: d.id, form: d.form, morale: d.morale };
  }
  t.stageKm = 0;
  t.holdUntil = 0;
  startJournal(t, STAGES[t.stageIndex], state.clock);
  log(
    state,
    t,
    "departure",
    `Sale a E${t.stageIndex + 1}: ${STAGES[t.stageIndex].from.name} → ${STAGES[t.stageIndex].to.name}.`,
  );
}
export function performance(
  team,
  stage = routeFor(team).stages[team.stageIndex],
  plan = team.activePlan || team.plans[team.stageIndex] || defaultPlan(),
  km = team.stageKm,
  rhythmSeconds = team.statistics?.driving || 0,
) {
  const v = vehicle(team.vehicleId),
    terrain = TERRAINS[segmentAt(stage, km).type],
    terrainId = segmentAt(stage, km).type,
    liveDriver = driverFor(team, plan.driverId),
    d =
      team.stageStaff?.driverId === liveDriver.id
        ? {
            ...liveDriver,
            form: team.stageStaff.form,
            morale: team.stageStaff.morale,
          }
        : liveDriver,
    staff = staffFactors(team, d, terrainId),
    pace = PACES[plan.pace],
    carFactors = vehicleFactors(team),
    attributes = statFactors(teamVehicleStats(team), terrainId),
    p = Object.fromEntries(
      PART_TYPES.map((t) => [t.id, partEffect(team.parts[t.id]) * d.parts]),
    );
  const partFactors = terrainPartFactors(p, terrainId),
    effect = partFactors.speed;
  const ride =
    terrainId === "asphalt"
      ? plan.ride === "low"
        ? 1.035
        : plan.ride === "high"
          ? 0.94
          : 1
      : ["rock", "sand"].includes(terrainId)
        ? plan.ride === "high"
          ? 1.075
          : plan.ride === "low"
            ? 0.85
            : 1
        : 1;
  const pressure =
    terrainId === "sand"
      ? plan.pressure === "soft"
        ? 1.12
        : plan.pressure === "firm"
          ? 0.87
          : 1
      : terrainId === "asphalt"
        ? plan.pressure === "firm"
          ? 1.04
          : plan.pressure === "soft"
            ? 0.92
            : 1
        : plan.pressure === "mixed"
          ? 1.025
          : 1;
  const gearing =
    terrainId === "asphalt"
      ? plan.gearing === "long"
        ? 1.06
        : plan.gearing === "short"
          ? 0.93
          : 1
      : ["rock", "mountain", "sand"].includes(terrainId)
        ? plan.gearing === "short"
          ? 1.06
          : plan.gearing === "long"
            ? 0.9
            : 1
        : 1;
  const altitude = 1 - Math.max(0, stage.altitude - 1500) * 0.000021,
    energy = 0.77 + (0.23 * d.energy) / 100,
    massFactor = 1 - team.fuel * 0.000045,
    boost = 1 + plan.boost * 0.065,
    coolingDrag =
      plan.cooling === "open" ? 0.965 : plan.cooling === "closed" ? 1.018 : 1;
  const broken = Object.values(team.parts).some((p) => p.broken),
    hot = team.heat > 122 ? 0.75 : team.heat > 112 ? 0.91 : 1;
  const speed = broken
    ? 30
    : clamp(
        terrain.speed *
          attributes.speed *
          v.terrain[terrainId] *
          effect *
          ride *
          pressure *
          gearing *
          altitude *
          energy *
          massFactor *
          boost *
          pace.speed *
          d.speed *
          driverRhythm(team, d, rhythmSeconds) *
          staff.speed *
          carFactors.speed *
          coolingDrag *
          hot,
        30,
        terrain.cap,
      );
  const wear =
    ((terrain.wear *
      pace.wear *
      (1 + plan.boost * 0.45) *
      d.wear *
      (1 + Math.max(0, team.heat - 105) * 0.013)) /
      v.reliability) *
    attributes.wear;
  const fuelPer100 =
    ((38 * terrain.fuel * pace.fuel * (1 + plan.boost * 0.14)) / v.efficiency) *
    (1 + team.fuel * 0.00008) *
    (broken ? 1.15 : 1) *
    attributes.fuel;
  const thermalLoad = PART_TYPES.reduce(
    (sum, type) =>
      sum +
      GRADES[team.parts[type.id].grade].heat *
        {
          engine: 0.5,
          transmission: 0.15,
          suspension: 0.04,
          tyres: 0.06,
          cooling: 0.15,
          brakes: 0.1,
        }[type.id],
    0,
  );
  const heatTarget =
    76 +
    stage.temp * 0.57 +
    (terrainId === "sand" ? 10 : 0) +
    plan.boost * 13 +
    (plan.pace === "attack" ? 7 : 0) +
    (plan.cooling === "closed" ? 12 : plan.cooling === "open" ? -14 : 0) +
    (1 - p.cooling / GRADES[team.parts.cooling.grade].heat) * 38 +
    (thermalLoad - 1) * 35 -
    staff.cooling;
  const risk =
    0.019 *
    terrain.risk *
    pace.risk *
    d.risk *
    (1 + (100 - d.energy) / 40) *
    (1 + plan.boost * 0.25) *
    attributes.risk *
    staff.risk *
    partFactors.risk;
  return {
    speed,
    wear,
    fuelPer100,
    heatTarget,
    risk,
    terrainId,
    driver: d,
    pace,
    broken,
  };
}
export function estimateStage(team, stage, raw) {
  const plan = normalizePlan(raw, team),
    forecast = structuredClone(team),
    quote = estimateService(team, plan, stage.index);
  for (const line of quote.lines)
    if (line.cost <= forecast.budget) {
      forecast.budget -= line.cost;
      if (line.action === "repair") {
        repairPiece(forecast.parts[line.type]);
      } else swap(forecast, line.type, line.replacement.id);
    }
  for (const type of PART_TYPES)
    if (forecast.parts[type.id].broken) {
      const spare = forecast.inventory.find(
        (i) => i.type === type.id && i.grade === "reserve",
      );
      if (spare) swap(forecast, type.id, spare.id);
    }
  forecast.fuel = Math.max(team.fuel, plan.fuelTarget);
  forecast.heat = stage.temp;
  for (const d of forecast.drivers)
    d.energy =
      stage.index === 0
        ? 100
        : clamp(d.energy + quote.serviceHours * d.recovery, 0, 100);
  let hours = 0,
    fuel = 0;
  for (const seg of stage.segments) {
    const p = performance(forecast, stage, plan, seg.start + 0.01, null);
    hours += seg.km / p.speed;
    fuel += (seg.km * p.fuelPer100) / 100;
  }
  return {
    hours,
    fuel,
    fuelWithMargin: Math.ceil(fuel * 1.1 + 12),
    tank: vehicle(team.vehicleId).tank,
  };
}
function fatigue(t, dt, racing = false, effort = 1) {
  for (const d of t.drivers) {
    if (racing && d.id === t.activeDriver)
      d.energy = clamp(
        d.energy -
          (dt / 3600) *
            3 *
            d.fatigue *
            (1 +
              (100 -
                (t.stageStaff?.driverId === d.id
                  ? t.stageStaff.form
                  : (d.form ?? 100))) /
                250) *
            effort *
            statFactors(teamVehicleStats(t), "gravel").fatigue,
        0,
        100,
      );
    else
      d.energy = clamp(
        d.energy + (dt / 3600) * d.recovery * (racing ? 0.1 : 1),
        0,
        100,
      );
  }
}
function finishStage(state, t, time) {
  const { stages: STAGES, totalKm: TOTAL_KM } = routeFor(t);
  const s = STAGES[t.stageIndex];
  delete t.stageStaff;
  finishJournal(t, s, time);
  t.history.push({
    stage: t.stageIndex,
    start: t.stageStart,
    arrival: time,
    duration: time - t.stageStart,
    fuel: t.fuel,
    budget: t.budget,
    energy: driverFor(t).energy,
    condition: Object.fromEntries(
      PART_TYPES.map((p) => [p.id, t.parts[p.id].condition]),
    ),
  });
  t.totalKm = s.endKm;
  t.stageKm = 0;
  t.speed = 0;
  log(state, t, "arrival", `Completa E${t.stageIndex + 1} en ${s.to.name}.`);
  t.stageIndex++;
  if (t.stageIndex >= STAGES.length) {
    t.phase = "finished";
    t.finishTime = time;
    t.totalKm = TOTAL_KM;
    log(state, t, "finish", `¡Llegó a ${s.to.name}! Carrera completa.`);
  } else {
    t.phase = "camp";
    t.service = null;
    t.activePlan = null;
    if (!t.plans[t.stageIndex] && t.id === "player")
      log(
        state,
        t,
        "attention",
        `Guardá el plan de E${t.stageIndex + 1} para continuar. El reloj y los rivales siguen avanzando.`,
      );
  }
}
export function advanceTeam(state, t, dt) {
  const { stages: STAGES, totalKm: TOTAL_KM } = routeFor(t);
  if (
    state.competition &&
    (!t.participating ||
      state.competition.closed ||
      ["finished", "cutoff"].includes(t.phase))
  ) {
    fatigue(t, dt);
    return;
  }
  if (t.phase === "finished") return;
  if (state.clock < 0) {
    fatigue(t, dt);
    return;
  }
  if (t.phase === "waiting") t.phase = "camp";
  if (t.phase === "camp") {
    t.speed = 0;
    if (raceWorkPending(t) || crewRate(t, "race") === 0) {
      fatigue(t, dt);
      t.statistics.waiting += dt;
      return;
    }
    if (currentEvent(state)?.kind === "short") {
      if (!t.plans[0])
        t.plans[0] = {
          ...defaultPlan(0),
          ...recommendedSetup(STAGES[0]),
          driverId: t.activeDriver,
          fuelTarget: vehicle(t.vehicleId).tank,
        };
      const plan = normalizePlan(t.plans[0], t);
      plan.actions = Object.fromEntries(PART_TYPES.map((p) => [p.id, "none"]));
      plan.replacements = {};
      plan.rest = 0;
      t.activePlan = plan;
      t.activeDriver = plan.driverId;
      const litres = Math.max(0, plan.fuelTarget - t.fuel),
        cost = Math.ceil(litres * FUEL_PRICE),
        paid = Math.min(cost, t.budget);
      transact(state, t, -paid, "Combustible previo al sprint");
      t.debt += cost - paid;
      t.fuel += litres;
      startStage(state, t);
    } else if (t.plans[t.stageIndex]?.auto) beginService(state, t);
    else {
      fatigue(t, dt);
      t.heat += (STAGES[t.stageIndex].temp - t.heat) * Math.min(1, dt / 3600);
      t.statistics.waiting += dt;
      return;
    }
  }
  if (t.phase === "service") {
    if (state.clock >= t.service.until) startStage(state, t);
    else {
      fatigue(t, dt);
      t.heat += (STAGES[t.stageIndex].temp - t.heat) * Math.min(1, dt / 2400);
      t.statistics.service += dt;
      return;
    }
  }
  if (t.phase !== "racing") return;
  if (!t.stageNotes) startJournal(t, STAGES[t.stageIndex], state.clock);
  if (state.clock < t.holdUntil) {
    t.speed = 0;
    fatigue(t, dt, true, 0);
    t.heat += (70 - t.heat) * Math.min(1, dt / 3600);
    t.statistics.waiting += dt;
    return;
  }
  const stage = STAGES[t.stageIndex],
    p = performance(t, stage),
    wasHot = t.heat > 112 && !p.broken,
    driveDt = Math.min(dt, ((stage.km - t.stageKm) / p.speed) * 3600),
    distance = (p.speed * driveDt) / 3600;
  if (t.fuel < (distance * p.fuelPer100) / 100) {
    if (currentEvent(state)?.kind === "short") {
      t.speed = 0;
      t.statistics.waiting += dt;
      return;
    }
    const litres = Math.min(
        vehicle(t.vehicleId).tank,
        Math.ceil(((stage.km - t.stageKm) * p.fuelPer100) / 100 + 20),
      ),
      cost = Math.ceil(litres * FUEL_PRICE * 1.4),
      paid = Math.min(cost, t.budget);
    if (paid) transact(state, t, -paid, "Rescate y combustible en ruta");
    t.debt += cost - paid;
    t.fuel = litres;
    t.holdUntil = state.clock + 4 * 3600;
    t.speed = 0;
    noteIncident(t, "fuel");
    log(
      state,
      t,
      "assistance",
      "Sin combustible: asistencia en ruta, +4 h y recargo del 40%.",
    );
    return;
  }
  t.speed = p.speed;
  t.stageKm = Math.min(stage.km, t.stageKm + distance);
  t.totalKm = stage.startKm + t.stageKm;
  const fuel = (distance * p.fuelPer100) / 100;
  t.fuel = Math.max(0, t.fuel - fuel);
  t.statistics.fuelUsed += fuel;
  t.statistics.driving += driveDt;
  wearVehicle(t, distance, p.wear);
  t.heat += (p.heatTarget - t.heat) * Math.min(1, driveDt / 1200);
  fatigue(
    t,
    driveDt,
    true,
    p.terrainId === "sand" ? 1.2 : p.terrainId === "mountain" ? 1.12 : 1,
  );
  observeJournal(t, stage, {
    terrainId: p.terrainId,
    distance,
    seconds: driveDt,
    wasHot,
  });
  for (const type of PART_TYPES) {
    const piece = t.parts[type.id],
      grade = GRADES[piece.grade];
    const extra =
      type.id === "suspension" && ["rock", "mountain"].includes(p.terrainId)
        ? 1.35
        : type.id === "tyres" &&
            t.activePlan.pressure === "soft" &&
            p.terrainId === "asphalt"
          ? 1.45
          : type.id === "brakes" && p.terrainId === "mountain"
            ? 1.5
            : 1;
    piece.condition = clamp(
      piece.condition -
        ((((type.wear * distance) / 100) * p.wear) / grade.durability) * extra,
      0,
      100,
    );
    if (piece.grade === "reserve") {
      piece.broken = false;
      continue;
    }
    const failure =
      (failureRate(piece, t.heat, t.activePlan.boost) *
        vehicleFactors(t).risk *
        driveDt) /
      3600;
    if (!piece.broken && random(t) < failure && !partProtected(t, type.id)) {
      piece.broken = true;
      piece.condition = Math.min(piece.condition, 5);
      t.statistics.failures++;
      noteIncident(t, "failure", type.id);
      t.speed = 30;
      log(
        state,
        t,
        "failure",
        `${type.name} averiado. Modo de emergencia: 30 km/h hasta el campamento.`,
      );
    }
  }
  if (random(t) < (p.risk * driveDt) / 3600) {
    const navigation = t.activeDriver !== "navigator" && random(t) < 0.45,
      delay = (navigation ? 0.2 : 0.35) + random(t) * 0.5;
    t.holdUntil = state.clock + delay * 3600;
    t.speed = 0;
    t.statistics.errors++;
    noteIncident(t, "error");
    if (!navigation) {
      const car = activeCar(t);
      if (car) car.condition = clamp(car.condition - delay * 2, 0, 100);
      const target = PART_TYPES[Math.floor(random(t) * PART_TYPES.length)].id;
      const piece = t.parts[target];
      piece.condition = clamp(piece.condition - (6 + random(t) * 16), 0, 100);
    }
    log(
      state,
      t,
      navigation ? "navigation" : "incident",
      navigation
        ? `Error de navegación: pierde ${Math.round(delay * 60)} min.`
        : `Salida de pista: pierde ${Math.round(delay * 60)} min y daña una pieza.`,
    );
  }
  if (t.stageKm >= stage.km - 1e-8)
    finishStage(state, t, state.clock + driveDt);
}
function award(state) {
  if (state.competition) return;
  const finishers = state.teams
    .filter((t) => t.finishTime !== null)
    .sort((a, b) => a.finishTime - b.finishTime || a.id.localeCompare(b.id));
  finishers.forEach((t, i) => {
    if (t.prizePaid) return;
    const gross = state.management
        ? Math.round(
            state.management.catalog.prizes[i].race *
              state.management.catalog.races[state.championship.round]
                .prizeFactor,
          )
        : PRIZES[i] || 8000,
      settled = Math.min(gross, t.debt),
      prize = gross - settled;
    t.debt -= settled;
    t.prizePaid = true;
    t.prize = { position: i + 1, gross, settled, net: prize };
    transact(
      state,
      t,
      prize,
      `Premio final P${i + 1}${settled ? " · asistencia descontada" : ""}`,
    );
    log(
      state,
      t,
      "prize",
      `Premio de llegada P${i + 1}: ${prize.toLocaleString("es-AR")} créditos netos.`,
    );
  });
}
export function advance(
  state,
  seconds,
  {
    stopAtPlayerCamp = false,
    stopAtAllFinished = false,
    stopAtPayroll = false,
  } = {},
) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("Avance de tiempo inválido.");
  if (state.mode !== "single")
    throw new Error("El reloj online debe avanzar en el servidor.");
  state.remainder += Math.min(seconds, 3600 * 720);
  let remaining = Math.floor(state.remainder / STEP);
  state.remainder -= remaining * STEP;
  let advanced = 0;
  const initialStage = getPlayer(state).stageIndex;
  const payrollTarget = stopAtPayroll
    ? state.employment?.nextPayrollAt
    : Infinity;
  while (remaining-- > 0) {
    if (state.competition) {
      if (state.employment) processContracts(state);
      const now = raceNow(state),
        p = getPlayer(state);
      const ready = state.competition.registrations
        .map((r) => eventById(state, r.eventId))
        .filter(
          (e) =>
            e &&
            e.eventId !== state.competition.currentId &&
            e.start <= now &&
            e.end > now &&
            !state.competition.results.some((r) => r.eventId === e.eventId),
        )
        .sort((a, b) => a.start - b.start)[0];
      if (ready && (!p.participating || state.competition.closed))
        activateEvent(state, ready);
      if (
        state.clock >= 0 &&
        !state.competition.closed &&
        !state.competition.started
      ) {
        state.competition.started = true;
        for (const t of state.teams.filter((t) => t.participating)) {
          const r = state.competition.registrations.find(
            (r) => r.eventId === state.competition.currentId,
          );
          if (t.id === "player" && r) {
            const car = t.garage.find((c) => c.id === r.carId);
            if (
              !car ||
              jobFor(t, r.carId) ||
              !crewRate(t, "race") ||
              !t.drivers.some((d) => d.id === r.driverId)
            ) {
              t.participating = false;
              t.phase = "unregistered";
              continue;
            }
            t.activeCarId = car.id;
            t.vehicleId = car.modelId;
            t.activeDriver = r.driverId;
            if (currentEvent(state)?.kind === "short" && t.plans[0])
              t.plans[0].driverId = r.driverId;
          }
          chargeSalaries(state, t);
          markParticipation(state, t);
        }
      }
      updateRaceClosure(state);
      if (stopAtAllFinished && state.competition.closed) {
        state.remainder = 0;
        break;
      }
      const baseDt =
        state.competition.closed || state.clock < 0
          ? STEP
          : Math.min(STEP, Math.max(0, raceDeadline(state) - state.clock));
      const dt = Math.min(
        baseDt,
        state.employment
          ? Math.max(
              0,
              (state.employment.nextPayrollAt - raceNow(state)) / 1000,
            )
          : STEP,
      );
      if (dt === 0) {
        updateRaceClosure(state);
        continue;
      }
      for (const t of state.teams) advanceTeam(state, t, dt);
      advanceWorkshops(state, dt);
      state.clock += dt;
      advanceProgression(state);
      if (state.employment) advanceEmployment(state);
      advanced += dt;
      settleAuctions(state);
      updateRaceClosure(state);
      if (stopAtPayroll && raceNow(state) >= payrollTarget) {
        state.remainder = 0;
        break;
      }
      if (
        stopAtPlayerCamp &&
        (getPlayer(state).stageIndex > initialStage || state.competition.closed)
      ) {
        state.remainder = 0;
        break;
      }
      // A deadline may split a tick. Retain its unused seconds instead of losing game time.
      state.remainder += STEP - dt;
      const carried = Math.floor(state.remainder / STEP);
      remaining += carried;
      state.remainder -= carried * STEP;
      continue;
    }
    if (
      state.teams.every((t) => t.phase === "finished") &&
      (stopAtAllFinished ||
        !state.management.auctions.some((a) => a.status === "open"))
    ) {
      if (!stopAtAllFinished) {
        advanceWorkshops(state, remaining * STEP + STEP);
        state.clock += remaining * STEP + STEP;
        advanced += remaining * STEP + STEP;
        if (state.employment) advanceEmployment(state);
      }
      settleAuctions(state);
      recordRound(state);
      state.remainder = 0;
      break;
    }
    for (const t of state.teams) advanceTeam(state, t, STEP);
    advanceWorkshops(state, STEP);
    award(state);
    state.clock += STEP;
    if (state.employment) advanceEmployment(state);
    settleAuctions(state);
    recordRound(state);
    advanced += STEP;
    if (stopAtPlayerCamp && getPlayer(state).stageIndex > initialStage) {
      state.remainder = 0;
      break;
    }
  }
  return {
    advanced,
    playerStopped: getPlayer(state).stageIndex > initialStage,
  };
}
export function nextPlayerCamp(state) {
  const player = getPlayer(state);
  if (["finished", "cutoff", "unregistered"].includes(player.phase))
    return { advanced: 0 };
  if (
    ["waiting", "camp"].includes(player.phase) &&
    crewRate(player, "race") === 0
  )
    throw Error("Contratá al menos un mecánico para iniciar la próxima etapa.");
  if (raceWorkPending(player) && crewRate(player, "workshop") === 0)
    throw Error(
      "El auto de carrera está en el taller sin mecánicos. Asigná personal o cancelá su trabajo.",
    );
  if (
    ["waiting", "camp"].includes(player.phase) &&
    !player.plans[player.stageIndex]
  )
    throw new Error("Guardá el plan de tu próxima etapa.");
  return advance(state, 3600 * 100, { stopAtPlayerCamp: true });
}
export function standings(state) {
  return [...state.teams]
    .filter((t) => !state.competition || t.participating)
    .sort((a, b) =>
      a.finishTime !== null && b.finishTime !== null
        ? a.finishTime - b.finishTime || a.id.localeCompare(b.id)
        : a.finishTime !== null
          ? -1
          : b.finishTime !== null
            ? 1
            : b.totalKm - a.totalKm ||
              (a.history.at(-1)?.arrival ?? Infinity) -
                (b.history.at(-1)?.arrival ?? Infinity),
    );
}
export function publicSnapshot(state) {
  return {
    raceId: state.id,
    engineVersion: state.engineVersion,
    startAt: state.startAt,
    gameAt: new Date(
      Date.parse(state.startAt) + state.clock * 1000,
    ).toISOString(),
    elapsedSeconds: state.clock,
    routeKm: routeFor(state).totalKm,
    entries: standings(state).map((t, i) => ({
      entryId: t.id,
      name: t.name,
      directorName: t.directorName,
      shieldId: t.shieldId,
      shieldCollection: t.shieldCollection,
      vehicleId: t.vehicleId,
      vehicleStats: { ...teamVehicleStats(t) },
      level: teamLevel(t).level,
      rank: i + 1,
      phase: t.phase,
      stageIndex: t.stageIndex,
      totalKm: t.totalKm,
      stageKm: t.stageKm,
      speedKmh: t.speed,
      finishTime: t.finishTime,
      position: locationAt(t.totalKm, t),
      updatedAt: new Date(
        Date.parse(state.startAt) + state.clock * 1000,
      ).toISOString(),
    })),
  };
}
export function dispatch(state, command) {
  if (!command || typeof command.type !== "string")
    throw new Error("Comando inválido.");
  switch (command.type) {
    case "rename-identity":
      return renameIdentity(state, command.name, command.director);
    case "choose-shield":
      return chooseShield(state, command.shieldId);
    case "next-payroll": {
      if (!state.employment)
        throw Error("La partida todavía usa sueldos por carrera.");
      const target = state.employment.nextPayrollAt;
      while (raceNow(state) < target) {
        const used = Math.max(
          STEP,
          Math.min((target - raceNow(state)) / 1000, 720 * 3600),
        );
        advance(state, used, { stopAtPayroll: true });
      }
      state.speed = 0;
      return state;
    }
    case "enroll":
      return enroll(state, command.eventId, command.driverId);
    case "cancel-enrollment":
      return cancelEnrollment(state, command.eventId);
    case "next-event":
      return nextScheduledRace(state);
    case "renew-contract":
      return renewContract(state, command.kind, command.id);
    case "bid":
      return bid(state, command.kind, command.personId, command.salary);
    case "cancel-bid":
      return cancelBid(state, command.id);
    case "release":
      return releasePerson(state, command.kind, command.id);
    case "buy-vehicle":
      return buyVehicle(state, command.id);
    case "save-plan":
      return savePlan(state, command.stageIndex, command.plan);
    case "sell-part":
      return sellPart(state, command.id);
    case "buy-part":
      return buyPart(state, command.partType, command.grade, command.condition);
    case "advance":
      return advance(state, command.seconds, {
        stopAtAllFinished: command.stopAtAllFinished === true,
      });
    case "next-camp":
      return nextPlayerCamp(state);
    default:
      throw new Error("Comando desconocido.");
  }
}

export function nextChampionshipRace(state) {
  if (state.competition) return nextScheduledRace(state);
  recordRound(state);
  const c = state.championship;
  if (!state.teams.every((t) => t.phase === "finished"))
    throw Error(
      "Esperá que todos los equipos terminen para cerrar la clasificación.",
    );
  if (c.round >= 7) throw Error("Completaste las ocho carreras.");
  const round = c.round + 1,
    spec = state.management.catalog.races[round],
    startAt = new Date(
      Date.parse(c.startAt) + spec.startDay * 86400000,
    ).toISOString();
  const now = Date.parse(state.startAt) + state.clock * 1000;
  const fresh = createRace({
    vehicleId: getPlayer(state).vehicleId,
    seed: state.seed + round * 1009,
    startAt,
    now: Date.parse(startAt) - 3600000,
    name: getPlayer(state).name,
    catalog: state.management.catalog,
    continuation: true,
  });
  fresh.management = structuredClone(state.management);
  fresh.championship = structuredClone(c);
  fresh.championship.round = round;
  fresh.routeId = spec.id;
  fresh.itemCounter = state.itemCounter;
  fresh.id = `${spec.id}-${fresh.seed}-${Date.parse(startAt)}`;
  for (const t of fresh.teams) {
    const previous = state.teams.find((x) => x.id === t.id);
    for (const key of [
      "budget",
      "initialBudget",
      "debt",
      "parts",
      "inventory",
      "drivers",
      "mechanics",
      "garage",
      "workshop",
      "activeCarId",
      "shieldId",
      "shieldCollection",
      "directorName",
      "legacyShieldId",
      "vehicleId",
      "name",
    ])
      t[key] = structuredClone(previous[key]);
    t.routeId = spec.id;
    t.ledger = structuredClone(previous.ledger);
    t.activeDriver = t.drivers[0].id;
    t.drivers.forEach((d) => (d.energy = 100));
    chargeSalaries(fresh, t);
    t.plans = routeFor(t).stages.map((s, i) =>
      t.ai
        ? {
            ...defaultPlan(i),
            ...recommendedSetup(s),
            driverId: t.drivers[i % t.drivers.length].id,
            fuelTarget: vehicle(t.vehicleId).tank,
          }
        : null,
    );
  }
  fresh.clock = Math.min(
    0,
    Math.floor((now - Date.parse(startAt)) / 30000) * 30,
  );
  if (now > Date.parse(startAt))
    advance(fresh, (now - Date.parse(startAt)) / 1000);
  return fresh;
}

// A race closes once, independent of the slowest entrant. No championship points.
export function updateRaceClosure(state) {
  const c = state.competition;
  if (!c || c.closed) return;
  const participants = state.teams.filter((t) => t.participating);
  const times = participants
    .filter((t) => t.finishTime !== null)
    .map((t) => t.finishTime);
  if (times.length) c.firstFinishAt = Math.min(...times);
  const deadline = raceDeadline(state);
  if (
    state.clock < deadline &&
    !participants.every((t) => t.phase === "finished")
  )
    return;
  if (state.clock < 0) return;
  const e = currentEvent(state),
    order = standings(state);
  c.closed = true;
  c.closedAt = raceNow(state);
  const entries = order.map((t, i) => {
    if (t.phase !== "finished") {
      if (t.stageNotes)
        finishJournal(t, routeFor(t).stages[t.stageIndex], state.clock, false);
      t.phase = "cutoff";
      t.speed = 0;
      t.service = null;
    }
    if (!t.prizePaid) {
      const row = state.management.catalog.prizes[i];
      const gross = Math.round(
          (e.kind === "short" ? (row.short ?? 4200) : row.race) * e.prizeFactor,
        ),
        settled = Math.min(gross, t.debt);
      t.debt -= settled;
      t.prizePaid = true;
      t.prize = { position: i + 1, gross, settled, net: gross - settled };
      transact(state, t, gross - settled, `Premio de carrera P${i + 1}`);
    }
    return {
      id: t.id,
      position: i + 1,
      time: t.finishTime,
      finished: t.finishTime !== null,
      km: t.totalKm,
      prize: t.prize.net,
      stages: t.history.length,
    };
  });
  const result = {
    eventId: c.currentId,
    routeId: state.routeId,
    closedAt: c.closedAt,
    reason:
      state.clock >= e.maxHours * 3600
        ? "maximum"
        : state.clock >= deadline
          ? "first-finisher"
          : "all-finished",
    entries,
  };
  c.results.push(result);
  for (const entry of entries)
    awardProgression(
      state,
      state.teams.find((t) => t.id === entry.id),
      e,
      entry,
      routeFor(state).totalKm,
    );
  state.championship.results.push(result);
  if (state.employment) processContracts(state);
  log(
    state,
    getPlayer(state),
    "closure",
    `Carrera cerrada. ${result.reason === "maximum" ? "Venció el tiempo máximo." : "Clasificación definitiva."} Quienes no llegaron se ordenan por distancia.`,
  );
}
export function activateEvent(state, e) {
  const now = raceNow(state),
    c = state.competition;
  if (!e || !eventById(state, e.eventId)) throw Error("Carrera desconocida.");
  const p = getPlayer(state);
  if (p.participating && !c.closed && state.clock >= 0)
    throw Error("Tu carrera todavía está en curso.");
  state.startAt = new Date(e.start).toISOString();
  state.clock = (now - e.start) / 1000;
  state.routeId = e.id;
  state.id = e.eventId;
  state.events = [];
  state.eventCounter = 0;
  state.remainder = 0;
  c.currentId = e.eventId;
  c.closed = false;
  c.firstFinishAt = null;
  c.closedAt = null;
  c.started = false;
  const registration = c.registrations.find((r) => r.eventId === e.eventId);
  state.championship.round = state.management.catalog.races.findIndex(
    (r) => r.id === e.id,
  );
  for (const t of state.teams) {
    t.routeId = e.id;
    t.participating = t.ai || !!registration;
    Object.assign(t, {
      phase: t.participating ? "waiting" : "unregistered",
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
    t.plans = routeFor(t).stages.map((s, i) =>
      t.ai
        ? {
            ...defaultPlan(i),
            ...recommendedSetup(s),
            driverId: t.drivers[i % t.drivers.length].id,
            fuelTarget: vehicle(t.vehicleId).tank,
          }
        : null,
    );
    if (registration && !t.ai && e.kind === "short")
      t.plans[0] = {
        ...defaultPlan(0),
        ...recommendedSetup(routeFor(t).stages[0]),
        driverId: registration.driverId,
        fuelTarget: vehicle(t.vehicleId).tank,
      };
  }
  return state;
}
export function nextScheduledRace(state) {
  const c = state.competition,
    p = getPlayer(state);
  if (p.participating && !c.closed && state.clock >= 0)
    throw Error("Esperá el cierre de tu carrera.");
  const now = raceNow(state);
  const pending = c.registrations
    .map((r) => eventById(state, r.eventId))
    .filter((e) => e.start > now)
    .sort((a, b) => a.start - b.start)[0];
  const e =
    pending ||
    calendar(state, now, now + 60 * 86400000).find((e) => e.start > now);
  if (!e) throw Error("Sin carreras futuras.");
  let skip = Math.max(0, (e.start - now) / 1000 - 60);
  // Admin skips idle time without enrolling. Production advances with server time.
  while (skip > 0) {
    const used = Math.min(skip, 720 * 3600);
    advance(state, used);
    skip -= used;
  }
  if (c.currentId !== e.eventId) activateEvent(state, e);
  return state;
}
