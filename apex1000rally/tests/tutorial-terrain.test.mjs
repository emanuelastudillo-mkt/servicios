import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {BOUNDS,TRAINING_TERRAIN,trainingGeo,trainingTerrainPacket} from '../tutorial/terrain-model.js';
import {WORLD,ROUTE,routePoint,trainingField} from '../tutorial/viewer-model.js';
import {SOLUTION,STAGES,newTraining,startPreparation,commitStage,advanceTraining} from '../tutorial/engine.js';

test('tutorial satellite coordinates preserve every training point and camp, without changing simulated kilometres',async()=>{
  const meta=JSON.parse(await readFile(new URL('../tutorial/assets/terrain3d/sprint-salta.json',import.meta.url),'utf8'));
  assert.deepEqual(meta.bounds,BOUNDS);
  assert.equal(TRAINING_TERRAIN.stages.length,5);
  assert.equal(TRAINING_TERRAIN.cities.length,6);
  for(const [i,r] of ROUTE.entries()){
    assert.equal(TRAINING_TERRAIN.stages[i].path.length,r.points.length);
    for(const [n,p] of r.points.entries())assert.deepEqual(TRAINING_TERRAIN.stages[i].path[n],trainingGeo(...p));
    const p=routePoint(r.endKm),g=trainingGeo(p.x,p.y),city=TRAINING_TERRAIN.cities[i+1];
    assert.deepEqual([city.lon,city.lat],g);
    assert.ok(g[0]>BOUNDS[0]&&g[0]<BOUNDS[2]&&g[1]>BOUNDS[1]&&g[1]<BOUNDS[3]);
    assert.equal(r.endKm-r.startKm,STAGES[i].km);
  }
  assert.equal(ROUTE.at(-1).endKm,WORLD.km);
});

test('3D cars use the same live ranking, progress and selected team as the tutorial across all five stages',()=>{
  const s=newTraining();startPreparation(s,structuredClone(SOLUTION));advanceTraining(s,300);
  for(const stage of STAGES){
    commitStage(s,{driver:stage.driver,pace:stage.pace,fuel:stage.fuel,repairs:'all',rest:'full'});
    for(const seconds of [150,2400]){
      advanceTraining(s,seconds);
      const field=trainingField(s),saved=JSON.stringify(s),packet=trainingTerrainPacket(field,'cobalto');
      assert.equal(packet.selectedId,'cobalto');
      assert.equal(packet.teams.length,6);
      for(const team of field){
        const car=packet.teams.find(t=>t.id===team.id);
        assert.deepEqual([car.lon,car.lat],trainingGeo(team.location.x,team.location.y));
        assert.equal(car.rank,team.position);assert.equal(car.speed,team.speed);
        assert.ok(car.ahead.every(Number.isFinite));
      }
      assert.equal(JSON.stringify(s),saved);
    }
  }
  assert.equal(s.phase,'result');assert.equal(s.km,40);
});
