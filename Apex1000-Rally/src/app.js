import { CATALOG } from "../data/catalog.js";
import { modelStats, teamVehicleStats } from "./vehicle-stats.js";
import { vehicleStatsHTML } from "./vehicle-stats-ui.js";
import {
  initializeCompetition,
  enroll,
  cancelEnrollment,
  currentEvent,
} from "./competition.js";
import { homePage } from "./home-independent-ui.js";
import {
  workshopPage,
  vehicleShop,
  allocationPanel,
  jobsHTML,
} from "./workshop-ui.js";
import {
  activeCar,
  jobFor,
  assignMechanic,
  purchaseVehicle,
  selectVehicle,
  sellVehicle,
  vehicleSaleValue,
  enqueueJob,
  jobQuote,
  crewRate,
  cancelJob,
} from "./workshop.js";
import { repairQuote } from "./part-maintenance.js";
import { adminBar, ADMIN_ENABLED } from "./admin-ui.js";
import { injectMoney } from "./admin-commands.js";
import {
  dashboardHTML,
  stopChecklistHTML,
  updateInstruments,
} from "./cockpit.js";
import { patchLivePanel, editingControl } from "./live-ui.js";
import { journalPage } from "./journal-ui.js";
import {
  bid,
  cancelBid,
  releasePerson,
  buyVehicle,
  seasonTime,
} from "./management.js";
import {
  identityPanel,
  championshipPage,
  staffMarket,
  mechanicsPanel,
} from "./management-ui.js";
import { shieldSVG } from "./shields.js";
import { vehicleHealth } from "./reliability.js";
import { raceNeighbors } from "./race-telemetry.js";
import {
  VERSION,
  STARTING_BUDGET,
  VEHICLES,
  PART_TYPES,
  GRADES,
  DRIVER_PROFILES,
  PACES,
  TERRAINS,
  PHASES,
  vehicle,
  partType,
  priceFor,
  defaultPlan,
  clamp,
} from "./catalog.js";
import {
  STAGES,
  CITIES,
  TOTAL_KM,
  ROUTE_NAME,
  setActiveRoute,
  terrainDescription,
  recommendedSetup,
} from "./route.js";
import {
  createRace,
  nextChampionshipRace,
  getPlayer,
  savePlan,
  buyPart,
  estimateService,
  estimateStage,
  performance,
  standings,
  publicSnapshot,
} from "./engine.js";
import { SAVE_KEY, validateSave, encodeSave } from "./storage.js";
import {
  esc,
  truckSVG,
  conditionBar,
  terrainBar,
  mapSVG,
  updateMap,
  camera,
  fitMap,
  focusTeam,
  focusStage,
  zoom,
  applyCamera,
  MAX_ZOOM,
} from "./visuals.js";
const $ = (s) => document.querySelector(s),
  money = (n) => Math.round(n).toLocaleString("es-AR"),
  num = (n, d = 0) =>
    Number(n).toLocaleString("es-AR", {
      maximumFractionDigits: d,
      minimumFractionDigits: d,
    });
const duration = (seconds) => {
  const n = Math.max(0, Math.round(seconds / 60)),
    days = Math.floor(n / 1440),
    hours = Math.floor((n % 1440) / 60),
    mins = n % 60;
  return `${days ? days + "d " : ""}${hours.toString().padStart(2, "0")}h ${mins.toString().padStart(2, "0")}m`;
};
const localDate = (iso) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
const icons = {
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2zm6-2v16m6-14v16",
  route:
    "M4 19c0-8 16 0 16-8s-13 1-13-6m-3 0a3 3 0 1 0 6 0 3 3 0 0 0-6 0M1 19a3 3 0 1 0 6 0 3 3 0 0 0-6 0",
  tools: "m15 4 4 4-9 9-4-4zm-9 9-3 7 7-3M16 3l2-1 4 4-1 2",
  shop: "M3 8h18l-2-5H5zm1 0v13h16V8M9 21v-7h6v7",
  crew: "M8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M2 21v-3c0-5 12-5 12 0v3m1-16a4 4 0 0 1 0 8m2 2c4 0 5 2 5 6",
  arrow: "M4 12h16m-6-6 6 6-6 6",
  play: "m8 5 11 7-11 7z",
  pause: "M8 5v14m8-14v14",
  clock: "M12 6v6l4 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  fuel: "M4 21V4h9v17M4 11h9m-11 10h13m0-17 5 4v10c0 3-4 3-4 0v-4h-3",
  flag: "M5 21V3m0 1c5-4 9 4 15 0v10c-6 4-10-4-15 0",
  save: "M5 3h12l4 4v14H3V3zm2 0v6h10V3M7 21v-8h10v8",
  info: "M12 11v6m0-10v1M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0",
  close: "m6 6 12 12M6 18 18 6",
  download: "M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5",
  target: "M12 2v4m0 12v4M2 12h4m12 0h4M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0",
  check: "m4 12 5 5L20 6",
  sun: "M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
};
const icon = (n) =>
  `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${icons[n] || icons.tools}"/></svg>`;
let state = null,
  geo = null,
  busy = false,
  bootWarning = "";
const ui = {
  tab: "home",
  vehicleId: "hilux",
  selectedStage: 0,
  selectedTeam: "player",
  drafts: {},
  marketType: "engine",
  marketCondition: 100,
};
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) {
    const parsed = JSON.parse(raw);
    state = validateSave(parsed);
    if (!state.competition) {
      if (!localStorage.getItem(SAVE_KEY + "-before-independent-races"))
        localStorage.setItem(SAVE_KEY + "-before-independent-races", raw);
      initializeCompetition(state, { legacy: true });
    }
    if (
      parsed.version < 3 &&
      !localStorage.getItem(SAVE_KEY + "-before-workshop")
    )
      localStorage.setItem(SAVE_KEY + "-before-workshop", raw);
    if (
      parsed.version <= 2 &&
      !localStorage.getItem(SAVE_KEY + "-before-v4-migration")
    )
      localStorage.setItem(SAVE_KEY + "-before-v4-migration", raw);
    if (
      parsed.version === 1 &&
      !localStorage.getItem(SAVE_KEY + "-before-v3-migration")
    )
      localStorage.setItem(SAVE_KEY + "-before-v3-migration", raw);
  }
} catch {
  bootWarning =
    "No se pudo cargar el guardado. Podés importar un respaldo. El original permanece en el navegador.";
}
let lastWall = Date.now(),
  saveTick = 0;
const p = () => getPlayer(state),
  currentStage = () => Math.min(p().stageIndex, STAGES.length - 1),
  editStage = () =>
    Math.min(
      STAGES.length - 1,
      p().stageIndex + (["racing", "service"].includes(p().phase) ? 1 : 0),
    );
function toast(text) {
  $("#toast").textContent = text;
  $("#toast").classList.add("show");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => $("#toast").classList.remove("show"), 5000);
}
function persist() {
  if (!state) return;
  try {
    state.wallAt = Date.now();
    localStorage.setItem(SAVE_KEY, encodeSave(state));
  } catch {
    toast("El navegador no pudo guardar. Exportá tu partida.");
  }
}
function draft(index = ui.selectedStage) {
  if (!ui.drafts[index])
    ui.drafts[index] = structuredClone(
      p().plans[index] || {
        ...defaultPlan(index),
        driverId: p().drivers[index % p().drivers.length].id,
        ...recommendedSetup(STAGES[index]),
        fuelTarget: vehicle(p().vehicleId).tank,
      },
    );
  if (currentEvent(state)?.kind === "short") {
    ui.drafts[index].actions = Object.fromEntries(
      PART_TYPES.map((p) => [p.id, "none"]),
    );
    ui.drafts[index].replacements = {};
    ui.drafts[index].rest = 0;
  }
  return ui.drafts[index];
}
const stat = (label, value, sub = "", cls = "") =>
  `<div class="stat ${cls}"><span>${label}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ""}</div>`;
