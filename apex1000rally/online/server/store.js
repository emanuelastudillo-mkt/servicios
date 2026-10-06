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
// One SQL statement per small group keeps payroll and a 25-team finish below D1 Free's query limit.
function inserts(db, table, columns, rows, key) {
  const output=[], size=Math.floor(90/columns.length);
  for(let i=0;i<rows.length;i+=size) {
    const chunk=rows.slice(i,i+size);
    const values=chunk.map(()=>"("+columns.map(()=>"?").join(",")+")").join(",");
    output.push(db.prepare(`WITH incoming(${columns.join(',')}) AS (VALUES ${values}) INSERT OR IGNORE INTO ${table}(${columns.join(',')}) SELECT * FROM incoming WHERE ${guard}`).bind(...chunk.flat(),key));
  }
  return output;
}
export async function commit(db, previous, w, key, extras = []) {
  const revision=previous.revision+1,ledger=[],results=[];
  for(const t of w.engine.teams) {
    const offset=t.ledgerOffset||0,saved=t.ledgerSaved||0;
    for(const [i,l] of t.ledger.entries())if(offset+i>=saved)ledger.push([t.id,offset+i,l.at,Math.round(l.amount*100),l.label]);
    t.ledgerSaved=offset+t.ledger.length;
  }
  for(const r of w.processed)results.push([r.raceId,r.circuitId,r.teamId,r.director,r.name,r.isBot?1:0,r.vehicleId,r.rulesVersion,r.catalogRevision,r.position,r.finished?1:0,r.finishSeconds,r.distanceKm,r.drivingSeconds,r.prizeCents,r.closedAt,JSON.stringify(r.details)]);
  compact(w);
  const state=JSON.stringify(w);
  if(new TextEncoder().encode(state).length>1800000)throw Error('La sala superó su tamaño de seguridad. No se guardaron cambios; revisar el histórico.');
  const first=previous.revision<0?db.prepare('INSERT OR IGNORE INTO world(id,revision,commit_key,state_json,updated_at) VALUES(1,?,?,?,?)').bind(revision,key,state,w.at):db.prepare('UPDATE world SET revision=?,commit_key=?,state_json=?,updated_at=? WHERE id=1 AND revision=?').bind(revision,key,state,w.at,previous.revision);
  const projection=db.prepare(`INSERT INTO snapshots(id,revision,payload_json) SELECT 1,?,? WHERE ${guard} ON CONFLICT(id) DO UPDATE SET revision=excluded.revision,payload_json=excluded.payload_json`).bind(revision,JSON.stringify(publicWorld(w)),key);
  const statements=[first,...extras.map(make=>make(guard,key)),...inserts(db,'ledger',['team_id','sequence','at','amount_cents','label'],ledger,key),...inserts(db,'results',['race_id','circuit_id','team_id','director','team_name','is_bot','vehicle_id','rules_version','catalog_revision','position','finished','finish_seconds','distance_km','driving_seconds','prize_cents','closed_at','details_json'],results,key),projection];
  if(statements.length>40)throw Error('Demasiados movimientos para un solo paso. Revisar la sala antes de continuar.');
  const out=await db.batch(statements);
  return out[0].meta.changes===1;
}
