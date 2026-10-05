import { VEHICLES } from "./catalog.js";
import {
  jobQuote,
  UPGRADE_LIMIT,
  mechanicsAt,
  partReserved,
} from "./workshop.js";
const num = (n, a = 0, b = Infinity) =>
  typeof n === "number" && Number.isFinite(n) && n >= a && n <= b;
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const id = (s) => typeof s === "string" && /^[\w-]{1,100}$/.test(s);
export function validateWorkshop(s, t) {
  const w = t.workshop;
  if (
    !w ||
    !count(w.carSequence) ||
    !count(w.jobSequence) ||
    typeof w.legacyOverflow !== "boolean" ||
    (w.legacyNoMechanics !== undefined &&
      typeof w.legacyNoMechanics !== "boolean") ||
    (w.legacyNoMechanics && t.mechanics.length !== 0) ||
    !Array.isArray(w.jobs) ||
    w.jobs.length > 8 ||
    !Array.isArray(w.completed) ||
    w.completed.length > 60
  )
    throw Error("Taller inválido.");
  if (
    !Array.isArray(t.garage) ||
    !num(t.garage.length, s.competition ? 0 : 1, w.legacyOverflow ? 4 : 3)
  )
    throw Error("Capacidad del garaje inválida.");
  const cars = new Set();
  for (const c of t.garage) {
    const serial = Number(c.id?.split("-car-").at(-1));
    if (
      !id(c.id) ||
      cars.has(c.id) ||
      !Number.isSafeInteger(serial) ||
      serial < 1 ||
      serial > w.carSequence ||
      !VEHICLES.some((v) => v.id === c.modelId) ||
      !num(c.condition, 0, 100) ||
      !num(c.performance, 50, UPGRADE_LIMIT) ||
      !num(c.reliability, 50, UPGRADE_LIMIT) ||
      !num(c.odometer)
    )
      throw Error("Vehículo de taller inválido.");
    cars.add(c.id);
  }
  if (
    !cars.has(t.activeCarId) &&
    !(
      s.competition &&
      t.activeCarId === null &&
      ["unregistered", "finished", "cutoff", "waiting"].includes(t.phase)
    )
  )
    throw Error("Vehículo activo inválido.");
  for (const m of t.mechanics)
    if (!["race", "workshop"].includes(m.assignment))
      throw Error("Destino de mecánico inválido.");
  for (const place of ["race", "workshop"])
    if (
      mechanicsAt(t, place).length > 4 ||
      (place === "race" &&
        mechanicsAt(t, place).length < 1 &&
        !w.legacyNoMechanics &&
        t.participating !== false &&
        !["finished", "cutoff"].includes(t.phase))
    )
      throw Error("Carrera requiere 1–4 mecánicos; taller admite 0–4.");
  const jobs = new Set(),
    targets = new Set();
  for (const j of [...w.completed, ...w.jobs]) {
    const completed = w.completed.includes(j),
      serial = Number(j.id?.split("-work-").at(-1));
    if (
      !id(j.id) ||
      jobs.has(j.id) ||
      !Number.isSafeInteger(serial) ||
      serial < 1 ||
      serial > w.jobSequence ||
      !id(j.targetId) ||
      !["part", "condition", "performance", "reliability"].includes(j.kind) ||
      !num(j.target, 0, UPGRADE_LIMIT) ||
      !num(j.cost, 0, 1e8) ||
      !num(j.workHours, 0.00000001, 1e6) ||
      !num(j.worked, 0, j.workHours + 0.00000001)
    )
      throw Error("Trabajo de taller inválido.");
    jobs.add(j.id);
    if (completed) {
      if (
        !num(j.finishedAt, -Infinity) ||
        Math.abs(j.worked - j.workHours) > 1e-6
      )
        throw Error("Finalización de taller inválida.");
      continue;
    }
    if (targets.has(j.targetId) || j.worked >= j.workHours)
      throw Error("Trabajo duplicado o completado en la cola.");
    targets.add(j.targetId);
    if (j.pricingVersion !== undefined && ![1, 2].includes(j.pricingVersion))
      throw Error("Versión de trabajo inválida.");
    if (
      j.points !== undefined &&
      (!Number.isInteger(j.points) || j.points < 1 || j.points > 5)
    )
      throw Error("Cantidad de mejora inválida.");
    const q = jobQuote(
      s,
      t,
      j.kind,
      j.targetId,
      j.points ?? 5,
      j.pricingVersion ?? 1,
    );
    if (
      !q.needed ||
      q.cost !== j.cost ||
      Math.abs(q.workHours - j.workHours) > 1e-8 ||
      q.target !== j.target ||
      (q.originalAfter ?? null) !== j.originalAfter
    )
      throw Error("Presupuesto de taller inconsistente.");
    if (j.targetId === t.activeCarId && ["racing", "service"].includes(t.phase))
      throw Error("El auto activo no puede estar en la base y en carrera.");
    if (j.kind === "part" && partReserved(t, j.targetId))
      throw Error("Pieza en taller también reservada para la carrera.");
  }
}
