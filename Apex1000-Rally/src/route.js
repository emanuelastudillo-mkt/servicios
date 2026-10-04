import * as base from "./route-base.js";
import { ROUTE_SPECS } from "../data/routes.js";
import { CATALOG } from "../data/catalog.js";
import { clamp } from "./catalog.js";
export {
  segmentAt,
  recommendedSetup,
  terrainDescription,
} from "./route-base.js";
const routes = {
  andes: {
    id: "andes",
    name: base.ROUTE_NAME,
    cities: base.CITIES,
    stages: base.STAGES,
    totalKm: base.TOTAL_KM,
  },
};
for (const spec of ROUTE_SPECS) {
  let cumulative = 0;
  const stages = spec.cities.slice(1).map((to, i) => {
    const from = spec.cities[i],
      km = spec.km / 15 + [0, 60, -60, 30, -30][i % 5];
    const types = [
      spec.terrain,
      ["asphalt", "rock", "sand", "gravel", "mountain"][i % 5],
      "gravel",
    ];
    const shares = new Map();
    types.forEach((t, j) =>
      shares.set(t, (shares.get(t) || 0) + [0.55, 0.3, 0.15][j]),
    );
    let consumed = 0;
    const segments = [...shares].map(([type, share]) => {
      const s = { type, share, start: consumed, km: km * share };
      consumed += s.km;
      return s;
    });
    const startKm = cumulative;
    cumulative += km;
    return {
      id: i,
      index: i,
      from,
      to,
      km,
      startKm,
      endKm: cumulative,
      temp: spec.temp + [0, 3, -2, 2, -4][i % 5],
      altitude: Math.max(0, spec.altitude + [0, 500, -300, 200, -100][i % 5]),
      segments,
      title: `Sector ${i + 1} · ${to.name}`,
      brief:
        spec.terrain === "sand"
          ? "La arena eleva el consumo y el calor. Refrigeración y autonomía antes de atacar."
          : spec.terrain === "mountain"
            ? "Desnivel y curvas: cuidá frenos y suspensión, acortá la transmisión."
            : "Alterná ritmo y conservación. Estudiá la mezcla de superficies antes de elegir piezas.",
      path: Array.from({ length: 17 }, (_, j) => [
        from.lon + ((to.lon - from.lon) * j) / 16,
        from.lat + ((to.lat - from.lat) * j) / 16,
      ]),
    };
  });
  routes[spec.id] = {
    id: spec.id,
    name: CATALOG.races.find((r) => r.id === spec.id).name,
    cities: spec.cities,
    stages,
    totalKm: cumulative,
  };
}
export function routeFor(value) {
  return (
    routes[typeof value === "string" ? value : value?.routeId] || routes.andes
  );
}
// Live bindings only drive the local viewer. Simulation resolves its own state route.
export let STAGES = base.STAGES,
  CITIES = base.CITIES,
  TOTAL_KM = base.TOTAL_KM,
  ROUTE_NAME = base.ROUTE_NAME;
export function setActiveRoute(value) {
  const r = routeFor(value);
  STAGES = r.stages;
  CITIES = r.cities;
  TOTAL_KM = r.totalKm;
  ROUTE_NAME = r.name;
  return r;
}
export function stageAtDistance(km, value) {
  const stages = value ? routeFor(value).stages : STAGES;
  return stages.find((s) => km < s.endKm) || stages.at(-1);
}
export function locationAt(totalKm, value) {
  const stage = stageAtDistance(totalKm, value),
    f = clamp((totalKm - stage.startKm) / stage.km, 0, 1),
    n = f * (stage.path.length - 1),
    a = Math.min(stage.path.length - 2, Math.floor(n)),
    u = n - a;
  return {
    lon: stage.path[a][0] + (stage.path[a + 1][0] - stage.path[a][0]) * u,
    lat: stage.path[a][1] + (stage.path[a + 1][1] - stage.path[a][1]) * u,
    stage: stage.index,
  };
}
