import { esc, conditionBar } from "./visuals.js";
import { shieldSVG } from "./shields.js";
import {
  championshipStandings,
  seasonTime,
  workshopRate,
} from "./management.js";
import { routeFor } from "./route.js";
import { vehicle } from "./catalog.js";
const money = (n) => Math.round(n).toLocaleString("es-AR");
const button = (action, label, attrs = "") =>
  `<button class="button ghost small" data-action="${action}" ${attrs}>${label}</button>`;
export function identityPanel(s) {
  const p = s.teams.find((t) => t.id === "player");
  return `<section class="panel identity-panel"><div class="identity-preview">${shieldSVG(p.shieldId)}<div><span class="eyebrow">IDENTIDAD DEL EQUIPO</span><h2>${esc(p.name)}</h2><p>Hasta 3 pilotos y 5 mecánicos. Los contratos duran el campeonato.</p></div></div><label>Nombre del equipo<input id="team-name" maxlength="40" value="${esc(p.name)}"></label>${button("rename-team", "Guardar nombre")}<details><summary>Elegir escudo · ${p.shieldId} / 100</summary><div class="shield-grid">${Array.from({ length: 100 }, (_, i) => `<button class="shield-option ${p.shieldId === i + 1 ? "selected" : ""}" data-action="choose-shield" data-id="${i + 1}" aria-label="Elegir escudo ${i + 1}" aria-pressed="${p.shieldId === i + 1}">${shieldSVG(i + 1)}<small>${String(i + 1).padStart(3, "0")}</small></button>`).join("")}</div></details></section>`;
}
export function championshipPage(s) {
  const c = s.championship,
    cat = s.management.catalog,
    p = s.teams.find((t) => t.id === "player"),
    ready = s.teams.every((t) => t.phase === "finished");
  return `<div class="page-title"><div><span class="eyebrow">APEX WORLD RAID / TEMPORADA 01</span><h1>Ocho carreras. Un campeonato.</h1><p>La caja, los contratos y las piezas acompañan a tu equipo durante toda la temporada.</p></div><span class="badge">${c.paid ? "CAMPEONATO COMPLETO" : `CARRERA ${c.round + 1} / 8`}</span></div><section class="panel championship-summary"><div>${shieldSVG(p.shieldId)}<h2>${esc(p.name)}</h2><p>${money(p.budget)} cr disponibles · ${c.points.player} puntos</p></div><div><strong>${c.results.length} / 8</strong><span>carreras clasificadas</span></div><div><strong>${money([...p.drivers, ...p.mechanics].reduce((n, x) => n + x.salary, 0))} cr</strong><span>sueldos por carrera</span></div>${c.paid ? `<div class="notice">Premio final: ${money(c.final.find((x) => x.id === "player").net)} cr netos.</div>` : ""}</section><div class="championship-layout"><div class="race-calendar">${cat.races
    .map((r, i) => {
      const route = routeFor(r.id),
        done = c.results.find((x) => x.round === i);
      return `<article class="panel calendar-card ${i === c.round ? "current" : ""}"><span class="round-number">${String(i + 1).padStart(2, "0")}</span><div><span class="eyebrow">${esc(r.region)} · ${done ? "FINALIZADA" : i === c.round ? "EN CURSO" : "PROGRAMADA"}</span><h2>${esc(r.name)}</h2><p>${route.cities[0].name} → ${route.cities.at(-1).name}</p><small>${money(route.totalKm)} km · ${route.stages.length} etapas · ${new Date(Date.parse(c.startAt) + r.startDay * 86400000).toLocaleDateString("es-AR")}</small></div><div class="calendar-prize"><small>1.º puesto</small><strong>${money(cat.prizes[0].race * r.prizeFactor)} cr</strong>${done ? `<small>Tu resultado: P${done.entries.find((e) => e.id === "player").position}</small>` : ""}</div></article>`;
    })
    .join(
      "",
    )}</div><aside class="panel"><span class="eyebrow">CLASIFICACIÓN GENERAL</span><h2>La constancia suma.</h2><div class="table-scroll"><table><thead><tr><th>Pos.</th><th>Equipo</th><th>Pts</th><th>Premio final</th></tr></thead><tbody>${championshipStandings(
    s,
  )
    .map(
      (t, i) =>
        `<tr class="${t.id === "player" ? "player-row" : ""}"><td>${i + 1}</td><td>${esc(t.name)}</td><td>${c.points[t.id]}</td><td>${money(cat.prizes[i].championship)}</td></tr>`,
    )
    .join(
      "",
    )}</tbody></table></div><p class="small-note">Puntos por carrera: ${cat.prizes.map((p) => p.points).join(" / ")}. Empate: menor tiempo acumulado; después ID estable. Premios de campeonato al cerrar las 8 carreras. Sueldos al contratar y al iniciar cada carrera siguiente.</p><p class="small-note">Largadas fijas compartidas, separadas por al menos 21 días. Cada equipo avanza y descansa a su ritmo. Los kilómetros deportivos incluyen especiales ficticias.</p></aside></div>`;
}
export function garagePanel(s) {
  const t = s.teams.find((t) => t.id === "player"),
    m = s.management;
  return `<section><div class="panel-heading"><div><span class="eyebrow">VEHÍCULOS / STOCK DEL PROTOTIPO</span><h2>Tu próximo vehículo.</h2></div></div><div class="vehicle-grid">${m.catalog.vehicles.map((v) => `<article class="panel garage-card"><img class="catalog-art" src="${v.image}" alt="Ilustración de ${esc(v.name)}" loading="lazy"><h3>${esc(v.name)}</h3><p>${vehicle(v.id).tag}</p><div class="stock-line"><strong>${money(v.price)} cr</strong><span>${m.stocks[v.id]} disponibles</span></div>${button("buy-vehicle", v.id === t.vehicleId ? "Vehículo actual" : t.garage.includes(v.id) ? "Usar vehículo" : "Comprar y usar", `data-id="${v.id}" ${v.id === t.vehicleId || !["waiting", "finished"].includes(t.phase) || (!t.garage.includes(v.id) && (!v.available || m.stocks[v.id] < 1 || t.budget < v.price)) ? "disabled" : ""}`)}</article>`).join("")}</div><p class="small-note">Los cambios de vehículo se realizan antes de largar o entre carreras. Conservás los autos comprados y el lote de piezas universales del prototipo.</p></section>`;
}
export function staffMarket(s) {
  const m = s.management,
    t = s.teams.find((t) => t.id === "player"),
    now = seasonTime(s);
  return `<section class="staff-market"><div class="page-title"><div><span class="eyebrow">CONTRATACIONES / OFERTAS TEMPORIZADAS</span><h2>Un lugar en tu equipo.</h2><p>Se reserva el sueldo ofrecido. Al cierre gana la oferta mayor; en empate, la primera. Si perdés o cancelás, recuperás el dinero.</p></div></div>${[
    "driver",
    "mechanic",
  ]
    .map(
      (kind) =>
        `<h3>${kind === "driver" ? "Pilotos" : "Mecánicos"} disponibles</h3><div class="staff-grid">${(kind ===
        "driver"
          ? m.catalog.drivers
          : m.catalog.mechanics
        )
          .map((person) => {
            const owner = m.owners[person.id],
              a = m.auctions.find(
                (a) => a.personId === person.id && a.status === "open",
              ),
              best = a ? Math.max(...a.bids.map((b) => b.salary), 0) : 0,
              own = a?.bids.find((b) => b.teamId === "player");
            return `<article class="panel staff-card"><img src="${person.image}" alt="Retrato ficticio de ${esc(person.name)}" class="portrait" loading="lazy"><div class="staff-copy"><span class="eyebrow">${kind === "driver" ? { technical: "Técnica y piezas", fast: "Velocidad y riesgo", navigator: "Navegación y resistencia" }[person.profile] : `Eficiencia ${person.efficiency.toFixed(2)}×`}</span><h3>${esc(person.name)}</h3><p>${owner ? `Contrato: ${esc(s.teams.find((t) => t.id === owner)?.name || "Asignado")}` : !person.available ? "No disponible" : a ? `Cierra en ${Math.max(0, (a.closesAt - now) / 3600).toFixed(1)} h · mejor ${money(best)} cr` : "Sin ofertas · plazo de " + m.catalog.settings.find((x) => x.key === "auctionHours").value + " h"}</p><small>Mínimo ${money(person.salary)} cr por carrera</small>${!owner && person.available ? `<label>Sueldo por carrera<input type="number" id="bid-${person.id}" min="${person.salary}" step="100" value="${Math.max(person.salary, best + 100)}"></label>${button("bid", own ? "Mejorar mi oferta" : "Enviar oferta", `data-kind="${kind}" data-id="${person.id}"`)}${own ? button("cancel-bid", "Cancelar · devolver reserva", `data-id="${a.id}"`) : ""}` : ""}</div></article>`;
          })
          .join("")}</div>`,
    )
    .join(
      "",
    )}<details class="panel"><summary>Historial de contrataciones</summary>${
    m.auctions
      .filter((a) => a.status === "closed")
      .slice(-20)
      .reverse()
      .map(
        (a) =>
          `<p>${esc([...m.catalog.drivers, ...m.catalog.mechanics].find((p) => p.id === a.personId).name)} · ${a.winnerId ? esc(s.teams.find((t) => t.id === a.winnerId).name) : "Sin adjudicar"} · ${money(a.winningSalary)} cr</p>`,
      )
      .join("") || "<p>Todavía no hubo cierres.</p>"
  }</details><p class="small-note">Mercado local con ofertas de rivales simulados. En la versión online, el servidor asignará cada contrato de forma exclusiva.</p></section>`;
}
export function mechanicsPanel(s) {
  const p = s.teams.find((t) => t.id === "player");
  return `<section class="panel"><div class="panel-heading"><div><span class="eyebrow">TALLER / ${p.mechanics.length} DE 5 MECÁNICOS</span><h2>Más capacidad de asistencia.</h2></div><span class="badge">Trabajo ${((1 / workshopRate(p)) * 100).toFixed(0)}% del tiempo base</span></div><p>Los mecánicos reducen el tiempo de taller. El descanso del piloto conserva su propia duración.</p><div class="staff-grid">${p.mechanics.map((m) => `<article class="mechanic-card"><img src="${m.image}" class="portrait" alt="${esc(m.name)}"><h3>${esc(m.name)}</h3><p>${money(m.salary)} cr / carrera · eficiencia ${m.efficiency.toFixed(2)}×</p>${button("release", "Liberar contrato", `data-kind="mechanic" data-id="${m.id}" ${["racing", "service"].includes(p.phase) ? "disabled" : ""}`)}</article>`).join("")}</div>${button("tab", "Buscar contrataciones", 'data-tab="market"')}</section>`;
}
