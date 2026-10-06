import { PART_TYPES } from "../../src/catalog.js";
import { jobFor } from "../../src/workshop.js";
import { normalizeStaffNames } from "./staff.js";

export const RUNTIME_KEYS = [
  "routeId",
  "participating",
  "phase",
  "stageIndex",
  "stageKm",
  "totalKm",
  "speed",
  "heat",
  "fuel",
  "activeDriver",
  "holdUntil",
  "finishTime",
  "stageStart",
  "stageStaff",
  "activePlan",
  "plans",
  "history",
  "journal",
  "stageNotes",
  "rng",
  "statistics",
  "prizePaid",
  "prize",
  "service",
];
const clone = (x) => structuredClone(x);
export const pieces = (t) => [...Object.values(t.parts), ...t.inventory];
export const overlaps = (a, b) => a.start < b.end && b.start < a.end;
export const pieceIds = (e) =>
  e.reservedPartIds || [
    ...Object.values(e.partIds || {}),
    ...(e.spareIds || []),
  ];
export function reservations(w, id) {
  return Object.values(w.races)
    .filter((r) => r.entries[id] && r.event.end > w.at)
    .map((r) => ({
      ...r.event,
      status: r.status,
      ...r.entries[id],
      runtime: undefined,
      plans: undefined,
    }));
}
export function normalizeEntries(w) {
  normalizeStaffNames(w);
  for (const r of Object.values(w.races)) {
    if (r.status !== "closed" && r.event.kind !== "short") {
      r.event.maxHours = Math.min(r.event.maxHours || 192, 192);
      r.event.end = Math.min(r.event.end, r.event.start + 192 * 3600000);
    }
    for (const [id, e] of Object.entries(r.entries)) {
      const t = w.engine.teams.find((t) => t.id === id);
      if (!t || e.driverIds) continue;
      e.driverIds = [
        ...new Set([
          e.driverId,
          ...e.plans.filter(Boolean).map((p) => p.driverId),
        ]),
      ].filter((id) => t.drivers.some((d) => d.id === id));
      if (r.event.kind === "short") e.driverIds = e.driverIds.slice(0, 1);
      e.mechanicIds = t.mechanics
        .filter((m) => m.assignment === "race")
        .slice(0, r.event.kind === "short" ? 1 : 4)
        .map((m) => m.id);
      e.partIds = Object.fromEntries(
        Object.entries(t.parts).map(([type, p]) => [type, p.id]),
      );
      e.spareIds = t.inventory.map((p) => p.id);
      e.reservedPartIds = [...Object.values(e.partIds), ...e.spareIds];
      if (r.status === "running" && t.onlineRace === r.event.eventId)
        e.runtime = Object.fromEntries(
          RUNTIME_KEYS.filter((k) => t[k] !== undefined).map((k) => [
            k,
            clone(t[k]),
          ]),
        );
    }
    // Adopt an in-progress legacy stage without changing any employee ID or race progress.
    for (const [id, e] of Object.entries(r.entries)) {
      const t = w.engine.teams.find((t) => t.id === id),
        rt = e.runtime;
      if (t && rt?.phase === "racing" && !rt.stageStaff) {
        const d = t.drivers.find((d) => d.id === rt.activeDriver);
        if (d) {
          rt.stageStaff = { driverId: d.id, form: d.form, morale: d.morale };
          if (t.onlineRace === r.event.eventId)
            t.stageStaff = { ...rt.stageStaff };
        }
      }
    }
    for (const t of r.bots)
      if (t.phase === "racing" && !t.stageStaff) {
        const d = t.drivers.find((d) => d.id === t.activeDriver);
        if (d)
          t.stageStaff = { driverId: d.id, form: d.form, morale: d.morale };
      }
  }
}
export function allocation(w, t, r, c) {
  normalizeEntries(w);
  const car = t.garage.find((x) => x.id === (c.carId || t.activeCarId));
  const driverIds = c.driverIds || [c.driverId || t.activeDriver];
  const mechanicIds =
    c.mechanicIds ||
    t.mechanics
      .filter((m) => m.assignment === "race")
      .slice(0, 1)
      .map((m) => m.id);
  const partIds =
    c.partIds ||
    Object.fromEntries(
      Object.entries(t.parts).map(([type, p]) => [type, p.id]),
    );
  const spareIds = c.spareIds || [];
  const validList = (xs, list, max) =>
    Array.isArray(xs) &&
    xs.length >= 1 &&
    xs.length <= max &&
    new Set(xs).size === xs.length &&
    xs.every((id) => list.some((p) => p.id === id));
  const short = r.event.kind === "short";
  if (
    !car ||
    jobFor(t, car.id) ||
    !validList(driverIds, t.drivers, short ? 1 : 3) ||
    !validList(mechanicIds, t.mechanics, short ? 1 : 4) ||
    t.budget < 1500
  )
    throw Error(
      short
        ? "El sprint exige exactamente un auto, un piloto, un mecánico y 1.500 cr."
        : "Necesitás auto disponible, entre 1 y 3 pilotos, entre 1 y 4 mecánicos y 1.500 cr.",
    );
  const all = pieces(t);
  if (
    !partIds ||
    typeof partIds !== "object" ||
    Object.keys(partIds).length !== PART_TYPES.length ||
    !PART_TYPES.every((type) =>
      all.some((p) => p.id === partIds[type.id] && p.type === type.id),
    ) ||
    !Array.isArray(spareIds) ||
    spareIds.some((id) => !all.some((p) => p.id === id))
  )
    throw Error("Asigná una pieza propia de cada tipo y repuestos del lote.");
  const reservedPartIds = [...Object.values(partIds), ...spareIds];
  if (
    new Set(reservedPartIds).size !== reservedPartIds.length ||
    reservedPartIds.some((id) => jobFor(t, id))
  )
    throw Error(
      "Las piezas no pueden repetirse ni tener reparaciones pendientes.",
    );
  const out = {
    carId: car.id,
    vehicleId: car.modelId,
    driverId: driverIds[0],
    driverIds: [...driverIds],
    mechanicIds: [...mechanicIds],
    partIds: { ...partIds },
    spareIds: [...spareIds],
    reservedPartIds,
  };
  for (const other of reservations(w, t.id)) {
    if (other.eventId === r.event.eventId || !overlaps(r.event, other))
      continue;
    const conflict =
      other.carId === out.carId
        ? "auto"
        : driverIds.some((id) => other.driverIds.includes(id))
          ? "piloto"
          : mechanicIds.some((id) => other.mechanicIds.includes(id))
            ? "mecánico"
            : reservedPartIds.some((id) => pieceIds(other).includes(id))
              ? "pieza"
              : null;
    if (conflict)
      throw Error(
        `Se superpone: el ${conflict} está reservado para ${other.name}. Elegí recursos diferentes.`,
      );
  }
  return out;
}
// Only driving fields live in an entry. Assets, salaries and money have one owner.
export function participant(w, r, id) {
  const t = w.engine.teams.find((t) => t.id === id),
    e = r.entries[id];
  if (!t || !e || e.dns) return null;
  const all = pieces(t),
    runtime = e.runtime || {
      routeId: r.event.id,
      phase: "waiting",
      stageIndex: 0,
      stageKm: 0,
      totalKm: 0,
      speed: 0,
      heat: 25,
      holdUntil: 0,
      service: null,
      finishTime: null,
      history: [],
      journal: [],
      activePlan: null,
      plans: e.plans,
      activeDriver: e.driverId,
      fuel: 0,
    };
  const out = {
    ...t,
    ...runtime,
    plans: e.plans,
    participating: r.status !== "closed",
    routeId: r.event.id,
    onlineRace: r.event.eventId,
    activeCarId: e.carId,
    vehicleId: e.vehicleId,
    garage: t.garage.filter((c) => c.id === e.carId),
    drivers: t.drivers.filter((d) => e.driverIds.includes(d.id)),
    mechanics: t.mechanics
      .filter((m) => e.mechanicIds.includes(m.id))
      .map((m) => ({ ...m, assignment: "race" })),
    parts: Object.fromEntries(
      Object.entries(e.partIds).map(([type, id]) => [
        type,
        all.find((p) => p.id === id),
      ]),
    ),
    inventory: all.filter((p) => e.spareIds.includes(p.id)),
  };
  // Preserve the primary runtime facade for existing worlds and tooling.
  if (e.runtime && t.onlineRace === r.event.eventId)
    for (const k of RUNTIME_KEYS) if (t[k] !== undefined) out[k] = t[k];
  return out;
}
export function saveParticipant(w, r, p) {
  const t = w.engine.teams.find((t) => t.id === p.id),
    e = r.entries[p.id];
  if (!t) return;
  e.runtime = Object.fromEntries(
    RUNTIME_KEYS.filter((k) => p[k] !== undefined).map((k) => [k, p[k]]),
  );
  delete e.runtime.plans;
  e.plans = p.plans;
  e.partIds = Object.fromEntries(
    Object.entries(p.parts).map(([type, p]) => [type, p.id]),
  );
  e.spareIds = p.inventory.map((p) => p.id);
  t.budget = p.budget;
  t.debt = p.debt;
  t.finance = p.finance;
  t.ledger = p.ledger;
  t.progression = p.progression;
  const car = t.garage.find((c) => c.id === e.carId);
  if (car) {
    car.kitIds = { ...e.partIds };
    car.fuel = p.fuel;
  }
  if (t.activeCarId === e.carId) {
    const all = pieces(t);
    t.parts = { ...p.parts };
    t.inventory = all.filter(
      (piece) => !Object.values(e.partIds).includes(piece.id),
    );
  }
  if (t.onlineRace === r.event.eventId)
    for (const k of RUNTIME_KEYS) {
      if (p[k] === undefined) delete t[k];
      else t[k] = p[k];
    }
}
export function refreshAssignments(w) {
  for (const t of w.engine.teams) {
    const active = Object.values(w.races).filter(
      (r) =>
        r.status === "running" &&
        r.entries[t.id]?.runtime &&
        !r.entries[t.id].dns,
    );
    t.onlineActiveStaffIds = active.flatMap((r) => [
      ...r.entries[t.id].driverIds,
      ...r.entries[t.id].mechanicIds,
    ]);
    t.onlineRacingDriverIds = active
      .filter((r) => r.entries[t.id].runtime.phase === "racing")
      .map((r) => r.entries[t.id].runtime.activeDriver);
    t.onlineRaces = active.map((r) => r.event.eventId);
    for (const m of t.mechanics) {
      const busy = active.some((r) =>
        r.entries[t.id].mechanicIds.includes(m.id),
      );
      if (busy) {
        m.onlinePreviousAssignment ??= m.assignment;
        m.assignment = "race";
      } else if (m.onlinePreviousAssignment) {
        m.assignment = m.onlinePreviousAssignment;
        delete m.onlinePreviousAssignment;
      }
    }
    if (!active.some((r) => r.event.eventId === t.onlineRace)) {
      const next = active.find((r) => r.event.kind !== "short") || active[0];
      t.onlineRace = next?.event.eventId || null;
      if (next)
        for (const k of RUNTIME_KEYS) {
          const v = next.entries[t.id].runtime[k];
          if (v === undefined) delete t[k];
          else t[k] = v;
        }
      if (next) t.plans = next.entries[t.id].plans;
      else {
        t.participating = false;
        t.speed = 0;
      }
    }
    t.participating = active.length > 0;
  }
}
export function protectResources(w, t, c) {
  const reserved = reservations(w, t.id);
  if (
    c.type === "sell-part" &&
    Object.values(t.parts).some((p) => p.id === c.id)
  ) {
    const part =
      t.parts[Object.keys(t.parts).find((type) => t.parts[type].id === c.id)];
    const replacement = t.inventory.find(
      (p) => p.type === part.type && p.grade === "reserve",
    );
    if (
      replacement &&
      reserved.some((e) => pieceIds(e).includes(replacement.id))
    )
      throw Error("La reserva estándar está asignada a otra carrera.");
  }
  if (
    reserved.some(
      (e) =>
        ((c.type === "sell-car" || c.type === "enqueue-work") &&
          e.carId === c.id) ||
        (c.type === "purchase-car" && e.carId === c.tradeId) ||
        (["sell-part", "enqueue-work"].includes(c.type) &&
          pieceIds(e).includes(c.id)) ||
        (c.type === "release" &&
          [...e.driverIds, ...e.mechanicIds].includes(c.id)) ||
        (c.type === "assign-mechanic" &&
          e.status === "running" &&
          e.mechanicIds.includes(c.id)),
    )
  )
    throw Error(
      "Recurso reservado para una carrera: cancelá o modificá su inscripción antes de venderlo, repararlo o reasignarlo.",
    );
}
