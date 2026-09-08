import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CITIES, AIRCRAFT } from '../lib/catalog.ts';
import { createGame, buyPlane, sellPlane, configureRoute, closeRoute, advanceQuarter, totals, distance, maxFrequency, parseSave, openingCost } from '../lib/engine.ts';

test('Las distancias geográficas y la rotación respetan los límites del avión',()=>{
  assert.ok(distance('EZE','SCL')>1100 && distance('EZE','SCL')<1200);
  assert.equal(distance('EZE','SCL'),distance('SCL','EZE'));
  let s=buyPlane(createGame('Prueba','EZE',false),'e195');
  assert.throws(()=>configureRoute(s,{to:'MAD',plane:'p1',fare:900,frequency:2}),/alcance/);
  assert.throws(()=>configureRoute(s,{to:'GRU',plane:'p1',fare:250,frequency:maxFrequency('EZE','GRU','e195')+1}),/frecuencia/);
});
test('Comprar, asignar y cerrar rutas conserva el capital y no duplica aviones',()=>{
  let s=buyPlane(createGame('Prueba','EZE',false),'e195');
  assert.equal(s.cash,202e6);
  s=configureRoute(s,{to:'SCL',plane:'p1',fare:180,frequency:7});
  assert.equal(s.cash,202e6-openingCost('EZE','SCL'));
  assert.throws(()=>configureRoute(s,{to:'GRU',plane:'p1',fare:250,frequency:7}),/asignado/);
  assert.throws(()=>sellPlane(s,'p1'),/Cerrá/);
  const cash=s.cash;
  s=configureRoute(s,{...s.routes[0],fare:210},s.routes[0].id);
  assert.equal(s.cash,cash);
  s=closeRoute(s,s.routes[0].id); s=sellPlane(s,'p1');
  assert.equal(s.fleet.length,0);assert.equal(s.cash,cash+38e6*.7);
});
test('El trimestre liquida exactamente la proyección y cambia el calendario y los rivales',()=>{
  const s=createGame(); const t=totals(s), next=advanceQuarter(s);
  assert.equal(next.cash,s.cash+t.profit);assert.equal(next.history[0].profit,t.profit);
  assert.equal(next.history[0].revenue-next.history[0].costs,next.history[0].profit);
  assert.equal(s.turn,0);assert.equal(next.turn,1);assert.equal(next.history.length,1);
  assert.ok(next.rivals.every((r,i)=>r.routes>=s.rivals[i].routes));
  assert.ok(t.occupancy<=.96);assert.ok(t.passengers>0);
});
test('Se cobran los aviones ociosos y la quiebra detiene la partida',()=>{
  const s=buyPlane(createGame('Prueba','EZE',false),'e195');
  assert.equal(totals(s).costs,740000);
  const broken=advanceQuarter({...s,cash:1});assert.equal(broken.bankrupt,true);
  assert.throws(()=>advanceQuarter(broken),/quiebra/);
  assert.throws(()=>buyPlane({...s,cash:0},'b789'),/Capital/);
});
test('El guardado sobrevive 40 trimestres y rechaza datos corruptos',()=>{
  let s=createGame();for(let i=0;i<40;i++)s=advanceQuarter(s);
  assert.deepEqual(parseSave(JSON.stringify(s)),s);
  assert.throws(()=>parseSave('{}'));
  assert.throws(()=>parseSave(JSON.stringify({...s,version:8})));
  assert.throws(()=>parseSave(JSON.stringify({...s,event:99})));
  const bad=structuredClone(s);bad.routes[1].plane=bad.routes[0].plane;
  assert.throws(()=>parseSave(JSON.stringify(bad)),/asignado/);
});
test('Tarifas inválidas, duplicados y bases desconocidas se rechazan sin modificar el estado',()=>{
  const s=createGame(); const before=JSON.stringify(s);
  assert.throws(()=>configureRoute(s,{...s.routes[0],fare:NaN},s.routes[0].id));
  assert.throws(()=>configureRoute(s,{...s.routes[0],frequency:1.5},s.routes[0].id));
  assert.throws(()=>createGame('','EZE'));assert.throws(()=>createGame('Prueba','XXX'));
  assert.equal(JSON.stringify(s),before);
});

test('La campaña puede alcanzar ocho rutas con capital ganado en operaciones',()=>{
  let s=createGame();
  for(let turn=0;turn<100&&!s.won&&!s.bankrupt;turn++){
    for(const c of CITIES.filter(c=>c.id!==s.hub&&!s.routes.some(r=>r.to===c.id))){
      const km=distance(s.hub,c.id),m=AIRCRAFT.find(m=>m.range>=km);
      if(!m||s.cash<m.price+openingCost(s.hub,c.id)+20e6)continue;
      s=buyPlane(s,m.id);const p=s.fleet.at(-1)!;
      s=configureRoute(s,{to:c.id,plane:p.id,fare:Math.round(75+km*.095),frequency:Math.min(7,maxFrequency(s.hub,c.id,m.id))});
      if(s.routes.length>=8)break;
    }
    s=advanceQuarter(s);
  }
  assert.equal(s.bankrupt,false);assert.equal(s.won,true);assert.ok(s.routes.length>=8);assert.ok(s.history.at(-1)!.profit>0);
  assert.deepEqual(parseSave(JSON.stringify(s)),s);
});
