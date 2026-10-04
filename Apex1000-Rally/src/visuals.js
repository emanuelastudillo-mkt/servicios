import { CITIES, STAGES, TOTAL_KM, locationAt } from "./route.js";
import { vehicle } from "./catalog.js";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
export function project(lon, lat) {
  const xs = CITIES.map((c) => c.lon),
    ys = CITIES.map((c) => -c.lat),
    minX = Math.min(...xs),
    maxX = Math.max(...xs),
    minY = Math.min(...ys),
    maxY = Math.max(...ys);
  const scale = Math.min(720 / (maxX - minX || 1), 720 / (maxY - minY || 1));
  return [
    500 + (lon - (minX + maxX) / 2) * scale,
    475 + (-lat - (minY + maxY) / 2) * scale,
  ];
}
export const stagePath = (s) =>
  s.path
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${project(...p)
          .map((n) => n.toFixed(2))
          .join(" ")}`,
    )
    .join(" ");
export const camera = { x: 0, y: 0, w: 1000, h: 950, follow: null };
export function fitMap() {
  Object.assign(camera, { x: 0, y: 0, w: 1000, h: 950, follow: null });
}
export function focusTeam(team) {
  const pos = locationAt(team.totalKm),
    [x, y] = project(pos.lon, pos.lat);
  Object.assign(camera, {
    x: x - 180,
    y: y - 171,
    w: 360,
    h: 342,
    follow: team.id,
  });
}
export function focusStage(stage) {
  const points = stage.path.map((p) => project(...p)),
    xs = points.map((p) => p[0]),
    ys = points.map((p) => p[1]),
    w = Math.max(180, Math.max(...xs) - Math.min(...xs) + 110),
    h = Math.max(w * 0.95, Math.max(...ys) - Math.min(...ys) + 130),
    width = h / 0.95;
  Object.assign(camera, {
    x: (Math.min(...xs) + Math.max(...xs) - width) / 2,
    y: (Math.min(...ys) + Math.max(...ys) - h) / 2,
    w: width,
    h,
    follow: null,
  });
}
export function zoom(factor) {
  const w = Math.min(1600, Math.max(110, camera.w * factor)),
    h = w * 0.95;
  camera.x += (camera.w - w) / 2;
  camera.y += (camera.h - h) / 2;
  camera.w = w;
  camera.h = h;
  camera.follow = null;
}
export function applyCamera() {
  const svg = document.querySelector("#race-map");
  if (svg)
    svg.setAttribute(
      "viewBox",
      `${camera.x} ${camera.y} ${camera.w} ${camera.h}`,
    );
  const label = document.querySelector("#zoom-level");
  if (label) label.textContent = `${(1000 / camera.w).toFixed(1)}×`;
}
const polygon = (ring) =>
  ring
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${project(...p)
          .map((n) => n.toFixed(1))
          .join(",")}`,
    )
    .join(" ") + "Z";
let cachedMap = "",
  cachedRoute = "";