function header() {
  return `<header class="topbar"><a href="#" class="brand" data-action="tab" data-tab="home"><svg viewBox="0 0 50 35" aria-hidden="true"><path d="m2 30 13-22 10 13 10-20 13 29H37l-7-10-5 10-10-10-6 10Z" fill="currentColor"/></svg><span>APEX<span class="brand-number">1000</span><small>ENDURANCE RALLY</small></span></a><nav aria-label="Secciones">${[
    ["home", "flag", "Home"],
    ["race", "map", "Carrera"],
    ["workshop", "tools", "Taller"],
    ["roadbook", "route", "Roadbook"],
    ["journal", "route", "Bitácora"],
    ["camp", "tools", "Campamento"],
    ["market", "shop", "Mercado"],
    ["crew", "crew", "Equipo"],
    ["championship", "flag", "Inscripción"],
  ]
    .map(
      ([id, ic, name]) =>
        `<button class="nav-item ${ui.tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" ${!state ? "disabled" : ""}>${icon(ic)}${name}</button>`,
    )
    .join(
      "",
    )}</nav><div class="top-meta"><span class="prototype"><i></i> SINGLE PLAYER</span><button class="icon-button" data-action="help" aria-label="Guía del juego">${icon("info")}</button></div></header>`;
}
function clockBar() {
  if (!state) return "";
  return `<section class="clock-bar"><div class="race-clock">${icon("clock")}<div><span>${state.clock < 0 ? "CUENTA REGRESIVA" : "TIEMPO DESDE LA LARGADA"}</span><strong id="clock-value">${state.clock < 0 ? "− " : ""}${duration(Math.abs(state.clock))}</strong></div><div class="scheduled-start">Largada compartida<strong>${localDate(state.startAt)}</strong></div></div></section>`;
}
function title(kicker, heading, description, action = "") {
  return `<div class="page-title"><div><span class="eyebrow">${kicker}</span><h1>${heading}</h1><p>${description}</p></div>${action}</div>`;
}
function onboarding() {
  const v = vehicle(ui.vehicleId),
    start = new Date(Date.now() + 3600000);
  start.setSeconds(0, 0);
  const local = new Date(start - start.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  return `<main class="onboarding"><div class="intro-copy"><span class="eyebrow">8 RAIDS · 24 SPRINTS · PREMIOS POR CARRERA</span><h1>La carrera no se gana<br>en un día.</h1><p>Ocho travesías por el mundo. Gestioná tu equipo, elegí cuándo acelerar y combiná experiencias cortas y expediciones. La primera carrera: de Buenos Aires a Santiago.</p><div class="intro-stats">${stat("RECORRIDO", "10.240 <em>km</em>")}${stat("COMPETENCIA", "12 <em>equipos</em>")}${stat("PRESUPUESTO", money(STARTING_BUDGET) + " <em>cr</em>")}</div></div><section class="vehicle-grid">${VEHICLES.filter(
    (car) => car.fee < STARTING_BUDGET - 1500,
  )
    .map(
      (car) =>
        `<button class="vehicle-card ${ui.vehicleId === car.id ? "selected" : ""}" style="--vehicle:${car.color}" data-action="choose-vehicle" data-id="${car.id}"><div class="vehicle-top"><span>${car.tag}</span>${ui.vehicleId === car.id ? icon("check") : '<span class="radio-circle"></span>'}</div>${truckSVG(car.id)}<h2>${car.name}</h2><p>${car.engine}</p><div class="vehicle-specs"><span>Tanque <b>${car.tank} L</b></span></div>${vehicleStatsHTML(modelStats(car.id, CATALOG), car.id)}<div class="vehicle-bottom"><span>Compra de vehículo</span><strong>${money(car.fee)} cr</strong></div></button>`,
    )
    .join(
      "",
    )}</section><section class="panel enlist"><div><span class="eyebrow">TU PRIMERA DECISIÓN</span><h2>${v.short}</h2><p>${v.description}</p><p class="muted">Velocidad, aceleración, comodidad y control son índices fijos de juego de 0 a 100; más es mejor. El peso se expresa en kilogramos con una referencia real indicada en cada ficha. Los mínimos reglamentarios no son mediciones del auto cargado. Los costos también pertenecen al juego. Auto nuevo: estado 100, performance 50 y fiabilidad 50. Seis piezas Sport al 92% y seis reservas gratuitas incluidas.</p></div><form id="create-form"><label>Nombre del equipo<input name="teamName" maxlength="40" value="Tu equipo" required></label><label>Largada compartida · hora local<input name="startAt" type="datetime-local" value="${local}" required></label><label>Escenario<input name="seed" type="number" min="1" max="999999" value="1729"></label><div class="enlist-balance"><span>Saldo antes de sueldos</span><strong>${money(STARTING_BUDGET - v.fee)} cr</strong></div><button class="button primary full" type="submit">Crear escudería ${icon("arrow")}</button></form></section><div class="intro-note">Prototipo single player. Todos comparten la largada; después cada equipo administra su propio tiempo. La aceleración sólo existe en esta versión de prueba.</div></main>`;
}
function mapPanel() {
  return `<section class="panel map-panel" id="map-panel"><div class="panel-heading"><div><span class="eyebrow">VISOR DE CARRERA / RECORRIDO COMPLETO</span><h2>${esc(ROUTE_NAME)}</h2></div><button class="button ghost small" data-action="fullscreen-map">${document.body.classList.contains("map-fullscreen") ? "Cerrar pantalla completa" : "⛶ Pantalla completa"}</button></div><div class="map-container">${mapSVG(state, geo)}<div class="map-zoom"><button data-action="zoom-in" aria-label="Acercar mapa">+</button><span id="zoom-level">${(1000 / camera.w).toFixed(1)}×</span><button data-action="zoom-out" aria-label="Alejar mapa">−</button><input id="map-zoom-range" type="range" min="1" max="${MAX_ZOOM}" step="1" value="${Math.max(1, 1000 / camera.w)}" aria-label="Nivel de zoom del mapa" title="Zoom de 1× a ${MAX_ZOOM}×"></div><div class="map-actions"><button data-action="fit-map">${icon("map")}Ver ruta</button><button data-action="follow" data-id="player">${icon("target")}Seguirme</button></div><div class="map-hud" id="map-hud">${mapHUD()}</div><div class="map-legend"><i></i> Trazado de la prueba <span>●</span> Campamento</div><div class="map-distance"><span>${currentEvent(state)?.kind === "short" ? "SPRINT · SIN PARADAS" : "RAID DE RESISTENCIA"}</span><strong>${num(TOTAL_KM)} <small>km</small></strong></div></div><div class="map-footer"><span>Arrastrá para mover · rueda para acercar · tocá un equipo para seguirlo</span><span>Natural Earth · GeoNames · trazado deportivo de diseño</span></div></section>`;
}
function leaderboard() {
  return `<section class="panel leaderboard"><div class="panel-heading"><div><span class="eyebrow">UNA LARGADA, DISTINTOS CAMINOS</span><h2>Orden de carrera</h2></div><span class="count-pill">${standings(state).length}</span></div><div class="standing-head"><span>EQUIPO / ESTADO</span><span>KM TOTALES</span></div><div id="leaderboard-rows">${leaderboardRows()}</div><div class="small-note">En carrera se ordena por avance. Al llegar, por tiempo total desde la largada, incluyendo asistencia y descanso.</div></section>`;
}
function leaderboardRows() {
  return standings(state)
    .map(
      (t, i) =>
        `<button class="standing-row ${t.id === "player" ? "player" : ""} ${ui.selectedTeam === t.id ? "focused" : ""}" data-action="follow" data-id="${t.id}"><span class="rank">${String(i + 1).padStart(2, "0")}</span><i style="background:${t.color}"></i><div><strong>${esc(t.name)} ${t.id === "player" ? "<span>TÚ</span>" : ""}</strong><small>${t.phase === "finished" ? "META" : `E${t.stageIndex + 1}`} · ${PHASES[t.phase]}</small></div><b>${num(t.totalKm)}</b></button>`,
    )
    .join("");
}
function teamInspector() {
  const t = state.teams.find((t) => t.id === ui.selectedTeam) || p(),
    stage = STAGES[Math.min(t.stageIndex, STAGES.length - 1)];
  return `<div class="inspector-title"><div><span class="eyebrow">EQUIPO SELECCIONADO</span><h2>${esc(t.name)}</h2></div><span class="badge">${PHASES[t.phase]}</span></div><div class="inspector-stats">${stat("VELOCIDAD", num(t.speed) + " <em>km/h</em>")}${stat("ETAPA", t.phase === "finished" ? "META" : `${t.stageIndex + 1} <em>/ ${STAGES.length}</em>`)}${stat("DESTINO", stage.to.name)}</div><p class="muted">${vehicle(t.vehicleId).name}${t.phase === "service" ? ` · Sale en ${duration(Math.max(0, t.service.until - state.clock))}` : t.phase === "racing" && t.holdUntil > state.clock ? ` · Incidente: ${duration(t.holdUntil - state.clock)} restantes` : ""}</p>${dashboardHTML(t, state.clock)}${stopChecklistHTML(state, t)}<details id="inspector-vehicle-attributes" data-preserve-open class="vehicle-base-details"><summary>Atributos fijos del modelo</summary>${vehicleStatsHTML(teamVehicleStats(t), t.vehicleId)}</details>`;
}
function playerMetrics() {
  const team = p(),
    d = team.drivers.find((d) => d.id === team.activeDriver),
    condition =
      PART_TYPES.reduce((a, t) => a + team.parts[t.id].condition, 0) / 6;
  return `${stat("PRESUPUESTO DISPONIBLE", money(team.budget) + " <em>cr</em>", team.debt ? `${money(team.debt)} cr de asistencia pendientes` : "Los premios se pagan al finalizar", "budget")}${stat("COMBUSTIBLE", num(team.fuel) + " <em>L</em>", `Tanque: ${vehicle(team.vehicleId).tank} L`)}${stat("ENERGÍA DEL PILOTO", num(d.energy) + "<em>%</em>", `${esc(d.name)} · ${d.role}`)}${stat("ESTADO DEL VEHÍCULO", num(condition) + "<em>%</em>", `${Object.values(team.parts).filter((p) => p.broken).length} piezas averiadas · ${num(team.heat)} °C`)}`;
}
function eventsHTML() {
  const events = state.events
    .filter((e) => e.teamId === "player" || e.type === "finish")
    .slice(-7)
    .reverse();
  return (
    events
      .map(
        (e) =>
          `<div class="event"><span>${e.time < 0 ? "PREVIA" : duration(e.time)}</span><i class="event-dot ${["failure", "incident", "assistance"].includes(e.type) ? "warn" : ""}"></i><p>${esc(e.text)}</p></div>`,
      )
      .join("") ||
    '<div class="small-note">Las novedades de tu equipo aparecerán aquí.</div>'
  );
}
function racePage() {
  const team = p(),
    stage = STAGES[currentStage()],
    needsPlan =
      !team.plans[Math.min(team.stageIndex, STAGES.length - 1)] &&
      !["racing", "service", "finished", "cutoff", "unregistered"].includes(
        team.phase,
      );
  return `${title(`CARRERA / ${esc(ROUTE_NAME).toUpperCase()}`, "La distancia pone todo a prueba.", "Tus decisiones de hoy son las piezas, la energía y el presupuesto de mañana.", `<button class="button ghost" data-action="open-camp">${icon("tools")}Preparar ${team.stageIndex >= STAGES.length ? "equipo" : `E${editStage() + 1}`}</button>`)}${jobFor(team, team.activeCarId) ? `<div class="inline-warning">El auto de carrera tiene un trabajo pendiente en la base. No saldrá hasta completarlo o cancelarlo. <button class="text-button" data-action="tab" data-tab="workshop">Revisar taller</button></div>` : ""}${needsPlan ? `<div class="notice"><div>${icon("flag")}<p><b>${state.clock < 0 ? "Antes de largar" : "Tu equipo espera un plan"}.</b> Guardá la configuración de E${team.stageIndex + 1}. ${state.clock >= 0 ? "El resto de los equipos sigue avanzando." : "Podés preparar las etapas futuras por adelantado."}</p></div><button class="button small primary" data-action="open-camp">Preparar etapa ${icon("arrow")}</button></div>` : ""}<div id="player-metrics" class="metrics-grid">${playerMetrics()}</div><div class="race-layout"><div class="map-column">${mapPanel()}<section class="panel team-inspector" id="team-inspector">${teamInspector()}</section></div>${leaderboard()}</div><div class="bottom-grid"><section class="panel next-stage"><span class="eyebrow">${team.phase === "finished" ? "TRAVESÍA COMPLETA" : `E${stage.index + 1} / ${stage.title}`}</span><h2>${stage.from.name}<span> → </span>${stage.to.name}</h2>${terrainBar(stage)}<p>${stage.brief}</p><div class="stage-info-line"><span>${money(stage.km)} km</span><span>${stage.temp} °C</span><span>Hasta ${money(stage.altitude)} m</span><button class="text-button" data-action="roadbook-stage" data-index="${stage.index}">Estudiar etapa ${icon("arrow")}</button></div></section><section class="panel event-panel"><div class="panel-heading"><h2>Radio del equipo</h2><span class="badge">REGISTRO</span></div><div id="events">${eventsHTML()}</div></section></div>${["finished", "cutoff"].includes(team.phase) ? finishPanel() : ""}`;
}
function roadbook() {
  return `${title("ROADBOOK / ESTUDIAR ANTES DE ELEGIR", "Cada etapa pide un auto distinto.", `${num(TOTAL_KM)} km en ${esc(ROUTE_NAME)}. El terreno, el calor y la altura cambian las prioridades.`, `<button class="button ghost" data-action="fill-plans">${icon("save")}Completar planes faltantes</button>`)}<div class="roadbook-intro panel"><div><strong>${STAGES.length}</strong><span>etapas</span></div><div><strong>${new Set(CITIES.map((c) => c.country)).size}</strong><span>países</span></div><div><strong>${num(Math.max(...STAGES.map((s) => s.altitude)))} <small>m</small></strong><span>altitud de diseño máxima</span></div><p>Localidades reales, prueba ficticia. Las distancias incluyen tramos de rally diseñados para el juego y no corresponden a un itinerario de carretera.</p></div><div class="stages-grid">${STAGES.map(
    (stage) => {
      const planned = !!p().plans[stage.index],
        done = p().stageIndex > stage.index,
        active = p().stageIndex === stage.index;
      return `<article class="panel stage-card ${active ? "active-stage" : ""}"><div class="stage-card-top"><span class="stage-number">${String(stage.index + 1).padStart(2, "0")}</span><span class="badge ${done ? "green" : planned ? "" : "outline"}">${done ? "COMPLETADA" : planned ? "PLAN GUARDADO" : active ? "PRÓXIMA" : "SIN PLAN"}</span></div><span class="eyebrow">${stage.title}</span><h2>${stage.from.name}<span>→</span>${stage.to.name}</h2><div class="stage-data"><strong>${money(stage.km)} <small>km</small></strong><span>${stage.temp} °C</span><span>${money(stage.altitude)} m</span></div>${terrainBar(stage)}<div class="terrain-legend">${stage.segments.map((s) => `<span><i style="background:${TERRAINS[s.type].color}"></i>${TERRAINS[s.type].name} ${Math.round(s.share * 100)}%</span>`).join("")}</div><p>${stage.brief}</p><div class="button-row"><button class="button ghost small" data-action="map-stage" data-index="${stage.index}">${icon("map")}Ver en mapa</button><button class="button small ${active ? "primary" : "ghost"}" data-action="plan-stage" data-index="${stage.index}" ${done ? "disabled" : ""}>${planned ? "Ver plan" : "Configurar"} ${icon("arrow")}</button></div></article>`;
    },
  ).join("")}</div>`;
}
const select = (key, label, values, value) =>
  `<label>${label}<select data-plan="${key}" id="plan-${key}">${values.map(([v, n]) => `<option value="${v}" ${String(value) === String(v) ? "selected" : ""}>${n}</option>`).join("")}</select></label>`;
function camp() {
  const index = ui.selectedStage,
    stage = STAGES[index],
    team = p(),
    plan = draft(),
    locked =
      index < team.stageIndex ||
      (index === team.stageIndex &&
        ["racing", "service", "finished"].includes(team.phase));
  return `${title(`CAMPAMENTO / ETAPA ${index + 1}`, "Cuidar el auto también es correr.", currentEvent(state)?.kind === "short" ? "Prepará tu piloto, configuración y combustible antes de largar. Este sprint no tiene paradas." : "Elegí piloto, repuestos y preparación. Reparación, combustible y descanso se ejecutan al llegar.", `<label class="stage-picker">Etapa a configurar<select id="stage-picker">${STAGES.map((s) => `<option value="${s.index}" ${s.index === index ? "selected" : ""}>${String(s.index + 1).padStart(2, "0")} · ${s.to.name}</option>`).join("")}</select></label>`)}${locked ? '<div class="notice warning"><p>Este plan ya está cerrado. Podés consultarlo y configurar una etapa futura.</p></div>' : ""}<div class="camp-layout"><div><section class="panel camp-brief"><div><span class="eyebrow">${stage.title}</span><h2>${stage.from.name} → ${stage.to.name}</h2><p>${stage.brief}</p>${terrainBar(stage)}<span class="muted">${terrainDescription(stage)}</span></div><div class="brief-numbers"><strong>${money(stage.km)} <small>km</small></strong><span>${stage.temp} °C · ${money(stage.altitude)} m</span></div></section><fieldset class="panel setup-form" ${locked ? "disabled" : ""}><div class="panel-heading"><div><span class="eyebrow">CONFIGURACIÓN DE ETAPA</span><h2>Cómo vamos a correr</h2></div><button class="button small ghost" type="button" data-action="recommended">Sugerir para este terreno</button></div><div class="form-grid">${select(
    "driverId",
    "Piloto",
    team.drivers.map((d) => [d.id, `${esc(d.name)} · ${d.role}`]),
    plan.driverId,
  )}${select(
    "pace",
    "Ritmo",
    Object.entries(PACES).map(([k, v]) => [k, v.name]),
    plan.pace,
  )}${select(
    "boost",
    "Exigencia de componentes",
    [
      [0, "Normal · cuidar equilibrio"],
      [1, "+ rendimiento · más desgaste"],
      [2, "Máxima · mucho desgaste y riesgo"],
    ],
    plan.boost,
  )}${select(
    "ride",
    "Altura y suspensión",
    [
      ["low", "Baja · favorable en asfalto"],
      ["balanced", "Intermedia · versátil"],
      ["high", "Alta · arena y piedras"],
    ],
    plan.ride,
  )}${select(
    "pressure",
    "Presión de neumáticos",
    [
      ["firm", "Alta · asfalto"],
      ["mixed", "Media · mixto"],
      ["soft", "Baja · dunas"],
    ],
    plan.pressure,
  )}${select(
    "gearing",
    "Relación de transmisión",
    [
      ["long", "Larga · velocidad en asfalto"],
      ["mixed", "Mixta · equilibrio"],
      ["short", "Corta · tracción y montaña"],
    ],
    plan.gearing,
  )}${select(
    "cooling",
    "Refrigeración",
    [
      ["closed", "Cerrada · menos resistencia, más calor"],
      ["balanced", "Equilibrada"],
      ["open", "Abierta · menos calor, algo más lenta"],
    ],
    plan.cooling,
  )}<label>Combustible al salir · litros<input type="number" min="0" max="${vehicle(team.vehicleId).tank}" value="${plan.fuelTarget}" data-plan="fuelTarget" id="plan-fuelTarget"><button type="button" class="text-button" data-action="fuel-suggestion">Calcular carga sugerida</button></label>${select(
    "rest",
    "Descanso antes de salir",
    [
      ["full", "Hasta recuperar 100%"],
      [0, "Sin espera adicional"],
      [1, "Hasta 1 hora"],
      [2, "Hasta 2 horas"],
      [4, "Hasta 4 horas"],
      [6, "Hasta 6 horas"],
      [8, "Hasta 8 horas"],
      [12, "Hasta 12 horas"],
    ],
    plan.rest,
  )}</div><p class="form-note">Se descansa sólo hasta alcanzar el 100% de energía. El piloto puede recuperarse mientras el equipo repara; se espera al trabajo que termine último.</p></fieldset><fieldset class="panel parts-panel" ${locked ? "disabled" : ""}><div class="panel-heading"><div><span class="eyebrow">VEHÍCULO Y LOTE DE REPUESTOS</span><h2>Qué hacer en la asistencia</h2></div><button type="button" class="button small ghost" data-action="repair-all">Reparar todo</button></div><div class="parts-rows">${PART_TYPES.map(
    (type) => {
      const current = team.parts[type.id],
        options = team.inventory.filter((i) => i.type === type.id),
        value =
          plan.actions[type.id] === "replace"
            ? "replace:" + plan.replacements[type.id]
            : plan.actions[type.id];
      return `<div class="part-row"><div class="part-ident"><span class="part-symbol">${type.id === "tyres" ? "◉" : type.id === "cooling" ? "❄" : "◇"}</span><div><h3>${type.name}</h3><span style="color:${GRADES[current.grade].color}">${GRADES[current.grade].name}${current.broken ? " · AVERIADA" : ""}</span></div></div><div class="part-health"><strong data-part-condition="${type.id}">${num(current.condition)}%</strong><small>Original ${num(current.original)}/100</small>${conditionBar(current.condition)}</div><label>Acción al llegar<select data-part-action="${type.id}"><option value="none" ${value === "none" ? "selected" : ""}>Mantener instalada</option><option value="repair" ${value === "repair" ? "selected" : ""}>Reparar hasta ${num(repairQuote(current).target, 1)}%</option>${options.map((i) => `<option value="replace:${i.id}" ${value === "replace:" + i.id ? "selected" : ""}>Cambiar → ${GRADES[i.grade].name} · ${num(i.condition)}% · O${num(i.original)}${i.broken ? " (averiada)" : ""}</option>`).join("")}</select></label></div>`;
    },
  ).join(
    "",
  )}</div><div class="parts-bottom"><p>Las piezas retiradas vuelven al lote con su estado y original. Reparar reduce el original y el potencial de las próximas reparaciones. Las reservas gratuitas nunca se averían; su desgaste sólo reduce el rendimiento.</p><button type="button" class="button ghost small" data-action="fit-reserves">Usar reservas</button></div></fieldset><details class="panel inventory-panel"><summary>Lote completo · ${team.inventory.length} repuestos</summary><div class="inventory-grid">${team.inventory.map((i) => `<div><span class="eyebrow">${partType(i.type).short}</span><strong style="color:${GRADES[i.grade].color}">${GRADES[i.grade].name}</strong><span>${num(i.condition)}% · Original ${num(i.original)} ${i.broken ? "· Averiada" : ""}</span>${conditionBar(i.condition)}</div>`).join("")}</div></details></div><aside><section class="panel quote-panel"><span class="eyebrow">ANTES DE CONFIRMAR</span><h2>El costo de tu decisión</h2><div id="service-quote">${quoteHTML()}</div><button class="button primary full" data-action="save-plan" ${locked ? "disabled" : ""}>${icon("save")}Guardar plan de E${index + 1}</button><p class="small-note">${team.plans[index] ? "Hay un plan guardado. Los cambios se aplican al volver a guardar." : "Todavía no hay un plan guardado para esta etapa."} Si llegás sin plan, tu equipo espera mientras el resto avanza.</p></section><section class="panel crew-mini"><span class="eyebrow">TRES PILOTOS, DISTINTOS RECURSOS</span>${team.drivers.map((d) => `<div class="crew-mini-row"><span class="avatar" style="--driver:${d.color}">${d.initials}</span><div><strong>${esc(d.name)}</strong><small>${d.role} · ${num(d.energy)}% energía</small>${conditionBar(d.energy, d.color)}</div></div>`).join("")}<button class="text-button" data-action="tab" data-tab="crew">Ver habilidades ${icon("arrow")}</button></section></aside></div>`;
}
function quoteHTML() {
  const team = p(),
    plan = draft(),
    stage = STAGES[ui.selectedStage],
    quote = estimateService(team, plan, ui.selectedStage),
    est = estimateStage(team, stage, plan);
  return `<div class="quote-total"><span>Asistencia + combustible</span><strong>${money(quote.cost)} <small>cr</small></strong></div><dl class="quote-lines"><div><dt>Trabajo mecánico y carga</dt><dd>${num(quote.workHours, 1)} h</dd></div><div><dt>Descanso necesario elegido</dt><dd>${num(quote.restHours, 1)} h</dd></div><div><dt>${ui.selectedStage === 0 ? "Preparación antes de largar" : "Espera total en campamento"}</dt><dd>${num(quote.serviceHours, 1)} h</dd></div><div><dt>Conducción sin incidentes</dt><dd>≈ ${num(est.hours, 1)} h</dd></div><div><dt>Consumo estimado de etapa</dt><dd>≈ ${num(est.fuel)} L</dd></div><div><dt>Presupuesto después</dt><dd class="${quote.cost > team.budget ? "bad" : ""}">${money(team.budget - quote.cost)} cr</dd></div></dl>${plan.fuelTarget < est.fuel ? `<div class="inline-warning">Combustible estimado insuficiente. ${state.competition && currentEvent(state)?.kind === "short" ? "En el sprint no hay asistencia: sin combustible el auto queda detenido hasta el cierre." : "Una asistencia en ruta suma 4 h y un recargo."}</div>` : ""}${quote.cost > team.budget ? '<div class="inline-warning">El presupuesto actual no alcanza: se omitirán reparaciones no financiables; el combustible de asistencia se descuenta del premio.</div>' : ""}<p class="muted">${ui.selectedStage > team.stageIndex ? "Etapa futura: el estado de llegada cambiará estos costos." : "Estimación con el estado actual."} El terreno, la fatiga y las averías pueden ampliar el tiempo.</p>`;
}
function partsMarket() {
  const type = partType(ui.marketType),
    condition = ui.marketCondition;
  return `${title("MERCADO / PIEZAS PARA TODA LA CARRERA", "Más rápido no siempre llega primero.", "Elegí calidad y estado por separado. Los repuestos quedan en tu lote hasta que programes su montaje.", `<div class="budget-pill"><span>Disponible</span><strong>${money(p().budget)} <small>cr</small></strong></div>`)}<div class="market-toolbar"><div class="part-tabs">${PART_TYPES.map((t) => `<button class="chip ${t.id === type.id ? "active" : ""}" data-action="market-type" data-id="${t.id}">${t.short}</button>`).join("")}</div><label>Estado de la pieza<select id="market-condition">${[
    [100, "100% · nueva"],
    [75, "75% · usada"],
    [50, "50% · usada"],
  ]
    .map(
      ([n, l]) =>
        `<option value="${n}" ${n === condition ? "selected" : ""}>${l}</option>`,
    )
    .join("")}</select></label></div><div class="market-grid">${[
    "endurance",
    "standard",
    "racing",
  ]
    .map((grade) => {
      const g = GRADES[grade],
        offer = state.management.catalog.parts.find(
          (x) =>
            x.type === type.id &&
            x.grade === grade &&
            x.condition === condition,
        ),
        stock = state.management.stocks[offer.id],
        cost = offer.price;
      return `<article class="panel offer-card" style="--grade:${g.color}"><div class="offer-top"><span class="eyebrow">${g.tag}</span><span class="badge">${condition}% ESTADO</span></div><img class="part-art" src="assets/art/${type.id}.webp" alt="${type.name}"><h2>${g.name}</h2><p>${g.description}</p><dl><div><dt>Rendimiento nuevo</dt><dd>${num(g.performance * 100)} / 100</dd></div><div><dt>Resistencia al desgaste</dt><dd>${num(g.durability, 2)}×</dd></div><div><dt>Riesgo base de avería</dt><dd>${num(g.failure * 100, 2)}% / h</dd></div><div><dt>Tendencia térmica</dt><dd>${num(g.heat, 2)}×</dd></div></dl><div class="offer-price"><strong>${money(cost)} <small>cr</small></strong><span>Estado: ${condition}% · Stock: ${stock}</span></div><button class="button ${grade === "standard" ? "primary" : "ghost"} full" data-action="buy" data-grade="${grade}" ${cost > p().budget || !offer.available || stock < 1 ? "disabled" : ""}>${icon("shop")}${!offer.available || stock < 1 ? "Sin stock" : cost > p().budget ? "Presupuesto insuficiente" : "Comprar para el lote"}</button></article>`;
    })
    .join(
      "",
    )}</div><div class="reserve-note panel"><span>∞</span><div><h3>Tu respaldo para llegar.</h3><p>Ya tenés una pieza de reserva de cada tipo. Nunca se avería ni desaparece del lote: puede estar instalada o guardada. Es lenta y pierde rendimiento con el desgaste.</p></div><button class="button ghost" data-action="open-camp">Ver mis repuestos</button></div><p class="footnote">Los precios y probabilidades son parámetros de juego. El riesgo real aumenta con el desgaste, la exigencia y el sobrecalentamiento. Los vehículos no reciben una mejora hasta que la pieza se monta.</p>`;
}
function driversPage() {
  return `${title("EQUIPO / ENERGÍA Y ESPECIALIZACIÓN", "Tres formas de leer el camino.", "Elegí quién conduce cada etapa. Los otros pilotos recuperan energía mientras viajan como parte del equipo.")}<div class="drivers-grid">${p()
    .drivers.map(
      (d) =>
        `<article class="panel driver-card" style="--driver:${d.color}"><div class="driver-banner"><span class="driver-number">${String(p().drivers.findIndex((x) => x.id === d.id) + 1).padStart(2, "0")}</span><img class="driver-portrait" src="${d.image}" alt="${esc(d.name)}"><span class="badge">${p().activeDriver === d.id && p().phase === "racing" ? "AL VOLANTE" : "EN EL EQUIPO"}</span></div><span class="eyebrow">${d.role}</span><h2>${esc(d.name)}</h2><p>${d.description}</p><div class="energy-heading"><span>Energía actual</span><strong>${num(d.energy)}%</strong></div>${conditionBar(d.energy, d.color)}<dl><div><dt>Velocidad base</dt><dd>${num(d.speed, 3)}×</dd></div><div><dt>Rendimiento de piezas</dt><dd>${num(d.parts, 3)}×</dd></div><div><dt>Desgaste de piezas</dt><dd>${num(d.wear, 2)}×</dd></div><div><dt>Riesgo de error</dt><dd>${num(d.risk, 2)}×</dd></div><div><dt>Consumo de energía</dt><dd>${num(3 * d.fatigue, 1)} pt/h base</dd></div><div><dt>Para volver al 100%</dt><dd>${num((100 - d.energy) / d.recovery, 1)} h</dd></div></dl><button class="button ghost full" data-action="choose-driver" data-id="${d.id}" ${p().phase === "finished" ? "disabled" : ""}>Asignar a próxima etapa ${icon("arrow")}</button><p class="small-note">${money(d.salary)} cr / carrera</p><button class="text-button" data-action="release" data-kind="driver" data-id="${d.id}" ${teamReleaseDisabled()}>Liberar contrato</button></article>`,
    )
    .join(
      "",
    )}</div><section class="panel finance-panel"><div class="panel-heading"><div><span class="eyebrow">PRESUPUESTO DEL CAMPEONATO</span><h2>Cada crédito tiene un destino.</h2></div><button class="button ghost small" data-action="export">${icon("download")}Exportar partida</button></div><div class="finance-stats">${stat("INICIAL", money(p().initialBudget ?? STARTING_BUDGET) + " <em>cr</em>")}${stat(
    "EGRESOS",
    money(
      -p()
        .ledger.filter((x) => x.amount < 0)
        .reduce((a, x) => a + x.amount, 0),
    ) + " <em>cr</em>",
  )}${stat("DISPONIBLE", money(p().budget) + " <em>cr</em>")}${stat(
    "INGRESOS",
    money(
      p()
        .ledger.filter((x) => x.amount > 0)
        .reduce((a, x) => a + x.amount, 0),
    ) + " <em>cr</em>",
  )}</div><div class="table-scroll"><table><thead><tr><th>Momento</th><th>Movimiento</th><th>Créditos</th></tr></thead><tbody>${p()
    .ledger.slice(-18)
    .reverse()
    .map(
      (l) =>
        `<tr><td>${l.time < 0 ? "Previa" : duration(l.time)}</td><td>${esc(l.label)}</td><td class="mono ${l.amount > 0 ? "good" : ""}">${l.amount > 0 ? "+" : ""}${money(l.amount)}</td></tr>`,
    )
    .join("")}</tbody></table></div></section>`;
}
function finishPanel() {
  const t = p();
  return `<section class="panel finish-panel"><div class="finish-copy"><span class="eyebrow">${esc(ROUTE_NAME)} / RESULTADO</span><h2>${t.phase === "cutoff" ? "Plazo de carrera agotado." : "Llegaste a la meta."}</h2><p>${t.finishTime !== null ? `Completaste ${STAGES.length} etapas en ${duration(t.finishTime)}.` : `Clasificado con ${num(t.totalKm)} km recorridos.`}</p>${t.prizePaid ? `<div class="finish-stats">${stat("POSICIÓN FINAL", "P" + t.prize.position)}${stat("PREMIO BRUTO", money(t.prize.gross) + " cr")}${stat("DEUDA DESCONTADA", money(t.prize.settled) + " cr")}${stat("PREMIO NETO", money(t.prize.net) + " cr")}</div>` : "<p>Resultado provisional. Se paga al cerrar la carrera: hasta 24 h desde la primera llegada, sujeto al límite máximo.</p>"}<div class="button-row"><button class="button primary" data-action="tab" data-tab="championship">Inscripción y próxima carrera</button><button class="button ghost" data-action="export-results">Guardar resultado</button></div></div></section>`;
}

function footer() {
  return `<footer><span>APEX1000 <b>RALLY</b> · v${VERSION} · Prototipo single player</span><div><button data-action="export" ${!state ? "disabled" : ""}>Exportar partida</button><button data-action="import">Importar</button><button data-action="help">Reglas y fuentes</button>${state ? '<button data-action="new-race">Nueva escudería</button>' : ""}</div></footer>`;
}
const adminRoot = document.createElement("div");
adminRoot.id = "admin-root";
document.body.append(adminRoot);
const adminObserver = new ResizeObserver(() => {
  document.documentElement.style.setProperty(
    "--admin-height",
    `${adminRoot.querySelector(".admin-menu")?.getBoundingClientRect().height || 0}px`,
  );
});
function renderAdmin() {
  adminObserver.disconnect();
  patchLivePanel(
    adminRoot,
    state
      ? adminBar(state, {
          busy,
          canNext:
            !!state.competition &&
            (!p().participating || state.competition.closed || state.clock < 0),
        })
      : "",
  );
  if (adminRoot.firstElementChild)
    adminObserver.observe(adminRoot.firstElementChild);
  else document.documentElement.style.setProperty("--admin-height", "0px");
}
let pendingLiveRender = false;
function render() {
  const openPanels = [
    ...document.querySelectorAll("details[data-preserve-open]"),
  ].map((el) => [el.id, el.open]);
  pendingLiveRender = false;
  setActiveRoute(state);
  const content = !state
    ? onboarding()
    : `<main>${{ home: () => homePage(state), workshop: () => workshopPage(state), race: racePage, roadbook, camp, market, crew, journal: () => journalPage(state), championship: () => championshipPage(state) }[ui.tab]()}</main>`;
  $("#app").innerHTML = header() + clockBar() + content + footer();
  for (const [id, open] of openPanels) {
    const panel = document.getElementById(id);
    if (panel) panel.open = open;
  }
  renderAdmin();
  if (state && ui.tab === "camp" && currentEvent(state)?.kind === "short") {
    const parts = document.querySelector(".parts-panel");
    if (parts) parts.disabled = true;
    const rest = document.getElementById("plan-rest");
    if (rest) rest.disabled = true;
    const note = document.querySelector(".form-note");
    if (note)
      note.textContent =
        "Sprint: sin paradas ni reparaciones. Descansá y repará en la base antes de largar. Se carga combustible previamente y un solo piloto corre toda la prueba.";
  }
  document
    .querySelector("[data-timeline-center]")
    ?.scrollIntoView({ inline: "center", block: "nearest" });
  if (state && ui.tab === "race") {
    updateMap(state, ui.selectedTeam);
    bindMap();
  }
  if (!state) {
    $("#create-form").onsubmit = (e) => {
      e.preventDefault();
      const f = new FormData(e.target),
        startAt = new Date(f.get("startAt")).toISOString();
      try {
        state = createRace({
          vehicleId: ui.vehicleId,
          name: f.get("teamName"),
          startAt,
          seed: Number(f.get("seed")),
        });
        if (!ADMIN_ENABLED) state.speed = 1;
        ui.tab = "home";
        ui.selectedStage = 0;
        ui.drafts = {};
        persist();
        render();
        toast("Escudería creada. Elegí una carrera en Inscripción.");
      } catch (err) {
        toast(err.message);
      }
    };
  }
}
function refresh() {
  if (!state) return;
  if (ui.tab === "home" || ui.tab === "championship")
    patchLivePanel(
      document.querySelector("main"),
      ui.tab === "home" ? homePage(state) : championshipPage(state),
    );
  if (!state) return;
  if ($("#clock-value"))
    $("#clock-value").textContent =
      (state.clock < 0 ? "− " : "") + duration(Math.abs(state.clock));
  if (ui.tab === "race") {
    updateMap(state, ui.selectedTeam);
    $("#leaderboard-rows").innerHTML = leaderboardRows();
    $("#player-metrics").innerHTML = playerMetrics();
    patchLivePanel($("#team-inspector"), teamInspector());
    $("#events").innerHTML = eventsHTML();
    patchLivePanel($("#map-hud"), mapHUD());
  }
  if (ui.tab === "workshop") {
    $("#workshop-jobs").innerHTML = jobsHTML(state);
    for (const car of p().garage) {
      const el = document.querySelector(`[data-car-condition="${car.id}"]`);
      if (el) {
        el.innerHTML = `${num(car.condition, 1)} <small>/100</small>`;
        el.parentElement.querySelector(".condition-bar").outerHTML =
          conditionBar(car.condition);
      }
    }
  }
  if (ui.tab === "journal") $("main").innerHTML = journalPage(state);
  if (ui.tab === "camp" && $("#service-quote"))
    $("#service-quote").innerHTML = quoteHTML();
}
function runTime(command) {
  if (busy) return;
  busy = true;
  if (!command.fromTimer) renderAdmin();
  const beforeStage = p().stageIndex,
    beforeRace = state.id,
    beforeClock = state.clock,
    beforePhase = p().phase,
    beforeResults = state.championship.results.length,
    beforeWork = p()
      .workshop.jobs.map((j) => j.id)
      .join(","),
    beforeAuctions = JSON.stringify(state.management.auctions);
  const worker = new Worker(new URL("./worker.js", import.meta.url), {
    type: "module",
  });
  $("#app").classList.add("computing");
  worker.onmessage = ({ data }) => {
    worker.terminate();
    busy = false;
    $("#app").classList.remove("computing");
    if (!data.ok) {
      renderAdmin();
      toast(data.error);
      return;
    }
    state = data.state;
    if (!command.fromTimer) renderAdmin();
    if (beforeRace !== state.id) {
      ui.drafts = {};
      ui.selectedStage = 0;
      fitMap();
    }
    setActiveRoute(state);
    if (!command.fromTimer) lastWall = Date.now();
    if (command.type === "next-camp") {
      state.speed = 0;
      ui.selectedStage = Math.min(p().stageIndex, STAGES.length - 1);
      toast(
        p().phase === "finished"
          ? "¡Completaste la travesía!"
          : p().stageIndex > beforeStage
            ? `Llegaste a ${STAGES[Math.max(0, p().stageIndex - 1)].to.name}. El reloj del prototipo está pausado.`
            : "Avanzó el reloj, pero el equipo todavía no llegó a la próxima parada. Revisá el taller y las esperas.",
      );
    }
    if (
      beforeRace !== state.id ||
      command.type !== "advance" ||
      beforeAuctions !== JSON.stringify(state.management.auctions) ||
      beforeStage !== p().stageIndex ||
      beforePhase !== p().phase ||
      beforeResults !== state.championship.results.length ||
      beforeWork !==
        p()
          .workshop.jobs.map((j) => j.id)
          .join(",") ||
      (beforeClock < 0 && state.clock >= 0)
    ) {
      persist();
      if (command.fromTimer && editingControl(document)) {
        pendingLiveRender = true;
        refresh();
      } else render();
    } else {
      if (pendingLiveRender && !editingControl(document)) render();
      else refresh();
      if (!command.fromTimer || ++saveTick % 5 === 0) persist();
    }
  };
  worker.onerror = () => {
    busy = false;
    renderAdmin();
    worker.terminate();
    $("#app").classList.remove("computing");
    toast(
      "No se pudo avanzar la simulación. La partida anterior sigue disponible.",
    );
  };
  worker.postMessage({ state, command });
}
function download(data, name) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
function goCamp(index = editStage()) {
  ui.selectedStage = index;
  ui.tab = "camp";
  render();
  window.scrollTo({ top: 0 });
}
let mapResizeObserver;
function bindMap() {
  const svg = $("#race-map");
  mapResizeObserver?.disconnect();
  mapResizeObserver = new ResizeObserver(applyCamera);
  mapResizeObserver.observe(svg);
  const pointers = new Map();
  let dragging = null,
    pinch = null,
    dragged = false;
  const worldPoint = (x, y) =>
    new DOMPoint(x, y).matrixTransform(svg.getScreenCTM().inverse());
  svg.addEventListener("pointerdown", (e) => {
    dragged = false;
    if (e.target.closest('[data-action="follow"]')) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y) };
      svg.setPointerCapture(e.pointerId);
      dragging = null;
      return;
    }
    dragging = { x: e.clientX, y: e.clientY, cx: camera.x, cy: camera.y };
  });
  svg.addEventListener("pointermove", (e) => {
    if (pointers.has(e.pointerId))
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()],
        distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (distance > 0 && pinch.distance > 0)
        zoom(
          pinch.distance / distance,
          worldPoint((a.x + b.x) / 2, (a.y + b.y) / 2),
        );
      pinch.distance = distance;
      dragged = true;
      updateMap(state, ui.selectedTeam);
      return;
    }
    if (!dragging) return;
    if (
      !dragging.active &&
      Math.hypot(e.clientX - dragging.x, e.clientY - dragging.y) < 4
    )
      return;
    if (!dragging.active) {
      dragging.active = true;
      dragged = true;
      svg.setPointerCapture(e.pointerId);
    }
    const matrix = svg.getScreenCTM(),
      scale = 1 / Math.hypot(matrix.a, matrix.b);
    camera.x = dragging.cx - (e.clientX - dragging.x) * scale;
    camera.y = dragging.cy - (e.clientY - dragging.y) * scale;
    camera.follow = null;
    applyCamera();
  });
  const release = (e) => {
    pointers.delete(e.pointerId);
    dragging = null;
    pinch = null;
  };
  svg.addEventListener("pointerup", release);
  svg.addEventListener("pointercancel", release);
  svg.addEventListener(
    "click",
    (e) => {
      if (dragged) {
        e.preventDefault();
        e.stopImmediatePropagation();
        dragged = false;
      }
    },
    true,
  );
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(e.deltaY > 0 ? 1.16 : 0.86, worldPoint(e.clientX, e.clientY));
      updateMap(state, ui.selectedTeam);
    },
    { passive: false },
  );
  svg.addEventListener("keydown", (e) => {
    const marker = e.target.closest('[data-action="follow"]');
    if (marker && ["Enter", " "].includes(e.key)) {
      e.preventDefault();
      marker.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      return;
    }
    if (["+", "=", "-", "0"].includes(e.key)) {
      e.preventDefault();
      if (e.key === "0") fitMap();
      else zoom(e.key === "-" ? 1.3 : 0.77);
      updateMap(state, ui.selectedTeam);
    }
  });
}
function help() {
  const dialog = document.createElement("dialog");
  dialog.className = "dialog help-dialog";
  dialog.innerHTML = `<div class="dialog-title"><div><span class="eyebrow">CÓMO FUNCIONA</span><h2>Una sola largada. Tu propio ritmo.</h2></div><button class="icon-button" data-action="close-modal" aria-label="Cerrar">${icon("close")}</button></div><p>Todos los equipos comparten un horario de largada. Después, conducción, averías, asistencia y descansos consumen tiempo de la misma carrera. Pueden estar en etapas diferentes. Gana quien llega antes a la meta de cada carrera.</p><h3>Inscripción y calendario</h3><p>Las carreras son independientes y no entregan puntos de campeonato. Hay ocho raids de varios días y 24 sprints que rotan cada 48 horas. Debés inscribirte antes de cada largada: si no lo hacés, permanecés en la base y el taller sigue trabajando. Cada inscripción reserva el intervalo máximo publicado, aunque termines antes, y bloquea las carreras que se superponen. El piloto y el auto de largada quedan registrados; vender ese auto cancela sus inscripciones futuras.</p><h3>Preparar cada etapa</h3><p>En Campamento elegís piloto, ritmo, exigencia, chasis, gomas, transmisión, refrigeración, combustible y acciones por pieza. Guardar confirma ese plan. Al llegar, las piezas se reparan o cambian y los pilotos descansan en paralelo. La etapa arranca cuando termina la tarea más larga. Una etapa sin plan deja al equipo esperando.</p><p>El descanso se limita a las horas necesarias para recuperar 100% de energía. Los pilotos de relevo recuperan energía a 0,1× mientras otro conduce y a 1× en campamento o en la base. Una carga completa suele alcanzar para una etapa con una preparación normal. La preparación de la primera etapa ocurre antes de largar.</p><h3>Home y taller</h3><p>La Home resume la próxima largada, tu caja y los hitos de recorrido. El Taller admite hasta 3 autos; cada uno conserva estado, performance y fiabilidad. Un auto nuevo empieza en 100/50/50. Las mejoras de performance y fiabilidad permiten elegir entre 1 y 5 puntos hasta 100. Empiezan en 20 horas de trabajo por punto y se vuelven progresivamente más lentas cerca de 100. Podés vender cualquier auto fuera de una carrera en curso, incluso el seleccionado o el último, o entregarlo como parte de pago; el auto seleccionado se cambia antes de largar o después de llegar a la meta.</p><p>Distribuí hasta 5 mecánicos: 1–4 en carrera y 0–4 en la base. Con cero en el taller la cola se pausa. Los trabajos se pagan al programar y se completan por orden; cancelar devuelve sólo la parte no trabajada. El auto que está participando no se puede desarrollar en la base, pero los otros sí. Las piezas instaladas forman el kit del equipo y se conservan al cambiar de auto.</p><h3>Calidad no es estado</h3><p>La calidad determina rendimiento, resistencia, tendencia térmica y riesgo base. El estado es el desgaste actual. Podés comprar repuestos nuevos o usados, reparar los instalados o intercambiarlos por piezas del lote. La pieza retirada vuelve al inventario.</p><p>Original mide el potencial de reconstrucción: empieza en 100 y baja al reparar, tanto en la base como en campamento. Menos original implica más horas, mayor costo por punto recuperado y menor estado máximo recuperable. El taller muestra el presupuesto y el resultado antes de programar.</p><p>Tenés una reserva gratuita de cada tipo. Nunca se avería: sigue funcionando cada vez más lenta al desgastarse. Si llegás con una pieza rota, se intenta reparar según tu plan; si continúa rota se monta la reserva disponible para seguir.</p><h3>Economía y continuidad</h3><p>El presupuesto paga vehículo, repuestos, mano de obra y combustible. Las reparaciones que no se pueden pagar se omiten. Para evitar una carrera bloqueada sin combustible, una asistencia suma 4 h y un recargo del 40%. Si falta dinero, queda una deuda que se descuenta del premio; el saldo pendiente se muestra al terminar. Cada carrera paga sus premios cuando se cierra. El cierre ocurre al terminar todos, a las 24 horas desde la primera llegada o al agotar su tiempo máximo, lo que ocurra antes. Los que no llegaron se clasifican por avance. En un sprint no hay reparaciones, descansos ni asistencia en ruta: un solo piloto corre hasta la meta o el límite de 4 horas.</p><h3>Tiempo del prototipo</h3><p>1× usa tiempo real y recupera el tiempo transcurrido al volver a abrir la partida. Pausado y las velocidades aceleradas pertenecen sólo al prototipo single player. Una sesión acelerada se reabre pausada. Los controles están reunidos en la barra Admin. “Próxima parada” avanza el reloj de todos hasta que tu equipo completa una etapa y pausa la prueba. “Próxima carrera” permite saltar hasta un minuto antes de una carrera futura cuando estás en la base o tu carrera ya cerró; elegirá primero una inscripción pendiente. No inscribe automáticamente.</p><h3>Bitácora de ruta</h3><p>El cuaderno registra una o dos notas por etapa, basadas en problemas o aciertos observados durante la simulación. Los consejos al margen ayudan a interpretar el calor, la fatiga, las averías y la configuración. Las etapas anteriores a la actualización no se reconstruyen.</p><h3>Qué es real y qué es diseño del juego</h3><p>Los modelos de vehículos y las localidades son reales. La ruta deportiva, los kilómetros de etapa, el terreno, los costos, la resistencia comparativa, los consumos y las probabilidades son parámetros ficticios. La cartografía base es de Natural Earth y las localidades de GeoNames; el trazado no es navegación vial.</p><p>Se juega una modalidad de preparación libre: algunos sectores de asfalto admiten hasta 250 km/h. No reproduce el reglamento Dakar ni la velocidad homologada de los vehículos (por ejemplo, X-raid publica un límite de 170 km/h para el MINI). Un vehículo averiado circula a 30 km/h.</p><h3>Online, más adelante</h3><p>Esta versión no conecta jugadores reales. Once equipos son simulados. El motor y el contrato público del visor están separados; un servidor futuro deberá ser dueño del reloj, el estado y las compras. GitHub Pages aloja este prototipo.</p><h3>Fuentes</h3><ul>${VEHICLES.map((v) => `<li><a href="${v.source}" target="_blank" rel="noreferrer">${v.name}</a></li>`).join("")}<li><a href="https://www.naturalearthdata.com/" target="_blank" rel="noreferrer">Natural Earth</a> · cartografía</li><li><a href="https://www.geonames.org/" target="_blank" rel="noreferrer">GeoNames</a> · localidades</li></ul>`;
  $("#modal-root").replaceChildren(dialog);
  dialog.showModal();
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-action]");
  if (!b) return;
  const a = b.dataset.action,
    id = b.dataset.id;
  try {
    if (a === "help") {
      help();
      return;
    }
    if (a === "close-modal") {
      b.closest("dialog").close();
      return;
    }
    if (a === "import") {
      if (busy) {
        toast("Esperá a que termine el cálculo actual.");
        return;
      }
      $("#import-file").click();
      return;
    }
    if (!state && a === "choose-vehicle") {
      ui.vehicleId = id;
      render();
      return;
    }
    if (!state) return;
    if (
      busy &&
      !["zoom-in", "zoom-out", "fit-map", "follow", "tab"].includes(a)
    ) {
      toast("Esperá a que termine el cálculo actual.");
      return;
    }
    if (
      !ADMIN_ENABLED &&
      [
        "toggle-time",
        "skip-start",
        "advance-hour",
        "advance-day",
        "next-camp",
        "next-race",
        "finish-grid",
        "inject-money",
      ].includes(a)
    )
      return;
    if (a === "fullscreen-map") {
      if (document.body.classList.contains("map-fullscreen")) {
        document.body.classList.remove("map-fullscreen");
        if (document.fullscreenElement)
          document.exitFullscreen().catch(() => {});
      } else {
        document.body.classList.add("map-fullscreen");
        document.documentElement.requestFullscreen?.().catch(() => {});
      }
      b.textContent = document.body.classList.contains("map-fullscreen")
        ? "Cerrar pantalla completa"
        : "⛶ Pantalla completa";
      return;
    }
    if (a === "bid") {
      bid(state, b.dataset.kind, id, Number($("#bid-" + id).value));
      persist();
      render();
      toast(
        "Oferta registrada y sueldo reservado. El cierre usa el reloj de la carrera.",
      );
      return;
    }
    if (a === "cancel-bid") {
      cancelBid(state, id);
      persist();
      render();
      return;
    }
    if (a === "release") {
      releasePerson(state, b.dataset.kind, id);
      ui.drafts = {};
      persist();
      render();
      toast(
        "Contrato liberado. Los planes futuros se reasignaron si era necesario.",
      );
      return;
    }
    if (
      [
        "purchase-car",
        "select-car",
        "confirm-sale",
        "confirm-trade",
        "enqueue-work",
        "cancel-work",
      ].includes(a)
    ) {
      if (a === "purchase-car") purchaseVehicle(state, id);
      if (a === "select-car") {
        selectVehicle(state, id);
        ui.drafts = {};
      }
      if (a === "confirm-sale") sellVehicle(state, id);
      if (a === "confirm-trade") {
        purchaseVehicle(state, id, { tradeId: b.dataset.trade });
        ui.drafts = {};
      }
      if (a === "enqueue-work")
        enqueueJob(
          state,
          b.dataset.kind,
          id,
          Number(
            document.getElementById(`upgrade-${id}-${b.dataset.kind}`)?.value ||
              5,
          ),
        );
      if (a === "cancel-work") cancelJob(state, id);
      b.closest("dialog")?.close();
      persist();
      render();
      toast(
        a === "enqueue-work"
          ? "Trabajo reservado. Avanza con el reloj y los mecánicos asignados al taller."
          : "Taller actualizado.",
      );
      return;
    }
    if (a === "quote-sale" || a === "quote-trade") {
      const tradeId = a === "quote-sale" ? id : $("#trade-" + id).value;
      const car = p().garage.find((c) => c.id === tradeId),
        value = vehicleSaleValue(state, car);
      const target =
        a === "quote-trade"
          ? state.management.catalog.vehicles.find((v) => v.id === id)
          : null;
      const dialog = document.createElement("dialog");
      dialog.className = "dialog";
      dialog.innerHTML = `<h2>${target ? "Cambiar vehículo" : "Vender vehículo"}</h2><p>Vendés ${esc(vehicle(car.modelId).short)} · unidad ${car.id.split("-").at(-1)} · estado ${num(car.condition, 1)}/100 por <strong>${money(value)} cr</strong>.</p>${target ? `<p>Comprás ${esc(target.name)} nuevo por ${money(target.price)} cr.</p><p>Diferencia: <strong>${money(target.price - value)} cr</strong>. Saldo posterior: ${money(p().budget + value - target.price)} cr.</p>` : `<p>Saldo posterior: ${money(p().budget + value)} cr.</p>`}<p>Las piezas del equipo permanecen en tu inventario y kit de carrera. Las inscripciones futuras que usen este auto se cancelan.</p><div class="button-row"><button class="button ghost" data-action="close-modal">Volver</button><button class="button primary" data-action="${target ? "confirm-trade" : "confirm-sale"}" data-id="${id}" data-trade="${tradeId}" ${target && p().budget + value < target.price ? "disabled" : ""}>Confirmar ${target ? "cambio" : "venta"}</button></div>`;
      $("#modal-root").replaceChildren(dialog);
      dialog.showModal();
      return;
    }
    if (a === "buy-vehicle") {
      buyVehicle(state, id);
      ui.drafts = {};
      persist();
      render();
      return;
    }
    if (a === "choose-shield") {
      p().shieldId = Number(id);
      persist();
      render();
      return;
    }
    if (a === "rename-team") {
      const name = $("#team-name").value.trim();
      if (!name) throw Error("Ingresá un nombre.");
      p().name = name.slice(0, 40);
      persist();
      render();
      return;
    }
    if (a === "center-timeline") {
      document.querySelector("[data-timeline-center]")?.scrollIntoView({
        inline: "center",
        block: "nearest",
        behavior: "smooth",
      });
      return;
    }
    if (a === "enroll" || a === "cancel-enrollment") {
      if (a === "enroll")
        enroll(
          state,
          id,
          document.getElementById("enroll-driver-" + id)?.value,
        );
      else cancelEnrollment(state, id);
      persist();
      render();
      toast(
        a === "enroll"
          ? "Inscripción guardada. Intervalo máximo reservado."
          : "Inscripción cancelada.",
      );
      return;
    }
    if (a === "next-race") {
      state = nextChampionshipRace(state);
      ui.drafts = {};
      ui.selectedStage = 0;
      ui.selectedTeam = "player";
      ui.tab = "championship";
      fitMap();
      persist();
      render();
      return;
    }
    if (a === "finish-grid") {
      runTime({
        type: "advance",
        seconds: 30 * 86400,
        stopAtAllFinished: true,
      });
      return;
    }
    if (a === "tab") {
      e.preventDefault();
      ui.tab = b.dataset.tab;
      if (ui.tab === "camp") ui.selectedStage = editStage();
      render();
      window.scrollTo({ top: 0 });
    } else if (a === "open-camp") goCamp();
    else if (a === "plan-stage") goCamp(Number(b.dataset.index));
    else if (a === "roadbook-stage") {
      ui.tab = "roadbook";
      render();
      document
        .querySelectorAll(".stage-card")
        [
          Number(b.dataset.index)
        ]?.scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (a === "map-stage") {
      const index = Number(b.dataset.index);
      ui.tab = "race";
      focusStage(STAGES[index]);
      render();
      $("#race-map").scrollIntoView({ behavior: "smooth", block: "center" });
    } else if (a === "follow") {
      ui.selectedTeam = id;
      focusTeam(state.teams.find((t) => t.id === id));
      if (ui.tab !== "race") {
        ui.tab = "race";
        render();
      } else refresh();
    } else if (a === "zoom-in" || a === "zoom-out") {
      zoom(a === "zoom-in" ? 0.72 : 1.38);
      updateMap(state, ui.selectedTeam);
    } else if (a === "fit-map") {
      fitMap();
      updateMap(state, ui.selectedTeam);
    } else if (a === "choose-driver") {
      ui.selectedStage = editStage();
      draft().driverId = id;
      ui.tab = "camp";
      render();
      toast("Piloto elegido en el borrador. Guardá el plan para confirmarlo.");
    } else if (a === "recommended") {
      Object.assign(draft(), recommendedSetup(STAGES[ui.selectedStage]));
      render();
      toast(
        "Chasis, presión, transmisión y refrigeración sugeridos. Guardá para confirmar.",
      );
    } else if (a === "fuel-suggestion") {
      const est = estimateStage(p(), STAGES[ui.selectedStage], draft());
      draft().fuelTarget = Math.min(
        vehicle(p().vehicleId).tank,
        est.fuelWithMargin,
      );
      render();
      toast("Carga sugerida calculada con margen del 10% más 12 L.");
    } else if (a === "repair-all") {
      PART_TYPES.forEach((t) => (draft().actions[t.id] = "repair"));
      render();
    } else if (a === "fit-reserves") {
      for (const type of PART_TYPES) {
        const part = p().inventory.find(
          (i) => i.type === type.id && i.grade === "reserve",
        );
        if (part) {
          draft().actions[type.id] = "replace";
          draft().replacements[type.id] = part.id;
        } else draft().actions[type.id] = "repair";
      }
      render();
    } else if (a === "save-plan") {
      savePlan(state, ui.selectedStage, draft());
      persist();
      render();
      toast(
        currentEvent(state)?.kind === "short"
          ? "Preparación del sprint guardada. Se aplica antes de largar."
          : `Plan de E${ui.selectedStage + 1} guardado. Se ejecutará al llegar a su campamento.`,
      );
    } else if (a === "fill-plans") {
      let count = 0;
      for (let i = editStage(); i < STAGES.length; i++)
        if (!p().plans[i]) {
          savePlan(state, i, {
            ...defaultPlan(i),
            driverId: p().drivers[i % p().drivers.length].id,
            ...recommendedSetup(STAGES[i]),
            fuelTarget: vehicle(p().vehicleId).tank,
          });
          count++;
        }
      persist();
      render();
      toast(
        `${count} planes guardados: reparación al máximo recuperable, pilotos rotativos, descanso al 100% y tanque lleno. Los planes existentes se conservaron.`,
      );
    } else if (a === "market-type") {
      ui.marketType = id;
      render();
    } else if (a === "buy") {
      buyPart(state, ui.marketType, b.dataset.grade, ui.marketCondition);
      persist();
      render();
      toast("Pieza comprada. Programá su montaje en Campamento.");
    } else if (a === "inject-money") {
      const amount = Number($("#admin-money-amount").value);
      injectMoney(state, amount);
      persist();
      render();
      toast("Admin: se añadieron " + money(amount) + " cr a tu equipo.");
    } else if (a === "toggle-time") {
      state.speed = state.speed ? 0 : 1;
      lastWall = Date.now();
      persist();
      render();
    } else if (a === "skip-start") {
      state.speed = 0;
      runTime({ type: "advance", seconds: Math.max(30, -state.clock + 30) });
    } else if (a === "advance-hour")
      runTime({ type: "advance", seconds: 3600 });
    else if (a === "advance-day") runTime({ type: "advance", seconds: 86400 });
    else if (a === "next-camp") {
      state.speed = 0;
      runTime({ type: "next-camp" });
    } else if (a === "export") download(state, "Apex1000-Rally-partida.json");
    else if (a === "export-results")
      download(
        {
          race: publicSnapshot(state),
          result: p().prize,
          history: p().history,
          ledger: p().ledger,
        },
        "Apex1000-Rally-resultado.json",
      );
    else if (a === "new-race") {
      const dialog = document.createElement("dialog");
      dialog.className = "dialog";
      dialog.innerHTML = `<h2>Inscribir un nuevo equipo</h2><p>Se conservará un respaldo de la partida actual en este navegador. También podés exportarla antes de comenzar.</p><div class="button-row"><button class="button ghost" data-action="close-modal">Volver</button><button class="button primary" data-action="confirm-new">Crear otra carrera</button></div>`;
      $("#modal-root").replaceChildren(dialog);
      dialog.showModal();
    } else if (a === "confirm-new") {
      localStorage.setItem(
        SAVE_KEY + "-archive-" + Date.now(),
        encodeSave(state),
      );
      state = null;
      ui.drafts = {};
      ui.tab = "race";
      fitMap();
      $("#modal-root").replaceChildren();
      render();
    }
  } catch (err) {
    toast(err.message);
  }
});
document.addEventListener("change", (e) => {
  if (e.target.dataset.upgradeCar) {
    const el = e.target,
      row = el.closest("div"),
      kind = el.dataset.upgradeKind;
    const q = jobQuote(
        state,
        p(),
        kind,
        el.dataset.upgradeCar,
        Number(el.value),
      ),
      rate = crewRate(p(), "workshop");
    row.querySelector("span small").textContent =
      `${money(q.cost)} cr · ${rate ? num(q.workHours / rate, 1) + " h" : "Pausado · sin mecánicos"}`;
    row.querySelector('[data-action="enqueue-work"]').disabled =
      !!jobFor(p(), el.dataset.upgradeCar) || !q.needed || q.cost > p().budget;
    return;
  }
  const el = e.target;
  if (!state) return;
  try {
    if (el.dataset.mechanicAssignment) {
      if (busy) {
        render();
        return;
      }
      assignMechanic(state, el.dataset.mechanicAssignment, el.value);
      persist();
      render();
      return;
    }
    if (el.dataset.plan) {
      const k = el.dataset.plan;
      draft()[k] = ["fuelTarget", "boost"].includes(k)
        ? clamp(
            Number(el.value) || 0,
            Number(el.min) || 0,
            Number(el.max) || 1000,
          )
        : k === "rest" && el.value !== "full"
          ? Number(el.value)
          : el.value;
      if ($("#service-quote")) $("#service-quote").innerHTML = quoteHTML();
    } else if (el.dataset.partAction) {
      const t = el.dataset.partAction;
      if (el.value.startsWith("replace:")) {
        draft().actions[t] = "replace";
        draft().replacements[t] = el.value.slice(8);
      } else draft().actions[t] = el.value;
      $("#service-quote").innerHTML = quoteHTML();
    } else if (el.id === "stage-picker") {
      ui.selectedStage = Number(el.value);
      render();
    } else if (el.id === "market-condition") {
      ui.marketCondition = Number(el.value);
      render();
    } else if (el.id === "time-speed" && ADMIN_ENABLED) {
      if (busy) {
        el.value = state.speed;
        return;
      }
      state.speed = Number(el.value);
      lastWall = Date.now();
      persist();
      render();
    }
  } catch (err) {
    toast(err.message);
    if (el.dataset.mechanicAssignment) render();
  }
});
$("#import-file").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    if (file.size > 6000000)
      throw new Error("La partida supera el máximo de 6 MB.");
    const imported = validateSave(JSON.parse(await file.text()));
    if (!imported.competition)
      initializeCompetition(imported, { legacy: true });
    if (busy) throw new Error("Esperá a que termine el cálculo actual.");
    if (state)
      localStorage.setItem(SAVE_KEY + "-before-import", encodeSave(state));
    state = imported;
    state.speed = ADMIN_ENABLED ? 0 : 1;
    ui.drafts = {};
    ui.tab = "race";
    ui.selectedTeam = "player";
    fitMap();
    persist();
    render();
    toast("Partida importada y pausada.");
  } catch (err) {
    toast(`No se importó: ${err.message}`);
  }
  e.target.value = "";
});
setInterval(() => {
  const now = Date.now();
  if (state?.speed && !busy) {
    const elapsed = (now - lastWall) / 1000;
    lastWall = now;
    runTime({
      type: "advance",
      seconds: elapsed * state.speed,
      fromTimer: true,
    });
  } else if (!busy) lastWall = now;
}, 1000);
// One animation loop for both dashboard views; visual RPM time never advances the race.
let instrumentTime = 0,
  instrumentLast = window.performance.now(),
  instrumentFrame = 0;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
