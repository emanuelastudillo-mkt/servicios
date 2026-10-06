import { partSpec, partName } from "./part-brands.js";
import { esc, conditionBar } from "./visuals.js";
import { modelStats } from "./vehicle-stats.js";
import { vehicleStatsHTML } from "./vehicle-stats-ui.js";
import { vehicle, partType, GRADES } from "./catalog.js";
import {
  activeCar,
  workshopPieces,
  installedPiece,
  mechanicsAt,
  crewRate,
  jobFor,
  partReserved,
  jobQuote,
  canChangeCar,
  vehicleSaleValue,
  partSaleQuote,
} from "./workshop.js";
import { repairQuote, REPAIR_TIME_MULTIPLIER } from "./part-maintenance.js";
const num = (n, d = 0) =>
  Number(n).toLocaleString("es-AR", { maximumFractionDigits: d });
const button = (action, label, extra = "", disabled = false) =>
  `<button class="button small ghost" data-action="${action}" ${extra} ${disabled ? "disabled" : ""}>${label}</button>`;
const names = {
  condition: "Reparar estado",
  performance: "Mejorar performance",
  reliability: "Mejorar fiabilidad",
  part: "Reparar repuesto",
};
const workTitle = (t, j) =>
  j.kind === "part"
    ? `${partType(workshopPieces(t).find((p) => p.id === j.targetId)?.type || "engine").short} · reparación`
    : `${vehicle(t.garage.find((c) => c.id === j.targetId)?.modelId || t.vehicleId).short} · ${names[j.kind]}`;
const eta = (work, rate) =>
  rate > 0 ? `${num(work / rate, 1)} h` : "Pausado · sin mecánicos";

