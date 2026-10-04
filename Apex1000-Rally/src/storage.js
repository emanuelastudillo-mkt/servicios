import { initializeManagement } from "./management.js";
import { validateCatalog } from "./catalog-schema.js";
import {
  ENGINE_VERSION,
  PART_TYPES,
  GRADES,
  DRIVER_PROFILES,
  PHASES,
  VEHICLES,
  PACES,
  vehicle,
} from "./catalog.js";
import { routeFor } from "./route.js";
import { validateJournal } from "./journal-validation.js";
import { initializeWorkshop } from "./workshop.js";
import { validateWorkshop } from "./workshop-validation.js";
import { validServiceTimeline } from "./service-telemetry.js";
export const SAVE_KEY = "apex1000-rally-v1";
const validNumber = (n, min = -Infinity, max = Infinity) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const boundedText = (s, max) => typeof s === "string" && s.length <= max;
function checkPlan(p, t) {
  if (!p || typeof p !== "object") throw new Error("Plan de etapa inválido.");
  for (const [key, allowed] of Object.entries({
    driverId: t.drivers.map((d) => d.id),
    pace: Object.keys(PACES),
    ride: ["low", "balanced", "high"],
    pressure: ["firm", "mixed", "soft"],
    gearing: ["long", "mixed", "short"],
    cooling: ["closed", "balanced", "open"],
  }))
    if (!allowed.includes(p[key]))
      throw new Error("Configuración desconocida en un plan.");
  if (
    !Number.isInteger(p.boost) ||
    !validNumber(p.boost, 0, 2) ||
    !validNumber(p.fuelTarget, 0, vehicle(t.vehicleId).tank) ||
    (p.rest !== "full" && !validNumber(p.rest, 0, 12)) ||
    typeof p.auto !== "boolean"
  )
    throw new Error("Valores de preparación fuera de rango.");
  for (const type of PART_TYPES) {
    if (!["none", "repair", "replace"].includes(p.actions?.[type.id]))
      throw new Error("Acción de taller inválida.");
    if (
      p.actions[type.id] === "replace" &&
      ![...Object.values(t.parts), ...t.inventory].some(
        (i) => i.id === p.replacements?.[type.id] && i.type === type.id,
      )
    )
      throw new Error("Repuesto desconocido en el plan.");
  }
}
export function validateSave(raw) {
  if (
    !raw ||
    raw.format !== "apex-rally" ||
    ![1, 2, 3].includes(raw.version) ||
    !["rally-1", "rally-2", ENGINE_VERSION].includes(raw.engineVersion) ||
    raw.mode !== "single"
  )
    throw new Error("No es una partida compatible con esta versión del rally.");
  if (
    !Number.isFinite(Date.parse(raw.startAt)) ||
    !validNumber(raw.clock, -86400 * 365, 86400 * 365) ||
    !validNumber(raw.remainder, 0, 30) ||
    !validNumber(raw.wallAt, 0) ||
    ![0, 1, 60, 600, 3600].includes(raw.speed)
  )
    throw new Error("El reloj de la partida es inválido.");
  if (
    !Array.isArray(raw.teams) ||
    raw.teams.length !== 12 ||
    raw.teams.filter((t) => t.id === "player").length !== 1 ||
    !Array.isArray(raw.events) ||
    raw.events.length > 600
  )
    throw new Error("La parrilla o el historial son inválidos.");
  if (
    !boundedText(raw.id, 150) ||
    !Number.isSafeInteger(raw.itemCounter) ||
    raw.itemCounter < 0 ||
    !Number.isSafeInteger(raw.eventCounter) ||
    raw.eventCounter < 0
  )
    throw new Error("Identificadores de partida inválidos.");
  raw = structuredClone(raw);
  const legacy = raw.version < 3;
  raw.version = 3;
  raw.engineVersion = ENGINE_VERSION;
  if (!raw.management) initializeManagement(raw, { legacy: true });
  if (legacy) initializeWorkshop(raw);
  const { stages: STAGES, totalKm: TOTAL_KM } = routeFor(raw);
  validateManagement(raw);
  const ids = new Set();
  for (const t of raw.teams) {
    if (
      typeof t.id !== "string" ||
      !/^[\w-]{1,80}$/.test(t.id) ||
      ids.has(t.id) ||
      !VEHICLES.some((v) => v.id === t.vehicleId) ||
      !Object.hasOwn(PHASES, t.phase)
    )
      throw new Error("Participante inválido.");
    ids.add(t.id);
    if (
      !boundedText(t.name, 80) ||
      !/^#[0-9a-f]{6}$/i.test(t.color) ||
      !t.drivers?.some((d) => d.id === t.activeDriver) ||
      typeof t.prizePaid !== "boolean" ||
      !validNumber(t.holdUntil, 0) ||
      !validNumber(t.speed, 0, 250) ||
      !Number.isInteger(t.rng) ||
      !t.rng
    )
      throw new Error("Datos del equipo inválidos.");
    if (
      !validNumber(t.budget, 0, 1e8) ||
      !validNumber(t.debt, 0, 1e8) ||
      !validNumber(t.totalKm, 0, TOTAL_KM + 0.01) ||
      !Number.isInteger(t.stageIndex) ||
      t.stageIndex < 0 ||
      t.stageIndex > STAGES.length ||
      !validNumber(t.stageKm, 0, 1000) ||
      !validNumber(t.fuel, 0, 600) ||
      !validNumber(t.heat, 0, 200) ||
      !validNumber(t.rng, 0, 4294967295)
    )
      throw new Error("Estado del participante fuera de rango.");
    if (
      !Array.isArray(t.inventory) ||
      t.inventory.length > 500 ||
      !Array.isArray(t.plans) ||
      t.plans.length !== STAGES.length ||
      !Array.isArray(t.drivers) ||
      t.drivers.length < 1 ||
      t.drivers.length > 3 ||
      !Array.isArray(t.ledger) ||
      t.ledger.length > 5000
    )
      throw new Error("Inventario, planes o equipo inválidos.");
    const all = [...Object.values(t.parts || {}), ...t.inventory],
      partIds = new Set();
    for (const p of all) {
      if (p && p.original === undefined && legacy) p.original = 100;
      if (
        !p ||
        !PART_TYPES.some((x) => x.id === p.type) ||
        !Object.hasOwn(GRADES, p.grade) ||
        !validNumber(p.condition, 0, 100) ||
        !validNumber(p.original, 0, 100) ||
        typeof p.broken !== "boolean" ||
        typeof p.id !== "string" ||
        !/^[\w-]{1,100}$/.test(p.id) ||
        partIds.has(p.id) ||
        (p.grade === "reserve" && p.broken)
      )
        throw new Error("Una pieza es inválida o está duplicada.");
      partIds.add(p.id);
    }
    for (const p of PART_TYPES) {
      if (
        t.parts?.[p.id]?.type !== p.id ||
        all.filter((i) => i.type === p.id && i.grade === "reserve").length !== 1
      )
        throw new Error(
          "Falta una pieza instalada o una reserva de emergencia.",
        );
    }
    if (
      Object.keys(t.parts).length !== PART_TYPES.length ||
      t.fuel > vehicle(t.vehicleId).tank
    )
      throw new Error("Vehículo fuera de capacidad.");
    for (const piece of all) {
      const match = /^player-shop-(\d+)$/.exec(piece.id);
      if (match && Number(match[1]) > raw.itemCounter)
        throw new Error("Contador de inventario inválido.");
    }
    for (const plan of t.plans) if (plan !== null) checkPlan(plan, t);
    if (t.activePlan !== null && t.activePlan !== undefined)
      checkPlan(t.activePlan, t);
    for (const k of [
      "driving",
      "service",
      "waiting",
      "errors",
      "failures",
      "fuelUsed",
    ])
      if (!validNumber(t.statistics?.[k], 0))
        throw new Error("Estadísticas inválidas.");
    if (!Array.isArray(t.history) || t.history.length !== t.stageIndex)
      throw new Error("Historial de etapas inválido.");
    for (const [i, h] of t.history.entries()) {
      if (
        h.stage !== i ||
        !validNumber(h.start, 0) ||
        !validNumber(h.arrival, h.start) ||
        !validNumber(h.duration, 0) ||
        !validNumber(h.budget, 0) ||
        !validNumber(h.energy, 0, 100)
      )
        throw new Error("Resultado de etapa inválido.");
      for (const type of PART_TYPES)
        if (!validNumber(h.condition?.[type.id], 0, 100))
          throw new Error("Desgaste de llegada inválido.");
    }
    for (const l of t.ledger)
      if (
        !validNumber(l.time) ||
        !validNumber(l.amount) ||
        !boundedText(l.label, 300)
      )
        throw new Error("Movimiento de presupuesto inválido.");
    for (const d of t.drivers) {
      const profile = DRIVER_PROFILES.find((p) => p.id === (d.profile || d.id));
      if (!profile || !validNumber(d.energy, 0, 100))
        throw new Error("Estado del piloto inválido.");
      for (const key of [
        "speed",
        "parts",
        "wear",
        "risk",
        "fatigue",
        "recovery",
        "color",
        "initials",
        "role",
        "description",
      ])
        d[key] = profile[key];
    }
    if (
      ["racing", "service"].includes(t.phase) &&
      (!t.activePlan || t.stageIndex >= STAGES.length)
    )
      throw new Error("Plan activo inválido.");
    if (
      t.phase === "service" &&
      (!t.service ||
        !validNumber(t.service.until, 0) ||
        !validNumber(t.service.start, 0) ||
        t.service.until < t.service.start ||
        !validServiceTimeline(t.service))
    )
      throw new Error("Servicio inválido.");
    if (t.phase === "racing" && !validNumber(t.stageStart, 0))
      throw new Error("Largada de etapa inválida.");
    if (
      t.phase === "finished" &&
      (t.stageIndex !== STAGES.length ||
        !validNumber(t.finishTime, 0) ||
        !t.prizePaid)
    )
      throw new Error("Llegada inválida.");
    if (
      t.phase !== "finished" &&
      (t.stageIndex >= STAGES.length ||
        t.finishTime !== null ||
        t.prizePaid ||
        t.stageKm > STAGES[t.stageIndex].km)
    )
      throw new Error("Progreso de etapa inválido.");
    if (
      t.prizePaid &&
      (!Number.isInteger(t.prize?.position) ||
        !validNumber(t.prize.position, 1, 12) ||
        !validNumber(t.prize.gross, 0) ||
        !validNumber(t.prize.settled, 0) ||
        !validNumber(t.prize.net, 0))
    )
      throw new Error("Premio inválido.");
  }
  for (const e of raw.events)
    if (
      !Number.isSafeInteger(e.id) ||
      e.id > raw.eventCounter ||
      !validNumber(e.time) ||
      !ids.has(e.teamId) ||
      !boundedText(e.type, 40) ||
      !boundedText(e.text, 800)
    )
      throw new Error("Evento inválido.");
  for (const team of raw.teams) {
    validateJournal(team, STAGES, raw.clock);
    validateWorkshop(raw, team);
  }
  return raw;
}
export function encodeSave(state) {
  return JSON.stringify(state);
}

