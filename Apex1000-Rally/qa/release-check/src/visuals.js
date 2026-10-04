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
export const project = (lon, lat) => [(lon + 78) * 34, (-lat - 16) * 31];
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
let cachedMap = "";
export function mapSVG(state, geo) {
  if (!cachedMap)
    cachedMap = `<defs><pattern id="map-grid" width="70" height="70" patternUnits="userSpaceOnUse"><path d="M70 0H0V70" fill="none" stroke="#d0c4a7" stroke-width=".4" opacity=".12"/></pattern><pattern id="sand-dots" width="11" height="11" patternUnits="userSpaceOnUse"><circle cx="3" cy="4" r=".7" fill="#c7a36e" opacity=".2"/></pattern></defs><rect x="-2000" y="-3000" width="6000" height="6500" fill="#17252c"/>${geo.features
      .map((f) => {
        const rings =
          f.geometry.type === "Polygon"
            ? [f.geometry.coordinates]
            : f.geometry.coordinates;
        const color =
          {
            Argentina: "#414a3b",
            Chile: "#514d3b",
            Bolivia: "#59553e",
            Peru: "#46513f",
            Brazil: "#34483c",
            Uruguay: "#415240",
            Paraguay: "#3e513d",
          }[f.properties.name] || "#354439";
        return `<path d="${rings.map((p) => p.map(polygon).join(" ")).join(" ")}" fill="${color}" stroke="#91a485" stroke-opacity=".3" stroke-width="1.1"/>`;
      })
      .join(
        "",
      )}<path d="M365 55 349 160 318 220 314 330 310 455 267 592 249 740 220 1000" fill="none" stroke="#d0c09b" stroke-width="37" opacity=".07"/><path d="M355 74 337 162 318 232 315 349 309 466 280 539 262 666 245 739 231 829" fill="none" stroke="#c9baa3" stroke-width="2" stroke-dasharray="7 8" opacity=".3"/><path d="M290 287 430 280 434 392 302 436Z" fill="url(#sand-dots)"/><rect x="-2000" y="-3000" width="6000" height="6500" fill="url(#map-grid)"/><g class="country-label"><text x="514" y="543">ARGENTINA</text><text x="163" y="469" transform="rotate(-83 163 469)">CHILE</text><text x="471" y="65">BOLIVIA</text><text x="855" y="190">BRASIL</text><text x="799" y="558">URUGUAY</text><text x="664" y="228">PARAGUAY</text></g><g class="ocean-label"><text x="93" y="665" transform="rotate(-90 93 665)">OCÉANO PACÍFICO</text><text x="797" y="796" transform="rotate(-35 797 796)">OCÉANO ATLÁNTICO</text></g>`;
  return `<svg id="race-map" viewBox="${camera.x} ${camera.y} ${camera.w} ${camera.h}" role="img" aria-label="Mapa de la travesía sudamericana, localidades y posición de los doce equipos" tabindex="0">${cachedMap}<g class="route-lines">${STAGES.map((s) => `<path d="${stagePath(s)}" fill="none" stroke="#091413" stroke-width="7"/><path class="stage-line" data-stage="${s.index}" d="${stagePath(s)}" fill="none" stroke="#d4ad73" stroke-width="2.8" stroke-linejoin="round" stroke-dasharray="5 3"/><path d="${stagePath(s)}" fill="none" stroke="transparent" stroke-width="15" data-action="map-stage" data-index="${s.index}"/>`).join("")}</g><g class="city-labels">${CITIES.map(
    (c, i) => {
      const [x, y] = project(c.lon, c.lat),
        left = [4, 5, 7, 12, 13, 14, 15].includes(i),
        dy = i === 8 ? -10 : i === 7 ? 14 : -8;
      return `<g transform="translate(${x} ${y})"><circle r="${i === 0 || i === 15 ? 6 : 3.5}" fill="${i === 0 ? "#eab67c" : i === 15 ? "#d7eac1" : "#c4c7ae"}" stroke="#28372d" stroke-width="2"/><text x="${left ? -10 : 10}" y="${dy}" text-anchor="${left ? "end" : "start"}">${esc(c.name)}</text>${i === 0 ? '<text x="10" y="8" class="city-kind">LARGADA</text>' : i === 15 ? '<text x="-10" y="23" text-anchor="end" class="city-kind">META</text>' : ""}</g>`;
    },
  ).join(
    "",
  )}</g><g id="team-markers">${state.teams.map((t, i) => `<g id="map-team-${t.id}" class="team-marker" data-action="follow" data-id="${t.id}" role="button" tabindex="0" aria-label="Seguir a ${esc(t.name)}"><circle class="marker-halo" r="${t.id === "player" ? 17 : 12}" fill="${t.color}" opacity=".12"/><circle class="marker-body" r="${t.id === "player" ? 9 : 7}" fill="${t.color}" stroke="#172121" stroke-width="2"/><text text-anchor="middle" dy="3.3" fill="#131b1e">${t.id === "player" ? "T" : i}</text></g>`).join("")}</g></svg>`;
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
  const v = vehicle(id);
  const roof =
    id === "raptor"
      ? "M68 71 116 67 133 43 190 43 218 69 271 76 276 114H60Z"
      : id === "mini"
        ? "M63 76 93 64 120 42 193 45 227 67 263 77 277 110H58Z"
        : "M60 78 94 67 127 43 189 45 217 67 266 76 280 112H55Z";
  return `<svg class="truck-art ${large ? "large" : ""}" viewBox="0 0 335 150" role="img" aria-label="Ilustración de vehículo de rally"><defs><linearGradient id="car-${id}"><stop stop-color="${v.color}"/><stop offset="1" stop-color="#555c53"/></linearGradient></defs><ellipse cx="167" cy="130" rx="137" ry="10" fill="#080b0c" opacity=".35"/><path d="M35 118H300" stroke="#a1947b" opacity=".15"/><path d="${roof}" fill="url(#car-${id})" stroke="#222c2d" stroke-width="2"/><path d="m114 66 20-18h25v18zm53-18h20l23 19h-43z" fill="#263740"/><path d="M74 95h184v15H74Z" fill="#2e3631"/><path d="m105 78 105 5-17 11-106-4z" fill="#e9debf" opacity=".65"/><path d="m131 47-17 20m46-21v23m33-19 24 20" stroke="#e2d7b8" stroke-width="1.5"/><path d="m66 101-8 11m213-18 9 16" stroke="#b9bfb1" stroke-width="4"/><g fill="#121c21" stroke="#27323a" stroke-width="4"><circle cx="101" cy="113" r="24"/><circle cx="237" cy="113" r="24"/></g><g fill="#a1a69b" stroke="#465251" stroke-width="5"><circle cx="101" cy="113" r="10"/><circle cx="237" cy="113" r="10"/></g><path d="M68 79h21M254 83h16" stroke="#f5edc3" stroke-width="4"/><path d="M119 39h72" stroke="#b7b9a3" stroke-width="3"/><text x="164" y="88" fill="#1b2728" text-anchor="middle" font-family="monospace" font-size="9" font-weight="bold">${id === "raptor" ? "V8" : id === "mini" ? "3.0i" : "RAID"}</text></svg>`;
}
export function conditionBar(n, color = "") {
  return `<span class="condition-bar"><i style="width:${Math.max(0, Math.min(100, n))}%;background:${color || (n < 25 ? "#df8b79" : n < 60 ? "#d9b778" : "#a8c799")}"></i></span>`;
}
export function terrainBar(stage) {
  return `<div class="terrain-bar">${stage.segments.map((s) => `<span style="flex:${s.share};background:${{ asphalt: "#98adc1", gravel: "#d7b685", sand: "#e6c26e", rock: "#ba9e99", mountain: "#9fbaa0" }[s.type]}" title="${s.type}: ${Math.round(s.share * 100)}%"></span>`).join("")}</div>`;
}
