import {
  WORLD,
  TEAMS,
  ROUTE,
  trainingField,
  routePoint,
  cameraBounds,
  markerLayout,
} from "./viewer-model.js?v=1.7.1";
import { STAGES } from "./engine.js?v=1.7.1";
import { createTrainingTerrain } from "./terrain.js?v=1.7.1";
import { createVehicleDialog } from './vehicle-dialog.js?v=1.7.1';
const fmt = (n) =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const path = (points) =>
  points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
export const TERRAIN_ASSET = "./assets/tutorial-terrain-v1.png";
function scenery() {
  // Terrain is a local illustration. Geometry, labels and live cars stay in SVG.
  return `<defs><linearGradient id="terrain-fallback" x2="1" y2="0"><stop stop-color="#66614a"/><stop offset=".32" stop-color="#b29155"/><stop offset=".52" stop-color="#626859"/><stop offset=".72" stop-color="#965e43"/><stop offset="1" stop-color="#6c7853"/></linearGradient><linearGradient id="map-edge-shade" x2="0" y2="1"><stop stop-color="#071310" stop-opacity=".1"/><stop offset=".5" stop-color="#071310" stop-opacity="0"/><stop offset="1" stop-color="#071310" stop-opacity=".18"/></linearGradient></defs><rect width="1200" height="460" fill="url(#terrain-fallback)"/><image class="map-terrain-image" data-src="${TERRAIN_ASSET}" x="0" y="0" width="1200" height="460" preserveAspectRatio="none"/><rect width="1200" height="460" fill="url(#map-edge-shade)" pointer-events="none"/><g class="map-terrain-label"><text x="89" y="227">QUEBRADA DE ENTRADA<tspan x="89" dy="16">RIPIO</tspan></text><text x="313" y="193">DUNAS DEL HORNO<tspan x="313" dy="16">ARENA · 46 °C</tspan></text><text x="501" y="96">PASO DEL CÓNDOR<tspan x="501" dy="16">MONTAÑA</tspan></text><text x="767" y="394">CAÑÓN DE LAS AGUJAS<tspan x="767" dy="16">ROCA</tspan></text><text x="989" y="294">RECTA DEL HORIZONTE<tspan x="989" dy="16">ASFALTO</tspan></text></g><text x="28" y="31" class="map-coordinate">HORIZONTE VIRTUAL / TERRENO ILUSTRADO</text><g transform="translate(1154 399)" class="map-compass"><path d="m0-27 8 28-8-5-8 5Z" fill="#f0ead8" stroke="#182219" stroke-width="1"/><text y="-34" text-anchor="middle">N</text></g>`;
}
function mapSVG() {
  const stops = [
    { km: 0, name: "LARGADA" },
    ...ROUTE.map((r, i) => ({
      km: r.endKm,
      name: i === 4 ? "META · 40 KM" : `CAMPAMENTO ${i + 1}`,
    })),
  ];
  return `<svg id="training-map" viewBox="0 0 1200 460" aria-label="Mapa del recorrido virtual de cinco etapas" role="group">${scenery()}${ROUTE.map((r, i) => `<path d="${path(r.points)}" fill="none" stroke="#081117" stroke-width="6" stroke-opacity=".8" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${path(r.points)}" fill="none" stroke="${r.color}" stroke-width="3.5" stroke-linecap="round" vector-effect="non-scaling-stroke"/><path d="${path(r.points)}" fill="none" stroke="#f2eee1" stroke-opacity=".95" stroke-width="1.4" vector-effect="non-scaling-stroke" ${i === 4 ? 'stroke-dasharray="6 7"' : ""}/>`).join("")}${stops
    .map((stop, i) => {
      const p = routePoint(stop.km);
      return `<g class="map-stop" transform="translate(${p.x} ${p.y})"><circle r="10" fill="#12242c" stroke="#d7e5df" stroke-width="2"/><text y="4" text-anchor="middle">${i === 5 ? "⚑" : i}</text><text y="${i % 2 ? 33 : -24}" text-anchor="middle" class="map-stop-name">${stop.name}</text></g>`;
    })
    .join(
      "",
    )}${TEAMS.map((t) => `<line id="tether-${t.id}" stroke="${t.color}" stroke-width="2" stroke-opacity="1" vector-effect="non-scaling-stroke" pointer-events="none"/><circle id="anchor-${t.id}" fill="${t.color}" stroke="#071310" stroke-width="1" vector-effect="non-scaling-stroke" pointer-events="none"/>`).join("")}${TEAMS.map((t) => `<g id="marker-${t.id}" class="map-marker" data-team="${t.id}" tabindex="0" role="button" aria-label="Seguir ${t.name}"><title>${t.name}</title><circle class="marker-ring" r="17" fill="#10212b" stroke="${t.color}" stroke-width="2"/><g class="marker-car"><path d="m-10-5 4-4h11l6 9-6 9H-6l-4-4Z" fill="${t.color}"/><path d="M-3-5h6v10h-6Z" fill="#13202b"/><path d="M-7-10v4M-7 10V6M6-10v4M6 10V6" stroke="#070f14" stroke-width="3"/></g><g transform="translate(13 -13)"><circle r="8" fill="${t.color}"/><text class="marker-rank" y="3.5" text-anchor="middle" fill="#10212b">1</text></g></g>`).join("")}</svg>`;
}
export function createRaceViewer(root, actions = {}) {
  let selected = "player",
    follow = true,
    camera = cameraBounds(600, 230),
    field = [],
    dragging = null;
  root.innerHTML = `<div class="viewer-heading"><div><span class="eyebrow">RECORRIDO VIRTUAL · 40 KM</span><h2>La carrera, en movimiento.</h2></div><span class="viewer-live" id="viewer-status">Antes de largar</span></div><div class="viewer-controls"><label>Seguir escudería<select id="viewer-team">${TEAMS.map((t) => `<option value="${t.id}">${t.name}${t.id === "player" ? " · vos" : ""}</option>`).join("")}</select></label><div class="viewer-buttons"><button type="button" data-viewer="own">Mi equipo</button><button type="button" data-viewer="follow" aria-pressed="true">Seguir: sí</button><button type="button" data-viewer="out" aria-label="Alejar mapa">−</button><output id="viewer-zoom">×1</output><button type="button" data-viewer="in" aria-label="Acercar mapa">+</button><button type="button" data-viewer="fit">Ver recorrido</button><button type="button" data-viewer="fullscreen">Pantalla completa</button></div></div><div class="viewer-map-box">${mapSVG()}</div><div class="viewer-info"><div><span id="viewer-team-name">Horizonte Virtual</span><strong id="viewer-position">P1 / 6</strong><small id="viewer-driver"></small></div><div><span>Avance válido</span><strong id="viewer-distance">0,00 km</strong><small id="viewer-terrain"></small></div><div><span>Velocidad</span><strong id="viewer-speed">0 km/h</strong><small id="viewer-phase"></small></div><div><span>Intervalos</span><strong id="viewer-gaps">—</strong><small>Distancia con anterior / siguiente</small></div></div><div class="viewer-legend">${TEAMS.map((t) => `<button type="button" data-team="${t.id}"><i style="background:${t.color}"></i>${t.short}${t.id === "player" ? " · vos" : ""}</button>`).join("")}<span>Rueda: zoom · arrastrar: mover · los iconos agrupados se unen a su posición exacta en el camino.</span></div>`;
  root
    .querySelector(".viewer-buttons")
    .insertAdjacentHTML(
      "afterbegin",
      `<button type="button" data-viewer="depth" aria-pressed="true">Satélite 3D</button><button type="button" data-viewer="pause">Pausar simulación</button><select id="viewer-speed-control" aria-label="Velocidad del visor"><option value="1">×1</option><option value="2">×2</option><option value="10">×10</option></select><button type="button" data-viewer="plan">Configurar etapa</button>`,
    );
  const terrain = root.querySelector(".map-terrain-image");
  root.querySelector('.viewer-buttons').insertAdjacentHTML('beforeend','<button type="button" data-viewer="vehicle">Ver vehículo</button>');
  const vehicleDialog=createVehicleDialog(root);
  terrain.addEventListener("error", () => {
    root.classList.add("terrain-unavailable");
    root.querySelector(".viewer-legend span").textContent =
      "El fondo no pudo cargarse. El trazado y los rivales siguen disponibles; recargá conectado para guardar el mapa offline.";
  });
  const svg = root.querySelector("svg"),
    teamSelect = root.querySelector("#viewer-team");
  const write = (id, value) => {
    const el = root.querySelector("#" + id);
    if (el.textContent !== value) el.textContent = value;
  };
  const terrain3d=createTrainingTerrain(root,{
    onZoom:()=>drawCamera(),
    onFreeCamera:()=>{follow=false;drawCamera();},
    onSelect:select,
  });
  const expanded = () =>
    document.fullscreenElement === root ||
    root.classList.contains("viewer-expanded");
  function drawCamera() {
    root.querySelector('[data-viewer="fullscreen"]').textContent = expanded()
      ? "Salir de pantalla completa"
      : "Pantalla completa";
    svg.setAttribute(
      "viewBox",
      `${camera.x} ${camera.y} ${camera.width} ${camera.height}`,
    );
    const zoom=terrain3d.enabled?terrain3d.zoom:camera.zoom;
    write("viewer-zoom", "×" + Number(zoom.toFixed(1)));
    const button = root.querySelector('[data-viewer="follow"]');
    button.textContent = "Seguir: " + (follow ? "sí" : "no");
    button.setAttribute("aria-pressed", String(follow));
    root.querySelector('[data-viewer="out"]').disabled = !terrain3d.enabled && camera.zoom <= 1;
    root.querySelector('[data-viewer="in"]').disabled = !terrain3d.enabled && camera.zoom >= 16;
  }
  function drawField() {
    const positions = markerLayout(field, camera.zoom);
    field.forEach((t) => {
      const point = t.location,
        { x, y, displaced } = positions.find((p) => p.id === t.id);
      const marker = root.querySelector("#marker-" + t.id);
      const tether = root.querySelector("#tether-" + t.id);
      for (const [key, value] of Object.entries({
        x1: point.x,
        y1: point.y,
        x2: x,
        y2: y,
      }))
        tether.setAttribute(key, value);
      tether.style.display = displaced ? "" : "none";
      const anchor = root.querySelector("#anchor-" + t.id);
      anchor.setAttribute("cx", point.x);
      anchor.setAttribute("cy", point.y);
      anchor.setAttribute("r", 3 / camera.zoom);
      anchor.style.display = displaced ? "" : "none";
      marker.setAttribute(
        "transform",
        `translate(${x} ${y}) scale(${1 / camera.zoom})`,
      );
      marker
        .querySelector(".marker-car")
        .setAttribute("transform", `rotate(${point.angle})`);
      marker.querySelector(".marker-rank").textContent = t.position;
      marker.classList.toggle("selected", t.id === selected);
      marker.setAttribute("aria-pressed", String(t.id === selected));
      marker.querySelector("title").textContent =
        `${t.name} · P${t.position} · ${fmt(t.km)} km`;
    });
  }
  function select(id) {
    if (!TEAMS.some((t) => t.id === id)) return;
    selected = id;
    teamSelect.value = id;
    follow = true;
    updateSelected();
  }
  function updateSelected() {
    const t = field.find((t) => t.id === selected);
    if (!t) return;
    if (follow && !terrain3d.enabled) camera = cameraBounds(t.location.x, t.location.y, camera.zoom);
    write("viewer-team-name", t.name + (t.you ? " · vos" : ""));
    write("viewer-position", `P${t.position} / 6`);
    write("viewer-distance", fmt(t.km) + " / 40 km");
    write("viewer-speed", Math.round(t.speed) + " km/h");
    write("viewer-driver", t.driver);
    write(
      "viewer-terrain",
      `Sector ${t.location.stage + 1} · ${STAGES[t.location.stage].terrain}`,
    );
    write("viewer-phase", t.phase);
    const gap = (km) =>
      km === null
        ? "—"
        : km < 0.01
          ? Math.round(km * 1000) + " m"
          : fmt(km) + " km";
    write("viewer-gaps", gap(t.previousGap) + " / " + gap(t.nextGap));
    write("viewer-status", t.phase);
    root
      .querySelectorAll(".viewer-legend [data-team]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.team === selected)),
      );
    drawCamera();
    if(!terrain3d.enabled)drawField();
    terrain3d.sync(field,selected,follow,!root.hidden);
  }
  function zoomTo(value, anchor = null) {
    const zoom = Math.max(1, Math.min(16, value));
    if (anchor) {
      follow = false;
      const scale = camera.zoom / zoom;
      camera = cameraBounds(
        anchor.x + (camera.cx - anchor.x) * scale,
        anchor.y + (camera.cy - anchor.y) * scale,
        zoom,
      );
    } else camera = cameraBounds(camera.cx, camera.cy, zoom);
    updateSelected();
  }
  function worldPointer(e) {
    const p = svg.createSVGPoint();
    p.x = e.clientX;
    p.y = e.clientY;
    return p.matrixTransform(svg.getScreenCTM().inverse());
  }
  root.addEventListener("change", (e) => {
    if (e.target === teamSelect) select(e.target.value);
    if (e.target.id === "viewer-speed-control")
      actions.onSpeed?.(Number(e.target.value));
  });
  root.addEventListener("click", async (e) => {
    const target = e.target.closest("[data-team],[data-viewer]");
    if (!target) return;
    if (target.dataset.team) {
      select(target.dataset.team);
      return;
    }
    switch (target.dataset.viewer) {
      case "vehicle":
        vehicleDialog.open(selected);
        break;
      case "depth":
        terrain3d.setEnabled(!terrain3d.enabled);
        updateSelected();
        break;
      case "pause":
        actions.onPause?.();
        break;
      case "plan":
        if (document.fullscreenElement === root)
          await document.exitFullscreen();
        root.classList.remove("viewer-expanded");
        drawCamera();
        document
          .querySelector("#app")
          .scrollIntoView({ block: "start", behavior: "auto" });
        break;
      case "own":
        select("player");
        break;
      case "follow":
        follow = !follow;
        updateSelected();
        break;
      case "in":
        if(terrain3d.enabled)terrain3d.command('zoom',1/1.5);else zoomTo(camera.zoom * 1.5);
        break;
      case "out":
        if(terrain3d.enabled)terrain3d.command('zoom',1.5);else zoomTo(camera.zoom / 1.5);
        break;
      case "fit":
        follow = false;
        camera = cameraBounds(600, 230, 1);
        updateSelected();
        if(terrain3d.enabled)terrain3d.command('fit');
        break;
      case "fullscreen":
        try {
          if (expanded()) {
            if (document.fullscreenElement === root)
              await document.exitFullscreen();
            root.classList.remove("viewer-expanded");
          } else if (window.matchMedia("(max-width: 800px)").matches) {
            root.classList.add("viewer-expanded");
          } else await root.requestFullscreen();
        } catch {
          root.classList.add("viewer-expanded");
        }
        drawCamera();
        break;
    }
  });
  root.addEventListener("keydown", (e) => {
    const target = e.target.closest(".map-marker");
    if (target && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      select(target.dataset.team);
    }
  });
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoomTo(camera.zoom * (e.deltaY < 0 ? 1.2 : 1 / 1.2), worldPointer(e));
    },
    { passive: false },
  );
  svg.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".map-marker")) return;
    dragging = { x: e.clientX, y: e.clientY, id: e.pointerId };
    svg.setPointerCapture(e.pointerId);
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const m = svg.getScreenCTM(),
      dx = e.clientX - dragging.x,
      dy = e.clientY - dragging.y;
    follow = false;
    camera = cameraBounds(
      camera.cx - dx / m.a,
      camera.cy - dy / m.d,
      camera.zoom,
    );
    dragging.x = e.clientX;
    dragging.y = e.clientY;
    drawCamera();
    drawField();
  });
  const release = () => {
    dragging = null;
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener("lostpointercapture", release);
  document.addEventListener("fullscreenchange", () => {
    root.querySelector('[data-viewer="fullscreen"]').textContent =
      document.fullscreenElement === root
        ? "Salir de pantalla completa"
        : "Pantalla completa";
    drawCamera();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && root.classList.contains("viewer-expanded")) {
      root.classList.remove("viewer-expanded");
      drawCamera();
    }
  });
  return {
    update(s) {
      root.hidden = s.phase === "briefing";
      const pause = root.querySelector('[data-viewer="pause"]');
      pause.textContent = s.paused
        ? "Continuar simulación"
        : "Pausar simulación";
      pause.disabled = !["preparation", "service", "driving"].includes(s.phase);
      const speed = root.querySelector("#viewer-speed-control");
      if (speed.value !== String(s.speed)) speed.value = String(s.speed);
      root.querySelector('[data-viewer="plan"]').textContent = [
        "camp",
        "ready",
      ].includes(s.phase)
        ? "Configurar etapa"
        : ["preparation", "service"].includes(s.phase)
          ? "Ver tareas"
          : s.phase === "result"
            ? "Ver informe"
            : "Ver tablero";
      field = trainingField(s);
      updateSelected();
    },
    field(s) {
      return trainingField(s);
    },
  };
}