function animateInstruments(now) {
  const delta = Math.min(0.1, (now - instrumentLast) / 1000);
  instrumentLast = now;
  if (state?.speed && !document.hidden) instrumentTime += delta;
  if (now - instrumentFrame >= 100 && !document.hidden) {
    instrumentFrame = now;
    updateInstruments(state, instrumentTime, reducedMotion.matches);
  }
  requestAnimationFrame(animateInstruments);
}
requestAnimationFrame(animateInstruments);
window.addEventListener("beforeunload", () => persist());
try {
  const response = await fetch(
    new URL("../assets/world.json", import.meta.url),
  );
  if (!response.ok) throw new Error("No se pudo cargar el mapa.");
  geo = await response.json();
  const offline =
    state?.speed === 1 ? Math.max(0, (Date.now() - state.wallAt) / 1000) : 0;
  if (state && state.speed !== 1) state.speed = ADMIN_ENABLED ? 0 : 1;
  render();
  if (offline > 30) runTime({ type: "advance", seconds: offline });
  if (bootWarning) toast(bootWarning);
} catch (err) {
  $("#app").innerHTML =
    `<main><h1>No se pudo abrir el rally</h1><p>${esc(err.message)}</p><p>Abrí el juego mediante su dirección web y conservá la carpeta assets al publicarlo.</p></main>`;
}

