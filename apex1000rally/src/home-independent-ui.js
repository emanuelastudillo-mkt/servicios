import { raceLogo } from "./race-logos.js";
import { esc, conditionBar } from "./visuals.js";
import { shieldSVG } from "./shields.js";
import { calendar, raceNow, currentEvent } from "./competition.js";
import { dateLabel, remainingLabel, raceTimeline } from "./enrollment-ui.js";
import { vehicle, PHASES } from "./catalog.js";
import { activeCar } from "./workshop.js";
import { routeFor } from "./route.js";
import { teamLevel } from "./progression.js";
const num = (n) => Math.round(n).toLocaleString("es-AR");
export function levelPanel(t) {
  const p = teamLevel(t),
    result = t.progression?.lastResult;
  return `<section class="panel team-level"><div><span class="eyebrow">NIVEL DE ESCUDERÍA</span><h2>Nivel ${p.level}</h2><p>${num(p.xp)} XP · ${num(Math.max(0, p.next - p.xp))} XP para el siguiente nivel</p>${conditionBar(p.progress * 100)}</div><p class="small-note">Cada nivel exige más experiencia. Buenos resultados suman; posiciones bajas y pruebas incompletas pueden restar. Tras 72 h sin participar, la experiencia decae un 1% diario. Una carrera en curso protege de la inactividad.${result ? ` Último resultado: ${result.change >= 0 ? "+" : ""}${num(result.change)} XP.` : ""}</p></section>`;
}
export function homeProgress(s) {
  const t = s.teams.find((t) => t.id === "player");
  const past = s.competition.results
    .filter((r) => r.eventId !== s.competition.currentId)
    .map((r) => ({ r, e: r.entries.find((e) => e.id === "player") }))
    .filter((x) => x.e);
  return {
    finishes:
      past.filter((x) => x.e.finished).length + (t.finishTime !== null ? 1 : 0),
    stages:
      past.reduce(
        (n, x) =>
          n +
          (x.e.stages ??
            (x.e.finished ? routeFor(x.r.routeId).stages.length : 0)),
        0,
      ) + t.history.length,
    km: past.reduce((n, x) => n + x.e.km, 0) + t.totalKm,
  };
}
export function homePage(s) {
  const t = s.teams.find((t) => t.id === "player"),
    now = raceNow(s),
    c = s.competition,
    progress = homeProgress(s),
    car = activeCar(t),
    route = routeFor(s);
  const next = calendar(s, now, now + 60 * 86400000).find((e) => e.start > now),
    registered =
      next && c.registrations.some((r) => r.eventId === next.eventId);
  const milestones = [
    ["Primera etapa", progress.stages, 1],
    ["Primera meta", progress.finishes, 1],
    ["10.000 km de camino", progress.km, 10000],
    ["Ocho llegadas", progress.finishes, 8],
  ];
  return `<div class="page-title home-heading"><div><span class="eyebrow">CENTRAL DE LA ESCUDERÍA</span><h1>Tu próxima aventura.</h1><p>Sprints de hasta cuatro horas y expediciones de varios días.</p></div><div class="home-identity">${shieldSVG(t.shieldId)}<strong>${esc(t.name)}</strong><span class="director-label">Director · @${esc(t.directorName)}</span></div></div>${raceTimeline(s)}<section class="home-hero panel"><div class="home-hero-copy"><span class="eyebrow">PRÓXIMA LARGADA · ${registered ? "INSCRIPTO" : "INSCRIPCIÓN ABIERTA"}</span><div class="race-heading">${raceLogo(next, "hero")}<h2>${esc(next?.name || "Próximo desafío")}</h2></div><p>${next ? `${esc(next.region)} · ${num(routeFor(next.id).totalKm)} km · ${next.kind === "short" ? "Un piloto, sin paradas" : "Campamentos y estrategia"}` : ""}</p><div class="home-countdown"><strong>${next ? remainingLabel(next.start - now) : "—"}</strong><span>${next ? dateLabel(next.start) : ""}</span></div><div class="button-row"><button class="button primary" data-action="tab" data-tab="championship">${registered ? "Ver inscripción" : "Inscribirme en una carrera"}</button><button class="button ghost" data-action="tab" data-tab="workshop">Ir al taller</button></div></div><div class="home-hero-art">${car ? `<img src="assets/art/${car.modelId}.webp" alt="${esc(vehicle(car.modelId).name)}"><span>${esc(vehicle(car.modelId).short)} · Estado ${num(car.condition)}/100</span>` : '<p class="garage-empty">Sin auto seleccionado. Comprá uno en el mercado para volver a competir.</p>'}</div></section><section class="home-summary"><article class="panel"><span class="eyebrow">PRESUPUESTO DISPONIBLE</span><strong>${num(t.budget)} <small>cr</small></strong><p>${t.debt ? `${num(t.debt)} cr de deuda` : "Sin deuda pendiente"}</p></article><article class="panel"><span class="eyebrow">DISTANCIA ACUMULADA</span><strong>${num(progress.km)} <small>km</small></strong><p>${progress.stages} etapas completadas</p></article><article class="panel"><span class="eyebrow">TALLER</span><strong>${t.workshop.jobs.length} <small>trabajos</small></strong><p>${t.mechanics.filter((m) => m.assignment === "workshop").length} mecánicos en la base · ${t.garage.length}/3 autos</p></article></section><div class="home-lower"><section class="panel home-race"><span class="eyebrow">${esc(PHASES[t.phase])}</span><div class="race-heading">${raceLogo(currentEvent(s))}<h2>${esc(currentEvent(s).name)}</h2></div><p>${t.participating ? `${num(t.totalKm)} / ${num(route.totalKm)} km · ${Math.min(t.stageIndex + 1, route.stages.length)} / ${route.stages.length} etapas` : "Sin inscripción, tus autos y pilotos siguen trabajando y descansando en la base."}</p>${t.participating ? conditionBar((t.totalKm / route.totalKm) * 100) : ""}<div class="button-row"><button class="button ghost" data-action="tab" data-tab="race">Ver carrera</button><button class="button ghost" data-action="tab" data-tab="journal">Leer bitácora</button></div><p class="small-note">${c.closed ? "Premios acreditados. Elegí tu próxima inscripción." : t.phase === "camp" ? "Guardá el plan de la próxima etapa para continuar." : "El reloj también hace avanzar el taller."}</p></section>${levelPanel(t)}<section class="panel"><span class="eyebrow">HITOS DEL EQUIPO</span><h2>Cada kilómetro cuenta.</h2><div class="home-milestones">${milestones.map(([name, value, goal]) => `<article class="${value >= goal ? "achieved" : ""}"><span class="milestone-icon">${value >= goal ? "✓" : "◇"}</span><div><strong>${name}</strong>${conditionBar(Math.min(100, (value / goal) * 100))}</div><small>${num(Math.min(value, goal))} / ${num(goal)}</small></article>`).join("")}</div><p class="small-note">Hitos informativos; sin premios adicionales.</p></section></div>`;
}
