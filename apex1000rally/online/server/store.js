import { createWorld, publicWorld } from "./world.js";
const guard = "EXISTS(SELECT 1 FROM world WHERE id=1 AND commit_key=?)";
export async function readWorld(db, now, epoch) {
  const row = await db
    .prepare("SELECT revision,state_json FROM world WHERE id=1")
    .first();
  return row
    ? { revision: row.revision, world: JSON.parse(row.state_json) }
    : { revision: -1, world: createWorld(now, epoch) };
}
export function compact(w) {
  for (const t of w.engine.teams) {
    if (t.ledger.length > 120) {
      const removed = t.ledger.length - 120;
      t.ledger.splice(0, removed);
      t.ledgerOffset = (t.ledgerOffset || 0) + removed;
    }
  }
  const closed = Object.values(w.races)
    .filter((r) => r.status === "closed" && r.event.end <= w.at)
    .sort((a, b) => b.closedAt - a.closedAt);
  for (const r of closed.slice(3)) delete w.races[r.event.eventId];
  w.engine.management.auctions = w.engine.management.auctions.filter(
    (a) =>
      a.status === "open" ||
      Date.parse(w.epoch) + a.closesAt * 1000 > w.at - 7 * 86400000,
  );
  w.processed = [];
}
export async function commit(db, previous, w, key, extras = []) {
  const revision = previous.revision + 1;
  const writes = [];
  for (const t of w.engine.teams) {
    const offset = t.ledgerOffset || 0,
      saved = t.ledgerSaved || 0;
    for (const [i, l] of t.ledger.entries())
      if (offset + i >= saved)
        writes.push(
          db
            .prepare(
              `INSERT OR IGNORE INTO ledger(team_id,sequence,at,amount_cents,label) SELECT ?,?,?,?,? WHERE ${guard}`,
            )
            .bind(
              t.id,
              offset + i,
              l.at,
              Math.round(l.amount * 100),
              l.label,
              key,
            ),
        );
    t.ledgerSaved = offset + t.ledger.length;
  }
  for (const r of w.processed)
    writes.push(
      db
        .prepare(
          `INSERT OR IGNORE INTO results(race_id,circuit_id,team_id,director,team_name,is_bot,vehicle_id,rules_version,catalog_revision,position,finished,finish_seconds,distance_km,driving_seconds,prize_cents,closed_at,details_json) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${guard}`,
        )
        .bind(
          r.raceId,
          r.circuitId,
          r.teamId,
          r.director,
          r.name,
          r.isBot ? 1 : 0,
          r.vehicleId,
          r.rulesVersion,
          r.catalogRevision,
          r.position,
          r.finished ? 1 : 0,
          r.finishSeconds,
          r.distanceKm,
          r.drivingSeconds,
          r.prizeCents,
          r.closedAt,
          JSON.stringify(r.details),
          key,
        ),
    );
  compact(w);
  const state = JSON.stringify(w);
  if (new TextEncoder().encode(state).length > 1800000)
    throw Error(
      "La sala superó su tamaño de seguridad. No se guardaron cambios; revisar el histórico.",
    );
  const first =
    previous.revision < 0
      ? db
          .prepare(
            "INSERT OR IGNORE INTO world(id,revision,commit_key,state_json,updated_at) VALUES(1,?,?,?,?)",
          )
          .bind(revision, key, state, w.at)
      : db
          .prepare(
            "UPDATE world SET revision=?,commit_key=?,state_json=?,updated_at=? WHERE id=1 AND revision=?",
          )
          .bind(revision, key, state, w.at, previous.revision);
  const projection = db
    .prepare(
      `INSERT INTO snapshots(id,revision,payload_json) SELECT 1,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json`,
    )
    .bind(revision, JSON.stringify(publicWorld(w)), key);
  const out = await db.batch([
    first,
    ...extras.map((make) => make(guard, key)),
    ...writes,
    projection,
  ]);
  return out[0].meta.changes === 1;
}
