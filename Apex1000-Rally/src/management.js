import { recordCash, startContract } from "./employment.js";
import { CATALOG } from "../data/catalog.js";
import { DRIVER_PROFILES, vehicle } from "./catalog.js";
import {
  crewRate,
  mechanicsAt,
  placeNewMechanic,
  selectVehicle,
  purchaseVehicle,
} from "./workshop.js";
export const LIMITS = { driver: 3, mechanic: 5 };
const roster = (t, kind) => (kind === "driver" ? t.drivers : t.mechanics);
const people = (state, kind) =>
  kind === "driver"
    ? state.management.catalog.drivers
    : state.management.catalog.mechanics;
export const seasonTime = (s) =>
  (Date.parse(s.startAt) - Date.parse(s.championship.startAt)) / 1000 + s.clock;
export function cash(state, t, amount, label) {
  recordCash(state, t, amount, label);
}
export function initializeManagement(
  state,
  { legacy = false, catalog: source = CATALOG } = {},
) {
  if (state.management) return;
  const catalog = structuredClone(source);
  state.routeId = "andes";
  state.management = {
    catalog,
    stocks: Object.fromEntries(
      [...catalog.vehicles, ...catalog.parts].map((x) => [x.id, x.stock]),
    ),
    owners: {},
    auctions: [],
    sequence: 0,
  };
  state.championship = {
    startAt: state.startAt,
    round: 0,
    results: [],
    paid: false,
    points: Object.fromEntries(state.teams.map((t) => [t.id, 0])),
  };
  state.teams.forEach((t, i) => {
    t.routeId = "andes";
    t.shieldId = i + 1;
    t.garage = [t.vehicleId];
    t.mechanics = [];
    t.initialBudget = Math.round(
      t.budget - t.ledger.reduce((sum, l) => sum + l.amount, 0),
    );
    t.drivers.forEach((d, j) => {
      d.personId = t.ai ? `${t.id}-${d.id}` : ["lucia", "bruno", "mateo"][j];
      d.salary = t.ai
        ? 0
        : catalog.drivers.find((p) => p.id === d.personId).salary;
      d.image = `assets/art/${["lucia", "bruno", "mateo"][j]}.webp`;
      if (!t.ai && !legacy) {
        const person = catalog.drivers.find((x) => x.id === d.personId),
          id = d.id,
          energy = d.energy;
        Object.assign(
          d,
          DRIVER_PROFILES.find((p) => p.id === person.profile),
          person,
          { id, personId: person.id, energy },
        );
      }
      if (t.ai) d.name = `${["Sol", "Nico", "Dani"][j]} · ${t.name}`;
      state.management.owners[d.personId] = t.id;
    });
    if (t.ai && !legacy) {
      const removed = t.drivers.pop();
      delete state.management.owners[removed.personId];
      for (const p of t.plans)
        if (p && !t.drivers.some((d) => d.id === p.driverId))
          p.driverId = t.drivers[0].id;
    }
    const mechanic = t.ai
      ? {
          id: `${t.id}-mechanic`,
          name: `Asistencia ${i}`,
          salary: 0,
          efficiency: 1.1,
          image: "assets/art/tomas.webp",
        }
      : structuredClone(catalog.mechanics.find((m) => m.id === "elena"));
    t.mechanics.push(mechanic);
    state.management.owners[mechanic.id] = t.id;
    if (!legacy && catalog.schemaVersion !== 2) chargeSalaries(state, t);
  });
  const selected = state.management.stocks[state.teams[0].vehicleId];
  state.management.stocks[state.teams[0].vehicleId] = Math.max(0, selected - 1);
}
export function chargeSalaries(state, t) {
  if (state.employment) return; // Monthly payroll replaces per-race salaries.
  const due = [...t.drivers, ...t.mechanics].reduce(
      (sum, p) => sum + (p.salary || 0),
      0,
    ),
    amount =
      state.competition &&
      state.management.catalog.races.find((r) => r.id === state.routeId)
        ?.kind === "short"
        ? Math.round(due * 0.2)
        : due,
    paid = Math.min(amount, t.budget);
  cash(state, t, -paid, "Sueldos de la carrera");
  t.debt += amount - paid;
}
export function workshopRate(t) {
  return Math.max(0.25, crewRate(t, "race"));
}
export function bid(state, kind, personId, salary) {
  if (!["driver", "mechanic"].includes(kind))
    throw Error("Tipo de contratación inválido.");
  const m = state.management,
    t = state.teams.find((t) => t.id === "player"),
    person = people(state, kind).find((p) => p.id === personId);
  if (state.championship.paid) throw Error("El campeonato terminó.");
  if (!person?.available || m.owners[personId])
    throw Error("Esta persona ya tiene equipo o no está disponible.");
  if (
    !Number.isSafeInteger(salary) ||
    salary < person.salary ||
    salary > 1000000
  )
    throw Error("Ofrecé un sueldo entero igual o mayor al mínimo.");
  let a = m.auctions.find(
    (a) => a.personId === personId && a.status === "open",
  );
  if (a && seasonTime(state) >= a.closesAt)
    throw Error("La oferta cerró. Avanzá el reloj para liquidarla.");
  const previous = a?.bids.find((b) => b.teamId === t.id);
  const pending = m.auctions.filter(
    (a) =>
      a.kind === kind &&
      a.status === "open" &&
      a.bids.some((b) => b.teamId === t.id) &&
      a.personId !== personId,
  ).length;
  if (roster(t, kind).length + pending >= LIMITS[kind])
    throw Error(
      `Máximo ${LIMITS[kind]} ${kind === "driver" ? "pilotos" : "mecánicos"}, incluyendo ofertas pendientes. Liberá un lugar primero.`,
    );
  if (previous && salary <= previous.salary)
    throw Error("La nueva oferta debe mejorar la anterior.");
  const difference = salary - (previous?.salary || 0);
  if (t.budget < difference)
    throw Error("No alcanza el saldo para reservar ese sueldo.");
  if (!a) {
    const duration =
      m.catalog.settings.find((s) => s.key === "auctionHours").value * 3600;
    a = {
      id: `offer-${++m.sequence}`,
      kind,
      personId,
      status: "open",
      openedAt: seasonTime(state),
      closesAt: seasonTime(state) + duration,
      bids: [],
    };
    m.auctions.push(a);
    // Deterministic simulated rival offer; never an actual online participant.
    const rival = state.teams
      .slice(1)
      .find((t) => roster(t, kind).length < LIMITS[kind]);
    if (rival)
      a.bids.push({
        teamId: rival.id,
        salary: Math.round(person.salary * (1.08 + (m.sequence % 4) * 0.08)),
        sequence: ++m.sequence,
        escrow: 0,
      });
  }
  cash(state, t, -difference, `Reserva de oferta: ${person.name}`);
  if (previous) ((previous.salary = salary), (previous.escrow = salary));
  else
    a.bids.push({
      teamId: t.id,
      salary,
      escrow: salary,
      sequence: ++m.sequence,
    });
  return a;
}
export function cancelBid(state, auctionId) {
  const a = state.management.auctions.find((a) => a.id === auctionId),
    t = state.teams.find((t) => t.id === "player");
  if (!a || a.status !== "open" || seasonTime(state) >= a.closesAt)
    throw Error("La oferta ya está cerrada.");
  const i = a.bids.findIndex((b) => b.teamId === t.id);
  if (i < 0) throw Error("No hay una oferta tuya.");
  cash(state, t, a.bids[i].escrow, "Devolución de oferta cancelada");
  a.bids.splice(i, 1);
}
export function settleAuctions(state) {
  if (!state.management) return;
  const m = state.management;
  for (const a of m.auctions) {
    if (a.status !== "open" || seasonTime(state) < a.closesAt) continue;
    const person = people(state, a.kind).find((p) => p.id === a.personId);
    const ordered = [...a.bids].sort(
      (a, b) => b.salary - a.salary || a.sequence - b.sequence,
    );
    const winner =
      !m.owners[a.personId] &&
      ordered.find((b) => {
        const t = state.teams.find((t) => t.id === b.teamId);
        return (
          t &&
          roster(t, a.kind).length < LIMITS[a.kind] &&
          t.budget + b.escrow >= b.salary
        );
      });
    a.status = "closed";
    a.winnerId = winner?.teamId || null;
    a.winningSalary = winner?.salary || 0;
    for (const b of a.bids) {
      const t = state.teams.find((t) => t.id === b.teamId);
      if (b !== winner && b.escrow)
        cash(state, t, b.escrow, `Oferta no ganadora: ${person.name}`);
      if (b === winner) {
        if (state.employment && b.escrow)
          cash(
            state,
            t,
            b.escrow,
            `Reserva liberada al firmar: ${person.name}`,
          );
        if (!state.employment && b.salary > b.escrow)
          cash(state, t, -(b.salary - b.escrow), `Contrato: ${person.name}`);
        const hired =
          a.kind === "driver"
            ? {
                ...DRIVER_PROFILES.find((d) => d.id === person.profile),
                ...person,
                id: `hire-${person.id}`,
                personId: person.id,
                energy: 100,
                salary: b.salary,
              }
            : { ...person, salary: b.salary };
        if (state.employment)
          startContract(
            state,
            t,
            hired,
            a.kind,
            Date.parse(state.championship.startAt) + a.closesAt * 1000,
            people(state, a.kind).findIndex((p) => p.id === person.id),
          );
        roster(t, a.kind).push(hired);
        if (a.kind === "driver" && !t.activeDriver) t.activeDriver = hired.id;
        if (a.kind === "mechanic") placeNewMechanic(t, hired);
        m.owners[person.id] = t.id;
      }
      b.escrow = 0;
    }
  }
}
export function releasePerson(state, kind, id) {
  if (!["driver", "mechanic"].includes(kind)) throw Error("Tipo inválido.");
  const t = state.teams.find((t) => t.id === "player"),
    list = roster(t, kind),
    at = list.findIndex((p) => p.id === id);
  if (at < 0) throw Error("La persona no pertenece al equipo.");
  if (["racing", "service"].includes(t.phase))
    throw Error("Los contratos se cambian cuando el equipo está detenido.");
  if (kind === "driver" && list.length <= 1)
    throw Error("Necesitás al menos un piloto.");
  if (
    kind === "mechanic" &&
    (list[at].assignment || "race") === "race" &&
    mechanicsAt(t, "race").length <= 1
  )
    throw Error(
      "Debe quedar al menos un mecánico en carrera. El taller puede quedar sin personal y pausado.",
    );
  const [person] = list.splice(at, 1);
  if (state.employment) {
    const ref = people(state, kind).find(
      (p) => p.id === (person.personId || person.id),
    );
    if (ref)
      Object.assign(ref, {
        salary: person.salary,
        age: person.age,
        form: Math.round(person.form),
        morale: Math.round(person.morale),
        traits: person.traits,
      });
    if (state.competition && kind === "driver")
      state.competition.registrations = state.competition.registrations.filter(
        (r) =>
          r.driverId !== id ||
          Number(r.eventId.split("@").at(-1)) <
            Date.parse(state.startAt) + state.clock * 1000,
      );
  }
  delete state.management.owners[person.personId || person.id];
  if (kind === "driver") {
    if (t.activeDriver === id) t.activeDriver = t.drivers[0].id;
    for (const plan of t.plans)
      if (plan?.driverId === id) plan.driverId = t.drivers[0].id;
    if (t.activePlan?.driverId === id) t.activePlan.driverId = t.drivers[0].id;
  }
  return person;
}
export function buyVehicle(state, id) {
  const t = state.teams.find((t) => t.id === "player");
  if (!["waiting", "finished"].includes(t.phase))
    throw Error("Cambiá de vehículo antes de largar o después de la carrera.");
  const owned = t.garage.find((c) => c.modelId === id);
  const car = owned || purchaseVehicle(state, id);
  selectVehicle(state, car.id);
}
export function championshipStandings(state) {
  return [...state.teams].sort(
    (a, b) =>
      (state.championship.points[b.id] || 0) -
        (state.championship.points[a.id] || 0) ||
      state.championship.results.reduce(
        (s, r) => s + (r.entries.find((e) => e.id === a.id)?.time || 0),
        0,
      ) -
        state.championship.results.reduce(
          (s, r) => s + (r.entries.find((e) => e.id === b.id)?.time || 0),
          0,
        ) ||
      a.id.localeCompare(b.id),
  );
}
export function recordRound(state) {
  if (state.competition) return;
  if (!state.championship || !state.teams.every((t) => t.phase === "finished"))
    return;
  const c = state.championship,
    m = state.management;
  if (c.results.some((r) => r.round === c.round)) return;
  const entries = [...state.teams]
    .sort((a, b) => a.finishTime - b.finishTime || a.id.localeCompare(b.id))
    .map((t, i) => ({
      id: t.id,
      position: i + 1,
      time: t.finishTime,
      points: m.catalog.prizes[i].points,
      prize: t.prize.net,
    }));
  c.results.push({ round: c.round, routeId: state.routeId, entries });
  entries.forEach((e) => (c.points[e.id] += e.points));
  if (c.round === 7 && !c.paid) {
    c.paid = true;
    c.final = championshipStandings(state).map((t, i) => {
      const gross = m.catalog.prizes[i].championship,
        settled = Math.min(gross, t.debt),
        net = gross - settled;
      t.debt -= settled;
      cash(state, t, net, `Premio de campeonato P${i + 1}`);
      return { id: t.id, position: i + 1, gross, settled, net };
    });
  }
}
