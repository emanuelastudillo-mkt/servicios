import { advanceWorld, events } from "./world.js";
const DAY = 86400000;
export const roundTime = (at) => Math.floor(at / 30000) * 30000;

// Continuous telemetry is deliberately absent: only decisions and durable events wake the room.
export function transitionKey(w) {
  return JSON.stringify([
    Object.values(w.races).map((r) => [
      r.event.eventId,
      r.status,
      Object.entries(r.entries).map(([id, e]) => [
        id,
        e.dns,
        e.runtime?.phase,
        e.runtime?.stageIndex,
      ]),
      r.bots.map((t) => [t.id, t.phase, t.stageIndex]),
    ]),
    w.engine.teams.map((t) => [
      t.id,
      t.workshop?.jobs.map((j) => j.id),
      t.ledger.length + (t.ledgerOffset || 0),
      [...t.drivers, ...t.mechanics].map((p) => [p.id, p.age]),
    ]),
    w.engine.management.auctions.map((a) => [a.id, a.status]),
    w.engine.employment?.nextPayrollAt,
  ]);
}
export function projectTime(w, now) {
  const result = advanceWorld(
    w,
    now,
    Math.min(6 * 3600, Math.max(0, (now - w.at) / 1000) + 30),
    {
      idleJump: true,
    },
  );
  return { ...result, caughtUp: w.at >= roundTime(now) };
}
export function forecastNext(w) {
  const nextStart = events(w, w.at + 1, w.at + 3 * DAY).find(
    (e) => e.start > w.at,
  )?.start;
  const maintenance = Math.floor(w.at / DAY) * DAY + DAY;
  const limit = Math.min(nextStart || Infinity, maintenance, w.at + DAY);
  const future = structuredClone(w);
  advanceWorld(
    future,
    Math.max(w.at + 30000, limit),
    (limit - w.at) / 1000 + 30,
    { idleJump: true, boundary: transitionKey },
  );
  return { at: future.at, world: future };
}
