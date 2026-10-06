import { CITIES, STAGES, TOTAL_KM, locationAt, routeFor } from "./route.js";
import { RACE_MAPS } from "../data/race-maps.js";
import { vehicle } from "./catalog.js";
import { shieldSVG } from "./shields.js";
import { vehicleHealth } from "./reliability.js";
import { standings } from "./engine.js";
import { pointAlong } from "./route-geometry.js";
export const esc = (s) =>
  String(s ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
let projectionCities, projection;
export function project(lon, lat) {
  if (projectionCities !== CITIES) {
    const xs = CITIES.map((c) => c.lon),
      ys = CITIES.map((c) => -c.lat),
      minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const scale = Math.min(720 / (maxX - minX || 1), 720 / (maxY - minY || 1));
    projection = { x: (minX + maxX) / 2, y: (minY + maxY) / 2, scale };
    projectionCities = CITIES;
  }
  return [
    500 + (lon - projection.x) * projection.scale,
    475 + (-lat - projection.y) * projection.scale,
  ];
}
export const stagePath = (s) =>
  s.path
    .map(
      (p, i) =>
        `${i ? "L" : "M"}${project(...p)
          .map((n) => n.toFixed(3))
          .join(" ")}`,
    )
    .join(" ");
export const camera = { x: 0, y: 0, w: 1000, h: 950, follow: null };
export const MAX_ZOOM = 2000;
export function fitMap() {
  Object.assign(camera, { x: 0, y: 0, w: 1000, h: 950, follow: null });
}
export function focusTeam(team) {
  const pos = locationAt(team.totalKm),
    [x, y] = project(pos.lon, pos.lat);
  const w = Math.min(camera.w, 1000 / 12),
    h = w * 0.95;
  Object.assign(camera, {
    x: x - w / 2,
    y: y - h / 2,
    w,
    h,
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
export function zoom(factor, anchor = null) {
  const w = Math.min(1600, Math.max(1000 / MAX_ZOOM, camera.w * factor)),
    h = w * 0.95;
  const ax = anchor?.x ?? camera.x + camera.w / 2,
    ay = anchor?.y ?? camera.y + camera.h / 2;
  camera.x = ax - ((ax - camera.x) * w) / camera.w;
  camera.y = ay - ((ay - camera.y) * h) / camera.h;
  camera.w = w;
  camera.h = h;
  if (anchor) camera.follow = null;
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
  const slider = document.querySelector("#map-zoom-range");
  if (slider) slider.value = Math.max(1, 1000 / camera.w);
  const matrix = svg?.getScreenCTM();
  if (matrix) {
    const unit = 1 / Math.hypot(matrix.a, matrix.b);
    svg
      .querySelectorAll(".marker-symbol, .city-symbol")
      .forEach((el) => el.setAttribute("transform", `scale(${unit})`));
  }
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
  cachedRoad = "",
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
      const overflow =
        Math.max(0, -box.left) +
        Math.max(0, box.right - 1000) +
        Math.max(0, -box.top) +
        Math.max(0, box.bottom - 950);
      return {
        dx,
        dy,
        anchor,
        box,
        score: overflow * 1000 + overlap * 100 + nearCity * 10,
      };
    });
    candidates.sort((a, b) => a.score - b.score);
    const label = candidates[0];
    placed.push(label.box);
    return `<g transform="translate(${x} ${y})"><g class="city-symbol"><circle r="${i === 0 || i === CITIES.length - 1 ? 4 : 2.5}" fill="#f2d6a3" stroke="#152d27" stroke-width="1"/><text x="${label.dx}" y="${label.dy}" text-anchor="${label.anchor}">${esc(c.name)}</text></g></g>`;
  }).join("");
}
export function mapSVG(state, geo) {
  if (cachedRoute !== state.routeId || !cachedMap) {
    cachedRoute = state.routeId;
    cachedMap =
      '<rect x="-20000" y="-20000" width="40000" height="40000" fill="#12252e"/><defs><clipPath id="map-terrain-bounds"><rect width="1000" height="950"/></clipPath></defs><g clip-path="url(#map-terrain-bounds)">' +
      geo.features
        .map((f) => {
          const polys =
            f.geometry.type === "Polygon"
              ? [f.geometry.coordinates]
              : f.geometry.coordinates;
          return (
            '<path d="' +
            polys.map((p) => p.map(polygon).join(" ")).join(" ") +
            '" fill="#344840" stroke="#78927c" stroke-opacity=".4" stroke-width=".8" vector-effect="non-scaling-stroke"/>'
          );
        })
        .join("") + "</g>";
    const terrain = RACE_MAPS[routeFor(state.routeId).id];
    if (terrain)
      cachedMap += `<image class="race-terrain-image" href="${esc(terrain.src)}" x="0" y="0" width="${terrain.width}" height="${terrain.height}" preserveAspectRatio="none" pointer-events="none"><title>Relieve satelital ilustrado</title></image>`;
    cachedRoad = STAGES.map((s) => {
      const full = stagePath(s);
      const sections = s.segments
        .map((segment) => {
          const a = segment.start / s.km,
            b = (segment.start + segment.km) / s.km,
            total = s.pathDistances.at(-1);
          const points = [
            pointAlong(s, a),
            ...s.path.filter(
              (_, i) =>
                s.pathDistances[i] > a * total &&
                s.pathDistances[i] < b * total,
            ),
            pointAlong(s, b),
          ];
          return `<path class="route-surface surface-${segment.type}" d="${stagePath({ path: points })}"/>`;
        })
        .join("");
      return `<g class="stage-trace"><path class="route-outline" d="${full}"/>${sections}<path class="stage-hit" d="${full}" data-action="map-stage" data-index="${s.index}"/></g>`;
    }).join("");
  }
  return `<svg id="race-map" viewBox="${camera.x} ${camera.y} ${camera.w} ${camera.h}" role="img" aria-label="Mapa de la carrera con localidades y escudos de los equipos participantes" tabindex="0">${cachedMap}<g class="route-lines">${cachedRoad}</g><g class="city-labels">${cityLabels()}</g><g id="team-markers">${state.teams.map((t) => `<g id="map-team-${t.id}" class="team-marker" data-action="follow" data-id="${t.id}" role="button" tabindex="0" aria-label="Seguir a ${esc(t.name)}"><title>${esc(t.name)}</title><g class="marker-symbol"><circle class="marker-halo" r="24"/><circle class="marker-status" r="21"/>${shieldSVG(t.shieldId).replace("<svg ", '<svg x="-17" y="-17" width="34" height="34" ')}<rect class="marker-rank-bg" x="8" y="10" width="20" height="16" rx="6"/><text class="marker-position" x="18" y="21" text-anchor="middle"></text></g></g>`).join("")}</g></svg>`;
}
export function updateMap(state, selectedId = "player") {
  const order = standings(state);
  for (const t of state.teams) {
    const el = document.querySelector(`#map-team-${t.id}`);
    if (!el) continue;
    el.style.display = state.competition && !t.participating ? "none" : "";
    const p = locationAt(t.totalKm),
      [x, y] = project(p.lon, p.lat);
    el.setAttribute("transform", `translate(${x} ${y})`);
    const health = vehicleHealth(t),
      position = order.findIndex((x) => x.id === t.id) + 1;
    el.setAttribute(
      "class",
      `team-marker health-${health.level}${t.id === selectedId ? " selected" : ""}`,
    );
    el.querySelector(".marker-position").textContent = position;
    el.querySelector("title").textContent =
      `P${position} · ${t.name}${health.alerts.length ? " · " + health.alerts.map((a) => a.text).join(" · ") : ""}`;
  }
  const selected = document.querySelector(`#map-team-${selectedId}`);
  if (selected && selected.parentNode.lastElementChild !== selected)
    selected.parentNode.append(selected);
  if (camera.follow) {
    const t = state.teams.find((t) => t.id === camera.follow);
    if (t && (!state.competition || t.participating)) {
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