function cityLabels() {
  const placed = [],
    points = CITIES.map((c) => project(c.lon, c.lat));
  return CITIES.map((c, i) => {
    const [x, y] = points[i],
      width = c.name.length * 8.3;
    const candidates = [
      [12, -13, "start"],
      [-12, -13, "end"],
      [12, 23, "start"],
      [-12, 23, "end"],
      [12, -33, "start"],
      [-12, -33, "end"],
      [12, 43, "start"],
      [-12, 43, "end"],
    ].map(([dx, dy, anchor]) => {
      const left = x + dx - (anchor === "end" ? width : 0);
      const box = {
        left,
        right: left + width,
        top: y + dy - 15,
        bottom: y + dy + 4,
      };
      const overlap = placed.filter(
        (b) =>
          box.left < b.right + 5 &&
          box.right > b.left - 5 &&
          box.top < b.bottom + 4 &&
          box.bottom > b.top - 4,
      ).length;
      const nearCity = points.filter(
        ([px, py]) =>
          px > box.left - 8 &&
          px < box.right + 8 &&
          py > box.top - 8 &&
          py < box.bottom + 8,
      ).length;
      return { dx, dy, anchor, box, score: overlap * 100 + nearCity * 10 };
    });
    candidates.sort((a, b) => a.score - b.score);
    const label = candidates[0];
    placed.push(label.box);
    return `<g transform="translate(${x} ${y})"><circle r="${i === 0 || i === CITIES.length - 1 ? 6 : 3.5}" fill="#f2d6a3" stroke="#152d27" stroke-width="2"/><text x="${label.dx}" y="${label.dy}" text-anchor="${label.anchor}">${esc(c.name)}</text></g>`;
  }).join("");
}
export function mapSVG(state, geo) {
  if (cachedRoute !== state.routeId || !cachedMap) {
    cachedRoute = state.routeId;
    cachedMap =
      '<rect x="-20000" y="-20000" width="40000" height="40000" fill="#12252e"/>' +
      geo.features
        .map((f) => {
          const polys =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates]
              : f.geometry.coordinates;
          return (
            '<path d="' +
            polys.map((p) => p.map(polygon).join(" ")).join(" ") +
            '" fill="#344840" stroke="#78927c" stroke-opacity=".4" stroke-width=".8"/>'
          );
        })
        .join("");
  }
  return `<svg id="race-map" viewBox="${camera.x} ${camera.y} ${camera.w} ${camera.h}" role="img" aria-label="Mapa de la carrera con localidades y posiciones de los doce equipos" tabindex="0">${cachedMap}<g class="route-lines">${STAGES.map((s) => `<path d="${stagePath(s)}" fill="none" stroke="#08181d" stroke-width="8"/><path class="stage-line" data-stage="${s.index}" d="${stagePath(s)}" fill="none" stroke="#edc17e" stroke-width="3" stroke-linejoin="round"/><path d="${stagePath(s)}" fill="none" stroke="transparent" stroke-width="15" data-action="map-stage" data-index="${s.index}"/> `).join("")}</g><g class="city-labels">${cityLabels()}</g><g id="team-markers">${state.teams.map((t, i) => `<g id="map-team-${t.id}" class="team-marker" data-action="follow" data-id="${t.id}" role="button" tabindex="0" aria-label="Seguir a ${esc(t.name)}"><circle class="marker-halo" r="${t.id === "player" ? 22 : 15}" fill="${t.color}" opacity=".18"/><circle class="marker-body" r="${t.id === "player" ? 10 : 8}" fill="${t.color}" stroke="#101c23" stroke-width="2"/><text text-anchor="middle" dy="3.3" fill="#101c23">${t.id === "player" ? "T" : i}</text></g>`).join("")}</g></svg>`;
}
export function updateMap(state) {
  for (const t of state.teams) {
    const el = document.querySelector(`#map-team-${t.id}`);
    if (!el) continue;
    const p = locationAt(t.totalKm),
      [x, y] = project(p.lon, p.lat);
    const stopped = t.phase !== "racing",
      index = state.teams.indexOf(t),
      angle = index * 2.4,
      spread = stopped ? (Math.min(15, 3 + index * 1.5) * camera.w) / 1000 : 0;
    el.setAttribute(
      "transform",
      `translate(${x + Math.cos(angle) * spread} ${y + Math.sin(angle) * spread}) scale(${Math.max(0.2, camera.w / 1000)})`,
    );
    el.style.opacity = t.phase === "finished" ? ".65" : "1";
  }
  if (camera.follow) {
    const t = state.teams.find((t) => t.id === camera.follow);
    if (t) {
      const p = locationAt(t.totalKm),
        [x, y] = project(p.lon, p.lat);
      camera.x = x - camera.w / 2;
      camera.y = y - camera.h / 2;
    }
  }
  applyCamera();
}
export function truckSVG(id = "hilux", large = false) {
  return (
    '<img class="truck-art ' +
    (large ? "large" : "") +
    '" src="assets/art/' +
    id +
    '.webp" alt="Ilustración de ' +
    esc(vehicle(id).name) +
    '" loading="lazy">'
  );
}
export function conditionBar(n, color = "") {
  return `<span class="condition-bar"><i style="width:${Math.max(0, Math.min(100, n))}%;background:${color || (n < 25 ? "#df8b79" : n < 60 ? "#d9b778" : "#a8c799")}"></i></span>`;
}
export function terrainBar(stage) {
  return `<div class="terrain-bar">${stage.segments.map((s) => `<span style="flex:${s.share};background:${{ asphalt: "#98adc1", gravel: "#d7b685", sand: "#e6c26e", rock: "#ba9e99", mountain: "#9fbaa0" }[s.type]}" title="${s.type}: ${Math.round(s.share * 100)}%"></span>`).join("")}</div>`;
}
