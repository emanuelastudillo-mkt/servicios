import {
  ENGINE_VERSION,
  STARTING_BUDGET,
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
  team.budget = round(team.budget + amount);
  team.ledger.push({ time: state.clock, amount: round(amount), label });
}
function item(id, type, grade, condition = 100) {
  return { id, type, grade, condition, broken: false };
}
function newTeam(id, name, vehicleId, seed, ai = false) {
  const v = vehicle(vehicleId),
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
    budget: STARTING_BUDGET - v.fee,
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
    plans: STAGES.map(() => null),
    rng: seed >>> 0 || 1,
    ledger: [
      {
        time: -3600,
        amount: -v.fee,
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
} = {}) {
  if (!VEHICLES.some((v) => v.id === vehicleId))
    throw new Error("Vehículo desconocido.");
  const start = Date.parse(startAt);
  if (!Number.isFinite(start) || !Number.isFinite(now))
    throw new Error("Horario de largada inválido.");
  if (start < now - 30 * 86400000 || start > now + 365 * 86400000)
    throw new Error(
      "Elegí una largada entre 30 días atrás y un año hacia adelante.",
    );
  const state = {
    format: "apex-rally",
    version: 1,
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
  names.forEach((n, i) => {
    const t = newTeam(
      `rival-${i + 1}`,
      n,
      VEHICLES[i % 4].id,
      seed + 991 * (i + 1),
      true,
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
  if (now > start) advance(state, (now - start) / 1000);
  return state;
}
export function getPlayer(state) {
  return state.teams.find((t) => t.id === "player");
}
export function normalizePlan(raw = {}, team) {
  const s = defaultPlan(),
    v = vehicle(team.vehicleId);
  for (const [key, allowed] of Object.entries({
    driverId: DRIVER_PROFILES.map((d) => d.id),
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
  return s;
}
export function savePlan(state, stageIndex, raw) {
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
  if (t.phase === "finished") throw new Error("La carrera ya terminó.");
  if (
    !PART_TYPES.some((p) => p.id === type) ||
    !["endurance", "standard", "racing"].includes(grade) ||
    ![50, 75, 100].includes(condition)
  )
    throw new Error("Oferta inválida.");
  const price = priceFor(type, grade, condition);
  if (price > t.budget)
    throw new Error("El presupuesto no alcanza para esta pieza.");
  const next = item(
    `player-shop-${++state.itemCounter}`,
    type,
    grade,
    condition,
  );
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
export function repairQuote(p) {
  const type = partType(p.type),
    missing = 100 - p.condition;
  return {
    cost: Math.ceil(
      type.price * GRADES[p.grade].price * (missing / 100) * 0.52 +
        (p.broken ? type.price * 0.12 : 0),
    ),
    hours:
      missing > 0 ? type.hours * (missing / 100) + (p.broken ? 0.75 : 0) : 0,
  };
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
        (i) => i.id === plan.replacements[type.id] && i.type === type.id,
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
  const at = team.inventory.findIndex((p) => p.id === id && p.type === type);
  if (at < 0) return false;
  const next = team.inventory[at];
  team.inventory.splice(at, 1, team.parts[type]);
  team.parts[type] = next;
  return true;
}
function beginService(state, t) {
  const plan = t.plans[t.stageIndex];
  if (!plan) return;
  const q = estimateService(t, plan),
    stage = STAGES[t.stageIndex];
  let hours = 0;
  for (const line of q.lines) {
    if (line.cost <= t.budget) {
      if (line.action === "repair") {
        transact(
          state,
          t,
          -line.cost,
          `E${t.stageIndex + 1} reparación ${partType(line.type).name}`,
        );
        t.parts[line.type].condition = 100;
        t.parts[line.type].broken = false;
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
    } else {
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
        (i) => i.type === p.id && i.grade === "reserve",
      );
      if (spare) {
        swap(t, p.id, spare.id);
        hours += p.hours * 0.24;
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
    hours += 4;
    log(
      state,
      t,
      "assistance",
      `Asistencia de combustible: +4 h y ${debt} créditos a descontar del premio.`,
    );
  }
  t.fuel += litres;
  hours += litres * 0.0015;
  hours = Math.max(hours, q.restHours);
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
  if (t.stageIndex === 0) {
    t.heat = stage.temp;
    t.drivers.forEach((d) => (d.energy = 100));
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
  t.phase = "racing";
  t.service = null;
  t.stageStart = state.clock;
  t.stageKm = 0;
  t.holdUntil = 0;
  log(
    state,
    t,
    "departure",
    `Sale a E${t.stageIndex + 1}: ${STAGES[t.stageIndex].from.name} → ${STAGES[t.stageIndex].to.name}.`,
  );
}
export function performance(
  team,
  stage = STAGES[team.stageIndex],
  plan = team.activePlan || team.plans[team.stageIndex] || defaultPlan(),
  km = team.stageKm,
) {
  const v = vehicle(team.vehicleId),
    terrain = TERRAINS[segmentAt(stage, km).type],
    terrainId = segmentAt(stage, km).type,
    d = driverFor(team, plan.driverId),
    pace = PACES[plan.pace],
    p = Object.fromEntries(
      PART_TYPES.map((t) => [t.id, partEffect(team.parts[t.id]) * d.parts]),
    );
  const effect =
    p.engine ** 0.31 *
    p.transmission ** 0.16 *
    p.suspension ** 0.19 *
    p.tyres ** 0.19 *
    p.brakes ** 0.09 *
    p.cooling ** 0.06;
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
          v.speed *
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
          coolingDrag *
          hot,
        30,
        terrain.cap,
      );
  const wear =
    (terrain.wear *
      pace.wear *
      (1 + plan.boost * 0.45) *
      d.wear *
      (1 + Math.max(0, team.heat - 105) * 0.013)) /
    v.reliability;
  const fuelPer100 =
    ((38 * terrain.fuel * pace.fuel * (1 + plan.boost * 0.14)) / v.efficiency) *
    (1 + team.fuel * 0.00008) *
    (broken ? 1.15 : 1);
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
    (thermalLoad - 1) * 35;
  const risk =
    0.019 *
    terrain.risk *
    pace.risk *
    d.risk *
    (1 + (100 - d.energy) / 40) *
    (1 + plan.boost * 0.25);
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
        forecast.parts[line.type].condition = 100;
        forecast.parts[line.type].broken = false;
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
    const p = performance(forecast, stage, plan, seg.start + 0.01);
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
        d.energy - (dt / 3600) * 11 * d.fatigue * effort,
        0,
        100,
      );
    else d.energy = clamp(d.energy + (dt / 3600) * d.recovery, 0, 100);
  }
}
function finishStage(state, t, time) {
  const s = STAGES[t.stageIndex];
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
    log(state, t, "finish", "¡Llegó a Santiago! Carrera completa.");
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
function advanceTeam(state, t, dt) {
  if (t.phase === "finished") return;
  if (state.clock < 0) {
    fatigue(t, dt);
    return;
  }
  if (t.phase === "waiting") t.phase = "camp";
  if (t.phase === "camp") {
    t.speed = 0;
    if (t.plans[t.stageIndex]?.auto) beginService(state, t);
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
  if (state.clock < t.holdUntil) {
    t.speed = 0;
    fatigue(t, dt);
    t.heat += (70 - t.heat) * Math.min(1, dt / 3600);
    t.statistics.waiting += dt;
    return;
  }
  const stage = STAGES[t.stageIndex],
    p = performance(t, stage),
    driveDt = Math.min(dt, ((stage.km - t.stageKm) / p.speed) * 3600),
    distance = (p.speed * driveDt) / 3600;
  if (t.fuel < (distance * p.fuelPer100) / 100) {
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
  t.heat += (p.heatTarget - t.heat) * Math.min(1, driveDt / 1200);
  fatigue(
    t,
    driveDt,
    true,
    p.terrainId === "sand" ? 1.2 : p.terrainId === "mountain" ? 1.12 : 1,
  );
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
      (grade.failure *
        (1 + ((100 - piece.condition) / 35) ** 2) *
        (t.activePlan.boost + 1) *
        (1 + Math.max(0, t.heat - 110) * 0.07) *
        driveDt) /
      3600;
    if (!piece.broken && random(t) < failure) {
      piece.broken = true;
      piece.condition = Math.min(piece.condition, 5);
      t.statistics.failures++;
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
    if (!navigation) {
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
  const finishers = state.teams
    .filter((t) => t.finishTime !== null)
    .sort((a, b) => a.finishTime - b.finishTime);
  finishers.forEach((t, i) => {
    if (t.prizePaid) return;
    const gross = PRIZES[i] || 8000,
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
export function advance(state, seconds, { stopAtPlayerCamp = false } = {}) {
  if (!Number.isFinite(seconds) || seconds < 0)
    throw new Error("Avance de tiempo inválido.");
  if (state.mode !== "single")
    throw new Error("El reloj online debe avanzar en el servidor.");
  state.remainder += Math.min(seconds, 3600 * 720);
  let remaining = Math.floor(state.remainder / STEP);
  state.remainder -= remaining * STEP;
  let advanced = 0;
  const initialStage = getPlayer(state).stageIndex;
  while (remaining-- > 0) {
    if (state.teams.every((t) => t.phase === "finished")) {
      state.remainder = 0;
      break;
    }
    for (const t of state.teams) advanceTeam(state, t, STEP);
    award(state);
    state.clock += STEP;
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
  if (player.phase === "finished") return { advanced: 0 };
  if (
    ["waiting", "camp"].includes(player.phase) &&
    !player.plans[player.stageIndex]
  )
    throw new Error("Guardá el plan de tu próxima etapa.");
  return advance(state, 3600 * 100, { stopAtPlayerCamp: true });
}
export function standings(state) {
  return [...state.teams].sort((a, b) =>
    a.finishTime !== null && b.finishTime !== null
      ? a.finishTime - b.finishTime
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
    elapsedSeconds: state.clock,
    routeKm: TOTAL_KM,
    entries: standings(state).map((t, i) => ({
      entryId: t.id,
      name: t.name,
      vehicleId: t.vehicleId,
      rank: i + 1,
      phase: t.phase,
      stageIndex: t.stageIndex,
      totalKm: t.totalKm,
      stageKm: t.stageKm,
      speedKmh: t.speed,
      finishTime: t.finishTime,
      position: locationAt(t.totalKm),
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
    case "save-plan":
      return savePlan(state, command.stageIndex, command.plan);
    case "buy-part":
      return buyPart(state, command.partType, command.grade, command.condition);
    case "advance":
      return advance(state, command.seconds);
    case "next-camp":
      return nextPlayerCamp(state);
    default:
      throw new Error("Comando desconocido.");
  }
}
