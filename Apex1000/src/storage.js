import {CARS,normalizeSetup,ENGINE_VERSION} from './catalog.js';
import {runPractice} from './engine.js';
export const KEY='apex-lab-save-v1';
const isObject=x=>x&&typeof x==='object'&&!Array.isArray(x);
const safeId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{1,100}$/.test(id)?id:crypto.randomUUID();
const carId=id=>CARS.some(c=>c.id===id)?id:'atlas';
const num=(v,d,a,b)=>Number.isFinite(Number(v))?Math.min(b,Math.max(a,Number(v))):d;
export function serialize(state){return {format:'apex-lab',version:1,engineVersion:ENGINE_VERSION,savedAt:new Date().toISOString(),carId:state.carId,setup:state.setup,temperature:state.temperature,testLaps:state.testLaps,raceLaps:state.raceLaps,stopLap:state.stopLap,nextCompound:state.nextCompound,seed:state.seed,saved:state.saved,tests:state.tests.slice(0,12).map(t=>({id:t.id,createdAt:t.createdAt,carId:t.carId,setup:t.setup,temperature:t.temperature,laps:t.requestedLaps,seed:t.seed})),raceInput:state.race?.input||state.raceInput||null};}
export function validateSave(data){
  if(!isObject(data)||data.format!=='apex-lab'||data.version!==1)throw new Error('El archivo no es una partida compatible de Apex Lab.');
  if(data.engineVersion!==ENGINE_VERSION)throw new Error('Esta partida usa otra versión del motor. Conservá el archivo para migrarlo.');
  if(!isObject(data.setup)||!Array.isArray(data.saved)||!Array.isArray(data.tests))throw new Error('La partida está incompleta.');
  if(data.saved.length>100||data.tests.length>20)throw new Error('El archivo excede el límite de configuraciones o pruebas.');
  const saved=data.saved.filter(isObject).map(s=>({id:safeId(s.id),name:String(s.name||'Configuración').slice(0,60),carId:carId(s.carId),setup:normalizeSetup(s.setup),temperature:num(s.temperature,32,15,50),createdAt:String(s.createdAt||''),notes:String(s.notes||'').slice(0,300)}));
  const tests=data.tests.filter(isObject).map(t=>({...runPractice({carId:carId(t.carId),setup:normalizeSetup(t.setup),temperature:num(t.temperature,32,15,50),laps:num(t.laps,5,1,12),seed:num(t.seed,42,1,999999)}),id:safeId(t.id),createdAt:String(t.createdAt||'')}));
  let raceInput=null;if(isObject(data.raceInput)){const r=data.raceInput;raceInput={carId:carId(r.carId),setup:normalizeSetup(r.setup),temperature:num(r.temperature,32,15,50),laps:num(r.laps,18,6,30),stopLap:num(r.stopLap,9,1,29),nextCompound:['soft','medium','hard'].includes(r.nextCompound)?r.nextCompound:'hard',seed:num(r.seed,42,1,999999)};}
  return {carId:carId(data.carId),setup:normalizeSetup(data.setup),temperature:num(data.temperature,32,15,50),testLaps:num(data.testLaps,5,1,12),raceLaps:num(data.raceLaps,18,6,30),stopLap:num(data.stopLap,9,1,29),nextCompound:['soft','medium','hard'].includes(data.nextCompound)?data.nextCompound:'hard',seed:num(data.seed,42,1,999999),saved,tests,raceInput};
}