export function allocationPanel(state) {
  const t = state.teams.find((t) => t.id === "player"),
    race = mechanicsAt(t, "race"),
    base = mechanicsAt(t, "workshop");
  const locked = ["racing", "service"].includes(t.phase);
  return `<section class="panel allocation-panel"><div class="panel-heading"><div><span class="eyebrow">DISTRIBUCIÓN / ${t.mechanics.length} DE 5 MECÁNICOS</span><h2>Dos frentes. Un solo equipo.</h2></div>${button("tab", "Contratar mecánicos", 'data-tab="market"')}</div><div class="allocation-totals"><div><strong>${race.length}<small>/${state.mode === "online" ? 5 : 4}</small></strong><span>EN CARRERA · ${num(crewRate(t, "race"), 2)}× de trabajo</span></div><div><strong>${base.length}<small>/4</small></strong><span>EN EL TALLER · ${base.length ? `${num(crewRate(t, "workshop"), 2)}× de trabajo` : "TRABAJOS PAUSADOS"}</span></div></div><p class="small-note">Al menos 1 en carrera para participar. Sin inscripción, se permiten 0 en carrera. El taller puede quedar con 0: conserva el avance y espera personal. Más mecánicos reducen los tiempos; el descanso del piloto se calcula aparte. Cambiá la distribución cuando el equipo esté detenido, antes de salir a otra etapa.</p>${!race.length ? '<p class="notice">No hay mecánicos asignados a carrera. Reasigná uno o contratá personal antes de inscribirte.</p>' : ""}<div class="allocation-people">${t.mechanics.map((m) => `<article><img src="${m.image}" alt="${esc(m.name)}"><div><strong>${esc(m.name)}</strong><small>${num(m.salary)} cr / mes · eficiencia ${num(m.efficiency, 2)}×</small></div><label>Destino<select data-mechanic-assignment="${m.id}" aria-label="Destino de ${esc(m.name)}" ${locked || t.onlineActiveMechanicIds?.includes(m.id) ? "disabled" : ""}><option value="race" ${m.assignment === "race" ? "selected" : ""} ${m.assignment !== "race" && race.length >= 4 ? "disabled" : ""}>Carrera</option><option value="workshop" ${m.assignment === "workshop" ? "selected" : ""} ${m.assignment === "race" && ((race.length <= 1 && t.participating !== false && !["finished", "cutoff"].includes(t.phase)) || base.length >= 4) ? "disabled" : ""}>Taller</option></select></label></article>`).join("")}</div></section>`;
}
export function vehicleShop(state) {
  const t = state.teams.find((t) => t.id === "player"),
    m = state.management;
  return `<section><div class="panel-heading"><div><span class="eyebrow">VEHÍCULOS NUEVOS / ${t.garage.length} DE 3 PLAZAS OCUPADAS</span><h2>Elegí tu próxima máquina.</h2></div>${button("tab", "Ver mi taller", 'data-tab="workshop"')}</div><p class="small-note">Ordenados de menor a mayor precio. Todos salen con estado 100, performance 50 y fiabilidad 50. La compra incorpora un auto al taller; elegí cuál usar antes de largar. Podés tener varias unidades del mismo modelo.</p><div class="vehicle-grid">${[
    ...m.catalog.vehicles,
  ]
    .sort((a, b) => a.price - b.price)
    .map((v) => {
      const tradable = t.garage.filter(
        (c) => !jobFor(t, c.id) && (c.id !== t.activeCarId || canChangeCar(t)),
      );
      return `<article class="panel garage-card"><img class="catalog-art" src="${v.image}" alt="${esc(v.name)}" loading="lazy"><h3>${esc(v.name)}</h3><p>${vehicle(v.id).tag}</p>${vehicleStatsHTML(modelStats(v.id, m.catalog), v.id)}<div class="stock-line"><strong>${num(v.price)} cr</strong><span>${m.stocks[v.id]} nuevos disponibles</span></div>${button("purchase-car", "Comprar para el taller", `data-id="${v.id}"`, t.garage.length >= 3 || !v.available || m.stocks[v.id] < 1 || t.budget < v.price)}${tradable.length ? `<details class="trade-options"><summary>Entregar un auto como parte de pago</summary><label>Auto que vendés<select id="trade-${v.id}">${tradable.map((c) => `<option value="${c.id}">${vehicle(c.modelId).short} · ${num(c.condition)}% · ${num(vehicleSaleValue(state, c))} cr</option>`).join("")}</select></label>${button("quote-trade", "Calcular diferencia", `data-id="${v.id}"`, !v.available || m.stocks[v.id] < 1)}</details>` : ""}</article>`;
    })
    .join(
      "",
    )}</div><p class="small-note">La tasación considera el estado y las mejoras. Los vehículos vendidos son usados y no aumentan el stock de unidades nuevas. Las piezas instaladas forman un kit del equipo y pasan al auto elegido; el estado, performance y fiabilidad pertenecen a cada auto.</p></section>`;
}
export function workshopPage(state) {
  const t = state.teams.find((t) => t.id === "player"),
    rate = crewRate(t, "workshop"),
    w = t.workshop;
  return `<div class="page-title"><div><span class="eyebrow">BASE DE OPERACIONES / TALLER</span><h1>La próxima ventaja se construye acá.</h1><p>Hasta tres autos. Repará el desgaste y desarrollá performance y fiabilidad mientras el reloj sigue corriendo.</p></div><div class="budget-pill"><span>Disponible</span><strong>${num(t.budget)} <small>cr</small></strong></div></div>${allocationPanel(state)}
  <div class="panel-heading workshop-heading"><div><span class="eyebrow">TU GARAJE</span><h2>${t.garage.length} / 3 vehículos</h2></div>${button("tab", "Comprar o cambiar auto", 'data-tab="market"')}</div>${!t.garage.length ? '<p class="notice">No tenés autos. Comprá uno en Mercado para inscribirte.</p>' : ""}${w.legacyOverflow ? '<div class="inline-warning">Tu partida anterior tenía cuatro autos. Se conservaron todos: vendé uno para volver al límite de tres antes de comprar otro.</div>' : ""}<div class="workshop-cars">${t.garage
    .map((c) => {
      const selected = c.id === t.activeCarId,
        busy = jobFor(t, c.id),
        locked =
          t.onlineBusyCarIds?.includes(c.id) || (selected && !canChangeCar(t));
      return `<article class="panel workshop-car ${selected ? "selected" : ""}"><div class="workshop-car-image"><img src="assets/art/${c.modelId}.webp" alt="${esc(vehicle(c.modelId).name)}"><span class="badge">${selected ? "AUTO DE CARRERA" : "EN LA BASE"}</span></div><div class="workshop-car-copy"><span class="eyebrow">UNIDAD ${c.id.split("-").at(-1)} · ${num(c.odometer)} KM OBSERVADOS</span><h2>${esc(vehicle(c.modelId).short)}</h2>${vehicleStatsHTML(c.stats, c.modelId)}<div class="car-metrics">${["condition", "performance", "reliability"].map((k) => `<div><span>${{ condition: "Estado", performance: "Performance", reliability: "Fiabilidad" }[k]}</span><strong data-car-${k}="${c.id}">${num(c[k], 1)} <small>/100</small></strong>${conditionBar(c[k])}</div>`).join("")}</div><div class="car-work-options">${[
        "condition",
        "performance",
        "reliability",
      ]
        .map((k) => {
          const q = jobQuote(state, t, k, c.id);
          return `<div><span><strong>${names[k]}${k !== "condition" ? " · hasta 5 puntos" : ""}</strong><small>${q.needed ? `${num(q.cost)} cr · ${eta(q.workHours, rate)}` : "Máximo alcanzado"}</small></span>${
            k !== "condition"
              ? `<label>Puntos<select id="upgrade-${c.id}-${k}" data-upgrade-car="${c.id}" data-upgrade-kind="${k}" aria-label="Puntos de ${names[k]} para ${vehicle(c.modelId).short}" ${locked || busy ? "disabled" : ""}>${[
                  1, 2, 3, 4, 5,
                ]
                  .filter((n) => n <= 100 - c[k])
                  .map(
                    (n) =>
                      `<option value="${n}" ${n === Math.min(5, 100 - c[k]) ? "selected" : ""}>+${n}</option>`,
                  )
                  .join("")}</select></label>`
              : ""
          }${button("enqueue-work", "Programar", `data-kind="${k}" data-id="${c.id}"`, locked || !!busy || !q.needed || q.cost > t.budget)}</div>`;
        })
        .join(
          "",
        )}</div><p class="small-note">${locked ? "Auto reservado para una inscripción. Modificá o cancelá su asignación antes de venderlo o trabajar en él; al largar queda bloqueado hasta el fin del intervalo publicado." : busy ? "Trabajo reservado: completalo o cancelalo antes de usar o vender este auto." : "Las mejoras permiten elegir 1 a 5 puntos, hasta 100. Empiezan en 20 h de trabajo por punto y crecen exponencialmente. Los trabajos reservan presupuesto y se completan por orden, con todos los mecánicos de la base."}</p><div class="button-row">${button("select-car", selected ? "Seleccionado" : "Usar en carrera", `data-id="${c.id}"`, selected || !!busy || !canChangeCar(t))}${button("quote-sale", `Vender · ${num(vehicleSaleValue(state, c))} cr`, `data-id="${c.id}"`, locked || !!busy)}</div></div></article>`;
    })
    .join("")}</div>
  <section class="panel workshop-queue"><div class="panel-heading"><div><span class="eyebrow">TRABAJOS PROGRAMADOS / ${w.jobs.length} DE 8</span><h2>${rate ? "Una tarea a la vez, todo el equipo." : "El taller espera mecánicos."}</h2></div><span class="badge">${rate ? `${num(rate, 2)}× de trabajo` : "PAUSADO"}</span></div><div id="workshop-jobs">${jobsHTML(state)}</div><p class="small-note">El tiempo del juego mueve la cola, también durante una carrera y al volver en modo 1×. Cancelar devuelve la parte del costo que aún no se trabajó; el trabajo inconcluso no modifica el auto o la pieza.</p></section>
  <section class="panel workshop-inventory"><div class="panel-heading"><div><span class="eyebrow">RECUPERACIÓN DE REPUESTOS / ${workshopPieces(t).length} PIEZAS · LOTE E INSTALADAS</span><h2>El desgaste deja una historia.</h2></div>${button("tab", "Comprar repuestos", 'data-tab="market"')}</div><p class="small-note">“Original” empieza en 100 y baja tras cada reparación, en taller o campamento. Menos original significa más horas, mayor costo y menor estado recuperable en la siguiente reparación. Las piezas estándar irrompibles también se pueden reparar y se conservan como reserva. Vendé las demás por hasta el 5% de su precio nuevo, reducido por estado, original y averías. Al vender una instalada en la base se monta su reserva estándar automáticamente. Las instaladas se trabajan cuando el auto está en la base y bloquean la salida hasta completar el trabajo. Una pieza reservada en un plan debe liberarse antes de trabajarla acá.</p><div class="workshop-parts">${workshopPieces(
    t,
  )
    .map((p) => {
      const q = repairQuote(p, { timeMultiplier: REPAIR_TIME_MULTIPLIER }),
        busy = jobFor(t, p.id),
        reserved = partReserved(t, p.id),
        installed = !!installedPiece(t, p.id),
        locked =
          t.onlineBusyPartIds?.includes(p.id) ||
          (installed && !canChangeCar(t)),
        sale = partSaleQuote(state, p.id);
      return `<article><img src="${partSpec(p).image}" alt="${esc(partType(p.type).name)}" loading="lazy"><div><span class="eyebrow">${p.grade === "reserve" ? "Estándar irrompible" : esc(partName(p))}${installed ? " · INSTALADA" : " · EN EL LOTE"}${p.broken ? " · AVERIADA" : ""}</span><h3>${partType(p.type).short}</h3><p>Estado <b>${num(p.condition, 1)}</b> · Original <b>${num(p.original)}</b></p>${conditionBar(p.condition)}<small>Potencial de reparación: ${num(q.ceiling, 1)}% · ${num(q.cost)} cr<br>${eta(q.hours, rate)} · Original después: ${num(q.originalAfter)}</small><div class="part-actions">${button("enqueue-work", busy ? "En la cola" : locked ? "Reservada · no disponible" : reserved ? "Reservada en un plan" : q.needed ? "Reparar pieza" : "Sin reparación necesaria", `data-kind="part" data-id="${p.id}"`, !!busy || locked || reserved || !q.needed || q.cost > t.budget)}${button("quote-part-sale", p.grade === "reserve" ? "Reserva protegida" : `Vender · ${num(sale.value)} cr`, `data-id="${p.id}" title="${esc(sale.reason || "Ver tasación y confirmar venta")}"`, locked || !sale.allowed)}</div>${!sale.allowed && p.grade !== "reserve" ? `<small>${esc(sale.reason)}</small>` : ""}</div></article>`;
    })
    .join("")}</div></section>`;
}
export function jobsHTML(state) {
  const t = state.teams.find((t) => t.id === "player"),
    rate = crewRate(t, "workshop");
  let ahead = 0;
  return t.workshop.jobs.length
    ? t.workshop.jobs
        .map((j, i) => {
          ahead += j.workHours - j.worked;
          return `<article class="workshop-job"><span class="job-order">${String(i + 1).padStart(2, "0")}</span><div><strong>${esc(workTitle(t, j))}</strong><p>${num((j.worked / j.workHours) * 100, 1)}% · ${rate ? (i ? "En espera" : "En trabajo") : "Pausado"} · ${rate ? `Finaliza en ${eta(ahead, rate)}` : "Sin personal asignado"}</p>${conditionBar((j.worked / j.workHours) * 100)}</div>${button("cancel-work", "Cancelar", `data-id="${j.id}"`)}</article>`;
        })
        .join("")
    : '<p class="empty-workshop">No hay trabajos pendientes. Elegí un auto o una pieza para comenzar.</p>';
}
