export const TERRAIN_WIDTH = 1000;
export const TERRAIN_DEPTH = 950;

export function geoToTerrain(lon, lat, bounds) {
  const [west, south, east, north] = bounds;
  return [(lon-west)/(east-west)*1000-500, (north-lat)/(north-south)*950-475];
}

export function decodeHeights(buffer, grid) {
  if (buffer.byteLength !== grid*grid*2) throw Error("El relieve está incompleto.");
  const view = new DataView(buffer), out = new Float32Array(grid*grid);
  for (let i=0; i<out.length; i++) out[i] = Math.max(0,view.getInt16(i*2,true));
  return out;
}

// Match the exact triangles of the chosen mesh resolution, so roads and cars
// remain on the surface in both high- and low-detail modes.
export function sampleElevation(data, grid, segments, x, z) {
  const u=Math.max(0,Math.min(1,(x+500)/1000))*segments;
  const v=Math.max(0,Math.min(1,(z+475)/950))*segments;
  const i=Math.min(segments-1,Math.floor(u)), j=Math.min(segments-1,Math.floor(v));
  const fx=u-i, fy=v-j, step=(grid-1)/segments;
  const h=(a,b)=>data[(b*step)*grid+a*step];
  const a=h(i,j), b=h(i+1,j), c=h(i,j+1), d=h(i+1,j+1);
  return fx+fy<=1 ? a+(b-a)*fx+(c-a)*fy : d+(c-d)*(1-fx)+(b-d)*(1-fy);
}

export function terrainScale(meta, relief=1) {
  return 950/(meta.northSouthKm*1000)*meta.defaultExaggeration*relief;
}
