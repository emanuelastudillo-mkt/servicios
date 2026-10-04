import {CARS,DEFAULT_SETUP,TYRES,ENGINE_MODES,PACES,normalizeSetup,ENGINE_VERSION} from './catalog.js';
import {TRACK,NODES,DS} from './track.js';
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function rng(seed=42){let t=seed>>>0;return ()=>{t+=0x6D2B79F5;let x=Math.imul(t^t>>>15,t|1);x^=x+Math.imul(x^x>>>7,x|61);return ((x^x>>>14)>>>0)/4294967296;};}
export function parameters(car,raw,conditions={temperature:32},state={}) {
  const s=normalizeSetup(raw),tyre=TYRES[s.compound],mode=ENGINE_MODES[s.engineMode],pace=PACES[s.pace];
  const fuel=state.fuel??s.fuel,wear=state.wear??0,temperature=state.temperature??tyre.optimum;
  const ambient=clamp(Number(conditions.temperature)||32,15,50);
  const rigidity=(s.frontSpring+s.rearSpring)/2;
  const bottoming=Math.max(0,(32-rigidity*.35-s.rideHeight)/8);
  const floor=clamp(1-Math.max(0,s.rideHeight-31)*.008-bottoming*.28,.65,1);
  const balance=(s.frontWing-s.rearWing+3)*.012+(s.frontSpring-s.rearSpring-1)*.006;
  const cdA=(.83+.0125*(s.frontWing+s.rearWing)+.00008*(s.frontWing+s.rearWing)**2)*car.drag;
  const clA=(3.2*floor+.062*(s.frontWing+s.rearWing))*car.aero;
  const optimalPressure=23.7-(ambient-32)*.025;
  const pressureGrip=1-.004*(s.pressure-optimalPressure)**2;
  const tempGrip=clamp(1-.00012*(temperature-tyre.optimum)**2,.79,1);
  const wearGrip=clamp(1-.065*wear-.33*Math.max(0,wear-.5)**1.5,.61,1);
  const mechanical=car.mechanical*(1-Math.abs(rigidity-8)*.0035);
  const mu=1.55*tyre.grip*pressureGrip*tempGrip*wearGrip*pace.grip;
  const optimalBrake=56+(s.frontWing-s.rearWing+3)*.1;
  const brakeEfficiency=clamp(1-Math.abs(s.brakeBias-optimalBrake)*.023,.75,1);
  const traction=clamp(1-.00011*(s.differential-56)**2-Math.max(0,s.rearSpring-8)*.014,.75,1);
  const fuelPerLap=1.73*mode.fuel*(car.power/715000)**.5*(1+(cdA-1.76)*.13)*(s.pace==='save'?.97:1);
  const targetTemp=tyre.optimum+(ambient-32)*.65+(s.pressure-23.5)*1.8+pace.heat+mode.heat+Math.abs(balance)*12;
  const wearPerLap=.0245*tyre.wear*pace.wear/car.tyreCare*(1+Math.abs(balance)*1.3+Math.abs(s.brakeBias-optimalBrake)*.023+Math.max(0,targetTemp-tyre.optimum)*.023+Math.abs(s.pressure-optimalPressure)*.03+Math.max(0,s.differential-65)*.005);
  return {mass:car.mass+fuel,cdA,clA,balance,mu,mechanical,brakeEfficiency,traction,power:car.power*mode.power,fuelPerLap,wearPerLap,targetTemp,bottoming};
}
// Punto material con carga aerodinámica, resistencia, límite de adherencia y barridos de frenada/aceleración.
export function solveLap(car,raw,conditions={temperature:32},state={}) {
  const setup=normalizeSetup(raw),p=parameters(car,setup,conditions,state),N=NODES.length,rho=1.18,g=9.81;
  const limits=NODES.map(node=>{
    if(node.curvature<.00004)return 105;
    let lo=6,hi=105;
    for(let i=0;i<18;i++){const v=(lo+hi)/2;const aero=.5*rho*p.clA*v*v;const load=(p.mass*g+aero);const sensitiveMu=p.mu*(1-.085*Math.log1p(aero/(p.mass*g)));const balanceLoss=1-Math.min(.2,Math.abs(p.balance)*(v>45?.48:.32));const available=sensitiveMu*load/p.mass*p.mechanical*balanceLoss;if(v*v*node.curvature<=available)lo=v;else hi=v;}
    return lo;
  });
  const speeds=[...limits];
  for(let pass=0;pass<7;pass++){
    for(let i=N-1;i>=0;i--){const j=(i+1)%N,v=speeds[j];const decel=Math.min(5.7*g,p.mu*(g+.5*rho*p.clA*v*v/p.mass)*p.brakeEfficiency);speeds[i]=Math.min(speeds[i],Math.sqrt(v*v+2*decel*DS));}
    for(let i=0;i<N;i++){const j=(i+1)%N,v=speeds[i];const drag=.5*rho*p.cdA*v*v;const roll=.014*p.mass*g*(1-(setup.pressure-23.5)*.005);const lateral=v*v*NODES[i].curvature;const grip=p.mu*(g+.5*rho*p.clA*v*v/p.mass);const traction=Math.sqrt(Math.max(.12,1-Math.min(.985,lateral/grip)**2));const accel=Math.max(.05,Math.min((p.power/Math.max(v,12)-drag-roll)/p.mass,grip*.62*p.traction*traction));speeds[j]=Math.min(speeds[j],Math.sqrt(v*v+2*accel*DS));}
  }
  let time=0;const sectors=[0,0,0];const samples=NODES.map((n,i)=>{const dt=2*DS/(speeds[i]+speeds[(i+1)%N]);const out={distance:n.distance,speed:speeds[i]*3.6,time,sector:n.sector};time+=dt;sectors[n.sector]+=dt;return out;});
  return {time,sectors,speeds,samples,topSpeed:Math.max(...speeds)*3.6,fuelUsed:p.fuelPerLap,wearAdded:p.wearPerLap,parameters:p,setup};
}
export function feedback(car,setup,conditions,result){
  const p=result.parameters,messages=[];
  if(p.balance<-.065)messages.push('El tren delantero pierde apoyo: subviraje en las curvas rápidas. Probá más ala delantera o menos trasera.');
  else if(p.balance>.065)messages.push('El auto gira con facilidad, pero la trasera queda inestable. Revisá el balance entre alerones y rigidez.');
  else messages.push('El balance entre ambos ejes es estable. Compará los sectores antes de buscar más velocidad punta.');
  if(p.bottoming>.04)messages.push('El piso trabaja demasiado cerca del suelo. Subir la altura o sostener mejor el chasis recuperaría apoyo.');
  if(p.brakeEfficiency<.94)messages.push('El reparto de frenos está lejos del balance del auto: perdemos capacidad de frenada y castigamos las gomas.');
  if(Math.abs(p.targetTemp-TYRES[setup.compound].optimum)>6)messages.push('Las gomas se alejan de su ventana térmica. Revisá presión y ritmo para sostener el agarre.');
  if(setup.frontWing+setup.rearWing<40)messages.push('Buena velocidad en recta, con menos margen en curvas rápidas. Revisá cuánto perdés en el segundo sector.');
  if(setup.frontWing+setup.rearWing>67)messages.push('Mucho apoyo en curva. La resistencia aerodinámica penaliza la recta principal y el consumo.');
  return messages.slice(0,3);
}
export function runPractice({carId='atlas',setup=DEFAULT_SETUP,temperature=32,laps=5,seed=42}={}) {
  const car=CARS.find(c=>c.id===carId)||CARS[0],s=normalizeSetup(setup),count=clamp(Math.round(laps),1,12),random=rng(seed);
  let fuel=s.fuel,wear=0,temp=TYRES[s.compound].optimum-8;const records=[];
  for(let i=0;i<count;i++){
    const result=solveLap(car,s,{temperature},{fuel,wear,temperature:temp});if(fuel<result.fuelUsed)break;
    const variation=(random()-.5)*.12;
    fuel-=result.fuelUsed;wear=clamp(wear+result.wearAdded,0,1);temp+=(result.parameters.targetTemp-temp)*.55;
    const sectors=[...result.sectors];sectors[2]+=variation;
    records.push({lap:i+1,time:result.time+variation,modelTime:result.time,sectors,topSpeed:result.topSpeed,fuel,wear,temperature:temp,samples:result.samples,parameters:result.parameters});
  }
  if(!records.length)throw new Error('Combustible insuficiente para completar una vuelta.');
  const best=records.reduce((a,b)=>a.time<b.time?a:b);
  return {id:globalThis.crypto?.randomUUID?.()||`test-${Date.now()}`,createdAt:new Date().toISOString(),engineVersion:ENGINE_VERSION,carId:car.id,setup:s,temperature,seed,laps:records,best:best.time,mean:records.reduce((n,r)=>n+r.time,0)/records.length,topSpeed:Math.max(...records.map(r=>r.topSpeed)),fuelPerLap:(s.fuel-fuel)/records.length,wearPerLap:wear/records.length,feedback:feedback(car,s,{temperature},best),requestedLaps:count};
}
export function buildGrid(input) {
  const random=rng(input.seed??42),s=normalizeSetup(input.setup),laps=clamp(Number(input.laps)||18,6,30),temperature=clamp(Number(input.temperature)||32,15,50);
  const names=['M. Ríos','L. Moretti','A. Weber','S. Laurent','T. Sato','N. Costa','D. Blake','I. Kovács','C. Varela','R. Silva','E. Martín'];
  const entries=[{id:'player',name:'Vos',carId:input.carId||'atlas',setup:s,stopLap:clamp(Math.round(input.stopLap||9),1,laps-1),nextCompound:Object.hasOwn(TYRES,input.nextCompound)?input.nextCompound:'hard',skill:1}];
  for(let i=0;i<11;i++){
    const car=CARS[i%4],style=i%3,st=normalizeSetup({...DEFAULT_SETUP,frontWing:24+Math.round(random()*8),rearWing:27+Math.round(random()*8),fuel:Math.ceil(laps*1.85+3),compound:style===0?'soft':'medium',pace:style===2?'save':'balanced',frontSpring:7+Math.round(random()*3),rearSpring:7+Math.round(random()*2)});
    entries.push({id:`ai-${i}`,name:names[i],carId:car.id,setup:st,stopLap:Math.round(laps*(style===0?.39:.53)),nextCompound:style===0?'medium':'hard',skill:1.002+random()*.014});
  }
  for(const e of entries){const car=CARS.find(c=>c.id===e.carId)||CARS[0];e.carId=car.id;e.qualifying=solveLap(car,{...e.setup,fuel:5,compound:'soft'},{temperature}).time*e.skill+(random()-.5)*.24;e.color=car.color;}
  return entries.sort((a,b)=>a.qualifying-b.qualifying).map((e,i)=>({...e,grid:i+1}));
}
export function simulateRace(input={}) {
  const laps=clamp(Math.round(Number(input.laps)||18),6,30),temperature=clamp(Number(input.temperature)||32,15,50),seed=Number(input.seed)||42,random=rng(seed),dt=.25;
  const grid=buildGrid({...input,laps,temperature,seed});const events=[{time:0,type:'start',text:'Se apagan los semáforos. ¡Largada!',driver:'all'}];
  const cars=grid.map(e=>{const car=CARS.find(c=>c.id===e.carId),profile=solveLap(car,e.setup,{temperature},{temperature:TYRES[e.setup.compound].optimum-8});return {...e,car,d:-(e.grid-1)*8,v:0,fuel:e.setup.fuel,wear:0,temp:TYRES[e.setup.compound].optimum-8,compound:e.setup.compound,profile,lap:0,lastCross:0,lapTimes:[],history:[],pit:false,pitAt:null,pitEnd:null,pitDwell:0,changed:false,stops:0,done:false,dnf:false,finishTime:null,incident:0,lane:0};});
  const frames=[];let time=0,frameTick=0;
  const capture=()=>{const ordered=[...cars].sort((a,b)=>a.done&&b.done?a.finishTime-b.finishTime:a.done?-1:b.done?1:b.d-a.d);frames.push({time,cars:ordered.map((c,i)=>({id:c.id,d:c.d,speed:c.v*3.6,fuel:c.fuel,wear:c.wear,temp:c.temp,compound:c.compound,pit:c.pit,position:i+1,done:c.done,dnf:c.dnf,lane:c.lane}))});};capture();
  while(cars.some(c=>!c.done&&!c.dnf)&&time<laps*180+180){
    const ordered=[...cars].filter(c=>!c.done&&!c.dnf).sort((a,b)=>b.d-a.d);
    const oldOrder=ordered.map(c=>c.id),next=[];
    for(let index=0;index<ordered.length;index++){
      const c=ordered[index],fraction=((c.d%TRACK.length)+TRACK.length)%TRACK.length,nodeIndex=Math.floor(fraction/DS)%NODES.length,node=NODES[nodeIndex];
      let desired=c.profile.speeds[nodeIndex]/c.skill;
      const front=ordered.slice(0,index).reverse().find(o=>!o.pit&&!c.pit);
      const gap=front?front.d-c.d:Infinity;
      c.lane*=.94;
      if(front&&gap<70&&gap>0&&!c.pit){
        if(node.overtake){desired*=1.012;const advantage=desired-front.v; if(advantage>1.0&&gap<24)c.lane=7+(c.grid%2)*3;else if(gap<14)desired=Math.min(desired,front.v+Math.max(-4,(gap-9)*.55));}
        else {desired*=1-.018*(1-gap/70);if(gap<22)desired=Math.min(desired,Math.max(5,front.v+(gap-12)*.45));}
      }
      if(!c.pit&&c.stops===0&&c.d>=((c.stopLap-1)+.90)*TRACK.length){c.pit=true;c.pitAt=((c.stopLap-1)+.972)*TRACK.length;c.pitEnd=(c.stopLap+.065)*TRACK.length;c.pitDwell=2.6+random()*.7;events.push({time,type:'pit',driver:c.id,text:`${c.name} entra a boxes.`});}
      if(c.pit){desired=Math.min(desired,22.22);if(c.d>=c.pitAt&&!c.changed){desired=0;c.pitDwell-=dt;if(c.pitDwell<=0){c.compound=c.nextCompound;c.wear=0;c.temp=76;c.changed=true;c.stops++;events.push({time,type:'tyre',driver:c.id,text:`${c.name} coloca ${TYRES[c.compound].name.toLowerCase()}s.`});}}}
      if(c.incident>0){desired*=.48;c.incident-=dt;}
      if(!c.pit&&random()<PACES[c.setup.pace].risk*dt/80){c.incident=2.2+random()*2;events.push({time,type:'error',driver:c.id,text:`${c.name} se pasa en la frenada y pierde tiempo.`});}
      c.v=clamp(desired,Math.max(0,c.v-32*dt),c.v+9.5*dt);
      let distance=c.v*dt;
      if(c.pit&&!c.changed&&c.d+distance>c.pitAt){distance=Math.max(0,c.pitAt-c.d);c.v=distance/dt;}
      if(front&&!c.pit&&!front.pit&&c.lane<3&&c.d+distance>front.d-5)distance=Math.max(0,front.d-5-c.d);
      next.push({c,distance});
    }
    for(const {c,distance} of next){
      const oldD=c.d;c.d+=distance;
      const p=c.profile.parameters;c.fuel=Math.max(0,c.fuel-distance/TRACK.length*p.fuelPerLap);c.wear=clamp(c.wear+distance/TRACK.length*p.wearPerLap,0,1);c.temp+=(p.targetTemp-c.temp)*dt/45;
      if(c.pit&&c.d>=c.pitEnd){c.pit=false;c.profile=solveLap(c.car,{...c.setup,compound:c.compound},{temperature},{fuel:c.fuel,wear:c.wear,temperature:c.temp});}
      const newLap=Math.floor(c.d/TRACK.length);
      if(newLap>c.lap){
        const crossing=time+dt*(newLap*TRACK.length-oldD)/(distance||1);const lapTime=crossing-c.lastCross;c.lapTimes.push(lapTime);c.history.push({lap:newLap,time:lapTime,fuel:c.fuel,wear:c.wear,compound:c.compound});c.lastCross=crossing;c.lap=newLap;
        if(c.lap>=laps){c.done=true;c.finishTime=crossing;c.d=laps*TRACK.length;c.v=0;events.push({time:crossing,type:'finish',driver:c.id,text:`Bandera a cuadros para ${c.name}.`});}
        else c.profile=solveLap(c.car,{...c.setup,compound:c.compound},{temperature},{fuel:c.fuel,wear:c.wear,temperature:c.temp});
      }
      if(c.fuel<=0&&!c.done){c.dnf=true;c.v=0;events.push({time:time+dt,type:'dnf',driver:c.id,text:`${c.name} abandona: sin combustible.`});}
    }
    const newOrder=[...ordered].sort((a,b)=>b.d-a.d).map(c=>c.id);
    for(let i=0;i<newOrder.length;i++){const before=oldOrder.indexOf(newOrder[i]);if(before>i){const c=cars.find(x=>x.id===newOrder[i]),other=cars.find(x=>x.id===oldOrder[i]);if(!c.pit&&!other.pit&&!c.done&&!other.done&&!other.dnf&&time>5)events.push({time:time+dt,type:'pass',driver:c.id,text:`${c.name} supera a ${other.name}.`});}}
    time+=dt;frameTick++;if(frameTick%4===0)capture();
  }
  capture();
  const results=[...cars].sort((a,b)=>a.done&&b.done?a.finishTime-b.finishTime:a.done?-1:b.done?1:b.d-a.d).map((c,i)=>({id:c.id,name:c.name,carId:c.carId,color:c.color,position:i+1,grid:c.grid,time:c.finishTime,dnf:c.dnf||!c.done,laps:c.lap,stops:c.stops,fuel:c.fuel,wear:c.wear,bestLap:c.lapTimes.length?Math.min(...c.lapTimes):null,history:c.history}));
  return {engineVersion:ENGINE_VERSION,seed,temperature,laps,grid,frames,events:events.sort((a,b)=>a.time-b.time),results,duration:time,input:{...input,setup:normalizeSetup(input.setup)}};
}
export function frameAt(race,time){const frames=race.frames;if(time>=frames.at(-1).time)return frames.at(-1).cars;if(time<=0)return frames[0].cars;let lo=0,hi=frames.length-1;while(lo+1<hi){const mid=(lo+hi)>>1;if(frames[mid].time<=time)lo=mid;else hi=mid;}const a=frames[lo],b=frames[hi],t=clamp((time-a.time)/(b.time-a.time||1),0,1);return a.cars.map(c=>{const end=b.cars.find(o=>o.id===c.id)||c;return {...(t===1?end:c),d:c.d+(end.d-c.d)*t,speed:c.speed+(end.speed-c.speed)*t,lane:c.lane+(end.lane-c.lane)*t};}).sort((x,y)=>{if(x.done&&y.done)return x.position-y.position;return y.d-x.d||x.position-y.position;});}
