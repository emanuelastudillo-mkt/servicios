// Designed rally specials, not surveyed roads. City coordinates remain exact.
const mix = (a, b, t) => a + (b - a) * t;
const hash = (i, seed) => {
  let x = Math.imul(i + seed, 374761393);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  return (((x ^ (x >>> 16)) >>> 0) / 4294967295) * 2 - 1;
};
const noise = (x, seed) => {
  const i = Math.floor(x),
    t = x - i;
  return mix(
    hash(i, seed),
    hash(i + 1, seed),
    t * t * t * (t * (t * 6 - 15) + 10),
  );
};
const curve = (a, b, c, d, t) =>
  0.5 *
  (2 * b +
    (-a + c) * t +
    (2 * a - 5 * b + 4 * c - d) * t * t +
    (-a + 3 * b - 3 * c + d) * t * t * t);
export function detailedGeometry(stage, seed) {
  const cos = Math.cos(((stage.from.lat + stage.to.lat) * Math.PI) / 360);
  const dx = (stage.to.lon - stage.from.lon) * cos,
    dy = stage.to.lat - stage.from.lat;
  const span = Math.hypot(dx, dy) || 0.001,
    nx = -dy / span,
    ny = dx / span;
  const rough = stage.segments.reduce(
    (n, s) =>
      n +
      s.share *
        { asphalt: 0.4, gravel: 1, sand: 0.8, rock: 1.3, mountain: 1.7 }[
          s.type
        ],
    0,
  );
  const anchors = stage.path,
    count = Math.max(640, Math.min(1800, Math.ceil(span * 180)));
  const amplitude = Math.min(0.22, span * 0.055) * rough;
  const path = Array.from({ length: count + 1 }, (_, i) => {
    const t = i / count,
      at = t * (anchors.length - 1),
      k = Math.min(anchors.length - 2, Math.floor(at)),
      u = at - k;
    const p0 = anchors[Math.max(0, k - 1)],
      p1 = anchors[k],
      p2 = anchors[k + 1],
      p3 = anchors[Math.min(anchors.length - 1, k + 2)];
    const envelope = Math.sin(Math.PI * t) ** 0.65;
    const offset =
      envelope *
      amplitude *
      (noise(t * 7, seed) +
        0.28 * noise(t * 31, seed + 87) +
        0.08 * noise(t * 127, seed + 233) +
        0.018 * noise(t * 383, seed + 977));
    return [
      curve(p0[0], p1[0], p2[0], p3[0], u) + (nx * offset) / cos,
      curve(p0[1], p1[1], p2[1], p3[1], u) + ny * offset,
    ];
  });
  path[0] = [stage.from.lon, stage.from.lat];
  path[count] = [stage.to.lon, stage.to.lat];
  const distances = [0];
  for (let i = 1; i < path.length; i++)
    distances.push(
      distances[i - 1] +
        Math.hypot(
          (path[i][0] - path[i - 1][0]) * cos,
          path[i][1] - path[i - 1][1],
        ),
    );
  return { path, pathDistances: distances };
}
export function pointAlong(stage, fraction) {
  const distances = stage.pathDistances,
    target = Math.max(0, Math.min(1, fraction)) * distances.at(-1);
  let lo = 0,
    hi = distances.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (distances[mid] <= target) lo = mid;
    else hi = mid;
  }
  const t = (target - distances[lo]) / (distances[hi] - distances[lo] || 1);
  return [
    mix(stage.path[lo][0], stage.path[hi][0], t),
    mix(stage.path[lo][1], stage.path[hi][1], t),
  ];
}
