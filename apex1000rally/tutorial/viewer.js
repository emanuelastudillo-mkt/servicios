import {
  WORLD,
  TEAMS,
  ROUTE,
  trainingField,
  routePoint,
  cameraBounds,
} from "./viewer-model.js?v=1.6.1";
import { STAGES } from "./engine.js?v=1.6.1";
const fmt = (n) =>
  n.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
const path = (points) =>
  points
    .map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`)
    .join(" ");
function scenery() {
  // Original vector terrain. No map tiles, external fonts or image requests.
  return `<defs><linearGradient id="terrain-night" x2="0" y2="1"><stop stop-color="#253c43"/><stop offset="1" stop-color="#10202b"/></linearGradient><pattern id="terrain-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#b6d6d7" stroke-opacity=".055"/></pattern><pattern id="sand-lines" width="80" height="32" patternUnits="userSpaceOnUse"><path d="M-10 20Q15 0 40 20T90 20" fill="none" stroke="#e7bd72" stroke-opacity=".13"/></pattern><pattern id="gravel-grain" width="33" height="27" patternUnits="userSpaceOnUse"><path d="m8 8 5-2 2 5-6 2Z M24 20l3-2 3 3-4 2Z" fill="#d0be91" fill-opacity=".18"/></pattern><g id="mountain-mark"><path d="m0 66 36-62 19 31 12-20 29 51Z" fill="#52747c" stroke="#91b5bd" stroke-opacity=".4"/><path d="m23 25 13-21 13 22-13-6Z" fill="#c4d6d3" fill-opacity=".7"/></g><g id="rock-mark"><path d="m0 22 9-19 23 2 14 17-7 17-27-1Z" fill="#65606f" stroke="#bca7c7" stroke-opacity=".4"/><path d="m9 3 8 23 15-21M17 26l-5 12" fill="none" stroke="#a192ab" stroke-opacity=".4"/></g></defs><rect width="1200" height="460" fill="url(#terrain-night)"/><path d="M0 240Q130 95 285 195L278 460H0Z" fill="#655d43" fill-opacity=".24"/><path d="M262 90Q410 80 493 235L494 460H270Z" fill="#ad7837" fill-opacity=".19"/><path d="M263 130H493V460H263Z" fill="url(#sand-lines)"/><path d="M0 250H272V460H0Z" fill="url(#gravel-grain)"/><path d="M475 80Q560 0 740 70L748 270 640 302 473 328Z" fill="#608c97" fill-opacity=".18"/><path d="M719 146Q897 114 953 328L909 432 728 393Z" fill="#8b6d97" fill-opacity=".15"/><path d="M914 56Q1080 9 1200 0V367L946 360Z" fill="#617c91" fill-opacity=".14"/><path d="M488 425Q560 360 556 320T658 228T724 28" fill="none" stroke="#69b7c6" stroke-opacity=".2" stroke-width="15"/><path d="M488 425Q560 360 556 320T658 228T724 28" fill="none" stroke="#acd8de" stroke-opacity=".16" stroke-width="3"/>${[
    [492, 56, 1],
    [553, 26, 1.3],
    [640, 53, 0.9],
    [543, 304, 0.7],
  ]
    .map(
      ([x, y, z]) =>
        `<use href="#mountain-mark" transform="translate(${x} ${y}) scale(${z})"/>`,
    )
    .join("")}${[
    [744, 310, 1.2],
    [798, 155, 0.7],
    [833, 345, 0.9],
    [896, 182, 0.6],
    [717, 230, 0.5],
  ]
    .map(
      ([x, y, z]) =>
        `<use href="#rock-mark" transform="translate(${x} ${y}) scale(${z})"/>`,
    )
    .join(
      "",
    )}<g fill="none" stroke="#f3d49f" stroke-opacity=".12"><path d="M286 179q45-46 100 0t72-12M302 204q45-46 100 0t72-12M290 369q50-40 95 0t87-8M319 394q50-40 95 0t70-8"/></g><g fill="#d6e2df" fill-opacity=".14">${Array.from({ length: 24 }, (_, i) => `<rect x="${968 + (i % 6) * 25}" y="${302 + Math.floor(i / 6) * 23}" width="${12 + (i % 3) * 3}" height="14" rx="2"/>`).join("")}</g><rect width="1200" height="460" fill="url(#terrain-grid)"/><g class="map-terrain-label"><text x="82" y="217">RIPIO</text><text x="342" y="159">DUNAS · 46 °C</text><text x="546" y="103">MONTAÑA</text><text x="755" y="388">CAÑÓN DE ROCA</text><text x="1000" y="269">ASFALTO</text></g><text x="34" y="43" class="map-coordinate">HORIZONTE VIRTUAL / SECTOR DE ENTRENAMIENTO</text><g transform="translate(1154 389)" class="map-compass"><path d="m0-27 8 28-8-5-8 5Z" fill="#e6c18a"/><text y="-34" text-anchor="middle">N</text></g>`;
}
function mapSVG() {
  const stops = [
    { km: 0, name: "LARGADA" },
    ...ROUTE.map((r, i) => ({
      km: r.endKm,
      name: i === 4 ? "META · 40 KM" : `CAMPAMENTO ${i + 1}`,
    })),
  ];
  return `<svg id="training-map" viewBox="0 0 1200 460" aria-label="Mapa del recorrido virtual de cinco etapas" role="group">${scenery()}${ROUTE.map((r, i) => `<path d="${path(r.points)}" fill="none" stroke="#081117" stroke-width="16" stroke-linecap="round"/><path d="${path(r.points)}" fill="none" stroke="${r.color}" stroke-width="7" stroke-linecap="round"/><path d="${path(r.points)}" fill="none" stroke="#f2eee1" stroke-opacity=".35" stroke-width="1" ${i === 4 ? 'stroke-dasharray="6 7"' : ""}/>`).join("")}${stops
    .map((stop, i) => {
      const p = routePoint(stop.km);
      return `<g class="map-stop" transform="translate(${p.x} ${p.y})"><circle r="10" fill="#12242c" stroke="#d7e5df" stroke-width="2"/><text y="4" text-anchor="middle">${i === 5 ? "⚑" : i}</text><text y="${i % 2 ? 33 : -24}" text-anchor="middle" class="map-stop-name">${stop.name}</text></g>`;
    })
    .join(
      "",
    )}${TEAMS.map((t) => `<g id="marker-${t.id}" class="map-marker" data-team="${t.id}" tabindex="0" role="button" aria-label="Seguir ${t.name}"><title>${t.name}</title><circle class="marker-ring" r="17" fill="#10212b" stroke="${t.color}" stroke-width="2"/><g class="marker-car"><path d="m-10-5 4-4h11l6 9-6 9H-6l-4-4Z" fill="${t.color}"/><path d="M-3-5h6v10h-6Z" fill="#13202b"/><path d="M-7-10v4M-7 10V6M6-10v4M6 10V6" stroke="#070f14" stroke-width="3"/></g><g transform="translate(13 -13)"><circle r="8" fill="${t.color}"/><text class="marker-rank" y="3.5" text-anchor="middle" fill="#10212b">1</text></g></g>`).join("")}</svg>`;
}
export function createRaceViewer(root, actions = {}) {
  let selected = "player",
    follow = true,
    camera = cameraBounds(600, 230),
    field = [],
    dragging = null;
  root.innerHTML = `<div class="viewer-heading"><div><span class="eyebrow">RECORRIDO VIRTUAL · 40 KM</span><h2>La carrera, en movimiento.</h2></div><span class="viewer-live" id="viewer-status">Antes de largar</span></div><div class="viewer-controls"><label>Seguir escudería<select id="viewer-team">${TEAMS.map((t) => `<option value="${t.id}">${t.name}${t.id === "player" ? " · vos" : ""}</option>`).join("")}</select></label><div class="viewer-buttons"><button type="button" data-viewer="own">Mi equipo</button><button type="button" data-viewer="follow" aria-pressed="true">Seguir: sí</button><button type="button" data-viewer="out" aria-label="Alejar mapa">−</button><output id="viewer-zoom">×1</output><button type="button" data-viewer="in" aria-label="Acercar mapa">+</button><button type="button" data-viewer="fit">Ver recorrido</button><button type="button" data-viewer="fullscreen">Pantalla completa</button></div></div><div class="viewer-map-box">${mapSVG()}</div><div class="viewer-info"><div><span id="viewer-team-name">Horizonte Virtual</span><strong id="viewer-position">P1 / 6</strong><small id="viewer-driver"></small></div><div><span>Avance válido</span><strong id="viewer-distance">0,00 km</strong><small id="viewer-terrain"></small></div><div><span>Velocidad</span><strong id="viewer-speed">0 km/h</strong><small id="viewer-phase"></small></div><div><span>Intervalos</span><strong id="viewer-gaps">—</strong><small>Distancia con anterior / siguiente</small></div></div><div class="viewer-legend">${TEAMS.map((t) => `<button type="button" data-team="${t.id}"><i style="background:${t.color}"></i>${t.short}${t.id === "player" ? " · vos" : ""}</button>`).join("")}<span>Rueda: zoom · arrastrar: mover · mapa por km válidos, sin sumar remolques.</span></div>`;
  root
    .querySelector(".viewer-buttons")
    .insertAdjacentHTML(
      "afterbegin",
      `<button type="button" data-viewer="pause">Pausar simulación</button><select id="viewer-speed-control" aria-label="Velocidad del visor"><option value="1">×1</option><option value="2">×2</option><option value="10">×10</option></select><button type="button" data-viewer="plan">Configurar etapa</button>`,
    );
  const svg = root.querySelector("svg"),
    teamSelect = root.querySelector("#viewer-team");
  const write = (id, value) => {
    const el = root.querySelector("#" + id);
    if (el.textContent !== value) el.textContent = value;
  };
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
    write("viewer-zoom", "×" + Number(camera.zoom.toFixed(1)));
    const button = root.querySelector('[data-viewer="follow"]');
    button.textContent = "Seguir: " + (follow ? "sí" : "no");
    button.setAttribute("aria-pressed", String(follow));
    root.querySelector('[data-viewer="out"]').disabled = camera.zoom <= 1;
    root.querySelector('[data-viewer="in"]').disabled = camera.zoom >= 16;
  }
  function drawField() {
    field.forEach((t) => {
      const point = t.location,
        index = TEAMS.findIndex((other) => other.id === t.id),
        offset = [18, -18, 48, -48, 78, -78][index] / camera.zoom;
      const angle = (point.angle * Math.PI) / 180,
        x = point.x - Math.sin(angle) * offset,
        y = point.y + Math.cos(angle) * offset;
      const marker = root.querySelector("#marker-" + t.id);
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
    if (follow) camera = cameraBounds(t.location.x, t.location.y, camera.zoom);
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
    drawField();
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
        zoomTo(camera.zoom * 1.5);
        break;
      case "out":
        zoomTo(camera.zoom / 1.5);
        break;
      case "fit":
        follow = false;
        camera = cameraBounds(600, 230, 1);
        updateSelected();
        break;
      case "fullscreen":
        try {
          if (expanded()) {
            if (document.fullscreenElement === root)
              await document.exitFullscreen();
            root.classList.remove("viewer-expanded");
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
          : "Ver tablero";
      field = trainingField(s);
      updateSelected();
    },
    field(s) {
      return trainingField(s);
    },
  };
}
