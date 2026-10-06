import { raceLogo } from "./race-logos.js";
import { esc } from "./visuals.js";
import { raceTimeline, dateLabel, remainingLabel } from "./enrollment-ui.js";
import { routeFor } from "./route.js";
import { PART_TYPES } from "./catalog.js";
import { partName } from "./part-brands.js";
import { TUNINGS, defaultTunings, PREPARATION_MS } from "./race-tuning.js";
const drafts = new Map(),
  num = (n) => Math.round(n).toLocaleString("es-AR");
const pool = (t) => [...Object.values(t.parts), ...t.inventory];
function blocked(s, e) {
  const others = s.online.reservations.filter(
    (r) =>
      r.eventId !== e.eventId &&
      r.start < e.end &&
      Math.max(s.online.at, e.start - PREPARATION_MS) < r.end,
  );
  return new Set(
    others.flatMap((r) => [
      r.carId,
      ...r.driverIds,
      ...r.mechanicIds,
      ...(r.reservedPartIds || [...Object.values(r.partIds), ...r.spareIds]),
    ]),
  );
}
function draft(s, e) {
  const t = s.online.baseTeam,
    busy = blocked(s, e),
    registered = s.online.reservations.find((r) => r.eventId === e.eventId);
  if (!drafts.has(e.eventId)) {
    const car = t.garage.find(
      (c) =>
        !busy.has(c.id) && !t.workshop.jobs.some((j) => j.targetId === c.id),
    );
    const partIds = Object.fromEntries(
      PART_TYPES.map((type) => [
        type.id,
        pool(t).find(
          (p) =>
            !busy.has(p.id) &&
            !t.workshop.jobs.some((j) => j.targetId === p.id) &&
            p.type === type.id &&
            (car?.kitIds?.[type.id]
              ? p.id === car.kitIds[type.id]
              : t.parts[type.id]?.id === p.id),
        )?.id ||
          pool(t).find(
            (p) =>
              p.type === type.id &&
              !busy.has(p.id) &&
              !t.workshop.jobs.some((j) => j.targetId === p.id),
          )?.id ||
          "",
      ]),
    );
    drafts.set(
      e.eventId,
      registered
        ? {
            tunings: { ...(registered.tunings || defaultTunings()) },
            carId: registered.carId,
            driverIds: [...registered.driverIds],
            mechanicIds: [...registered.mechanicIds],
            partIds: { ...registered.partIds },
            spareIds: [...registered.spareIds],
          }
        : {
            tunings: defaultTunings(),
            carId: car?.id || "",
            driverIds: t.drivers
              .filter((d) => !busy.has(d.id))
              .slice(0, e.kind === "short" ? 1 : 2)
              .map((d) => d.id),
            mechanicIds: t.mechanics
              .filter((m) => !busy.has(m.id))
              .slice(0, 1)
              .map((m) => m.id),
            partIds,
            spareIds: [],
          },
    );
  }
  return drafts.get(e.eventId);
}
export function clearEnrollmentDraft() {
  drafts.clear();
}
export function allocationCommand(s, id, type) {
  const e = s.online.events.find((e) => e.eventId === id);
  return { type, eventId: id, ...structuredClone(draft(s, e)) };
}
export function updateAllocation(s, el) {
  const id = el.dataset.allocationEvent;
  if (!id) return false;
  const e = s.online.events.find((e) => e.eventId === id),
    d = draft(s, e),
    field = el.dataset.allocationField;
  if (field === "carId") {
    d.carId = el.value;
    const car = s.online.baseTeam.garage.find((c) => c.id === el.value),
      busy = blocked(s, e);
    for (const [type, piece] of Object.entries(car?.kitIds || {}))
      if (
        !busy.has(piece) &&
        pool(s.online.baseTeam).some((p) => p.id === piece)
      )
        d.partIds[type] = piece;
  } else if (field === "tunings")
    d.tunings[el.dataset.partType] = Number(el.value);
  else if (field === "partIds") d.partIds[el.dataset.partType] = el.value;
  else if (field === "driverId")
    d.driverIds = [el.value, ...d.driverIds.filter((id) => id !== el.value)];
  else {
    d[field] = d[field].filter((id) => id !== el.value);
    if (el.checked) d[field].push(el.value);
  }
  d.spareIds = d.spareIds.filter(
    (id) => !Object.values(d.partIds).includes(id),
  );
  return true;
}
function reason(s, e, d, busy) {
  const t = s.online.baseTeam,
    short = e.kind === "short";
  if (!t.garage.some((c) => c.id === d.carId))
    return "Necesitás un auto disponible.";
  if (!d.driverIds.length || d.driverIds.length > (short ? 1 : 3))
    return short
      ? "Seleccioná exactamente un piloto."
      : "Seleccioná entre 1 y 3 pilotos.";
  if (!d.mechanicIds.length || d.mechanicIds.length > (short ? 1 : 4))
    return short
      ? "Seleccioná exactamente un mecánico."
      : "Seleccioná entre 1 y 4 mecánicos.";
  if (
    !PART_TYPES.every((type) =>
      pool(t).some((p) => p.type === type.id && p.id === d.partIds[type.id]),
    )
  )
    return "Completá las seis piezas del kit.";
  const ids = [
    d.carId,
    ...d.driverIds,
    ...d.mechanicIds,
    ...Object.values(d.partIds),
    ...d.spareIds,
  ];
  if (ids.some((id) => busy.has(id)))
    return "Hay recursos reservados en otra carrera que se superpone.";
  if (ids.some((id) => t.workshop.jobs.some((j) => j.targetId === id)))
    return "Completá o cancelá el trabajo pendiente de los recursos elegidos.";
  if (
    d.driverIds.some((id) => !t.drivers.some((d) => d.id === id)) ||
    d.mechanicIds.some((id) => !t.mechanics.some((m) => m.id === id))
  )
    return "Revisá el personal: un contrato dejó de estar disponible.";
  if (t.budget < 1500) return "Reservá 1.500 cr para combustible.";
  return "";
}
export function onlineEnrollmentPage(s) {
  const t = s.online.baseTeam,
    now = s.online.at;
  return `<div class="page-title"><div><span class="eyebrow">INSCRIPCIONES · RECURSOS POR CARRERA</span><h1>Dos experiencias. Tu misma escudería.</h1><p>Raids de 15 etapas y hasta 8 días; sprints cada 48 horas, de hasta 4 horas. Podés competir simultáneamente con autos, personal y piezas diferentes.</p></div><span class="badge">${num(t.budget)} cr</span></div>${raceTimeline(s)}<p class="notice">Cada recurso queda reservado desde el inicio de la puesta a punto (5 horas antes de largar, o desde la inscripción tardía) hasta el límite máximo publicado, aunque la carrera cierre antes. Los recursos sin asignar permanecen en la base. No se crean piezas ni empleados al inscribirse.</p><div class="enrollment-grid">${s.online.events
    .filter((e) => e.end > now)
    .map((e) => {
      const registered = s.online.reservations.find(
          (r) => r.eventId === e.eventId,
        ),
        d = draft(s, e),
        busy = blocked(s, e),
        closed = e.start <= now || registered?.preparationStart <= now,
        why =
          !registered &&
          Math.max(now, e.start - PREPARATION_MS) + PREPARATION_MS >= e.end
            ? "No quedan cinco horas para preparar el auto y salir antes del cierre."
            : reason(s, e, d, busy),
        route = routeFor(e.id);
      const attrs = (field) =>
        `data-allocation-event="${e.eventId}" data-allocation-field="${field}"`;
      const unavailable = (id) =>
        busy.has(id) || t.workshop.jobs.some((j) => j.targetId === id);
      const personList = (field, list) =>
        list
          .map(
            (p) =>
              `<label class="allocation-choice"><input type="checkbox" ${attrs(field)} value="${esc(p.id)}" ${d[field].includes(p.id) ? "checked" : ""} ${closed || busy.has(p.id) ? "disabled" : ""}><span>${esc(p.name)}<small>${busy.has(p.id) ? "Reservado en otra carrera" : field === "driverIds" ? `${num(p.energy)}% de energía` : `Eficiencia ${p.efficiency.toFixed(2)}×`}</small></span></label>`,
          )
          .join("");
      return `<article class="panel enrollment-card ${registered ? "enrolled" : ""}">${raceLogo(e)}<span class="eyebrow">${esc(e.region)} · ${e.kind === "short" ? "SPRINT" : "RAID"}</span><h2>${esc(e.name)}</h2><p>${num(route.totalKm)} km · ${route.stages.length} ${route.stages.length === 1 ? "etapa" : "etapas"} · hasta ${e.maxHours} h</p><dl><div><dt>Largada</dt><dd>${dateLabel(e.start)}</dd></div><div><dt>Fin de reserva</dt><dd>${dateLabel(e.end)}</dd></div><div><dt>Premio P1</dt><dd>${num((e.kind === "short" ? s.management.catalog.prizes[0].short : s.management.catalog.prizes[0].race) * e.prizeFactor)} cr</dd></div></dl>${registered?.readyAt ? `<p class="notice preparation-notice"><strong>${now < registered.preparationStart ? "Puesta a punto programada" : now < registered.readyAt ? "Puesta a punto en curso" : "Preparación completada"}</strong><br>Inicio: ${dateLabel(registered.preparationStart)}<br>Listo para salir: ${dateLabel(registered.readyAt)}${now < registered.readyAt ? `<br>Faltan ${remainingLabel(registered.readyAt - now)}` : ""}<br>Reglajes fijos desde el inicio de la preparación.</p>` : ""}<button class="button small ghost" data-action="view-event" data-id="${e.eventId}">Ver y preparar esta carrera</button>${closed ? `<p class="notice">${registered ? "Inscripto · " + (registered.status === "closed" ? "Carrera cerrada; reserva vigente hasta el límite." : e.start > now ? "Preparación iniciada; equipo y reglajes bloqueados." : "Equipo asignado en carrera.") : "La inscripción cerró al largar."}</p>` : ""}<p class="assignment-summary"><strong>${esc(s.management.catalog.vehicles.find((v) => v.id === t.garage.find((c) => c.id === d.carId)?.modelId)?.name || "Sin auto")}</strong><br>${d.driverIds.map((id) => esc(t.drivers.find((p) => p.id === id)?.name || "Piloto no disponible")).join(" + ")}<br>${d.mechanicIds.length} mecánico${d.mechanicIds.length === 1 ? "" : "s"} · ${Object.values(d.partIds).filter(Boolean).length}/6 piezas · ${d.spareIds.length} repuestos</p><details data-preserve-open id="allocation-${e.eventId}" ${registered ? "open" : ""}><summary>${registered ? "Equipo reservado" : "Asignar auto, personal y piezas"}</summary><div class="race-allocation"><label>Auto<select ${attrs("carId")} ${closed ? "disabled" : ""}><option value="">Seleccionar</option>${t.garage.map((c) => `<option value="${c.id}" ${c.id === d.carId ? "selected" : ""} ${unavailable(c.id) ? "disabled" : ""}>${esc(s.management.catalog.vehicles.find((v) => v.id === c.modelId)?.name || c.modelId)} · ${num(c.condition)}%${unavailable(c.id) ? " · No disponible" : ""}</option>`).join("")}</select></label><fieldset><legend>Pilotos · ${e.kind === "short" ? "exactamente 1" : "1 a 3; podés enviar 2 y reservar el tercero"}</legend>${personList("driverIds", t.drivers)}</fieldset>${d.driverIds.length > 1 ? `<label>Piloto de largada<select ${attrs("driverId")} ${closed ? "disabled" : ""}>${d.driverIds.map((id) => `<option value="${id}">${esc(t.drivers.find((p) => p.id === id)?.name || id)}</option>`).join("")}</select></label>` : ""}<fieldset><legend>Mecánicos · ${e.kind === "short" ? "exactamente 1" : "1 a 4"}</legend>${personList("mechanicIds", t.mechanics)}</fieldset><fieldset><legend>Kit instalado · una pieza de cada tipo</legend>${PART_TYPES.map(
        (type) =>
          `<label>${esc(type.name)}<select ${attrs("partIds")} data-part-type="${type.id}" ${closed ? "disabled" : ""}><option value="">Seleccionar</option>${pool(
            t,
          )
            .filter((p) => p.type === type.id)
            .map(
              (p) =>
                `<option value="${p.id}" ${d.partIds[type.id] === p.id ? "selected" : ""} ${unavailable(p.id) ? "disabled" : ""}>${esc(partName(p))} · ${num(p.condition)}% · ${p.id.split("-").at(-1)}${unavailable(p.id) ? " · Reservada / taller" : ""}</option>`,
            )
            .join("")}</select></label>`,
      ).join(
        "",
      )}</fieldset><fieldset><legend>Repuestos del lote · opcionales</legend>${
        pool(t)
          .filter((p) => !Object.values(d.partIds).includes(p.id))
          .map(
            (p) =>
              `<label class="allocation-choice"><input type="checkbox" ${attrs("spareIds")} value="${p.id}" ${d.spareIds.includes(p.id) ? "checked" : ""} ${closed || unavailable(p.id) ? "disabled" : ""}><span>${esc(PART_TYPES.find((type) => type.id === p.type)?.short)} · ${esc(partName(p))} · ${num(p.condition)}%${unavailable(p.id) ? "<small>Reservada / en taller</small>" : ""}</span></label>`,
          )
          .join("") || "<small>No quedan piezas adicionales.</small>"
      }</fieldset><fieldset class="race-tunings"><legend>Reglajes · una vez para toda la carrera</legend><p class="small-note">Estudiá las superficies y el clima. Cada carrera tiene un óptimo oculto; el efecto conjunto sobre el rendimiento va de −30% a +30%, respetando los límites de velocidad de cada sector. El centro no garantiza un efecto neutro.</p>${TUNINGS.map((type) => `<label class="race-tuning"><span><strong>${type.name}</strong><output>${d.tunings[type.id]}</output>/100</span><input type="range" min="0" max="100" step="1" value="${d.tunings[type.id]}" aria-label="Reglaje de ${type.name}" ${attrs("tunings")} data-part-type="${type.id}" ${closed ? "disabled" : ""}><small><span>${type.left}</span><span>${type.right}</span></small></label>`).join("")}</fieldset><p class="small-note">${e.kind === "short" ? "Un piloto y un mecánico; sin cambios, paradas ni reparaciones durante el sprint." : "Solo los pilotos enviados pueden alternarse en las etapas. El personal restante descansa y los mecánicos libres pueden trabajar en la base."}</p></div></details>${!closed ? `<button class="button primary full" data-action="${registered ? "configure-enrollment" : "enroll"}" data-id="${e.eventId}" ${why ? "disabled" : ""}>${registered ? "Guardar asignación" : "Inscribirme con este equipo"}</button>${registered ? `<button class="button ghost full" data-action="cancel-enrollment" data-id="${e.eventId}">Cancelar inscripción</button>` : ""}<small class="enrollment-reason">${esc(why) || `${registered ? "Inscripción confirmada" : "Recursos disponibles"} · 5 h de preparación inicial · largada oficial en ${remainingLabel(e.start - now)}`}</small>` : ""}${registered && closed && now < e.start ? `<button class="button ghost full" data-action="cancel-enrollment" data-id="${e.eventId}">Cancelar inscripción</button>` : ""}</article>`;
    })
    .join("")}</div>${history(s)}`;
}

function history(s) {
  return `<section class="panel race-history"><span class="eyebrow">RESULTADOS POR CARRERA</span><h2>Tu historial reciente</h2>${
    s.competition.results
      .slice()
      .reverse()
      .map((r) => {
        const entry = r.entries.find((e) => e.id === "player");
        return entry
          ? `<p><strong>${esc(s.management.catalog.races.find((e) => e.id === r.routeId)?.name || r.routeId)}</strong> · ${dateLabel(r.closedAt)} · P${entry.position} · ${entry.finished ? "Meta completada" : num(entry.km) + " km al cierre"} · ${num(entry.prize)} cr</p>`
          : "";
      })
      .join("") || "<p>Todavía no hay resultados para tu escudería.</p>"
  }</section>`;
}
