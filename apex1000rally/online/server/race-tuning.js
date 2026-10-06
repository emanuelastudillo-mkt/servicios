import { TUNINGS } from "../../src/race-tuning.js";
import { routeFor } from "../../src/route.js";
// Never send this profile or the world seed through a presentation API.
export function optimalTunings(w, event) {
  const route = routeFor(event.id);
  const km = {},
    total = route.totalKm;
  for (const stage of route.stages)
    for (const segment of stage.segments)
      km[segment.type] = (km[segment.type] || 0) + segment.km;
  const asphalt = (km.asphalt || 0) / total;
  const rough = ((km.rock || 0) + (km.mountain || 0)) / total;
  const sand = (km.sand || 0) / total;
  const heat =
    route.stages.reduce((v, s) => v + s.temp, 0) / route.stages.length;
  const centers = {
    engine: 40 + 35 * asphalt,
    transmission: 35 + 45 * asphalt - 15 * rough,
    suspension: 65 - 40 * rough - 30 * sand,
    tyres: 65 - 45 * sand - 20 * rough,
    cooling: 80 - heat * 1.4,
    brakes: 40 + 25 * asphalt + 20 * rough,
  };
  return Object.fromEntries(
    TUNINGS.map(({ id }) => {
      let h = 2166136261;
      for (const c of `${w.seed}/${event.eventId}/${id}`)
        h = Math.imul(h ^ c.charCodeAt(0), 16777619);
      return [
        id,
        Math.max(
          5,
          Math.min(95, Math.round(centers[id] + ((h >>> 0) % 31) - 15)),
        ),
      ];
    }),
  );
}
