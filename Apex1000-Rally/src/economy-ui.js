import { esc, conditionBar } from "./visuals.js";
import { shieldSVG } from "./shields.js";
import { teamLevel } from "./progression.js";
import { gameNow, gameDate, monthStart, renewalQuote } from "./employment.js";
import {
  traitList,
  traitLabel,
  traitDescription,
  staffDefaults,
  staffCondition,
} from "./staff.js";
const money = (n) => Math.round(n).toLocaleString("es-AR");
const player = (s) => s.teams.find((t) => t.id === "player");
export const dateBadge = (s) =>
  `<time id="game-date" class="game-date" datetime="${new Date(gameNow(s)).toISOString()}"><small>FECHA DEL JUEGO · ART</small><strong>${gameDate(gameNow(s))}</strong><span>${new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false }).format(gameNow(s))}</span></time>`;
export function traitsHTML(p, kind) {
  return `<div class="staff-traits">${
    traitList(p)
      .map(
        (id) =>
          `<div class="staff-trait" title="${esc(traitDescription(id, kind))}"><span>◆ ${esc(traitLabel(id))}</span><small>${esc(traitDescription(id, kind))}</small></div>`,
      )
      .join("") || "<small>Sin especialidad adicional.</small>"
  }</div>`;
}
function gauge(value) {
  return `<div class="morale-gauge" role="img" aria-label="Moral ${Math.round(value)} de 100"><div class="gauge-face"><i style="transform:rotate(${value * 1.8 - 90}deg)"></i><b>${Math.round(value)}</b></div><span>Baja</span><span>Alta</span></div>`;
}
export function staffPanel(s, kind) {
  const t = player(s),
    list = kind === "driver" ? t.drivers : t.mechanics,
    now = gameNow(s);
  return `<section class="personnel-section"><div class="panel-heading"><div><span class="eyebrow">PLANTEL / ${list.length} DE ${kind === "driver" ? 3 : 5}</span><h2>${kind === "driver" ? "Pilotos" : "Mecánicos"}</h2></div><button class="button ghost small" data-action="tab" data-tab="market">Buscar contrataciones</button></div>${!list.length ? `<div class="panel notice">No tenés ${kind === "driver" ? "pilotos" : "mecánicos"} contratados. Necesitás personal para volver a inscribirte.</div>` : ""}<div class="personnel-roster">${list
    .map((p) => {
      const c = p.contract,
        q = c ? renewalQuote(t, p) : null,
        expiring = c && c.expiresAt - now < 30 * 86400000;
      const attrs =
        kind === "driver"
          ? [
              ["Ritmo base", p.speed.toFixed(3) + "×"],
              ["Uso de piezas", p.parts.toFixed(3) + "×"],
              ["Riesgo base", p.risk.toFixed(2) + "×"],
              ["Energía", Math.round(p.energy) + "/100"],
              ["Forma", Math.round(p.form ?? 100) + "/100"],
              ["Recuperación", p.recovery.toFixed(1) + " pt/h"],
            ]
          : [
              ["Eficiencia base", p.efficiency.toFixed(2) + "×"],
              [
                "Trabajo efectivo",
                (p.efficiency * staffCondition(p)).toFixed(2) + "×",
              ],
              ["Destino", p.assignment === "workshop" ? "Taller" : "Carrera"],
              ["Forma", Math.round(p.form ?? 100) + "/100"],
            ];
      return `<article id="staff-card-${kind}-${p.id}" class="panel personnel-card"><aside class="personnel-identity"><div class="staff-photo"><img src="${p.image}" alt="Retrato ficticio de ${esc(p.name)}" loading="lazy"><span class="badge">${kind === "driver" && t.activeDriver === p.id && t.phase === "racing" ? "AL VOLANTE" : kind === "mechanic" ? (p.assignment === "workshop" ? "BASE / TALLER" : "ASISTENCIA") : "PILOTO"}</span></div><h2>${esc(p.name)}</h2><p>${p.age ?? staffDefaults(p, kind).age} años · ${esc(kind === "driver" ? p.role : "Mecánico de competición")}</p><div class="contract-heading">DETALLES DEL CONTRATO</div><dl class="contract-details"><div><dt>Sueldo mensual</dt><dd>${money(p.salary)} cr</dd></div>${c ? `<div><dt>Firmado</dt><dd>${gameDate(c.signedAt)}</dd></div><div class="${expiring ? "contract-warning" : ""}"><dt>Vence</dt><dd>${gameDate(c.expiresAt)}</dd></div><div><dt>Nivel al acordar</dt><dd>${c.levelAtSigning}</dd></div><div><dt>Renovaciones</dt><dd>${c.renewals}</dd></div>${c.pendingSalary !== null ? `<div><dt>Desde próximo cobro</dt><dd>${money(c.pendingSalary)} cr/mes</dd></div>` : ""}` : "<div><dt>Contrato</dt><dd>Partida clásica</dd></div>"}</dl>${c ? `<button class="button primary full" data-action="renew-preview" data-kind="${kind}" data-id="${p.id}">Renovar · +12 meses</button><small class="renewal-preview">Pedido: ${money(q.salary)} cr/mes · ${q.change >= 0 ? "+" : ""}${Math.round(q.change * 100)}%<br>Nivel ${q.delta >= 0 ? "+" : ""}${q.delta} desde el último acuerdo.</small>${c.expiresAt <= now ? '<p class="contract-warning">Contrato vencido. Conserva su puesto hasta terminar la carrera actual; todavía podés renovar.</p>' : ""}` : ""}<button class="text-button" data-action="release" data-kind="${kind}" data-id="${p.id}" ${["racing", "service"].includes(t.phase) ? "disabled" : ""}>Liberar contrato</button></aside><div class="personnel-main"><span class="eyebrow">ATRIBUTOS ${kind === "driver" ? "DEL PILOTO" : "DEL MECÁNICO"}</span><p class="small-note">Forma: preparación física. Moral: ánimo. La energía del piloto indica el cansancio inmediato.</p><div class="staff-attributes">${attrs.map(([label, value]) => `<div><small>${label}</small><strong>${esc(value)}</strong></div>`).join("")}</div><div class="staff-condition"><div><span class="eyebrow">FORMA</span><strong>${Math.round(p.form ?? 100)}/100</strong>${conditionBar(p.form ?? 100)}</div><div><span class="eyebrow">MORAL</span>${gauge(p.morale ?? 100)}</div></div><details id="staff-traits-${p.id}" data-preserve-open open><summary>Especialidades · ${traitList(p).length}</summary>${traitsHTML(p, kind)}</details><p class="small-note">${kind === "driver" ? "Las especialidades se aplican mientras conduce; los otros pilotos descansan." : "Sus especialidades se aplican en carrera si está asignado allí. Forma y moral afectan su ritmo de trabajo en ambas asignaciones."}</p></div></article>`;
    })
    .join("")}</div></section>`;
}
const category = (l) =>
  l.category ||
  (/Reserva|Oferta|oferta/.test(l.label)
    ? "offers"
    : /Sueldos|Contrato/.test(l.label)
      ? "staff"
      : /vehículo|Vehículo|Compra inicial/.test(l.label)
        ? "vehicles"
        : /Premio/.test(l.label)
          ? "prizes"
          : /Combustible|combustible|asistencia/.test(l.label)
            ? "fuel"
            : /Repuesto|repuesto|pieza|Reparación|reparación|Mejora|mejora|Taller|taller/.test(
                  l.label,
                )
              ? "parts"
              : /Admin|ADMIN/.test(l.label)
                ? "admin"
                : "other");
