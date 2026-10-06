import { raceLogo } from "./race-logos.js";
import { esc, conditionBar } from "./visuals.js";
import {
  calendar,
  currentEvent,
  raceNow,
  enrollmentReason,
  raceDeadline,
} from "./competition.js";
import { routeFor } from "./route.js";
const num = (n) => Math.round(n).toLocaleString("es-AR");
export const dateLabel = (n) =>
  new Date(n).toLocaleString("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
export function remainingLabel(ms) {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h ${m % 60}m`;
}
export function raceTimeline(s) {
  const now = raceNow(s),
    events = calendar(s, now - 15 * 86400000, now + 15 * 86400000);
  const active = currentEvent(s);
  const focus =
    events.find((e) => e.eventId === active?.eventId) ||
    events.filter((e) => e.start <= now).at(-1) ||
    events[0];
  return `<section class="panel race-timeline"><div class="panel-heading"><div><span class="eyebrow">CALENDARIO MENSUAL · 30 DÍAS</span><h2>${new Date(now).toLocaleDateString("es-AR", { month: "long", year: "numeric" })}</h2><p class="small-note">${dateLabel(now)} · Cada sprint larga cada 48 h. Deslizá para explorar.</p></div><button class="button small ghost" data-action="center-timeline">Centrar actual</button></div><div class="timeline-track" role="list" aria-label="Línea de tiempo de carreras">${events.map((e) => `<article role="listitem" class="timeline-event ${e.eventId === focus?.eventId ? "timeline-current" : ""}" ${e.eventId === focus?.eventId ? 'data-timeline-center="true"' : ""}><time>${dateLabel(e.start)}</time>${raceLogo(e, "compact")}<span class="timeline-dot"></span><span class="eyebrow">${e.kind === "short" ? "SPRINT · HASTA 4 H" : "RAID · VARIOS DÍAS"}</span><strong>${esc(e.name)}</strong><small>${s.competition.registrations.some((r) => r.eventId === e.eventId) ? "✓ Inscripto" : e.start > now ? "Próxima" : now < e.end ? "Intervalo en curso" : "Anterior"}</small></article>`).join("")}</div></section>`;
}
export function enrollmentPage(s) {
  const now = raceNow(s),
    c = s.competition,
    t = s.teams.find((t) => t.id === "player"),
    e = currentEvent(s);
  const events = calendar(s, now - 86400000, now + 60 * 86400000).filter(
    (e) => e.end > now,
  );
  const cutoff = Date.parse(s.startAt) + raceDeadline(s) * 1000;
  return `<div class="page-title"><div><span class="eyebrow">CARRERAS INDEPENDIENTES</span><h1>Inscripción</h1><p>Elegí una experiencia corta o un raid de varios días. Cada carrera entrega sus propios premios.</p></div><span class="badge">${num(t.budget)} cr</span></div>${raceTimeline(s)}<section class="panel enrollment-current"><span class="eyebrow">${c.closed ? "CARRERA CERRADA" : "PRUEBA EN EL VISOR"}</span>${raceLogo(e)}<h2>${esc(e.name)}</h2><p>${c.closed ? "Los resultados y premios ya son definitivos." : s.clock < 0 ? `Largada en ${remainingLabel(e.start - now)}.` : `Cierre como máximo en ${remainingLabel(cutoff - now)}${c.firstFinishAt !== null ? " · ventana de 24 h desde la primera llegada activada." : "."}`}</p><p>${t.participating ? "Tu escudería participa." : "Tu escudería está en la base. El tiempo avanza para el taller y el descanso."}</p></section><div class="enrollment-grid">${events
    .map((e) => {
      const registration = c.registrations.find((r) => r.eventId === e.eventId),
        registered = !!registration,
        reason = enrollmentReason(s, e),
        route = routeFor(e.id),
        prize = s.management.catalog.prizes[0];
      const salaries = Math.round(
        [...t.drivers, ...t.mechanics].reduce(
          (n, p) => n + (p.salary || 0),
          0,
        ) * (s.employment ? 1 : e.kind === "short" ? 0.2 : 1),
      );
      return `<article class="panel enrollment-card ${registered ? "enrolled" : ""}"><span class="eyebrow">${esc(e.region)} · ${e.kind === "short" ? "EXPERIENCIA CORTA" : "EXPEDICIÓN"}</span>${raceLogo(e)}<h2>${esc(e.name)}</h2><p>${num(route.totalKm)} km · ${route.stages.length} ${route.stages.length === 1 ? "etapa sin paradas" : "etapas con campamentos"}</p><dl><div><dt>Largada fija</dt><dd>${dateLabel(e.start)}</dd></div><div><dt>Límite máximo</dt><dd>${e.maxHours} h · hasta ${dateLabel(e.end)}</dd></div><div><dt>Premio P1</dt><dd>${num((e.kind === "short" ? prize.short : prize.race) * e.prizeFactor)} cr</dd></div><div><dt>${s.employment ? "Nómina mensual (día 1)" : "Sueldos estimados"}</dt><dd>${num(salaries)} cr${!s.employment && e.kind === "short" ? " (20%)" : ""}</dd></div></dl>${e.kind === "short" ? '<p class="small-note">Un piloto, sin reparaciones ni asistencia en ruta. Prepará el auto y el combustible antes de largar. Al llegar no se cambia el piloto.</p>' : '<p class="small-note">El cierre se adelanta si pasan 24 h desde la primera llegada. Prepará un plan por etapa.</p>'}${e.start > now ? `${registration ? `<p class="small-note">Auto reservado: ${esc(s.management.catalog.vehicles.find((v) => v.id === t.garage.find((car) => car.id === registration.carId)?.modelId)?.name || "No disponible")}</p>` : ""}<label>Piloto de largada<select id="enroll-driver-${e.eventId}" ${registered ? "disabled" : ""}>${t.drivers.map((d) => `<option value="${d.id}" ${d.id === (registration?.driverId || t.activeDriver) ? "selected" : ""}>${esc(d.name)} · ${num(d.energy)}%</option>`).join("")}</select></label><button class="button ${registered ? "ghost" : "primary"} full" data-action="${registered ? "cancel-enrollment" : "enroll"}" data-id="${e.eventId}" ${!registered && reason ? "disabled" : ""}>${registered ? "Cancelar inscripción" : "Inscribirme"}</button><small class="enrollment-reason">${registered ? "Intervalo máximo reservado, incluso si terminás antes." : esc(reason) || `Disponible · larga en ${remainingLabel(e.start - now)}`}</small>` : '<span class="badge">INSCRIPCIÓN CERRADA</span>'}</article>`;
    })
    .join(
      "",
    )}</div><section class="panel race-history"><span class="eyebrow">RESULTADOS POR CARRERA</span><h2>Tu historial</h2>${
    c.results.length
      ? c.results
          .slice()
          .reverse()
          .map((r) => {
            const entry = r.entries.find((e) => e.id === "player");
            return `<p><strong>${esc(s.management.catalog.races.find((e) => e.id === r.routeId)?.name || r.routeId)}</strong> · ${dateLabel(r.closedAt)} · ${entry ? `P${entry.position} · ${entry.finished ? "Meta completada" : `${num(entry.km)} km al cierre`} · ${num(entry.prize)} cr netos` : "No participaste"}</p>`;
          })
          .join("")
      : "<p>Todavía no hay carreras cerradas.</p>"
  }</section>`;
}
