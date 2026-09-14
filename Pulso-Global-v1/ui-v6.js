(function (root) {
  "use strict";
  const D = root.PULSO_DATA,
    E = root.PulsoEngine;
  const esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (x) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[x],
    );
  const num = (n, d = 0) =>
    new Intl.NumberFormat("es-AR", { maximumFractionDigits: d }).format(
      Number.isFinite(n) ? n : 0,
    );
  const dollars = (n) => "US$ " + num(n * 1e9, 2);
  const amount = (n, unit = "") => num(n, 2) + (unit ? " " + unit : "");
  const btn = (action, label, extra = "", disabled = false) =>
    `<button class="button compact" type="button" data-action="v6-${action}" ${extra} ${disabled ? "disabled" : ""}>${esc(label)}</button>`;
  const field = (name, label, value, type = "number", extra = "") =>
    `<label class="v6-field">${esc(label)}<input name="${name}" type="${type}" value="${esc(value)}" ${type === "number" ? `${extra.includes("min=") ? "" : 'min="0"'} ${extra.includes("step=") ? "" : 'step="any"'}` : ""} ${extra} required></label>`;
  const options = (items, selected) =>
    items
      .map(
        (x) =>
          `<option value="${esc(x.id)}" ${selected === x.id ? "selected" : ""}>${esc(x.label || x.name)}</option>`,
      )
      .join("");
  const select = (name, label, items, selected) =>
    `<label class="v6-field">${esc(label)}<select name="${name}">${options(items, selected)}</select></label>`;
  const card = (label, value, detail = "") =>
    `<article class="v6-stat"><small>${esc(label)}</small><strong>${value}</strong><span>${detail}</span></article>`;
  const row = (label, value) =>
    `<div><dt>${esc(label)}</dt><dd>${value}</dd></div>`;
  function shell(title, body, kicker = "Gestión nacional · v6") {
    return `<section class="management-panel system-panel v6-panel"><header class="management-heading"><div class="section-symbol">◈</div><div><p class="panel-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2></div><button class="panel-close" type="button" data-action="view" data-view="map" aria-label="Cerrar">×</button></header><div class="panel-body v6-body">${body}</div></section>`;
  }
  function form(action, body, extra = "") {
    return `<form class="v6-form" data-v6-form="${action}" ${extra}>${body}<button class="button" type="submit" ${extra.includes('data-blocked="true"') ? "disabled" : ""}>Aplicar</button></form>`;
  }
  function tabs(items, selected) {
    return `<div class="v6-tabs">${items.map((x) => btn("tab", x.label, `data-tab="${x.id}" aria-pressed="${x.id === selected}"`)).join("")}</div>`;
  }
  function sector(s, id, u) {
    const c = s.countries[s.playerCountryId],
      def = D.sectors.find((x) => x.id === id),
      v = c.sectors[id],
      tab = u.tab || "summary";
    let body = tabs(
      [
        { id: "summary", label: "Situación" },
        { id: "manage", label: "Presupuesto y funcionarios" },
        { id: "build", label: "Construcciones" },
        { id: "stock", label: "Producción" },
      ],
      tab,
    );
    if (tab === "manage") {
      body +=
        `<p>Definí el gasto autorizado por mes. El presupuesto incluye la nómina; solo se pagan puestos cubiertos. Las vacantes compiten con otros empleadores.</p>` +
        form(
          "sector",
          field("budget", "Presupuesto mensual (US$)", v.budget * 1e9) +
            field(
              "requested",
              "Puestos públicos solicitados",
              Math.round(v.requested),
            ) +
            field(
              "salary",
              "Sueldo por funcionario / mes (US$)",
              v.salary.toFixed(2),
            ) +
            field(
              "subsidyCap",
              "Tope de subsidio mensual (US$)",
              v.subsidyCap * 1e9,
            ),
          `data-sector="${id}"`,
        ) +
        `<div class="v6-grid">${card("Ejecutado este mes", dollars(v.executed))}${card("Vacantes", num(Math.max(0, v.requested - v.publicWorkers)))}${card("Nómina potencial", dollars((v.requested * v.salary) / 1e9))}${card("Desde desempleo", num(v.newFromUnemployment || 0), "Contrataciones del mes")}${card("Desde privados", num(v.transfers || 0), "Cambios de empleador")}</div>`;
    } else if (tab === "build") body += constructionList(s, id, u);
    else if (tab === "stock")
      body += resourceTable(
        s,
        D.materials.filter((m) => m.sector === id),
      );
    else {
      const produced = D.materials
        .filter((m) => m.sector === id)
        .reduce(
          (n, m) => n + c.materialProduction[m.id] * Math.abs(m.value),
          0,
        );
      body += `<div class="v6-grid">${card("Funcionarios", num(v.publicWorkers), "Solicitados: " + num(v.requested))}${card("Empleo privado", num(v.privateWorkers), "Puestos: " + num(v.privateJobs))}${card("Eficiencia pública", num(v.efficiencyPublic * 100, 1) + "%")}${card("Eficiencia privada", num(v.efficiencyPrivate * 100, 1) + "%")}${card("Presupuesto autorizado", dollars(v.budget), num((v.budget * 1200) / c.gdp, 2) + "% PBI anual")}${card("Valor producido / mes", dollars(produced))}</div><p class="method-note">La capacidad necesita instalaciones, personal, energía e insumos. La eficiencia mejora mediante formación, experiencia operativa y tecnología.</p>`;
      if (id === "agriculture")
        body += `<div class="v6-grid">${card("Superficie agrícola", amount(c.land.agricultureHa, "ha"))}${card("Superficie irrigada", amount(c.land.irrigatedHa, "ha"))}${card("Bovinos", num(c.herds.public.cattle + c.herds.private.cattle))}${card("Porcinos", num(c.herds.public.pigs + c.herds.private.pigs))}${card("Aves", num(c.herds.public.poultry + c.herds.private.poultry))}${card("Ovinos", num(c.herds.public.sheep + c.herds.private.sheep))}</div>`;
      if (id === "energy")
        body += `<div class="v6-grid">${card("Generación mensual", amount(c.energy.generated, "MWh"))}${card("Consumo necesario", amount(c.energy.demand, "MWh"))}${card("Cobertura", amount(c.energy.served * 100, "%"))}${card("Almacenado", amount(c.energy.stored, "MWh"))}</div>`;
      if (id === "services")
        body += `<div class="v6-grid">${card(
          "Residuos fuera de almacén",
          amount(
            Object.values(c.uncollectedWaste).reduce((n, v) => n + v, 0),
            "t",
          ),
          "Reducen bienestar; requieren recolección y tratamiento",
        )}${card("Basura acumulada", amount(c.publicStocks.waste, "t"))}${card("Residuos orgánicos", amount(c.publicStocks.organic_waste, "t"))}${card("Reciclables", amount(c.publicStocks.recyclables, "t"))}</div>`;
      const p = E.nationalizePreview(s, id);
      body += `<section class="v6-section"><h3>Propiedad del sector</h3><p>Nacionalizar transfiere instalaciones, inventario y empleados privados. El Estado asume sus costos y producción.</p><p>Transferencia del 100%: <strong>${dollars(p.cost)}</strong> · ${num(p.workers)} trabajadores</p>${btn("nationalize", "Revisar nacionalización", `data-sector="${id}"`)}</section>`;
      if (id === "education") body += educationForms(c);
    }
    body += projects(s, id);
    return shell(def.label, body);
  }
  function educationForms(c) {
    return `<section class="v6-section"><h3>Educación por nivel y especialidad</h3><p>Los programas reparten funcionarios existentes y fondos del ministerio. Sus sueldos determinan la oferta salarial media de Educación. Las cohortes iniciales representan alumnos ya en formación.</p>${[
      ...D.educationLevels.map((d) => ({
        ...d,
        key: "level:" + d.id,
        p: c.educationPlan[d.id],
      })),
      ...D.educationBranches.map((d) => ({
        ...d,
        key: "branch:" + d.id,
        p: c.educationBranches[d.id],
      })),
    ]
      .map((d) => {
        const p = d.p;
        return `<details><summary>${esc(d.label)} · ${num(p.graduates || 0)} egresados este mes</summary>${form("education", field("budget", "Presupuesto mensual US$", p.budget * 1e9) + field("staff", "Docentes / investigadores solicitados", Math.round(p.staff)) + field("salary", "Oferta salarial mensual US$", p.salary.toFixed(2)), `data-education="${d.key}"`)}<p>Personal asignado: ${num(p.actualStaff || 0)} · Ejecutado: ${dollars(p.executed || 0)} · Estudiantes en formación: ${num(p.enrolled || 0)}</p></details>`;
      })
      .join("")}</section>`;
  }
  function constructionList(s, id, u) {
    const c = s.countries[s.playerCountryId];
    return `<p>Cada proyecto muestra su cantidad física, costo y requisitos. Los importes son estimaciones; el material propio se consume sin comprarlo de nuevo.</p><div class="v6-buildings">${D.constructions
      .filter((b) => b.sector === id)
      .map((b) => {
        const p = E.constructionPreview(s, b.id);
        return `<article><div class="v6-title"><h3>${esc(b.label)}</h3><small>Público ${num(c.buildings[b.id], 2)} · Privado ${num(c.privateBuildings[b.id], 2)}</small></div><p>${esc(b.description)}</p><dl class="v6-lines">${row("Módulo", amount(p.quantity, p.unit))}${row("Base y mano de obra", dollars(p.baseCost + p.laborCost))}${row("Materiales (valor estimado)", dollars(p.materialCost))}${row("Trabajadores temporales", num(p.laborNeed))}${row("Cualificación / disponibilidad", amount(p.skillMatch, "%") + " / " + amount(p.laborAvailability, "%"))}${row("Duración estimada", amount(p.estimatedMonths, "meses"))}${row("Suelo", amount(p.landHa, "ha"))}${p.convertAgricultureHa ? row("Convierte agricultura", amount(p.convertAgricultureHa, "ha")) : ""}${b.energyOutput ? row("Generación de referencia", amount(b.energyOutput, "TWh/año")) : ""}${b.storage ? row("Almacenamiento", amount(b.storageAmount, "t equivalentes")) : ""}</dl><p class="${p.blocked ? "negative" : "positive"}">${esc(p.blocked || "Construcción habilitada")}</p>${btn("build", "Revisar obra", `data-building="${b.id}"`, !!p.blocked)}</article>`;
      })
      .join("")}</div>`;
  }
  function projects(s, id) {
    const c = s.countries[s.playerCountryId],
      items = c.projects.filter(
        (p) => (!id || p.sector === id) && p.progress < 100,
      );
    return `<section class="v6-section"><h3>Obras en ejecución · ${items.length}</h3>${
      items.length
        ? items
            .map(
              (p) =>
                `<div class="v6-project"><strong>${esc(D.getBuilding(p.typeId)?.label || p.typeId)}</strong><progress max="100" value="${p.progress}"></progress><span>${num(p.progress, 1)}% · ${num(p.workers || 0)} trabajadores · ${dollars(p.spent)}</span><small>${
                  p.blockedBy
                    .map((id) => D.getMaterial(id)?.label || id)
                    .map(esc)
                    .join(", ") || "Avance según presupuesto y personal"
                }</small></div>`,
            )
            .join("")
        : "<p>No hay obras activas.</p>"
    }</section>`;
  }
  function resourceTable(s, items) {
    const c = s.countries[s.playerCountryId];
    return `<div class="table-wrap"><table class="v6-table"><thead><tr><th>Recurso</th><th>Producción pública</th><th>Producción privada</th><th>Stock público</th><th>Stock privado</th><th>Cotización/unidad</th></tr></thead><tbody>${items.map((m) => `<tr><th><img class="v6-resource-icon" src="assets/resources/${m.id}.svg" width="32" height="32" alt="" loading="lazy">${btn("resource", m.label, `data-resource="${m.id}"`)}<small>${esc(m.unit)}</small></th><td>${amount(c.publicProduction[m.id])}</td><td>${amount(c.privateProduction[m.id])}</td><td>${amount(c.publicStocks[m.id])}</td><td>${amount(c.privateStocks[m.id])}</td><td>${dollars(s.market.resourcePrices[m.id])}</td></tr>`).join("")}</tbody></table></div>`;
  }
  function resources(s, u) {
    let body = `<p>Seleccioná un recurso para ver su cadena productiva, requisitos, costos y comparación mundial.</p>`;
    for (const tier of D.resourceTiers)
      body += `<section class="v6-section"><h3>${esc(tier.label)}</h3>${resourceTable(
        s,
        D.materials.filter((m) => m.tier === tier.id),
      )}</section>`;
    return shell("Recursos y producción", body);
  }
  function resourceDetail(s, id, u = {}) {
    const c = s.countries[s.playerCountryId],
      r = E.resourceReport(s, id),
      m = r.material;
    const related = s.agreements.filter(
      (a) => a.active && a.resource === id && [a.from, a.to].includes(c.id),
    );
    return shell(
      m.label,
      `${btn("close-resource", "← Volver")}<p>${esc(m.tier)} · Unidad: ${esc(m.unit)} · ${esc(m.waste ? "Residuo o materia recuperable" : "Producción y consumo mensuales")}</p><div class="v6-grid">${card("Cotización mundial", dollars(s.market.resourcePrices[id]))}${card("Variación mensual", amount((s.market.resourcePrices[id] / (s.market.previousResourcePrices[id] || s.market.resourcePrices[id]) - 1) * 100, "%"))}${card("Pública / privada", amount(r.publicProduction) + " / " + amount(r.privateProduction))}${card("Producción mundial", amount(r.world.production, m.unit), "Puesto " + (r.ranking.find((x) => x.id === c.id)?.position || "—"))}${card("Demanda nacional", amount(c.needs[id], m.unit))}${card("Faltante de hogares", amount(c.shortages[id], m.unit))}${card("Stock público / espacio libre", amount(r.stock) + " / " + amount(r.free))}${card("Excedente público", amount(r.exportable, m.unit))}</div>
    <section class="v6-section"><h3>Cómo producirlo</h3><p>${
      Object.keys(m.inputs).length
        ? Object.entries(m.inputs)
            .map(
              ([id, q]) =>
                `${amount(q, D.getMaterial(id).unit)} de ${btn("resource", D.getMaterial(id).label, `data-resource="${id}"`)}`,
            )
            .join(" + ")
        : esc(
            m.natural
              ? "Extracción de depósito conocido"
              : m.waste
                ? "Generado por población y actividad"
                : m.id === "milk" || m.id === "wool"
                  ? "Ganadería y alimentación"
                  : "Producción primaria",
          )
    } → <strong>${esc(m.label)}</strong></p><dl class="v6-lines">${row("Tecnología", esc(D.getTechnology(m.technology).label) + " · nivel " + r.technology)}${row("Instalación", esc(D.getBuilding(m.unlock)?.label || "Producción derivada"))}${row("Insumos por unidad producida", dollars(r.cost))}${row("Capacidad operativa mensual", amount(r.capacity, m.unit))}${row("Stock privado", amount(r.privateStock, m.unit))}${row("Almacén compatible", esc(D.storageTypes.find((t) => t.id === m.storage).label))}${row("Capacidad pública compartida", amount(E.storageCapacity(c, "public", m.storage), "t equivalentes"))}${row("Meses de cobertura", c.needs[id] > 0 ? amount((r.stock + r.privateStock) / c.needs[id], "meses") : "Sin demanda actual")}${row("Funcionarios / empleo privado del sector", num(c.sectors[m.sector].publicWorkers) + " / " + num(c.sectors[m.sector].privateWorkers))}${row("Energía disponible", amount(c.energy.served * 100, "%"))}${row("Consumo nacional total", amount(c.materialConsumption[id], m.unit))}${row("Consumo mundial", amount(r.world.consumption, m.unit))}${row("Importado / exportado", amount(c.resourceImports[id]) + " / " + amount(c.resourceExports[id]))}${row("Nivel de utilización pública / privada", amount((c.publicUtilization[id] || 0) * 100, "%") + " / " + amount((c.privateUtilization[id] || 0) * 100, "%"))}${r.deposits ? row("Depósitos terrestre / marítimo", amount(r.deposits.land, m.unit) + " / " + amount(r.deposits.sea, m.unit)) : ""}</dl><p>${esc(r.reason || "Producción condicionada por demanda, personal, insumos y capacidad.")}</p>${D.getBuilding(m.unlock) ? btn("go-sector", "Ver construcción", `data-sector="${m.sector}"`) : ""} ${btn("view-research", "Investigar tecnología", `data-tech="${m.technology}"`)}</section>
    <section class="v6-section"><h3>Política y mercado público</h3>${form("resource-policy", field("minimum", "Stock mínimo protegido (" + m.unit + ")", c.stockMinimum[id]) + field("target", "Producción pública deseada (0 a 100%)", c.productionTargets[id] * 100, "number", 'max="100"'), `data-resource="${id}"`)}${btn("ban", c.importBans[id] ? "Permitir importaciones" : "Prohibir importaciones", `data-resource="${id}" data-banned="${!c.importBans[id]}"`)}<p>Importaciones ${c.importsBanned || c.importBans[id] ? "prohibidas" : "permitidas"}. La prohibición también alcanza las compras manuales.</p>
    ${form(
      "trade-resource",
      field(
        "quantity",
        "Cantidad (" + m.unit + ")",
        1,
        "number",
        'min="0.000001" data-v6-quote="true"',
      ) +
        select(
          "direction",
          "Operación",
          [
            { id: "buy", label: "Comprar" },
            { id: "sell", label: "Vender" },
          ],
          "buy",
        ) +
        `<div class="v6-quote" data-v6-quote-output>Precio de referencia: ${dollars(Math.abs(s.market.resourcePrices[id]))} por ${esc(m.unit)}; transporte según contraparte. La vista previa se actualiza al cambiar la cantidad.</div>`,
      `data-resource="${id}"`,
    )}<p>Reservas disponibles: <strong>${dollars(c.reserves)}</strong>. Solo se negocia stock público y excedentes reales; puede ejecutarse una cantidad menor si no hay contraparte.</p></section>
    <section class="v6-section"><h3>Comparación mundial del recurso</h3>${resourceRank(s, id, u)}<p>${related.length} acuerdos activos para este recurso.</p></section>`,
    );
  }
  function economy(s) {
    const c = s.countries[s.playerCountryId],
      v = c.finance.monthly;
    return shell(
      "Economía y deuda",
      `<div class="v6-grid">${card("Reservas del Tesoro", dollars(c.reserves), "Saldo público disponible")}${card("Caja privada", dollars(c.finance.privateCash))}${card("Dinero de hogares", dollars(c.finance.householdCash))}${card("Deuda nominal", dollars(c.finance.nominalDebt), amount(c.debt, "% del PBI"))}${card("Resultado fiscal mensual", dollars(c.fiscalCashFlowMonthly || 0))}${card("Cambio de reservas", dollars(c.reserveChangeMonthly || 0))}${card("PBI real / nominal", dollars(c.realGdp) + " / " + dollars(c.gdp))}${card("Balance comercial nacional", dollars(c.tradeBalance), "Incluye comercio público y privado")}</div><p>Las operaciones privadas no se cargan al Tesoro. Un préstamo agrega capital disponible y deuda; las compras se descuentan una sola vez. La deuda no desaparece porque crezca el PBI.</p><dl class="v6-lines">${row("Ingresos públicos mensuales", dollars(v.income || 0))}${row("Gasto ejecutado", dollars(v.spending || 0))}${row("Intereses / amortizaciones", dollars(v.interest || 0) + " / " + dollars(v.principal || 0))}${row("Cuotas próximas", dollars(c.debtServiceMonthly))}${row("Crédito automático máximo", amount(c.finance.creditLimitShare, "% PBI"))}</dl>${btn("auto-credit", c.finance.automaticCredit ? "Desactivar crédito automático" : "Activar crédito automático")}<p>La financiación automática cubre gastos públicos hasta su límite; las compras manuales requieren reservas disponibles. Deuda superior al 205% del PBI y reservas agotadas mantienen la condición de cesación de pagos.</p><div class="v6-buildings">${E.LOAN_OPTIONS.map(
        (o) => {
          const p = E.loanPreview(s, o.id);
          return `<article><h3>${esc(o.label)}</h3><p>${esc(o.description)}</p><strong>${dollars(p.amount)}</strong><p>${p.months} meses · ${amount(p.annualRate, "% anual")}</p><p>Primera cuota: ${dollars(p.firstPayment)} · deuda resultante ${amount(p.projectedDebt, "%")}</p><p>Reservas tras recibirlo: ${dollars(c.reserves + p.amount)}</p>${btn("loan", "Contratar préstamo", `data-loan="${o.id}"`)}</article>`;
        },
      ).join(
        "",
      )}</div><section class="v6-section"><h3>Préstamos activos</h3>${c.loans.map((l) => `<article><strong>${esc(l.label)}</strong><p>Saldo ${dollars(l.outstanding)} · ${l.remainingMonths} cuotas · último pago ${dollars(l.lastPayment || 0)}</p>${form("repay", field("amount", "Amortizar capital (US$)", 0), `data-loan="${l.id}"`)}</article>`).join("") || "<p>No hay préstamos contratados.</p>"}</section><section class="v6-section"><h3>Registro de operaciones</h3><div class="table-wrap"><table class="v6-table"><thead><tr><th>Mes</th><th>Concepto</th><th>Cuenta</th><th>Movimiento</th></tr></thead><tbody>${c.finance.ledger
        .slice(-40)
        .reverse()
        .map(
          (x) =>
            `<tr><td>${x.tick}</td><td>${esc(x.kind)} ${esc(x.details)}</td><td>${esc(x.account)}</td><td class="${x.amount < 0 ? "negative" : "positive"}">${dollars(x.amount)}</td></tr>`,
        )
        .join("")}</tbody></table></div></section>`,
    );
  }
  function trade(s) {
    const c = s.countries[s.playerCountryId];
    return shell(
      "Comercio exterior",
      `<p>Los acuerdos priorizan la venta de excedentes. El comprador debe necesitar el producto, disponer de fondos y admitir su importación.</p>${btn("ban-all", c.importsBanned ? "Reabrir importaciones" : "Prohibir todas las importaciones")}<p>Estado general: <strong>${c.importsBanned ? "importaciones cerradas" : "importaciones abiertas"}</strong> · Cobertura de consumo: ${amount(c.consumptionCoverage * 100, "%")}</p><details><summary>Restricciones por categoría</summary>${D.resourceTiers.map((t) => `<p>${esc(t.label)} ${btn("ban", "Prohibir", `data-resource="${t.id}" data-banned="true"`)} ${btn("ban", "Permitir", `data-resource="${t.id}" data-banned="false"`)}</p>`).join("")}</details><section class="v6-section"><h3>Crear acuerdo</h3>${form(
        "agreement",
        select(
          "countryId",
          "País socio",
          D.countries.filter((x) => x.id !== c.id),
          D.countries.find((x) => x.id !== c.id).id,
        ) +
          select("resource", "Recurso", D.materials, "grains") +
          select(
            "direction",
            "Dirección",
            [
              { id: "export", label: "Exportar excedente público" },
              { id: "import", label: "Importar del socio" },
            ],
            "export",
          ) +
          field("quantity", "Cantidad máxima mensual", 100) +
          field("months", "Duración (meses)", 24, "number", 'max="120"') +
          field("tariff", "Arancel pactado (%)", 5, "number", 'max="40"'),
      )}</section><section class="v6-section"><h3>Acuerdos del país</h3>${
        s.agreements
          .filter((a) => [a.from, a.to].includes(c.id))
          .map(
            (a) =>
              `<article class="v6-project"><strong>${esc(D.getMaterial(a.resource).label)} · ${esc(s.countries[a.from].name)} → ${esc(s.countries[a.to].name)}</strong><span>${amount(a.lastQuantity)} / ${amount(a.quantity)} este mes · ${a.remaining} meses</span><small>${esc(a.status)}</small>${a.active ? btn("cancel-agreement", "Cancelar", `data-agreement="${a.id}"`) : ""}</article>`,
          )
          .join("") || "<p>No hay acuerdos.</p>"
      }</section><section class="v6-section"><h3>Flujos del último mes</h3><div class="table-wrap"><table class="v6-table"><thead><tr><th>Recurso</th><th>Origen</th><th>Destino</th><th>Cantidad</th><th>Valor</th></tr></thead><tbody>${s.market.trades
        .filter((t) => t.from === c.id || t.to === c.id)
        .slice(0, 60)
        .map(
          (t) =>
            `<tr><td>${esc(D.getMaterial(t.commodity)?.label || t.commodity)}</td><td>${esc(s.countries[t.from]?.name || t.from)}</td><td>${esc(s.countries[t.to]?.name || t.to)}</td><td>${amount(t.quantity)}</td><td>${dollars(t.value)}</td></tr>`,
        )
        .join("")}</tbody></table></div></section>`,
    );
  }
  function territory(s) {
    const c = s.countries[s.playerCountryId],
      l = c.land;
    return shell(
      "Territorio y vivienda",
      `<div class="v6-grid">${card("Superficie terrestre", amount(l.areaKm2, "km²"))}${card("Densidad", amount((c.population * 1e6) / l.areaKm2, "hab/km²"))}${card("Techo del escenario", num(l.areaKm2 * 60000) + " habitantes")}${card("Suelo libre", amount(E.availableLand(c), "ha"))}${card("Residencial", amount(l.residentialHa, "ha"))}${card("Agrícola", amount(l.agricultureHa, "ha"))}${card("Irrigado", amount(l.irrigatedHa, "ha"))}${card("Industrial y redes", amount(l.industrialHa, "ha"))}${card("Restringido/no apto", amount(l.restrictedHa, "ha"))}${card("Viviendas nuevas", num(c.housingStock.new * 1e6))}${card("Viviendas normales", num(c.housingStock.normal * 1e6))}${card("A refaccionar", num(c.housingStock.repair * 1e6))}</div><p>Al ocupar suelo agrícola, la obra solicita confirmación y descuenta las hectáreas convertidas una sola vez. Densificar reduce el uso de suelo.</p><section class="v6-section"><h3>Redes e instalaciones iniciales y construidas</h3><dl class="v6-lines">${Object.entries(
        c.infrastructureAssets,
      )
        .map(([id, n]) =>
          row(
            D.getBuilding(id)?.label || id,
            amount(
              n,
              ["airport", "port"].includes(id) ? "instalaciones" : "km",
            ),
          ),
        )
        .join(
          "",
        )}</dl><p class="method-note">${c.dataSources.areaKm2 ? "Superficie: Banco Mundial " + c.dataSources.areaKm2.year + ". " : ""}Las cantidades equivalentes de instalaciones son estimaciones de escenario; ferrocarriles con fuente cuando hay datos.</p></section>${btn("go-sector", "Construir viviendas e infraestructura", 'data-sector="infrastructure"')} ${btn("go-sector", "Ampliar agro y riego", 'data-sector="agriculture"')}`,
    );
  }
  function demographics(s, u) {
    const c = s.countries[s.playerCountryId],
      p = c.laborSnapshot;
    return shell(
      "Población y trabajo",
      `<div class="v6-grid">${card("Habitantes", num(c.population * 1e6))}${card("Esperanza de vida", amount(c.lifeExpectancy, "años"))}${card("Menores de 18", num(p.children * 1e6))}${card("Edad laboral habilitada", num(p.workingAge * 1e6))}${card("Ocupados", num(p.employed * 1e6))}${card("Desocupados", num(p.unemployed * 1e6))}${card("Inactivos en edad laboral", num(p.inactive * 1e6))}${card("Edad previsional", num(p.retired * 1e6))}${card("Natalidad del mes", num(c.demographicFlows.births * 1e6))}${card("Fallecimientos del mes", num(c.demographicFlows.deaths * 1e6))}${card("Migración neta mensual", num(c.demographicFlows.migration * 1e6))}${card("Pensiones pagadas", dollars(c.finance.pensions || 0))}</div><p>La habilitación laboral no obliga a trabajar. La cualificación, vacantes y salario determinan la ocupación; adelantar la incorporación puede perjudicar la educación.</p>${form("ages", field("start", "Edad inicial", c.workPolicy.start, "number", 'min="12" max="79" step="1"') + field("retire", "Edad de retiro", c.workPolicy.retire, "number", 'min="13" max="80" step="1"'))}<p class="method-note">Esperanza de vida inicial: ${c.dataSources.lifeExpectancy ? "Banco Mundial " + c.dataSources.lifeExpectancy.year : "estimación de juego"}. La mortalidad se calcula por grupos de edad.</p>${rankingTable(s, u, true)}`,
    );
  }
  function rankingTable(s, u, demographic = false) {
    const columns = demographic
      ? [
          ["name", "País"],
          ["population", "Habitantes"],
          ["children", "Menores"],
          ["workingAge", "Edad laboral"],
          ["retired", "Jubilados"],
          ["lifeExpectancy", "Esperanza de vida"],
        ]
      : [
          ["name", "País"],
          ["population", "Habitantes"],
          ["gdp", "PBI"],
          ["perCapita", "PBI por habitante"],
          ["growth", "Crecimiento"],
          ["reserves", "Reservas"],
          ["debt", "Deuda/PBI"],
          ["happiness", "Felicidad"],
          ["employment", "Empleo"],
          ["education", "Educación"],
          ["efficiency", "Eficiencia"],
          ["unemployment", "Desocupación"],
          ["lifeExpectancy", "Esperanza de vida"],
          ["housing", "Vivienda"],
          ["migration", "Migración"],
          ["tradeBalance", "Comercio"],
        ];
    const key = u.sortKey || "gdp",
      direction = u.sortDirection || "desc";
    let rows;
    if (["children", "workingAge", "retired"].includes(key)) {
      rows = Object.values(s.countries)
        .map((c) => ({ id: c.id, value: c.laborSnapshot[key] }))
        .sort(
          (a, b) =>
            (a.value - b.value) * (direction === "asc" ? 1 : -1) ||
            a.id.localeCompare(b.id),
        )
        .map((r, i) => ({ ...r, position: i + 1 }));
    } else rows = E.rank(s, key, direction);
    const value = (c, k) =>
      ["children", "workingAge", "retired"].includes(k)
        ? num(c.laborSnapshot[k] * 1e6)
        : k === "name"
          ? esc(c.name)
          : k === "population"
            ? num(c.population * 1e6)
            : ["gdp", "reserves", "tradeBalance"].includes(k)
              ? dollars(c[k])
              : k === "perCapita"
                ? "US$ " + num((c.gdp * 1000) / c.population)
                : k === "employment"
                  ? amount(100 - c.unemployment, "%")
                  : k === "efficiency"
                    ? amount(
                        (Object.values(c.sectors).reduce(
                          (n, v) =>
                            n + (v.efficiencyPublic + v.efficiencyPrivate) / 2,
                          0,
                        ) /
                          D.sectors.length) *
                          100,
                        "%",
                      )
                    : c[k] === undefined || c[k] === null
                      ? "Sin datos"
                      : amount(c[k]);
    return `<section class="v6-section"><h3>Ranking mundial</h3><p>Pulsá una columna para cambiar el orden. Cada posición corresponde al criterio seleccionado.</p><div class="table-wrap"><table class="v6-table"><thead><tr><th>#</th>${columns.map(([k, label]) => `<th aria-sort="${key === k ? (direction === "asc" ? "ascending" : "descending") : "none"}">${btn("sort", label + (key === k ? (direction === "asc" ? " ↑" : " ↓") : ""), `data-sort="${k}"`)}</th>`).join("")}</tr></thead><tbody>${rows
      .map((r) => {
        const c = s.countries[r.id];
        return `<tr class="${c.id === s.playerCountryId ? "v6-player" : ""}"><td>${r.position}</td>${columns.map(([k]) => `<td>${value(c, k)}</td>`).join("")}</tr>`;
      })
      .join("")}</tbody></table></div></section>`;
  }
  function research(s, u) {
    const c = s.countries[s.playerCountryId],
      project = c.research.project;
    return shell(
      "Investigación y exploración",
      `<p>El laboratorio utiliza científicos y el presupuesto de Educación. Una tecnología habilita instalaciones; la exploración puede terminar sin hallazgo.</p>${project ? `<section class="v6-section"><h3>${esc(D.getTechnology(project.technology).label)} · nivel ${project.level}</h3><progress max="100" value="${project.progress}"></progress><p>${amount(project.progress, "%")} · presupuesto ${dollars(project.budget)}/mes</p>${btn("cancel-research", "Cancelar investigación")}</section>` : ""}<div class="v6-tabs">${D.sectors.map((sec) => btn("research-filter", sec.short, `data-sector="${sec.id}"`)).join("")}</div><div class="v6-buildings">${D.technologies
        .filter((t) => !u.researchSector || t.sector === u.researchSector)
        .map((t) => {
          const level = c.research.levels[t.id] || 0,
            missing = t.requires.filter((id) => !c.research.levels[id]);
          const effects = {
            output: "producción",
            cost: "ahorro de insumos y operación",
            quality: "calidad",
            logistics: "logística",
            resilience: "resiliencia",
            education: "educación",
            health: "salud",
            services: "servicios",
            waste: "tratamiento",
            tax: "recaudación",
            capacity: "capacidad",
          };
          const blocked =
            missing.length > 0 ||
            level >= 4 ||
            !!project ||
            !c.buildings.research_lab;
          const reason =
            level >= 4
              ? "Nivel máximo alcanzado."
              : project
                ? "Ya hay otra investigación activa."
                : !c.buildings.research_lab
                  ? "Hace falta un laboratorio público."
                  : missing.length
                    ? "Completá los requisitos anteriores."
                    : "";
          const linked =
            D.materials.some((m) => m.technology === t.id) ||
            D.constructions.some(
              (b) => b.energyOutput && b.technology === t.id,
            );
          return `<article><h3>${esc(t.label)}</h3><p>Nivel ${level}/4 · ${t.effect === "capacity" ? "Capacidad: 1.000 MWh por unidad de red y nivel." : `${esc(effects[t.effect] || t.effect)}: aporte sectorial de ${amount(t.improvement * 15, "%")} por nivel (tope conjunto 40%).`} ${linked ? "Desde el nivel 2: +8% de capacidad por nivel en la producción vinculada." : ""}</p><p>${t.requires.length ? "Requiere: " + t.requires.map((id) => esc(D.getTechnology(id).label)).join(", ") : "Tecnología de base"} · formación de referencia ${t.skill}/100</p><p>Plazo base: ${t.months * (level + 1)} meses; depende de formación, recursos y científicos.</p>${reason ? `<p class="method-note">${reason}</p>` : ""}${form("research", `<input type="hidden" name="technology" value="${t.id}">` + field("budget", "Presupuesto mensual US$", Math.max(100, c.gdp * 1e9 * 0.00002).toFixed(2)), `data-blocked="${blocked}"`)}</article>`;
        })
        .join(
          "",
        )}</div><section class="v6-section"><h3>Exploración de recursos</h3>${form(
        "explore",
        select(
          "resource",
          "Recurso",
          D.materials.filter((m) => m.natural),
          "crude_oil",
        ) +
          select(
            "site",
            "Zona",
            [
              { id: "land", label: "Terrestre" },
              { id: "sea", label: "Marítima (petróleo)" },
            ],
            "land",
          ) +
          field(
            "budget",
            "Presupuesto mensual US$",
            Math.max(100, c.gdp * 1e9 * 0.00001).toFixed(2),
          ),
      )}<p>La probabilidad depende del potencial geológico y tecnología. Reabrir un guardado no vuelve a sortear la campaña.</p>${c.research.explorations.map((x) => `<p>${esc(D.getMaterial(x.resource).label)} · ${x.offshore ? "marítima" : "terrestre"} · ${amount(x.progress, "%")} · ${esc(x.status)}${x.discovered ? " · " + amount(x.discovered, D.getMaterial(x.resource).unit) : ""}</p>`).join("")}</section>`,
    );
  }
  function modal(s, u) {
    if (!u.confirm) return "";
    const item = u.confirm;
    return `<div class="v6-overlay" role="dialog" aria-modal="true" aria-labelledby="v6-confirm-title"><section class="v6-dialog"><h2 id="v6-confirm-title">${esc(item.title)}</h2>${item.body}<div class="v6-tabs">${btn("confirm", "Confirmar")} ${btn("cancel-confirm", "Cancelar")}</div></section></div>`;
  }
  function render(s, view, u) {
    if (u.resource) return resourceDetail(s, u.resource, u);
    let html;
    if (D.sectors.some((x) => x.id === view)) html = sector(s, view, u);
    else if (view === "resources") html = resources(s, u);
    else if (view === "economy") html = economy(s);
    else if (view === "trade") html = trade(s);
    else if (view === "demographics") html = demographics(s, u);
    else if (view === "indicators")
      html = shell("Indicadores comparados", rankingTable(s, u));
    else if (view === "territory") html = territory(s);
    else if (view === "research") html = research(s, u);
    else return null;
    return html + modal(s, u);
  }
  function action(s, u, target) {
    const a = target.dataset.action.replace("v6-", ""),
      c = s.countries[s.playerCountryId];
    let view = null;
    if (a === "tab") u.tab = target.dataset.tab;
    if (a === "resource") u.resource = target.dataset.resource;
    if (a === "close-resource") u.resource = null;
    if (a === "go-sector") {
      view = target.dataset.sector;
      u.resource = null;
      u.tab = "build";
    }
    if (a === "view-research") {
      view = "research";
      u.resource = null;
      u.researchSector = D.getTechnology(target.dataset.tech).sector;
    }
    if (a === "resource-sort") {
      u.resourceSortDirection =
        u.resourceSort === target.dataset.sort &&
        u.resourceSortDirection === "desc"
          ? "asc"
          : "desc";
      u.resourceSort = target.dataset.sort;
    }
    if (a === "sort") {
      u.sortDirection =
        u.sortKey === target.dataset.sort && u.sortDirection === "desc"
          ? "asc"
          : "desc";
      u.sortKey = target.dataset.sort;
    }
    if (a === "research-filter") u.researchSector = target.dataset.sector;
    if (a === "ban")
      E.setImportPolicy(
        s,
        target.dataset.resource,
        target.dataset.banned === "true",
      );
    if (a === "ban-all") E.setImportPolicy(s, "all", !c.importsBanned);
    if (a === "auto-credit")
      c.finance.automaticCredit = !c.finance.automaticCredit;
    if (a === "loan") {
      const p = E.loanPreview(s, target.dataset.loan);
      u.confirm = {
        type: "loan",
        id: target.dataset.loan,
        title: p.label,
        body: `<p>Desembolso: ${dollars(p.amount)}. Primera cuota: ${dollars(p.firstPayment)}.</p><p>Deuda posterior: ${amount(p.projectedDebt, "% del PBI")}.</p><p>Riesgo: ${esc(p.risk.label)}. Las cuotas futuras salen de reservas.</p>`,
      };
    }
    if (a === "cancel-agreement")
      E.cancelAgreement(s, target.dataset.agreement);
    if (a === "cancel-research") c.research.project = null;
    if (a === "build") {
      const p = E.constructionPreview(s, target.dataset.building),
        b = D.getBuilding(target.dataset.building);
      u.confirm = {
        type: "build",
        id: b.id,
        title: b.label,
        body: `<p>Construir ${amount(p.quantity, p.unit)}.</p><p>Costo estimado total: <strong>${dollars(p.totalCost)}</strong>; incluye el valor del material propio.</p><p>Reservas actuales: ${dollars(c.reserves)}.</p><p>${p.convertAgricultureHa ? `Se convertirán <strong>${amount(p.convertAgricultureHa, "ha agrícolas")}</strong> y se perderá su producción.` : "Suelo requerido: " + amount(p.landHa, "ha")}</p><p>La obra avanza y paga mes a mes; puede detenerse por falta de recursos o dinero.</p>`,
      };
    }
    if (a === "nationalize") {
      const p = E.nationalizePreview(s, target.dataset.sector);
      u.confirm = {
        type: "nationalize",
        id: target.dataset.sector,
        title: "Nacionalizar el 100% privado",
        body: `<p>Costo ${dollars(p.cost)}. Se transfieren ${num(p.workers)} trabajadores e instalaciones; revisá luego el presupuesto salarial.</p><p>Reservas posteriores: ${dollars(c.reserves - p.cost)}.</p>`,
      };
    }
    if (a === "cancel-confirm") u.confirm = null;
    if (a === "confirm" && u.confirm) {
      if (u.confirm.type === "build")
        E.queueConstruction(s, u.confirm.id, 1, true);
      else if (u.confirm.type === "loan") E.takeLoan(s, u.confirm.id);
      else E.nationalize(s, u.confirm.id);
      u.confirm = null;
    }
    return { view };
  }
  function submit(s, u, formElement) {
    const v = Object.fromEntries(new FormData(formElement)),
      a = formElement.dataset.v6Form;
    if (a === "sector")
      E.setSector(s, formElement.dataset.sector, {
        budget: Number(v.budget) / 1e9,
        requested: Number(v.requested),
        salary: Number(v.salary),
        subsidyCap: Number(v.subsidyCap) / 1e9,
      });
    if (a === "education")
      E.setEducation(s, formElement.dataset.education, {
        budget: Number(v.budget) / 1e9,
        staff: Number(v.staff),
        salary: Number(v.salary),
      });
    if (a === "resource-policy")
      E.setResourcePolicy(s, formElement.dataset.resource, {
        minimum: Number(v.minimum),
        target: Number(v.target) / 100,
      });
    if (a === "trade-resource") {
      const r = E.tradeResource(
        s,
        formElement.dataset.resource,
        v.direction,
        Number(v.quantity),
      );
      return `Operación realizada: ${amount(r.quantity)} · movimiento público ${dollars(r.revenue ?? -r.cost)}`;
    }
    if (a === "repay")
      E.repayment(s, formElement.dataset.loan, Number(v.amount) / 1e9);
    if (a === "ages") E.setAges(s, Number(v.start), Number(v.retire));
    if (a === "agreement") E.addAgreement(s, v);
    if (a === "research")
      E.startResearch(s, v.technology, Number(v.budget) / 1e9);
    if (a === "explore")
      E.explore(s, v.resource, v.site === "sea", Number(v.budget) / 1e9);
    return "Cambios aplicados.";
  }
  function quote(s, formElement) {
    const output = formElement.querySelector("[data-v6-quote-output]");
    if (!output) return;
    const values = Object.fromEntries(new FormData(formElement));
    try {
      const p = E.tradePreview(
        s,
        formElement.dataset.resource,
        values.direction,
        Number(values.quantity),
      );
      output.innerHTML = `<strong>${p.blocked ? esc(p.blocked) : "Cantidad máxima ofrecida: " + amount(p.quantity)}</strong><p>${p.cost ? "Costo máximo: " + dollars(p.cost) : "Ingreso si se ejecuta todo: " + dollars(p.revenue)} · Reservas proyectadas: ${dollars(p.projectedReserves)}</p><p>La cantidad efectiva depende de contraparte, demanda, transporte y fondos. Los aranceles del propio Estado no se cobran a sí mismo.</p>${p.cost > Math.max(0, s.countries[s.playerCountryId].reserves) ? '<p class="negative">Reservas insuficientes. La operación no se ejecutará.</p>' : ""}`;
    } catch (e) {
      output.textContent = e.message;
    }
  }
  function resourceRank(s, id, u) {
    const columns = [
      ["name", "País"],
      ["materialProduction", "Producción"],
      ["materialConsumption", "Consumo"],
      ["resourceImports", "Importaciones"],
      ["resourceExports", "Exportaciones"],
    ];
    const key = u.resourceSort || "materialProduction",
      sign = u.resourceSortDirection === "asc" ? 1 : -1;
    const rows = Object.values(s.countries)
      .slice()
      .sort(
        (a, b) =>
          (key === "name"
            ? a.name.localeCompare(b.name, "es")
            : a[key][id] - b[key][id]) * sign || a.id.localeCompare(b.id),
      );
    return (
      '<div class="table-wrap"><table class="v6-table"><thead><tr><th>#</th>' +
      columns
        .map(
          ([k, label]) =>
            "<th>" +
            btn("resource-sort", label, 'data-sort="' + k + '"') +
            "</th>",
        )
        .join("") +
      "</tr></thead><tbody>" +
      rows
        .map(
          (c, i) =>
            '<tr class="' +
            (c.id === s.playerCountryId ? "v6-player" : "") +
            '"><td>' +
            (i + 1) +
            "</td>" +
            columns
              .map(
                ([k]) =>
                  "<td>" +
                  (k === "name" ? esc(c.name) : amount(c[k][id])) +
                  "</td>",
              )
              .join("") +
            "</tr>",
        )
        .join("") +
      "</tbody></table></div>"
    );
  }
  root.PulsoUI6 = { render, action, submit, quote };
})(typeof globalThis !== "undefined" ? globalThis : this);
