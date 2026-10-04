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
import { STAGES, TOTAL_KM } from "./route.js";
export const SAVE_KEY = "apex1000-rally-v1";
const validNumber = (n, min = -Infinity, max = Infinity) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const boundedText = (s, max) => typeof s === "string" && s.length <= max;
function checkPlan(p, t) {
  if (!p || typeof p !== "object") throw new Error("Plan de etapa inválido.");
  for (const [key, allowed] of Object.entries({
    driverId: DRIVER_PROFILES.map((d) => d.id),
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
    raw.version !== 1 ||
    raw.engineVersion !== ENGINE_VERSION ||
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
      !DRIVER_PROFILES.some((d) => d.id === t.activeDriver) ||
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
      t.drivers.length !== 3 ||
      !Array.isArray(t.ledger) ||
      t.ledger.length > 5000
    )
      throw new Error("Inventario, planes o equipo inválidos.");
    const all = [...Object.values(t.parts || {}), ...t.inventory],
      partIds = new Set();
    for (const p of all) {
      if (
        !p ||
        !PART_TYPES.some((x) => x.id === p.type) ||
        !Object.hasOwn(GRADES, p.grade) ||
        !validNumber(p.condition, 0, 100) ||
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
    for (const profile of DRIVER_PROFILES) {
      const d = t.drivers.find((d) => d.id === profile.id);
      if (!d || !validNumber(d.energy, 0, 100))
        throw new Error("Estado del piloto inválido.");
      Object.assign(d, profile, { energy: d.energy });
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
        !validNumber(t.service.start, 0))
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
  return raw;
}
export function encodeSave(state) {
  return JSON.stringify(state);
}
