import { esc, conditionBar } from "./visuals.js";
import { shieldSVG } from "./shields.js";
import { routeFor } from "./route.js";
import { PHASES, vehicle } from "./catalog.js";

const num = (n, d = 0) =>
  Number(n).toLocaleString("es-AR", { maximumFractionDigits: d });
const date = (iso) =>
  new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
const countdown = (seconds) => {
  const minutes = Math.max(0, Math.round(seconds / 60)),
    d = Math.floor(minutes / 1440),
    h = Math.floor((minutes % 1440) / 60),
    m = minutes % 60;
  return `${d}d ${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m`;
};
export function homeProgress(state) {
  const t = state.teams.find((t) => t.id === "player"),
    c = state.championship;
  const past = c.results.filter((r) => r.round !== c.round);
  const finishes =
    c.results.length +
    (t.phase === "finished" && !c.results.some((r) => r.round === c.round)
      ? 1
      : 0);
  return {
    finishes,
    stages: past.length * 15 + t.history.length,
    km:
      past.reduce((sum, r) => sum + routeFor(r.routeId).totalKm, 0) + t.totalKm,
  };
}
export function homePage(state) {
  const t = state.teams.find((t) => t.id === "player"),
    cat = state.management.catalog,
    c = state.championship;
  const nextIndex = state.clock < 0 ? c.round : c.round + 1,
    next = cat.races[nextIndex],
    progress = homeProgress(state);
  const scheduled = next
    ? Date.parse(c.startAt) + next.startDay * 86400000
    : null;
  const remaining = next
    ? (scheduled - Date.parse(state.startAt)) / 1000 - state.clock
    : 0;
  const car = t.garage.find((x) => x.id === t.activeCarId);
  const active = vehicle(t.vehicleId),
    route = routeFor(state),
    jobs = t.workshop?.jobs || [];
  const milestones = [
    {
      name: "Primera parada",
      detail: "Completar una etapa",
      value: progress.stages,
      goal: 1,
    },
    {
      name: "Primer raid",
      detail: "Llegar a la meta de una carrera",
      value: progress.finishes,
      goal: 1,
    },
    {
      name: "10.000 km de camino",
      detail: "Distancia acumulada en estas carreras",
      value: progress.km,
      goal: 10000,
    },
    {
      name: "Vuelta al mundo",
      detail: "Completar las ocho carreras del calendario",
      value: progress.finishes,
      goal: 8,
    },
  ];
  return `<div class="page-title home-heading"><div><span class="eyebrow">CENTRAL DE LA ESCUDERÍA</span><h1>El próximo desafío empieza acá.</h1><p>Prepará tu equipo, cuidá el presupuesto y seguí el trabajo entre carreras.</p></div><div class="home-identity">${shieldSVG(t.shieldId)}<strong>${esc(t.name)}</strong></div></div>
  <section class="home-hero panel"><div class="home-hero-copy"><span class="eyebrow">${nextIndex === c.round ? "TU PRÓXIMA LARGADA" : next ? "PRÓXIMA CARRERA" : "CIERRE DEL CALENDARIO"}</span><h2>${next ? esc(next.name) : t.phase === "finished" ? "Calendario completado" : "Última carrera en curso"}</h2><p>${next ? `${esc(next.region)} · ${num(routeFor(next.id).totalKm)} km · 15 etapas` : "Tu escudería conserva sus vehículos, repuestos y resultados."}</p><div class="home-countdown"><strong>${next ? (remaining > 0 ? countdown(remaining) : "Fecha prevista superada") : `${progress.finishes} / 8 completadas`}</strong><span>${next ? date(scheduled) : "Consultá tus resultados"}</span></div><div class="button-row"><button class="button primary" data-action="tab" data-tab="workshop">Ir al taller</button><button class="button ghost" data-action="tab" data-tab="championship">Ver calendario</button></div></div><div class="home-hero-art"><img src="assets/art/${active.id}.webp" alt="${esc(active.name)}"><span>${esc(active.short)} · ${car ? `Estado ${num(car.condition, 1)}/100` : "Vehículo de carrera"}</span></div></section>
  <section class="home-summary"><article class="panel"><span class="eyebrow">PRESUPUESTO DISPONIBLE</span><strong>${num(t.budget)} <small>cr</small></strong><p>${t.debt ? `${num(t.debt)} cr de deuda pendiente` : "Sin deuda pendiente"}</p></article><article class="panel"><span class="eyebrow">DISTANCIA ACUMULADA</span><strong>${num(progress.km)} <small>km</small></strong><p>${progress.stages} ${progress.stages === 1 ? "etapa completada" : "etapas completadas"}</p></article><article class="panel"><span class="eyebrow">TRABAJO EN EL TALLER</span><strong>${jobs.length} <small>${jobs.length === 1 ? "trabajo" : "trabajos"}</small></strong><p>${t.mechanics.filter((m) => m.assignment === "workshop").length} ${t.mechanics.filter((m) => m.assignment === "workshop").length === 1 ? "mecánico" : "mecánicos"} en la base · ${t.garage.length}/3 autos</p></article></section>
  <div class="home-lower"><section class="panel home-race"><span class="eyebrow">CARRERA ACTUAL / ${esc(PHASES[t.phase])}</span><h2>${esc(route.name)}</h2><p>Etapa ${Math.min(t.stageIndex + 1, 15)} de 15 · ${num(t.totalKm)} / ${num(route.totalKm)} km</p>${conditionBar((t.totalKm / route.totalKm) * 100)}<div class="button-row"><button class="button primary" data-action="tab" data-tab="race">Ver carrera</button><button class="button ghost" data-action="tab" data-tab="camp">Preparar etapa</button><button class="button ghost" data-action="tab" data-tab="journal">Leer bitácora</button></div><p class="small-note">${state.clock < 0 ? "La largada está programada. Aprovechá la previa para guardar tus planes." : t.phase === "camp" ? "Revisá tu plan: el equipo puede estar esperando instrucciones para seguir." : t.phase === "finished" ? "Terminaste esta carrera. El calendario muestra los premios y resultados." : "El reloj de la carrera también hace avanzar los trabajos del taller."}</p></section>
  <section class="panel"><span class="eyebrow">HITOS DE TU EQUIPO</span><h2>Cada kilómetro cuenta.</h2><div class="home-milestones">${milestones.map((m) => `<article class="${m.value >= m.goal ? "achieved" : ""}"><span class="milestone-icon">${m.value >= m.goal ? "✓" : "◇"}</span><div><strong>${m.name}</strong><p>${m.detail}</p>${conditionBar(Math.min(100, (m.value / m.goal) * 100))}</div><small>${num(Math.min(m.value, m.goal))} / ${num(m.goal)}</small></article>`).join("")}</div><p class="small-note">Hitos de seguimiento. Esta pantalla no acredita premios adicionales.</p></section></div>`;
}
