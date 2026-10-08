import { WORLD, ROUTE, routePoint } from './viewer-model.js?v=1.7.1';
import { STAGES } from './engine.js?v=1.7.1';

// Salta supplies real scenery. The training route and its 40 km remain fictional.
export const BOUNDS = [-66.57888888888888,-26.274444444444445,-64.80111111111111,-24.585555555555555];
export function trainingGeo(x,y) {
  const [west,south,east,north]=BOUNDS;
  // Preserve the original course's aspect ratio inside the satellite square.
  return [west+x/WORLD.width*(east-west), north-(.3+y/WORLD.height*.4)*(north-south)];
}
export const TRAINING_TERRAIN = {
  id:'sprint-salta',
  stages:ROUTE.map((r,i)=>({title:`Sector ${i+1} · ${STAGES[i].name}`,path:r.points.map(p=>trainingGeo(...p))})),
  cities:[{km:0,name:'Largada'},...ROUTE.map((r,i)=>({km:r.endKm,name:i===4?'Meta · 40 km':`Campamento ${i+1}`}))].map(stop=>{
    const p=routePoint(stop.km),[lon,lat]=trainingGeo(p.x,p.y);
    return {name:stop.name,lon,lat};
  }),
};
export function trainingTerrainPacket(field,selectedId) {
  return {routeId:TRAINING_TERRAIN.id,selectedId,teams:field.map(t=>{
    const [lon,lat]=trainingGeo(t.location.x,t.location.y);
    // Look backwards at the finish to retain the last heading.
    const p=routePoint(Math.min(WORLD.km,t.km+.015));
    let ahead=trainingGeo(p.x,p.y);
    if(t.km>=WORLD.km){const prev=routePoint(WORLD.km-.015),g=trainingGeo(prev.x,prev.y);ahead=[lon+lon-g[0],lat+lat-g[1]];}
    return {id:t.id,name:t.name,color:t.color,rank:t.position,lon,lat,ahead,speed:t.speed};
  })};
}