const groups = {
  drivers: "Sueldos · pilotos",
  mechanics: "Sueldos · mecánicos",
  base: "Base y taller",
  staff: "Contratos históricos",
  vehicles: "Vehículos",
  parts: "Repuestos, reparaciones y mejoras",
  fuel: "Combustible y asistencia",
  offers: "Reservas y devolución de ofertas",
  prizes: "Premios de carrera",
  admin: "Fondos del prototipo",
  other: "Otros movimientos",
};
function balanceChart(t) {
  let balance = t.initialBudget;
  const values = [balance];
  for (const l of t.ledger) {
    balance += l.amount;
    values.push(balance);
  }
  const sample = values.filter(
      (_, i) =>
        i === values.length - 1 ||
        i % Math.max(1, Math.ceil(values.length / 48)) === 0,
    ),
    lo = Math.min(0, ...sample),
    hi = Math.max(1, ...sample);
  const points = sample.map((v, i) => [
    20 + (i * 300) / Math.max(1, sample.length - 1),
    145 - ((v - lo) / (hi - lo)) * 125,
  ]);
  const line = points
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  return `<figure class="balance-chart"><figcaption>EVOLUCIÓN DEL SALDO</figcaption><svg viewBox="0 0 340 180" role="img" aria-label="Saldo después de cada movimiento registrado"><defs><linearGradient id="balance-fill" x1="0%" y1="0%" x2="0%" y2="100%"><stop stop-color="#73b879" stop-opacity=".65"/><stop offset="1" stop-color="#73b879" stop-opacity=".06"/></linearGradient></defs><path d="M20 20H320M20 82H320M20 145H320" stroke="#ffffff16"/><polygon points="20,145 ${line} 320,145" fill="url(#balance-fill)"/><polyline points="${line}" fill="none" stroke="#90cc87" stroke-width="2"/>${points.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2.5" fill="#c7edaf"/>`).join("")}<text x="20" y="172">Inicio</text><text x="265" y="172">Actual</text></svg><small>Por movimiento · ${money(lo)} a ${money(hi)} cr</small></figure>`;
}
export function financePage(s) {
  const t = player(s),
    e = s.employment,
    at = gameNow(s),
    since = monthStart(at),
    level = teamLevel(t).level;
  const rows = Object.entries(groups).map(([key, label]) => {
    const all = t.ledger.filter((l) => category(l) === key),
      monthly = all.filter((l) => l.at !== undefined && l.at >= since);
    return {
      key,
      label,
      month: monthly.reduce((n, l) => n + l.amount, 0),
      total: all.reduce((n, l) => n + l.amount, 0),
    };
  });
  const salary = [...t.drivers, ...t.mechanics].reduce(
      (a, p) => a + (p.contract?.pendingSalary ?? p.salary),
      0,
    ),
    base =
      s.management.catalog.settings.find((x) => x.key === "monthlyBaseCost")
        ?.value ?? 1500,
    monthly = salary + base;
  const income = t.ledger
      .filter((l) => l.amount > 0 && category(l) === "prizes")
      .reduce((n, l) => n + l.amount, 0),
    bills = t.finance?.bills || [],
    last = bills.at(-1),
    danger = t.debt > 0 || t.budget < monthly;
  return `<div class="page-title"><div><span class="eyebrow">GESTIÓN / FLUJO DE CAPITAL</span><h1>Finanzas</h1><p>Sueldos y gastos fijos el día 1. Compras, combustible y reparaciones al realizarlos.</p></div>${dateBadge(s).replace('id="game-date"', 'id="finance-date"')}</div><div class="economy-layout"><aside class="panel economy-summary"><div class="finance-team">${shieldSVG(t.shieldId)}<h2>${esc(t.name)}</h2><span class="badge">NIVEL ${level}</span></div><div class="economy-health ${danger ? "contract-warning" : ""}"><span class="eyebrow">LIQUIDEZ</span><strong>${t.debt ? "Deuda pendiente" : t.budget < monthly ? "Saldo insuficiente para un mes" : "Pagos bajo control"}</strong><p>${monthly ? Math.floor(t.budget / monthly) + " meses de costos fijos cubiertos al ritmo actual." : "Sin costos fijos."}</p></div><dl class="contract-details"><div><dt>Nómina mensual</dt><dd>${money(salary)} cr</dd></div><div><dt>Base / taller</dt><dd>${money(base)} cr</dd></div><div><dt>Deuda</dt><dd>${money(t.debt)} cr</dd></div><div><dt>Próximo cobro</dt><dd>${e ? gameDate(e.nextPayrollAt) : "Reglas clásicas"}</dd></div></dl>${balanceChart(t)}<button class="button ghost full" data-action="tab" data-tab="crew">Revisar contratos</button></aside><section class="panel economy-detail"><div class="economy-headline"><div><small>PRESUPUESTO DISPONIBLE</small><strong>${money(t.budget)} <em>cr</em></strong></div><div><small>PREMIOS COBRADOS</small><strong>+${money(income)} <em>cr</em></strong></div></div><div class="payroll-banner"><span>Próxima liquidación · ${e ? gameDate(e.nextPayrollAt) : "por carrera"}</span><strong>${money(monthly)} cr / mes completo</strong><small>El primer mes se prorratea por el tiempo contratado. Los cambios de sueldo empiezan después del próximo cobro.</small></div><div class="table-scroll"><table class="finance-breakdown"><thead><tr><th>Desglose del presupuesto</th><th>Mes actual</th><th>Acumulado</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${row.label}</td><td class="${row.month < 0 ? "negative" : row.month > 0 ? "positive" : ""}">${row.month > 0 ? "+" : ""}${money(row.month)} cr</td><td class="${row.total < 0 ? "negative" : row.total > 0 ? "positive" : ""}">${row.total > 0 ? "+" : ""}${money(row.total)} cr</td></tr>`).join("")}</tbody></table></div><p class="small-note">Las reservas de ofertas son fondos retenidos, no un gasto salarial. Se devuelven al adjudicar, perder o cancelar. Los movimientos anteriores a esta actualización figuran sólo en el acumulado.</p>${last ? `<details id="finance-last-bill" data-preserve-open><summary>Última liquidación · ${gameDate(last.at)}</summary><p>Devengado ${money(Object.values(last.due).reduce((a, b) => a + b, 0))} cr · Pagado ${money(Object.values(last.paid).reduce((a, b) => a + b, 0))} cr · Deuda nueva ${money(last.unpaid)} cr.</p></details>` : '<p class="small-note">La primera liquidación aparecerá al llegar al día 1 del próximo mes.</p>'}<details id="finance-ledger" data-preserve-open open><summary>Movimientos recientes</summary><div class="table-scroll"><table><thead><tr><th>Fecha</th><th>Movimiento</th><th>Importe</th></tr></thead><tbody>${t.ledger
    .slice(-24)
    .reverse()
    .map(
      (l) =>
        `<tr><td>${l.at !== undefined ? gameDate(l.at) : "Histórico"}</td><td>${esc(l.label)}</td><td class="${l.amount < 0 ? "negative" : "positive"}">${l.amount > 0 ? "+" : ""}${money(l.amount)} cr</td></tr>`,
    )
    .join("")}</tbody></table></div></details></section></div>`;
}