function teamReleaseDisabled() {
  return ["racing", "service"].includes(p().phase) || p().drivers.length <= 1
    ? "disabled"
    : "";
}
function market() {
  return vehicleShop(state) + partsMarket() + staffMarket(state);
}
function crew() {
  return (
    identityPanel(state) +
    driversPage() +
    allocationPanel(state) +
    mechanicsPanel(state)
  );
}
function raceContextHTML(team) {
  if (team.participating === false)
    return '<section class="hud-position"><p>Sin inscripción · en la base</p></section>';
  const race = raceNeighbors(state, team.id);
  const gap = (other, direction) =>
    other
      ? `<span>${esc(other.name)}</span><strong>${num(other.km, 2)} km${other.seconds !== null ? `<small> · ${duration(other.seconds)}</small>` : ""}</strong>`
      : `<span>${direction === "ahead" ? "Líder de carrera" : "Último equipo"}</span><strong>—</strong>`;
  return `<section class="hud-position" aria-label="Posición y distancias"><div class="hud-place"><strong>P${race.position}</strong><span>DE ${race.total}</span></div><div class="hud-gaps"><div><small>ANTERIOR</small>${gap(race.ahead, "ahead")}</div><div><small>SIGUIENTE</small>${gap(race.behind, "behind")}</div></div><small class="gap-note">Distancia sobre el recorrido · tiempo al llegar ambos</small></section>`;
}
function mapHUD() {
  const t = state.teams.find((x) => x.id === ui.selectedTeam) || p(),
    d = t.drivers.find((x) => x.id === t.activeDriver) || t.drivers[0],
    health = vehicleHealth(t);
  const alerts = health.alerts.length
    ? `<div class="hud-alerts health-${health.level}" aria-label="Alertas del vehículo">${health.alerts.map((a) => `<div class="vehicle-alert health-${a.level}" title="${esc(a.detail)}"><strong>${a.level === "critical" ? "!" : "△"} ${esc(a.text)}</strong><small>${esc(a.detail)}</small></div>`).join("")}</div>`
    : '<div class="hud-clear">Sin alertas de avería</div>';
  return `<div class="hud-team">${shieldSVG(t.shieldId)}<div><small>SEGUIMIENTO · ${PHASES[t.phase]}</small><strong>${esc(t.name)}</strong><small class="hud-driver-inline">${esc(d.name)} · Energía ${num(d.energy)}%</small></div></div>${raceContextHTML(t)}<div class="hud-driver"><img src="${d.image}" alt="${esc(d.name)}"><div><strong>${esc(d.name)}</strong><small>${esc(vehicle(t.vehicleId).short)} · Energía ${num(d.energy)}%</small></div></div>${stopChecklistHTML(state, t)}${dashboardHTML(t, state.clock)}${alerts}<div class="hud-chassis"><span>Auto: ${num(activeCar(t)?.condition ?? 100)}/100 estado</span><span>${num(activeCar(t)?.performance ?? 50)}/100 performance · ${num(activeCar(t)?.reliability ?? 50)}/100 fiabilidad</span></div><img class="hud-vehicle" src="assets/art/${t.vehicleId}.webp" alt="${esc(vehicle(t.vehicleId).name)}"><details id="hud-vehicle-attributes" data-preserve-open class="vehicle-base-details"><summary>Atributos fijos del modelo</summary>${vehicleStatsHTML(teamVehicleStats(t), t.vehicleId)}</details><div class="hud-parts">${PART_TYPES.map(
    (type) => {
      const report = health.parts.find((x) => x.id === type.id),
        piece = t.parts[type.id];
      return `<div class="part-health health-${report.level}" title="${report.reserve ? "Reserva: nunca se avería" : report.broken ? "Pieza averiada" : `${num(report.probability * 100, 1)}% aprox. de avería en 1 h de conducción a condiciones constantes`}"><small>${type.short}</small><b>${piece.broken ? "AVERÍA" : num(piece.condition) + "%"}</b>${conditionBar(piece.condition, report.level === "critical" ? "#ff5a68" : report.level === "warning" ? "#ffd057" : "")}<span class="part-risk">${report.reserve ? "Respaldo irrompible" : report.broken ? "Requiere reparación" : num(report.probability * 100, 1) + "% / próxima h aprox."}</span></div>`;
    },
  ).join("")}</div><label>Seguir equipo<select id="hud-team">${standings(state)
    .map(
      (x, i) =>
        `<option value="${x.id}" ${x.id === t.id ? "selected" : ""}>P${i + 1} · ${esc(x.name)}</option>`,
    )
    .join(
      "",
    )}</select></label><small>Etapa ${Math.min(t.stageIndex + 1, STAGES.length)} / ${STAGES.length} · Tiempo ${duration(state.clock)} · ${money(t.budget)} cr</small>`;
}

document.addEventListener("change", (e) => {
  if (e.target.id === "hud-team") {
    ui.selectedTeam = e.target.value;
    focusTeam(state.teams.find((t) => t.id === ui.selectedTeam));
    refresh();
  }
});
document.addEventListener("input", (e) => {
  if (e.target.id === "map-zoom-range") {
    zoom(1000 / Number(e.target.value) / camera.w);
    updateMap(state, ui.selectedTeam);
  }
});
document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement) {
    document.body.classList.remove("map-fullscreen");
    const button = document.querySelector('[data-action="fullscreen-map"]');
    if (button) button.textContent = "⛶ Pantalla completa";
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !editingControl(document)) {
    document.body.classList.remove("map-fullscreen");
    const button = document.querySelector('[data-action="fullscreen-map"]');
    if (button) button.textContent = "⛶ Pantalla completa";
  }
});