function validateManagement(s) {
  const m = s.management,
    c = s.championship;
  validateCatalog(m.catalog);
  if (
    !c ||
    !Number.isInteger(c.round) ||
    c.round < 0 ||
    c.round > 7 ||
    !Number.isFinite(Date.parse(c.startAt)) ||
    typeof c.paid !== "boolean" ||
    !Array.isArray(c.results) ||
    c.results.length > 8 ||
    s.routeId !== m.catalog.races[c.round].id
  )
    throw Error("Campeonato inválido.");
  if (
    !Array.isArray(m.auctions) ||
    m.auctions.length > 1000 ||
    !Number.isSafeInteger(m.sequence) ||
    m.sequence < 0
  )
    throw Error("Mercado inválido.");
  const persons = new Set();
  for (const t of s.teams) {
    if (t.initialBudget === undefined)
      t.initialBudget = Math.round(
        t.budget - t.ledger.reduce((sum, l) => sum + l.amount, 0),
      );
    if (!validNumber(t.initialBudget, 0, 10000000))
      throw Error("Presupuesto inicial inválido.");
    if (
      t.routeId !== s.routeId ||
      !Number.isInteger(t.shieldId) ||
      t.shieldId < 1 ||
      t.shieldId > 100 ||
      !Array.isArray(t.garage) ||
      !t.garage.some(
        (c) => c.id === t.activeCarId && c.modelId === t.vehicleId,
      ) ||
      !Array.isArray(t.mechanics) ||
      t.mechanics.length > 5 ||
      !Array.isArray(t.drivers) ||
      t.drivers.length < 1 ||
      t.drivers.length > 3
    )
      throw Error("Plantel o identidad inválidos.");
    for (const p of [...t.drivers, ...t.mechanics]) {
      const id = p.personId || p.id;
      if (
        !/^[a-z0-9-]{1,80}$/.test(p.id) ||
        !/^[a-z0-9-]{1,80}$/.test(id) ||
        persons.has(id) ||
        m.owners[id] !== t.id ||
        !boundedText(p.name, 80) ||
        !validNumber(p.salary, 0, 1000000) ||
        !/^assets\/art\/[a-z0-9-]+\.webp$/.test(p.image)
      )
        throw Error("Contrato duplicado o inválido.");
      persons.add(id);
    }
    if (new Set(t.drivers.map((d) => d.id)).size !== t.drivers.length)
      throw Error("Piloto duplicado.");
    for (const mech of t.mechanics)
      if (!validNumber(mech.efficiency, 1, 1.6))
        throw Error("Mecánico inválido.");
    if (!validNumber(c.points?.[t.id], 0, 8000))
      throw Error("Puntos inválidos.");
  }
  if (Object.keys(m.owners).some((id) => !persons.has(id)))
    throw Error("Titularidad sin contrato.");
  if (c.results.length < c.round || c.results.length > c.round + 1)
    throw Error("Faltan resultados del campeonato.");
  const expectedPoints = Object.fromEntries(s.teams.map((t) => [t.id, 0]));
  for (const [i, r] of c.results.entries()) {
    if (
      r.round !== i ||
      r.routeId !== m.catalog.races[i].id ||
      !Array.isArray(r.entries) ||
      r.entries.length !== 12 ||
      new Set(r.entries.map((e) => e.id)).size !== 12
    )
      throw Error("Resultado de campeonato inválido.");
    for (const [j, e] of r.entries.entries()) {
      if (
        !s.teams.some((t) => t.id === e.id) ||
        e.position !== j + 1 ||
        !validNumber(e.time, 0, 365 * 86400) ||
        e.points !== m.catalog.prizes[j].points ||
        !validNumber(e.prize, 0)
      )
        throw Error("Clasificación inválida.");
      expectedPoints[e.id] += e.points;
    }
  }
  for (const t of s.teams)
    if (c.points[t.id] !== expectedPoints[t.id])
      throw Error("Puntos inconsistentes.");
  if (c.paid !== (c.results.length === 8))
    throw Error("Liquidación de campeonato inválida.");
  if (
    c.paid &&
    (!Array.isArray(c.final) ||
      c.final.length !== 12 ||
      new Set(c.final.map((e) => e.id)).size !== 12 ||
      c.final.some(
        (e, i) =>
          !s.teams.some((t) => t.id === e.id) ||
          e.position !== i + 1 ||
          !validNumber(e.gross, 0) ||
          !validNumber(e.settled, 0, e.gross) ||
          e.net !== e.gross - e.settled,
      ))
  )
    throw Error("Premio de campeonato inválido.");
  for (const row of [...m.catalog.vehicles, ...m.catalog.parts])
    if (
      !Number.isInteger(m.stocks[row.id]) ||
      !validNumber(m.stocks[row.id], 0, 100000)
    )
      throw Error("Stock inválido.");
  const active = new Set(),
    ids = new Set();
  for (const a of m.auctions) {
    const pool =
      a.kind === "driver"
        ? m.catalog.drivers
        : a.kind === "mechanic"
          ? m.catalog.mechanics
          : [];
    if (
      !/^offer-\d+$/.test(a.id) ||
      !pool.some((p) => p.id === a.personId) ||
      !["open", "closed"].includes(a.status) ||
      !validNumber(a.openedAt) ||
      !validNumber(a.closesAt, a.openedAt) ||
      !Array.isArray(a.bids) ||
      a.bids.length > 12 ||
      ids.has(a.id)
    )
      throw Error("Subasta inválida.");
    ids.add(a.id);
    if (a.status === "open") {
      if (active.has(a.personId) || m.owners[a.personId])
        throw Error("Subasta duplicada.");
      active.add(a.personId);
    }
    const bidders = new Set();
    for (const b of a.bids) {
      if (
        bidders.has(b.teamId) ||
        !s.teams.some((t) => t.id === b.teamId) ||
        !validNumber(b.salary, 0, 1000000) ||
        !validNumber(b.escrow, 0, b.salary) ||
        !Number.isSafeInteger(b.sequence) ||
        b.sequence > m.sequence ||
        (a.status === "closed" && b.escrow !== 0)
      )
        throw Error("Oferta inválida.");
      bidders.add(b.teamId);
    }
  }
}
