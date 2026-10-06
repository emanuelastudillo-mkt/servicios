import { initializeEmployment } from "./employment.js";
import { CATALOG } from "../data/catalog.js";
import { routeFor } from "./route.js";
import { activeCar, jobFor, crewRate } from "./workshop.js";
import { initializeProgression } from "./progression.js";
const HOUR = 3600000,
  DAY = 24 * HOUR;
export const raceNow = (s) => Date.parse(s.startAt) + s.clock * 1000;
export function calendar(
  s,
  from = raceNow(s) - 16 * DAY,
  to = raceNow(s) + 60 * DAY,
) {
  const epoch = Date.parse(s.competition?.epoch || s.championship.startAt);
  const events = [];
  for (const r of s.management.catalog.races) {
    const cycle = (r.kind === "short" ? 48 : 224) * DAY;
    const base = epoch + r.startDay * DAY;
    const first = Math.max(0, Math.floor((from - base) / cycle));
    for (let i = first; base + i * cycle <= to; i++) {
      const start = base + i * cycle,
        end = start + (r.maxHours || 480) * HOUR;
      if (end < from) continue;
      events.push({ ...r, eventId: `${r.id}@${start}`, start, end });
    }
  }
  return events.sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
}
export function eventById(s, id) {
  if (typeof id !== "string") return null;
  const at = id.lastIndexOf("@"),
    routeId = id.slice(0, at),
    start = Number(id.slice(at + 1));
  const r = s.management.catalog.races.find((x) => x.id === routeId);
  if (!r || !Number.isSafeInteger(start)) return null;
  const base =
    Date.parse(s.competition?.epoch || s.championship.startAt) +
    r.startDay * DAY;
  const cycle = (r.kind === "short" ? 48 : 224) * DAY;
  if (start < base || (start - base) % cycle !== 0) return null;
  return { ...r, eventId: id, start, end: start + (r.maxHours || 480) * HOUR };
}
export function currentEvent(s) {
  return eventById(s, s.competition?.currentId);
}
export function enrollmentReason(s, e) {
  if (!e || raceNow(s) >= e.start) return "La inscripción cerró al largar.";
  if (s.competition.registrations.some((r) => r.eventId === e.eventId))
    return "Ya estás inscripto.";
  if (
    s.competition.registrations.some((r) => {
      const x = eventById(s, r.eventId);
      return x && e.start < x.end && x.start < e.end;
    })
  )
    return "Se superpone con el intervalo máximo de otra inscripción.";
  const t = s.teams.find((t) => t.id === "player"),
    car = activeCar(t);
  if (!car) return "Comprá y seleccioná un vehículo.";
  if (jobFor(t, car.id)) return "El auto tiene un trabajo pendiente.";
  if (!t.drivers.length || !crewRate(t, "race"))
    return "Necesitás un piloto y un mecánico en carrera.";
  const due = Math.round(
    [...t.drivers, ...t.mechanics].reduce((n, p) => n + (p.salary || 0), 0) *
      (e.kind === "short" ? 0.2 : 1),
  );
  if (t.budget < (s.employment ? 0 : due) + 1500)
    return s.employment
      ? "Reservá 1.500 cr para combustible."
      : "Reservá saldo para sueldos y combustible (1.500 cr).";
  return "";
}
export function enroll(s, id, driverId) {
  const e = eventById(s, id),
    reason = enrollmentReason(s, e);
  if (reason) throw Error(reason);
  const t = s.teams.find((t) => t.id === "player");
  if (!t.drivers.some((d) => d.id === (driverId || t.activeDriver)))
    throw Error("Piloto desconocido.");
  s.competition.registrations.push({
    eventId: id,
    carId: t.activeCarId,
    driverId: driverId || t.activeDriver,
  });
  if (id === s.competition.currentId) {
    t.participating = true;
    t.phase = "waiting";
  }
  if (id === s.competition.currentId && e.kind === "short" && t.plans[0])
    t.plans[0].driverId = driverId || t.activeDriver;
}
export function cancelEnrollment(s, id) {
  const e = eventById(s, id);
  if (!e || raceNow(s) >= e.start) throw Error("La inscripción ya cerró.");
  s.competition.registrations = s.competition.registrations.filter(
    (r) => r.eventId !== id,
  );
  if (id === s.competition.currentId) {
    const t = s.teams.find((t) => t.id === "player");
    t.participating = false;
    t.phase = "unregistered";
  }
}
export function initializeCompetition(s, { legacy = false } = {}) {
  initializeProgression(s);
  if (s.competition) return;
  if (legacy) {
    // Keep prices already paid, personal contracts and stock; append new references only.
    for (const key of ["vehicles", "drivers", "mechanics", "races"])
      for (const row of CATALOG[key])
        if (!s.management.catalog[key].some((x) => x.id === row.id)) {
          s.management.catalog[key].push(structuredClone(row));
          if (key === "vehicles") s.management.stocks[row.id] = row.stock;
        }
    s.management.catalog.races.forEach((r) => {
      const now = CATALOG.races.find((x) => x.id === r.id);
      r.kind = now?.kind || "raid";
      r.maxHours = now?.maxHours || 480;
    });
    s.management.catalog.schemaVersion = 2;
    s.management.catalog.prizes.forEach(
      (p, i) => (p.short = CATALOG.prizes[i].short),
    );
  }
  const epoch = s.championship.startAt,
    id = `${s.routeId}@${Date.parse(s.startAt)}`;
  s.competition = {
    version: 1,
    epoch,
    currentId: id,
    registrations: [],
    results: [],
    closed: false,
    firstFinishAt: null,
    closedAt: null,
    started: legacy && s.clock >= 0,
  };
  for (const t of s.teams) t.participating = t.ai || legacy;
  const t = s.teams.find((t) => t.id === "player");
  if (legacy) {
    const old = s.championship.results.find((r) => r.routeId === s.routeId);
    for (const r of s.championship.results) {
      const spec = s.management.catalog.races.find((x) => x.id === r.routeId);
      const eventId = `${r.routeId}@${Date.parse(epoch) + spec.startDay * DAY}`;
      s.competition.results.push({
        eventId,
        routeId: r.routeId,
        closedAt: raceNow(s),
        reason: "legacy",
        entries: r.entries.map((e) => ({
          id: e.id,
          position: e.position,
          time: e.time,
          prize: e.prize,
          finished: true,
          km: routeFor(r.routeId).totalKm,
        })),
      });
    }
    s.competition.registrations.push({
      eventId: id,
      carId: t.activeCarId,
      driverId: t.activeDriver,
    });
    const finishers = s.teams.filter((t) => t.finishTime !== null);
    if (finishers.length)
      s.competition.firstFinishAt = Math.min(
        ...finishers.map((t) => t.finishTime),
      );
    if (old) {
      s.competition.closed = true;
      s.competition.closedAt = raceNow(s);
    }
  } else t.phase = "unregistered";
  s.championship.paid = false;
  initializeEmployment(s);
}
export function raceDeadline(s) {
  const e = currentEvent(s);
  if (!e) return Infinity;
  const first = s.competition.firstFinishAt;
  return Math.min(e.maxHours * 3600, first === null ? Infinity : first + 86400);
}
export function validateCompetition(s) {
  const c = s.competition,
    fail = () => {
      throw Error("Inscripciones o calendario inválidos.");
    };
  if (typeof c?.started !== "boolean" || (!c.closed && c.closedAt !== null))
    fail();
  if (
    c?.version !== 1 ||
    !Number.isFinite(Date.parse(c.epoch)) ||
    !currentEvent(s) ||
    currentEvent(s).id !== s.routeId ||
    Date.parse(s.startAt) !== currentEvent(s).start ||
    !Array.isArray(c.registrations) ||
    c.registrations.length > 1000 ||
    !Array.isArray(c.results) ||
    c.results.length > 1000 ||
    typeof c.closed !== "boolean" ||
    (c.firstFinishAt !== null &&
      !(
        Number.isFinite(c.firstFinishAt) &&
        c.firstFinishAt >= 0 &&
        c.firstFinishAt <= s.clock
      )) ||
    (c.closed && (!Number.isFinite(c.closedAt) || c.closedAt > raceNow(s)))
  )
    fail();
  const ids = new Set();
  for (const r of c.registrations) {
    const e = eventById(s, r.eventId);
    if (
      !e ||
      ids.has(r.eventId) ||
      typeof r.carId !== "string" ||
      typeof r.driverId !== "string"
    )
      fail();
    ids.add(r.eventId);
  }
  for (let i = 0; i < c.registrations.length; i++)
    for (let j = 0; j < i; j++) {
      const a = eventById(s, c.registrations[i].eventId),
        b = eventById(s, c.registrations[j].eventId);
      if (a.start < b.end && b.start < a.end) fail();
    }
  const resultIds = new Set();
  for (const r of c.results) {
    if (
      !eventById(s, r.eventId) ||
      resultIds.has(r.eventId) ||
      !Number.isFinite(r.closedAt) ||
      r.closedAt > raceNow(s) ||
      !Array.isArray(r.entries) ||
      r.entries.length > 12 ||
      new Set(r.entries.map((e) => e.id)).size !== r.entries.length
    )
      fail();
    resultIds.add(r.eventId);
    for (const [i, e] of r.entries.entries())
      if (
        (e.stages !== undefined &&
          (!Number.isInteger(e.stages) ||
            e.stages < 0 ||
            e.stages > routeFor(r.routeId).stages.length)) ||
        !s.teams.some((t) => t.id === e.id) ||
        e.position !== i + 1 ||
        !Number.isFinite(e.km) ||
        e.km < 0 ||
        typeof e.finished !== "boolean" ||
        !Number.isFinite(e.prize) ||
        e.prize < 0 ||
        (e.time !== null && (!Number.isFinite(e.time) || e.time < 0))
      )
        fail();
  }
  for (const t of s.teams) if (typeof t.participating !== "boolean") fail();
  if (c.closed && !c.results.some((r) => r.eventId === c.currentId)) fail();
  return s;
}
