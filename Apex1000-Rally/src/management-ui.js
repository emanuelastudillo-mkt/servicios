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
  return `<section class="panel identity-panel"><div class="identity-preview">${shieldSVG(p.shieldId)}<div><span class="eyebrow">IDENTIDAD DEL EQUIPO</span><h2>${esc(p.name)}</h2><p>Hasta 3 pilotos y 5 mecánicos. Los contratos se conservan entre carreras.</p></div></div><label>Nombre del equipo<input id="team-name" maxlength="40" value="${esc(p.name)}"></label>${button("rename-team", "Guardar nombre")}<details><summary>Elegir escudo · ${p.shieldId} / 100</summary><div class="shield-grid">${Array.from({ length: 100 }, (_, i) => `<button class="shield-option ${p.shieldId === i + 1 ? "selected" : ""}" data-action="choose-shield" data-id="${i + 1}" aria-label="Elegir escudo ${i + 1}" aria-pressed="${p.shieldId === i + 1}">${shieldSVG(i + 1)}<small>${String(i + 1).padStart(3, "0")}</small></button>`).join("")}</div></details></section>`;
}
export { enrollmentPage as championshipPage } from "./enrollment-ui.js";
export { vehicleShop as garagePanel } from "./workshop-ui.js";

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
  return `<section class="panel"><div class="panel-heading"><div><span class="eyebrow">CONTRATOS / ${p.mechanics.length} DE 5 MECÁNICOS</span><h2>Más capacidad de asistencia.</h2></div><span class="badge">Trabajo ${((1 / workshopRate(p)) * 100).toFixed(0)}% del tiempo base</span></div><p>Sólo los mecánicos asignados a carrera intervienen en estas asistencias. El descanso del piloto conserva su propia duración.</p><div class="staff-grid">${p.mechanics.map((m) => `<article class="mechanic-card"><img src="${m.image}" class="portrait" alt="${esc(m.name)}"><h3>${esc(m.name)}</h3><p>${m.assignment === "workshop" ? "Taller" : "Carrera"} · ${money(m.salary)} cr / carrera · eficiencia ${m.efficiency.toFixed(2)}×</p>${button("release", "Liberar contrato", `data-kind="mechanic" data-id="${m.id}" ${["racing", "service"].includes(p.phase) ? "disabled" : ""}`)}</article>`).join("")}</div>${button("tab", "Buscar contrataciones", 'data-tab="market"')}</section>`;
}
