import { vehicle, clamp } from "./catalog.js";
import { repairQuote, repairPiece } from "./part-maintenance.js";

export const GARAGE_LIMIT = 3;
export const UPGRADE_LIMIT = 100;
const round = (n) => Math.round(n * 100) / 100;
const player = (s) => s.teams.find((t) => t.id === "player");
const spend = (s, t, amount, label) => {
  t.budget = round(t.budget + amount);
  t.ledger.push({ time: s.clock, amount: round(amount), label });
};
export const activeCar = (t) => t.garage?.find((c) => c.id === t.activeCarId);
export const mechanicsAt = (t, place) =>
  (t.mechanics || []).filter((m) => (m.assignment || "race") === place);
export const crewRate = (t, place) =>
  mechanicsAt(t, place).reduce((sum, m) => sum + m.efficiency, 0);
export const jobFor = (t, id) =>
  t.workshop?.jobs.find((j) => j.targetId === id);
export const partReserved = (t, id) =>
  t.plans
    .slice(t.stageIndex)
    .some(
      (p) =>
        p &&
        Object.entries(p.replacements || {}).some(
          ([type, piece]) => piece === id && p.actions?.[type] === "replace",
        ),
    );
export function newCar(t, modelId) {
  return {
    id: `${t.id}-car-${++t.workshop.carSequence}`,
    modelId,
    condition: 100,
    performance: 50,
    reliability: 50,
    odometer: 0,
  };
}
export function initializeWorkshop(state) {
  for (const t of state.teams) {
    if (!t.workshop) {
      const models = t.garage || [t.vehicleId];
      if (
        !Array.isArray(models) ||
        models.length < 1 ||
        models.length > 4 ||
        models.some((m) => typeof m !== "string")
      )
        throw Error("Garaje anterior inválido.");
      t.workshop = {
        carSequence: 0,
        jobSequence: 0,
        jobs: [],
        completed: [],
        legacyOverflow: models.length > GARAGE_LIMIT,
        legacyNoMechanics: t.mechanics.length === 0,
      };
      t.garage = models.map((model) => newCar(t, model));
      t.activeCarId =
        t.garage.find((c) => c.modelId === t.vehicleId)?.id || t.garage[0].id;
      t.mechanics.forEach(
        (m, i) => (m.assignment = i === 0 ? "race" : "workshop"),
      );
    }
  }
}
export function assignMechanic(state, id, place) {
  const t = player(state),
    m = t.mechanics.find((m) => m.id === id);
  if (!m || !["race", "workshop"].includes(place))
    throw Error("Asignación inválida.");
  if (["racing", "service"].includes(t.phase))
    throw Error(
      "Distribuí los mecánicos cuando el equipo esté detenido, antes de iniciar otra etapa.",
    );
  if (m.assignment === place) return;
  const next = t.mechanics.map((x) => ({
    ...x,
    assignment: x.id === id ? place : x.assignment,
  }));
  for (const destination of ["race", "workshop"]) {
    const n = next.filter((m) => m.assignment === destination).length;
    if (n < (destination === "race" ? 1 : 0) || n > 4)
      throw Error("Carrera: 1–4 mecánicos. Taller: 0–4. Máximo 5 en total.");
  }
  m.assignment = place;
}
export function placeNewMechanic(t, m) {
  m.assignment =
    mechanicsAt(t, "race").filter((x) => x !== m).length === 0
      ? "race"
      : mechanicsAt(t, "workshop").length < 4
        ? "workshop"
        : "race";
  if (t.workshop) t.workshop.legacyNoMechanics = false;
}
export function canChangeCar(t) {
  return ["waiting", "finished"].includes(t.phase);
}
export function selectVehicle(state, id) {
  const t = player(state),
    c = t.garage.find((c) => c.id === id);
  if (!canChangeCar(t))
    throw Error(
      "Elegí el auto antes de largar o después de terminar la carrera.",
    );
  if (!c) throw Error("El auto no pertenece al equipo.");
  if (jobFor(t, id))
    throw Error(
      "El auto tiene un trabajo pendiente. Esperá o cancelalo antes de usarlo.",
    );
  t.activeCarId = id;
  t.vehicleId = c.modelId;
  t.fuel = Math.min(t.fuel, vehicle(c.modelId).tank);
  for (const plan of t.plans)
    if (plan)
      plan.fuelTarget = Math.min(plan.fuelTarget, vehicle(c.modelId).tank);
  if (t.activePlan)
    t.activePlan.fuelTarget = Math.min(
      t.activePlan.fuelTarget,
      vehicle(c.modelId).tank,
    );
}
export function vehicleSaleValue(state, car) {
  const price =
    state.management.catalog.vehicles.find((v) => v.id === car.modelId)
      ?.price || 0;
  return Math.floor(
    price * (0.2 + (0.5 * car.condition) / 100) +
      (price * 0.12 * (car.performance - 50 + (car.reliability - 50))) / 100 +
      1e-8,
  );
}
export function purchaseVehicle(state, modelId, { tradeId = null } = {}) {
  const t = player(state),
    m = state.management,
    v = m.catalog.vehicles.find((v) => v.id === modelId);
  if (!v?.available || m.stocks[modelId] < 1)
    throw Error("Vehículo sin stock.");
  const trade = tradeId ? t.garage.find((c) => c.id === tradeId) : null;
  if (tradeId && !trade) throw Error("Auto a entregar inválido.");
  if (trade && jobFor(t, trade.id))
    throw Error("Cancelá o completá el trabajo del auto antes de entregarlo.");
  if (trade?.id === t.activeCarId && !canChangeCar(t))
    throw Error("El auto de carrera no se puede vender mientras participa.");
  if (!trade && t.garage.length >= GARAGE_LIMIT)
    throw Error(
      "El taller admite hasta 3 autos. Vendé uno o entregalo como parte de pago.",
    );
  const sale = trade ? vehicleSaleValue(state, trade) : 0;
  if (t.budget + sale < v.price)
    throw Error("Saldo insuficiente, incluso después de la entrega.");
  // Validate the complete exchange before changing money, ownership or stock.
  const wasActive = trade?.id === t.activeCarId;
  if (trade) {
    spend(state, t, sale, `Venta de vehículo: ${vehicle(trade.modelId).short}`);
    t.garage = t.garage.filter((c) => c.id !== trade.id);
  }
  spend(state, t, -v.price, `Compra de vehículo: ${v.name}`);
  m.stocks[modelId]--;
  const car = newCar(t, modelId);
  t.garage.push(car);
  if (wasActive) selectVehicle(state, car.id);
  if (t.garage.length <= GARAGE_LIMIT) t.workshop.legacyOverflow = false;
  return car;
}
export function sellVehicle(state, id) {
  const t = player(state),
    car = t.garage.find((c) => c.id === id);
  if (!car) throw Error("Auto desconocido.");
  if (t.garage.length <= 1)
    throw Error(
      "Conservá un auto para competir. Podés entregar el último como parte de pago de otro.",
    );
  if (id === t.activeCarId)
    throw Error(
      "Seleccioná primero otro auto para competir, o entregá este como parte de pago.",
    );
  if (jobFor(t, id))
    throw Error(
      "El auto tiene un trabajo pendiente. Completalo o cancelalo antes de vender.",
    );
  const price = vehicleSaleValue(state, car);
  t.garage = t.garage.filter((c) => c.id !== id);
  spend(state, t, price, `Venta de vehículo: ${vehicle(car.modelId).short}`);
  if (t.garage.length <= GARAGE_LIMIT) t.workshop.legacyOverflow = false;
  return price;
}
export function jobQuote(state, team, kind, id) {
  if (kind === "part") {
    const part = team.inventory.find((p) => p.id === id);
    if (!part)
      throw Error(
        "Sólo se reparan en la base las piezas disponibles del lote.",
      );
    const q = repairQuote(part);
    return { ...q, kind, targetId: id, workHours: q.hours };
  }
  const car = team.garage.find((c) => c.id === id);
  if (!car || !["condition", "performance", "reliability"].includes(kind))
    throw Error("Trabajo desconocido.");
  const price = state.management.catalog.vehicles.find(
    (v) => v.id === car.modelId,
  ).price;
  const target =
    kind === "condition" ? 100 : Math.min(UPGRADE_LIMIT, car[kind] + 5);
  const gain = Math.max(0, target - car[kind]);
  const difficulty = kind === "condition" ? 1 : 1 + (car[kind] - 50) / 25;
  return {
    kind,
    targetId: id,
    target,
    needed: gain > 0,
    cost: Math.ceil(
      price * (kind === "condition" ? 0.003 : 0.008) * gain * difficulty,
    ),
    workHours: gain * (kind === "condition" ? 0.6 : 2) * difficulty,
  };
}
export function enqueueJob(state, kind, id) {
  const t = player(state);
  if (t.workshop.jobs.length >= 8)
    throw Error("La cola admite hasta 8 trabajos.");
  if (jobFor(t, id))
    throw Error("Este auto o repuesto ya tiene un trabajo pendiente.");
  if (kind !== "part" && id === t.activeCarId && !canChangeCar(t))
    throw Error(
      "El auto en carrera no puede repararse ni mejorarse en la base.",
    );
  if (kind === "part" && partReserved(t, id))
    throw Error(
      "La pieza está reservada en un plan. Cambiá esa elección antes de enviarla al taller.",
    );
  const q = jobQuote(state, t, kind, id);
  if (!q.needed) throw Error("No hay una mejora posible con el estado actual.");
  if (q.cost > t.budget) throw Error("Saldo insuficiente para este trabajo.");
  const job = {
    id: `${t.id}-work-${++t.workshop.jobSequence}`,
    kind,
    targetId: id,
    target: q.target,
    cost: q.cost,
    workHours: q.workHours,
    worked: 0,
    originalAfter: q.originalAfter ?? null,
  };
  spend(
    state,
    t,
    -q.cost,
    `Taller: ${kind === "part" ? "reparación de repuesto" : { condition: "reparación de auto", performance: "mejora de performance", reliability: "mejora de fiabilidad" }[kind]}`,
  );
  t.workshop.jobs.push(job);
  return job;
}
export function cancelJob(state, id) {
  const t = player(state),
    job = t.workshop.jobs.find((j) => j.id === id);
  if (!job) throw Error("Trabajo desconocido.");
  const refund = Math.floor(job.cost * (1 - job.worked / job.workHours));
  t.workshop.jobs = t.workshop.jobs.filter((j) => j.id !== id);
  if (refund)
    spend(state, t, refund, "Devolución de trabajo pendiente en taller");
  return refund;
}
export function advanceWorkshops(state, seconds) {
  for (const t of state.teams) {
    if (!t.workshop) continue;
    const rate = crewRate(t, "workshop"),
      initialWork = (seconds / 3600) * rate;
    let work = initialWork;
    while (work > 0 && t.workshop.jobs.length) {
      const j = t.workshop.jobs[0],
        used = Math.min(work, j.workHours - j.worked);
      j.worked += used;
      work -= used;
      if (j.worked < j.workHours - 1e-9) break;
      const target =
        j.kind === "part"
          ? t.inventory.find((p) => p.id === j.targetId)
          : t.garage.find((c) => c.id === j.targetId);
      if (!target) throw Error("El trabajo perdió su auto o repuesto.");
      if (j.kind === "part") repairPiece(target);
      else target[j.kind] = j.target;
      t.workshop.completed.push({
        ...j,
        finishedAt: state.clock + ((initialWork - work) / rate) * 3600,
      });
      t.workshop.completed = t.workshop.completed.slice(-60);
      t.workshop.jobs.shift();
    }
  }
}
export function vehicleFactors(team) {
  const c = activeCar(team);
  if (!c) return { speed: 1, risk: 1, wear: 1 };
  return {
    speed:
      (1 + (c.performance - 50) * 0.003) * (0.72 + (0.28 * c.condition) / 100),
    risk: (1 + (100 - c.condition) / 100) * (1 - (c.reliability - 50) * 0.008),
    wear: 1 - (c.reliability - 50) * 0.004,
  };
}
export function wearVehicle(team, distance, effort) {
  const c = activeCar(team);
  if (!c) return;
  c.odometer += distance;
  c.condition = clamp(
    c.condition - (distance / 100) * 0.1 * effort * vehicleFactors(team).wear,
    0,
    100,
  );
}
