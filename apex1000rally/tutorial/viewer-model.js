import {
  STAGES,
  stageDistance,
  telemetry,
  DRIVERS,
  rivalReference,
} from "./engine.js?v=1.6.3";
export const WORLD = { width: 1200, height: 460, km: 40 };
export const TEAMS = [
  {
    id: "player",
    name: "Horizonte Virtual",
    short: "HV",
    color: "#efb86a",
    ratio: 1,
  },
  {
    id: "cobalto",
    name: "Cobalto Virtual",
    short: "CO",
    color: "#72baff",
    ratio: 0.9999,
  },
  {
    id: "faro",
    name: "Faro Virtual",
    short: "FA",
    color: "#a6df8a",
    ratio: 0.94,
  },
  {
    id: "orbita",
    name: "Órbita Virtual",
    short: "OR",
    color: "#c7a3ff",
    ratio: 0.88,
  },
  {
    id: "nomada",
    name: "Nómada Virtual",
    short: "NO",
    color: "#fa889c",
    ratio: 0.82,
  },
  {
    id: "sur",
    name: "Sur Virtual",
    short: "SU",
    color: "#66dacb",
    ratio: 0.75,
  },
];
// A virtual training course, with no real-world or navigation coordinates.
const ANCHORS = [
  [
    [65, 346],
    [108, 322],
    [118, 273],
    [169, 264],
    [183, 317],
    [230, 321],
    [264, 271],
  ],
  [
    [264, 271],
    [302, 244],
    [340, 270],
    [353, 324],
    [398, 338],
    [417, 286],
    [469, 270],
  ],
  [
    [469, 270],
    [518, 244],
    [535, 183],
    [570, 213],
    [610, 172],
    [647, 131],
    [697, 159],
  ],
  [
    [697, 159],
    [736, 196],
    [751, 252],
    [791, 231],
    [824, 271],
    [865, 324],
    [906, 283],
  ],
  [
    [906, 283],
    [939, 252],
    [961, 196],
    [1001, 174],
    [1047, 187],
    [1090, 134],
    [1135, 98],
  ],
];
export const COLORS = ["#bcb080", "#e5b86f", "#90c5cd", "#c2a9d0", "#c1d2e2"];
function curve(points) {
  const out = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)],
      p1 = points[i],
      p2 = points[i + 1],
      p3 = points[Math.min(points.length - 1, i + 2)];
    for (let j = 0; j < 20; j++) {
      const t = j / 20;
      out.push(
        [0, 1].map(
          (axis) =>
            0.5 *
            (2 * p1[axis] +
              (-p0[axis] + p2[axis]) * t +
              (2 * p0[axis] - 5 * p1[axis] + 4 * p2[axis] - p3[axis]) * t * t +
              (-p0[axis] + 3 * p1[axis] - 3 * p2[axis] + p3[axis]) * t * t * t),
        ),
      );
    }
  }
  out.push(points.at(-1));
  return out;
}
let km = 0;
export const ROUTE = ANCHORS.map((anchors, i) => {
  const points = curve(anchors),
    cumulative = [0];
  for (let p = 1; p < points.length; p++)
    cumulative.push(
      cumulative.at(-1) +
        Math.hypot(
          points[p][0] - points[p - 1][0],
          points[p][1] - points[p - 1][1],
        ),
    );
  const segment = {
    stage: i,
    startKm: km,
    endKm: km + STAGES[i].km,
    points,
    cumulative,
    length: cumulative.at(-1),
    color: COLORS[i],
  };
  km = segment.endKm;
  return segment;
});
export function routePoint(distance) {
  const km = Math.max(0, Math.min(WORLD.km, Number(distance) || 0));
  const segment = ROUTE.find((r) => km < r.endKm) || ROUTE.at(-1);
  const target =
    ((km - segment.startKm) / (segment.endKm - segment.startKm)) *
    segment.length;
  let i = segment.cumulative.findIndex((n) => n >= target);
  i = Math.max(1, i < 0 ? segment.points.length - 1 : i);
  const a = segment.points[i - 1],
    b = segment.points[i],
    length = segment.cumulative[i] - segment.cumulative[i - 1];
  const p = length ? (target - segment.cumulative[i - 1]) / length : 0;
  return {
    x: a[0] + (b[0] - a[0]) * p,
    y: a[1] + (b[1] - a[1]) * p,
    angle: (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI,
    stage: segment.stage,
  };
}
export function cameraBounds(cx, cy, zoom = 1) {
  const z = Math.max(1, Math.min(16, Number(zoom) || 1)),
    width = WORLD.width / z,
    height = WORLD.height / z;
  const x = Math.max(0, Math.min(WORLD.width - width, cx - width / 2)),
    y = Math.max(0, Math.min(WORLD.height - height, cy - height / 2));
  return {
    x,
    y,
    width,
    height,
    cx: x + width / 2,
    cy: y + height / 2,
    zoom: z,
  };
}
export function trainingField(s) {
  const partial = s.phase === "driving" ? stageDistance(s) : 0;
  const field = TEAMS.map((t) => {
    const reference = rivalReference(s.elapsed, t.ratio);
    const you = t.id === "player",
      km = you ? s.km + partial : reference.km;
    const location = routePoint(km),
      speed =
        s.paused || s.phase === "result"
          ? 0
          : you
            ? telemetry(s).speed
            : reference.speed;
    const phase =
      s.phase === "result"
        ? "Resultado final"
        : s.phase === "service"
          ? "Asistencia / pausa virtual"
          : s.phase === "camp" || s.phase === "ready"
            ? "Esperando plan de etapa"
            : s.phase === "preparation"
              ? "Puesta a punto"
              : s.phase === "briefing"
                ? "Antes de largar"
                : s.paused
                  ? "En pausa"
                  : "En carrera";
    return {
      ...t,
      you,
      km,
      speed,
      location,
      phase:
        !you && !s.paused && s.phase !== "result" ? reference.phase : phase,
      driver:
        you && s.decision ? DRIVERS[s.decision.driver].name : "Piloto virtual",
    };
  }).sort((a, b) => b.km - a.km || Number(b.you) - Number(a.you));
  return field.map((t, i) => ({
    ...t,
    position: i + 1,
    previousGap: i ? field[i - 1].km - t.km : null,
    nextGap: i < field.length - 1 ? t.km - field[i + 1].km : null,
  }));
}
