import { calendar, eventById } from '../../src/competition.js';
import { routeFor } from '../../src/route.js';
import { activeCar } from '../../src/workshop.js';

const clone = x => structuredClone(x);
const pick = (x, keys) => Object.fromEntries(keys.filter(k => x[k] !== undefined).map(k => [k, clone(x[k])]));
function opponent(t) {
  const out = pick(t, ['id','name','directorName','shieldId','shieldCollection','ai','color','vehicleId','vehicleStats','routeId','participating','phase','stageIndex','stageKm','totalKm','speed','heat','fuel','activeDriver','holdUntil','finishTime','stageStart','activeCarId','statistics']);
  out.parts = clone(t.parts);
  out.garage = activeCar(t) ? [clone(activeCar(t))] : [];
  out.drivers = t.drivers.filter(d => d.id === t.activeDriver).map(d => pick(d, ['id','personId','name','image','profile','energy','form','morale','age','traits','skill','consistency','stamina','care']));
  out.mechanics = t.mechanics.filter(m => m.assignment === 'race').map(m => pick(m, ['id','name','assignment','efficiency','form','morale','traits']));
  out.plans = []; out.activePlan = t.activePlan ? pick(t.activePlan,['boost','pace']) : null;
  out.history = []; out.inventory = []; out.journal = []; out.service = t.service ? pick(t.service,['until','start','duration','tasks']) : null;
  return out;
}
// Explicit presentation projection. Never serialize the world, opponents' money, inventory, contracts or RNG.
export function viewWorld(w, id, selected) {
  const source = w.engine.teams.find(t => t.id === id);
  if (!source) throw Error('Escudería desconocida.');
  const events = calendar(w.engine, w.at - 16 * 86400000, w.at + 60 * 86400000);
  const eventId = selected || source.onlineRace || events.find(e => w.races[e.eventId]?.status === 'running')?.eventId || events.find(e => e.start > w.at)?.eventId;
  const event = eventById(w.engine, eventId);
  if (!event) throw Error('Carrera desconocida.');
  const race = w.races[eventId], own = clone(source), registration = race?.entries[id];
  own.id = 'player'; delete own.rng; delete own.ledgerSaved; delete own.ledgerOffset;
  if (source.onlineRace !== eventId) {
    Object.assign(own, {participating:!!registration && race.status === 'scheduled', phase:registration && race.status === 'scheduled'?'waiting':'unregistered', stageIndex:0,stageKm:0,totalKm:0,speed:0,heat:25,holdUntil:0,service:null,activePlan:null,finishTime:null,history:[],journal:[],plans:clone(registration?.plans || routeFor(event.id).stages.map(()=>null))});
    if (registration && race.status === 'scheduled') {
      own.activeCarId=registration.carId; own.vehicleId=own.garage.find(c=>c.id===registration.carId)?.modelId || own.vehicleId;
      own.activeDriver=registration.driverId;
    }
  }
  const others = race?.status === 'running' ? [...Object.keys(race.entries).filter(other => other!==id && !race.entries[other].dns).map(other=>w.engine.teams.find(t=>t.id===other)),...race.bots].filter(Boolean).map(opponent) : [];
  const owners = Object.fromEntries(Object.entries(w.engine.management.owners).map(([k,v])=>[k,v===id?'player':v]));
  return {
    version:4, mode:'online', id:eventId, routeId:event.id, startAt:new Date(event.start).toISOString(), clock:(w.at-event.start)/1000, speed:1,
    teams:[own,...others],events:[],eventCounter:0,employment:clone(w.engine.employment),
    championship:{...pick(w.engine.championship,['startAt','round']),results:[]},
    management:{catalog: w.engine.management.catalog, stocks:w.engine.management.stocks, owners, auctions:w.engine.management.auctions.filter(a=>a.status==='open').map(a=>({...pick(a,['id','kind','personId','closesAt','status']),bids:a.bids.filter(b=>b.teamId===id).map(b=>({...b,teamId:'player'}))}))},
    competition:{version:1,epoch:w.epoch,currentId:eventId,closed:race?.status==='closed',started:race?.status==='running',closedAt:race?.closedAt||null,firstFinishAt:race?.firstFinish??null,
      registrations:Object.values(w.races).filter(r=>r.entries[id]).map(r=>({eventId:r.event.eventId,...clone(r.entries[id])})),
      results:Object.values(w.races).filter(r=>r.status==='closed').map(r=>({eventId:r.event.eventId,routeId:r.event.id,closedAt:r.closedAt,entries:r.results.map(x=>({id:x.teamId===id?'player':x.teamId,position:x.position,finished:x.finished,km:x.distanceKm,prize:x.prizeCents/100,stages:x.details?.stages?.length||0}))}))},
    online:{at:w.at,ownId:id,ownRace:source.onlineRace||null,stats:w.stats[id],events:events.map(e=>({...e,status:w.races[e.eventId]?.status||'scheduled'}))}
  };
}
