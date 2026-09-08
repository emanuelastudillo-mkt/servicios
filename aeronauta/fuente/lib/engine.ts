import { CITIES, AIRCRAFT, EVENTS, city, aircraft } from './catalog.ts';

export type Plane = { id: string; model: string };
export type Route = { id: string; to: string; plane: string; fare: number; frequency: number };
export type Report = { turn: number; revenue: number; costs: number; profit: number; passengers: number; occupancy: number; cash: number; event: string; routes: { id: string; profit: number; passengers: number; occupancy: number }[] };
export type Game = { version: 1; name: string; hub: string; turn: number; cash: number; reputation: number; fleet: Plane[]; routes: Route[]; history: Report[]; event: number; seed: number; nextId: number; bankrupt: boolean; won: boolean; rivals: { name: string; routes: number; score: number; color: string }[] };
export const GOAL_ROUTES = 8;
export const OVERHEAD = 450000;
export const SAVE_KEY = 'aeronauta-save-v1';
export function distance(a: string, b: string) {
  const p = city(a), q = city(b); if (!p || !q) throw Error('Aeropuerto desconocido.');
  const rad = Math.PI / 180;
  const h = Math.sin((q.lat-p.lat)*rad/2)**2 + Math.cos(p.lat*rad)*Math.cos(q.lat*rad)*Math.sin((q.lon-p.lon)*rad/2)**2;
  return Math.round(6371*2*Math.asin(Math.sqrt(Math.min(1,h))));
}
export const recommendedFare = (from: string, to: string) => Math.round((75 + distance(from,to)*.095)/5)*5;
export const openingCost = (from: string, to: string) => Math.round(250000 + distance(from,to)*65);
export function maxFrequency(from: string, to: string, model: string) { return Math.min(35, Math.max(1, Math.floor(112/(2*(distance(from,to)/aircraft(model).speed+.6))))); }
export function createGame(name = 'Sur Aviation', hub = 'EZE', demo = true): Game {
  if (!name.trim() || name.trim().length > 30) throw Error('El nombre debe tener entre 1 y 30 caracteres.');
  if (!city(hub)) throw Error('Elegí una base válida.');
  const s: Game = { version:1, name:name.trim(), hub, turn:0, cash:240e6, reputation:65, fleet:[], routes:[], history:[], event:0, seed:2026, nextId:1, bankrupt:false, won:false, rivals:[{name:'Meridian Air',routes:12,score:72,color:'#96b7d8'},{name:'Vértice Airways',routes:9,score:66,color:'#d9b578'},{name:'Nómada',routes:6,score:58,color:'#b7a4cd'}] };
  if (demo && hub === 'EZE') {
    for (const to of ['SCL','GRU']) { const id = `p${s.nextId++}`; s.fleet.push({id,model:'e195'}); s.cash -= aircraft('e195').price + openingCost(hub,to); s.routes.push({id:`r${s.nextId++}`,to,plane:id,fare:recommendedFare(hub,to),frequency:7}); }
  }
  return s;
}
const guard = (s: Game) => { if(s.bankrupt) throw Error('La aerolínea está en quiebra. Creá una nueva partida.'); };
export function routeEstimate(s: Game, route: Route) {
  const plane = s.fleet.find(p=>p.id===route.plane); if (!plane) throw Error('Asigná un avión a la ruta.');
  const model=aircraft(plane.model), km=distance(s.hub,route.to), event=EVENTS[s.event];
  const flights=route.frequency*2*13, capacity=flights*model.seats;
  const market=(city(s.hub).demand+city(route.to).demand)/2;
  const season=[1,1.08,1.16,1.06][s.turn%4];
  const competitiveShare=Math.max(.52,.83-s.rivals.reduce((n,r)=>n+r.routes,0)*.003);
  const demand=44000*market*Math.pow(2500/(km+1700),.28)*season*event.demand*(.60+s.reputation/130)*competitiveShare*Math.pow(recommendedFare(s.hub,route.to)/route.fare,2.15);
  const passengers=Math.floor(Math.min(capacity*.96,demand));
  const flightHours=km/model.speed;
  const revenue=Math.round(passengers*route.fare);
  const fuel=Math.round(flights*flightHours*model.fuel*.92*event.fuel);
  const crew=Math.round(flights*(flightHours+.6)*(model.seats>250?1450:750));
  const airport=Math.round(flights*(city(s.hub).fee+city(route.to).fee)/2+passengers*15);
  const costs=fuel+crew+airport+model.maintenance+120000;
  return {km,flights,capacity,passengers,occupancy:passengers/capacity,revenue,costs,profit:revenue-costs,fuel,crew,airport,maintenance:model.maintenance};
}
export function totals(s: Game) {
  const results=s.routes.map(r=>routeEstimate(s,r));
  const idleMaintenance=s.fleet.filter(p=>!s.routes.some(r=>r.plane===p.id)).reduce((n,p)=>n+aircraft(p.model).maintenance,0);
  const revenue=results.reduce((n,r)=>n+r.revenue,0), costs=results.reduce((n,r)=>n+r.costs,0)+OVERHEAD+idleMaintenance;
  const passengers=results.reduce((n,r)=>n+r.passengers,0), capacity=results.reduce((n,r)=>n+r.capacity,0);
  return {revenue,costs,profit:revenue-costs,passengers,occupancy:capacity?passengers/capacity:0,idleMaintenance};
}
export function buyPlane(s: Game, modelId: string): Game {
  guard(s); const model=aircraft(modelId); if(!model) throw Error('Modelo desconocido.');
  if(s.cash<model.price) throw Error('Capital insuficiente para comprar este avión.');
  return {...s,cash:s.cash-model.price,nextId:s.nextId+1,fleet:[...s.fleet,{id:`p${s.nextId}`,model:modelId}]};
}
export function sellPlane(s: Game, id: string): Game {
  guard(s); const plane=s.fleet.find(p=>p.id===id); if(!plane) throw Error('Avión desconocido.');
  if(s.routes.some(r=>r.plane===id)) throw Error('Cerrá la ruta asignada antes de vender este avión.');
  return {...s,cash:s.cash+Math.round(aircraft(plane.model).price*.70),fleet:s.fleet.filter(p=>p.id!==id)};
}
export function configureRoute(s: Game, input: Omit<Route,'id'>, editId?: string): Game {
  guard(s);
  const p=s.fleet.find(p=>p.id===input.plane); if(!p) throw Error('Elegí un avión de tu flota.');
  if(!city(input.to)||input.to===s.hub) throw Error('Elegí un destino distinto de tu base.');
  if(editId && !s.routes.some(r=>r.id===editId)) throw Error('La ruta ya no existe.');
  if(s.routes.some(r=>r.to===input.to&&r.id!==editId)) throw Error('Ya operás esta ruta.');
  if(s.routes.some(r=>r.plane===input.plane&&r.id!==editId)) throw Error('El avión ya está asignado a otra ruta.');
  if(distance(s.hub,input.to)>aircraft(p.model).range) throw Error('El destino supera el alcance de este avión.');
  if(!Number.isFinite(input.fare)||input.fare<50||input.fare>2500) throw Error('La tarifa debe estar entre US$ 50 y US$ 2.500.');
  if(!Number.isInteger(input.frequency)||input.frequency<1||input.frequency>maxFrequency(s.hub,input.to,p.model)) throw Error('La frecuencia supera las horas disponibles del avión.');
  const charge=editId?0:openingCost(s.hub,input.to); if(s.cash<charge) throw Error('Capital insuficiente para abrir esta ruta.');
  const route={...input,id:editId??`r${s.nextId}`};
  return {...s,cash:s.cash-charge,nextId:editId?s.nextId:s.nextId+1,routes:editId?s.routes.map(r=>r.id===editId?route:r):[...s.routes,route]};
}
export function closeRoute(s: Game, id: string): Game { guard(s); if(!s.routes.some(r=>r.id===id)) throw Error('Ruta desconocida.'); return {...s,routes:s.routes.filter(r=>r.id!==id)}; }
export function advanceQuarter(s: Game): Game {
  guard(s); const t=totals(s), cash=s.cash+t.profit;
  const seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;
  const report: Report={...t,turn:s.turn,cash,event:EVENTS[s.event].title,routes:s.routes.map(r=>{const e=routeEstimate(s,r);return {id:r.id,profit:e.profit,passengers:e.passengers,occupancy:e.occupancy};})};
  const reputation=Math.max(10,Math.min(100,s.reputation+(s.routes.length?(t.profit>0?2:-2):-1)));
  return {...s,turn:s.turn+1,cash,reputation,history:[...s.history,report],seed,event:seed%EVENTS.length,bankrupt:cash<0,won:s.won||(s.routes.length>=GOAL_ROUTES&&t.profit>0),rivals:s.rivals.map((r,i)=>({...r,routes:Math.min(30,r.routes+(((seed>>>(i*5))%3)===0?1:0)),score:Math.min(100,r.score+((seed>>>(i*7))%2))}))};
}
export function parseSave(raw: string): Game {
  const s=JSON.parse(raw) as Game;
  if(!s||s.version!==1||typeof s.name!=='string'||!s.name.trim()||s.name.length>30||!city(s.hub)||!Number.isInteger(s.turn)||s.turn<0||!Number.isFinite(s.cash)||!Number.isFinite(s.reputation)||s.reputation<0||s.reputation>100||!Number.isInteger(s.event)||!EVENTS[s.event]||!Number.isInteger(s.seed)||!Number.isInteger(s.nextId)||s.nextId<1||typeof s.won!=='boolean'||typeof s.bankrupt!=='boolean'||s.bankrupt!==(s.cash<0)) throw Error('La partida guardada no es válida.');
  if(!Array.isArray(s.fleet)||!Array.isArray(s.routes)||!Array.isArray(s.history)||!Array.isArray(s.rivals)||s.fleet.length>500||s.routes.length>=CITIES.length||s.history.length!==s.turn||s.rivals.length!==3) throw Error('La partida está incompleta.');
  if(new Set(s.fleet.map(p=>p.id)).size!==s.fleet.length||new Set(s.routes.map(r=>r.id)).size!==s.routes.length) throw Error('La partida contiene identificadores repetidos.');
  for(const p of s.fleet) if(typeof p.id!=='string'||!/^p\d+$/.test(p.id)||!aircraft(p.model)) throw Error('Flota inválida.');
  for(const r of s.rivals) if(typeof r.name!=='string'||!Number.isInteger(r.routes)||r.routes<0||!Number.isFinite(r.score)||typeof r.color!=='string'||!/^#[0-9a-f]{6}$/i.test(r.color)) throw Error('Competencia inválida.');
  const ids=[...s.fleet.map(p=>Number(p.id.slice(1))),...s.routes.map(r=>Number(r.id.slice(1)))];
  if(ids.some(id=>!Number.isInteger(id)||id>=s.nextId)) throw Error('Identificadores inválidos.');
  const check={...s,cash:1e12,bankrupt:false};
  for(const r of s.routes){if(typeof r.id!=='string'||!/^r\d+$/.test(r.id)) throw Error('Ruta inválida.');configureRoute(check,r,r.id);}
  for(const [i,r] of s.history.entries()) if(!r||r.turn!==i||!['revenue','costs','profit','passengers','occupancy','cash'].every(k=>Number.isFinite(r[k as keyof Report]))||typeof r.event!=='string'||!Array.isArray(r.routes)) throw Error('Historial inválido.');
  return s;
}
export const quarterLabel = (turn: number) => `T${turn%4+1} ${2026+Math.floor(turn/4)}`;
