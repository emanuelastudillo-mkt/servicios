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
  const numberFormats = new Map();
  const num = (n, d = 0) => {
    if (!numberFormats.has(d))
      numberFormats.set(
        d,
        new Intl.NumberFormat("es-AR", { maximumFractionDigits: d }),
      );
    return numberFormats.get(d).format(Number.isFinite(n) && n !== 0 ? n : 0);
  };
  const dollars = (n) => {
    const value = (Number(n) || 0) * 1e9,
      absolute = Math.abs(value),
      unit =
        absolute >= 1e12
          ? [1e12, "B"]
          : absolute >= 1e9
            ? [1e9, "MM"]
            : absolute >= 1e6
              ? [1e6, "M"]
              : absolute >= 1e3
                ? [1e3, "m"]
                : [1, ""];
    return (
      "US$ " +
      num(value / unit[0], Math.abs(value / unit[0]) < 10 ? 2 : 1) +
      (unit[1] ? " " + unit[1] : "")
    );
  };
  const amount = (n, unit = "") => num(n, 2) + (unit ? " " + unit : "");
  const recipeAmount = (n, unit = "") => {
    const digits = Math.abs(n) < 0.000001 ? 10 : Math.abs(n) < 0.001 ? 8 : Math.abs(n) < 1 ? 6 : 2;
    return num(n, digits) + (unit ? " " + unit : "");
  };
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
  function shell(title, body, kicker = `Gestión nacional · v${D.release}`) {
    return `<section class="management-panel system-panel v6-panel"><header class="management-heading"><div class="section-symbol">◈</div><div><p class="panel-kicker">${esc(kicker)}</p><h2>${esc(title)}</h2></div><button class="panel-close" type="button" data-action="view" data-view="map" aria-label="Cerrar">×</button></header><div class="panel-body v6-body"><p class="v6-live-note">Datos actualizados durante el avance (cada 2 s); la edición se conserva. ${btn("refresh", "Actualizar datos")}</p>${body}</div></section>`;
  }
  function form(action, body, extra = "", submitLabel = "") {
    return `<form class="v6-form" data-v6-form="${action}" ${extra}>${body}<button class="button" type="submit" ${extra.includes('data-blocked="true"') ? "disabled" : ""}>${submitLabel || (["research", "explore"].includes(action) ? "Agregar a la cola" : "Aplicar")}</button></form>`;
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
        { id: "manage", label: "Funcionarios y sueldos" },
        { id: "build", label: "Construcciones" },
        { id: "stock", label: "Producción" },
      ],
      tab,
    );
    if (tab === "manage") {
      body +=
        `<p>Definí cuántos puestos públicos querés cubrir y el sueldo ofrecido. La nómina se paga directamente desde el Tesoro; las vacantes dependen de desempleo, cualificación y competencia con empleadores privados.</p>${id === "infrastructure" ? `<p class="method-note">Los funcionarios de Vivienda y Transporte son la dotación compartida para obras de <strong>todos los ministerios</strong>. Las cuadrillas de vivienda y refacción se reservan de esa misma dotación. Si falta personal, se contratan desocupados temporalmente; al terminar la obra o el programa vuelven al desempleo. Los funcionarios cobran su sueldo mensual una vez: no se les paga un segundo salario por la obra.</p>` : ""}` +
        form(
          "sector",
          field(
            "requested",
            "Puestos públicos solicitados",
            Math.round(v.requested),
          ) +
            field(
              "salary",
              "Sueldo por funcionario / mes (US$)",
              v.salary.toFixed(2),
            ),
          `data-sector="${id}"`,
        ) +
        `<div class="v6-grid">${card("Ejecutado este mes", dollars(v.executed))}${card("Vacantes", num(Math.max(0, v.requested - v.publicWorkers)))}${card("Nómina potencial", dollars((v.requested * v.salary) / 1e9))}${card("Desde desempleo", num(v.newFromUnemployment || 0), "Contrataciones del mes")}${card("Desde privados", num(v.transfers || 0), "Cambios de empleador")}</div>`;
      if (id === "infrastructure") {
        const p = c.housingProgram;
        body += `<section class="v6-section"><h3>Programa pasivo de vivienda</h3><p>Definí un tope y cuadrillas para construir y refaccionar cada mes, sin iniciar una obra manual. Estas cuadrillas se reservan de la misma bolsa de Vivienda y Transporte; pueden sumar desocupados temporalmente. El programa se detiene o avanza parcialmente si faltan Tesoro, materiales, suelo o personal.</p>${form(
          "housing-program",
          field(
            "buildBudget",
            "Construcción: tope mensual (US$)",
            p.buildBudget * 1e9,
          ) +
            field(
              "buildWorkers",
              "Construcción: cuadrilla solicitada",
              Math.round(p.buildWorkers),
            ) +
            field(
              "repairBudget",
              "Refacción: tope mensual (US$)",
              p.repairBudget * 1e9,
            ) +
            field(
              "repairWorkers",
              "Refacción: cuadrilla solicitada",
              Math.round(p.repairWorkers),
            ),
        )}<div class="v6-grid">${card("Viviendas construidas último mes", num(p.lastBuildUnits), `${num(p.lastBuildPublic || 0)} funcionarios · ${num(p.lastBuildTemporary || 0)} temporarios`)}${card("Viviendas refaccionadas último mes", num(p.lastRepairUnits), `${num(p.lastRepairPublic || 0)} funcionarios · ${num(p.lastRepairTemporary || 0)} temporarios`)}${card("Estado de construcción", p.lastBuildStatus)}${card("Estado de refacción", p.lastRepairStatus)}</div></section>`;
      }
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
      const diagnostic = E.sectorDiagnostic(s, id),
        productionBlocks = diagnostic.resources
          .map((x) => `${x.label}: ${x.reason}`)
          .join(" · ");
      body += `<div class="v6-grid">${card("Funcionarios", num(v.publicWorkers), "Solicitados: " + num(v.requested))}${card("Empleo privado", num(v.privateWorkers), "Puestos: " + num(v.privateJobs))}${card("Eficiencia pública", num(v.efficiencyPublic * 100, 1) + "%")}${card("Eficiencia privada", num(v.efficiencyPrivate * 100, 1) + "%")}${card("Nómina pública mensual", dollars((v.publicWorkers * v.salary) / 1e9), "Cobertura pagada: " + amount((v.payrollCoverage ?? 1) * 100, "%"))}${card("Valor producido / mes", dollars(produced))}</div><p class="method-note">La capacidad necesita instalaciones, personal pagado, energía e insumos. La eficiencia mejora mediante formación, experiencia operativa y tecnología.</p>${productionBlocks ? `<div class="v6-alert v6-alert-warning"><strong>Qué limita la producción hoy:</strong> ${esc(productionBlocks)}</div>` : `<div class="v6-alert"><strong>Producción:</strong> no hay un bloqueo de recurso reportado; verificá demanda, capacidad instalada y funcionarios.</div>`}`;
      if (id === "agriculture")
        body += `<div class="v6-grid">${card("Superficie agrícola", amount(c.land.agricultureHa, "ha"))}${card("Superficie irrigada", amount(c.land.irrigatedHa, "ha"))}${card("Bovinos", num(c.herds.public.cattle + c.herds.private.cattle))}${card("Porcinos", num(c.herds.public.pigs + c.herds.private.pigs))}${card("Aves", num(c.herds.public.poultry + c.herds.private.poultry))}${card("Ovinos", num(c.herds.public.sheep + c.herds.private.sheep))}</div>`;
      if (id === "energy")
        body += `<div class="v6-grid">${card("Generación mensual", amount(c.energy.generated, "MWh"))}${card("Consumo necesario", amount(c.energy.demand, "MWh"))}${card("Cobertura", amount(c.energy.served * 100, "%"))}${card("Almacenado", amount(c.energy.stored, "MWh"))}</div>`;
      if (id === "services")
        body += `<div class="v6-grid">${card(
          "Residuos fuera de almacén",
          amount(
            Object.values(c.uncollectedWaste).reduce((n, v) => n + v, 0),
            "u",
          ),
          "Reducen bienestar; requieren recolección y tratamiento",
        )}${card("Basura acumulada", amount(c.publicStocks.waste, "u"))}${card("Residuos orgánicos", amount(c.publicStocks.organic_waste, "u"))}${card("Reciclables", amount(c.publicStocks.recyclables, "u"))}</div>`;
      if (id === "education") body += educationForms(c) + researchStaffPreview(c);
    }
    body += projects(s, id);
    return shell(def.label, body);
  }
  function researchStaffPreview(c) {
    const task = c.research.queue?.[0];
    if (!task) return `<p>Asigná científicos, laboratorio, cualificación y presupuesto para acelerar una investigación. No hay tarea activa para calcular el aporte marginal.</p>`;
    const now = E.researchQueuePreview(c, task);
    const more = E.researchQueuePreview({ ...c, researchScientists: (c.researchScientists || 0) + 100 }, task);
    return `<section class="v6-section"><h3>Aporte marginal de científicos</h3><p>Tarea ${esc(now.label)}: ${amount(now.rate, "puntos porcentuales/mes")}; con 100 científicos más, ${amount(more.rate, "puntos porcentuales/mes")} (${amount(more.rate - now.rate, "puntos adicionales")}). Requiere puestos, sueldo, laboratorio, presupuesto y nivel educativo; los bienes tecnológicos en uso también ayudan.</p></section>`;
  }
  function educationForms(c) {
    return `<section class="v6-section"><h3>Educación por nivel y especialidad</h3><p>Los programas reparten los funcionarios existentes y administran sus costos específicos. Sus sueldos determinan la oferta salarial media de Educación. Las cohortes iniciales representan alumnos ya en formación.</p>${[
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
    const c = s.countries[s.playerCountryId],
      staff = c.sectors.infrastructure.publicWorkers * (c.sectors.infrastructure.payrollCoverage ?? 1),
      temporary = c.laborSnapshot.unemployed * 1e6 + (c.constructionWorkers || 0);
    return `<p>Bolsa compartida: <strong>${num(E.constructionWorkforce(c))} personas</strong> (${num(staff)} funcionarios pagos de Vivienda y Transporte + hasta ${num(temporary)} desocupados temporarios). Las cuadrillas de vivienda y refacción reservan sus puestos antes de repartir el resto entre obras activas de todos los ministerios. Al finalizar una obra, los temporarios vuelven a estar disponibles como desempleados. El avance se liquida en la etapa mensual de obras.</p><p>Cada proyecto muestra su cantidad física, costo y requisitos. El salario ordinario de los funcionarios ya está en la nómina; el costo laboral de la obra estima solo temporarios. El material propio se consume sin comprarlo de nuevo.</p><div class="v6-buildings">${D.constructions
      .filter((b) => b.sector === id && !b.storage)
      .map((b) => {
        const p = E.constructionPreview(s, b.id);
        return `<article><div class="v6-title"><h3>${esc(b.label)}</h3><small>Público ${num(c.buildings[b.id], 2)} · Privado ${num(c.privateBuildings[b.id], 2)}</small></div><p>${esc(b.description)}</p><dl class="v6-lines">${row("Módulo", amount(p.quantity, p.unit))}${row("Costo fijo", dollars(p.baseCost))}${row("Salarios temporarios estimados", dollars(p.laborCost))}${row("Material propio: costo económico, no segundo pago", dollars(p.ownMaterialValue))}${row("Compra estimada de faltantes", dollars(p.purchaseCost))}${row("Personas necesarias por módulo", num(p.laborNeed))}${row("Cualificación / disponibilidad", amount(p.skillMatch, "%") + " / " + amount(p.laborAvailability, "%"))}${row("Duración estimada", p.estimatedMonths === null ? "Sin trabajadores disponibles" : amount(p.estimatedMonths, "meses de trabajo"))}${row("Suelo", amount(p.landHa, "ha"))}${p.convertAgricultureHa ? row("Convierte agricultura", amount(p.convertAgricultureHa, "ha")) : ""}${b.energyOutput ? row("Generación de referencia", amount(b.energyOutput, "TWh/año")) : ""}</dl><p class="${p.blocked ? "negative" : "positive"}">${esc(p.blocked || "Construcción habilitada")}</p>${oneModuleMaterials(p)}${field("quantity", "Cantidad de módulos", 1, "number", 'data-build-quantity min="1" max="999" step="1"')}<div data-build-quote>${constructionQuote(p, s.adminMode)}</div>${btn("build", "Construir", `data-building="${b.id}"`, !!p.blocked)}</article>`;
      })
      .join("")}</div>`;
  }
  function constructionQuote(p, adminMode = false) {
    if (adminMode) return `<p class="positive"><strong>Modo admin: ${p.factor} módulo(s) inmediatos, US$ 0 y sin consumir materiales ni mano de obra.</strong></p><p>Se mantienen los requisitos tecnológicos, de depósito y suelo. La operación posterior conserva sus costos e insumos normales.</p>`;
    const rows = p.materialQuote.map((x) => `<li class="${x.missing > 1e-9 ? "negative" : "positive"}">${esc(D.getMaterial(x.id)?.label || x.id)}: requiere ${amount(x.required)}, stock ${amount(x.stock)}, comprometido ${amount(x.committed)}, libre ${amount(x.free)}, falta ${amount(x.missing)} · compra ${dollars(x.purchaseCost)}</li>`).join("");
    const outputs = p.productionImpact.map((x) => `${esc(D.getMaterial(x.id)?.label || x.id)}: hasta ${amount(x.monthly)} ${esc(D.getMaterial(x.id)?.unit || "unidades")}/mes, ${num(x.operators)} puestos de operación; insumos ${Object.entries(x.inputs).map(([id,q]) => `${amount(q)} ${esc(D.getMaterial(id)?.label || id)}`).join(" + ") || "sin insumos de receta"}`).join(" · ");
    return `<p><strong>${p.factor} módulo(s): salida de caja estimada ${dollars(p.treasuryEstimate)}</strong>; costo económico total ${dollars(p.totalCost)}. La obra paga por avance, no todo al crearla.</p><ul>${rows || "<li>Sin materiales de construcción.</li>"}</ul><p>Operación adicional teórica: ${outputs || "infraestructura o servicio, sin producto material directo"}. Mantenimiento estimado ${dollars(p.maintenance)}/mes; producción efectiva depende de empleo, tecnología, energía, insumos, demanda y almacén.</p>`;
  }
  function oneModuleMaterials(p) {
    return `<p><strong>Referencia de 1 módulo:</strong> ${p.materialQuote.map(x => `${amount(x.required)} ${esc(D.getMaterial(x.id)?.label || x.id)}`).join(" · ") || "sin materiales adicionales"}; ${num(p.laborNeed)} personas de la bolsa compartida.</p>`;
  }
  function projects(s, id) {
    const c = s.countries[s.playerCountryId],
      items = c.projects.filter(
        (p) => (!id || p.sector === id) && p.progress < 100,
      );
    return `<section class="v6-section"><h3>Obras en ejecución · ${items.length}</h3>${
      items.length
        ? items
            .map((p) => {
              const d = E.projectDiagnostic(s, p),
                materialText = d.materials
                  .map(
                    (m) =>
                      `${D.getMaterial(m.id)?.label || m.id}: faltan ${amount(m.missing)}`,
                  )
                  .join(" · "),
                blockers = d.blockers
                  .map((x) => {
                    if (x.type === "workers")
                      return `sin funcionarios ni desocupados disponibles (se requieren ${num(x.amount)})`;
                    if (x.type === "materials") return materialText;
                    if (x.type === "treasury")
                      return `Tesoro insuficiente: necesita ${dollars(x.amount)} y hay ${dollars(x.available)}`;
                    return x.type;
                  })
                  .join(". ");
              return `<div class="v6-project ${d.status === "blocked" ? "v6-project-blocked" : ""}"><strong>${esc(D.getBuilding(p.typeId)?.label || p.typeId)} · ${p.factor || 1} módulos</strong><progress max="100" value="${p.progress}"></progress><span>${num(p.progress, 1)}% · ${num(p.workers || 0)} personas asignadas (${num(p.publicWorkers || 0)} funcionarios + ${num(p.temporaryWorkers || 0)} temporarios) · ${dollars(p.spent)} ejecutados</span><small class="${d.status === "blocked" ? "negative" : "positive"}">${esc(
                d.status === "blocked"
                  ? "No avanzará en la próxima etapa de obras: " + blockers
                  : "Avanzará aproximadamente " +
                      num(d.desired, 1) +
                      "% en la próxima etapa de obras; costo previsto " +
                      dollars(d.pay),
              )}</small></div>`;
            })
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
  function recipeSummary(r) {
    const m = r.material;
    const base = Object.entries(r.baseInputs);
    const baseText = base.length
      ? base.map(([id, q]) => `${recipeAmount(q, D.getMaterial(id).unit)} de ${esc(D.getMaterial(id).label)}`).join(" + ")
      : "Fuente primaria o subproducto; sin insumos de receta";
    const available = r.inputAvailability.length
      ? r.inputAvailability.map(({ id, stock }) => `${esc(D.getMaterial(id).label)}: ${amount(stock, D.getMaterial(id).unit)}`).join(" · ")
      : "No requiere insumos de receta";
    return `<section class="v6-section"><h3>Receta y límites de producción</h3><dl class="v6-lines">${row("Receta base por 1 " + m.unit, baseText)}${row("Materia prima disponible (pública + privada)", available)}${row("Techo por insumos actuales", r.inputLimit === null ? "No aplica" : amount(r.inputLimit, m.unit))}${row("Máximo instalado/mes", amount(r.installedCapacity, m.unit))}${row("Capacidad operativa actual/mes", amount(r.capacity, m.unit))}${row("Producción efectiva pública / privada", amount(r.publicProduction, m.unit) + " / " + amount(r.privateProduction, m.unit))}</dl><p>El techo por insumos es teórico: instalaciones, funcionarios, energía, depósitos y almacén pueden reducirlo. La tecnología de ahorro mejora la receta base.</p></section>`;
  }
  function resourceDetail(s, id, u = {}) {
    const c = s.countries[s.playerCountryId],
      r = E.resourceReport(s, id),
      m = r.material,
      nationalization = E.nationalizePreview(s, id),
      ownershipAction = m.natural ? "extracción" : "producción";
    const related = s.agreements.filter(
      (a) => a.active && a.resource === id && [a.from, a.to].includes(c.id),
    );
    return shell(
      m.label,
      resourceExtras(s, id) +
      recipeSummary(r) +
      `${btn("close-resource", "← Volver")}${m.tier === "final" ? `<p>Precio base ×10 respecto a v7.6. Los bienes duraderos se usan durante años; los alimentos se consumen regularmente. Los equipos profesionales tienen demanda pequeña. Al entrar en uso mejoran capacidades (no por almacenarlos). Bonos actuales: felicidad ×${amount(c.goodsBenefits.happiness)}, producción ×${amount(c.goodsBenefits.production)}, construcción ×${amount(c.goodsBenefits.construction)}, investigación ×${amount(c.goodsBenefits.research)}. Topes: ×1,15 / ×1,25 / ×1,35 / ×1,35. No se acumulan exponencialmente. El plutonio solo tiene uso industrial especializado.</p>` : ""}<p>${esc(m.tier)} · Unidad: ${esc(m.unit)} · ${esc(m.waste ? "Residuo o materia recuperable" : "Producción y consumo mensuales")}</p><div class="v6-grid">${card("Cotización mundial", dollars(s.market.resourcePrices[id]))}${card("Variación mensual", amount((s.market.resourcePrices[id] / (s.market.previousResourcePrices[id] || s.market.resourcePrices[id]) - 1) * 100, "%"))}${card("Pública / privada", amount(r.publicProduction) + " / " + amount(r.privateProduction))}${card("Producción mundial", amount(r.world.production, m.unit), "Puesto " + (r.ranking.find((x) => x.id === c.id)?.position || "—"))}${card("Demanda nacional", amount(c.needs[id], m.unit))}${card("Faltante de hogares", amount(c.shortages[id], m.unit))}${card("Stock público / espacio libre", amount(r.stock) + " / " + amount(r.free))}${card("Excedente público", amount(r.exportable, m.unit))}</div>
    <section class="v6-section"><h3>Cómo producirlo</h3><p>${
      Object.keys(m.inputs).length
        ? Object.entries(m.inputs)
            .map(
              ([id, q]) =>
                `${recipeAmount(q, D.getMaterial(id).unit)} de ${btn("resource", D.getMaterial(id).label, `data-resource="${id}"`)}`,
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
    } → <strong>${esc(m.label)}</strong></p><dl class="v6-lines">${row("Tecnología", esc(D.getTechnology(m.technology).label) + " · nivel " + r.technology)}${row("Instalación", esc(D.getBuilding(m.unlock)?.label || "Producción derivada"))}${row("Costo estimado de insumos por unidad", dollars(r.cost))}${row("Capacidad operativa mensual", amount(r.capacity, m.unit))}${row("Stock privado", amount(r.privateStock, m.unit))}${row("Almacén especializado", esc(D.storageTypes.find((t) => t.id === m.storage).label))}${row("Capacidad pública exclusiva", amount(r.storage.public, m.unit))}${row("Meses de cobertura", c.needs[id] > 0 ? amount((r.stock + r.privateStock) / c.needs[id], "meses") : "Sin demanda actual")}${row("Funcionarios / empleo privado del sector", num(c.sectors[m.sector].publicWorkers) + " / " + num(c.sectors[m.sector].privateWorkers))}${row("Energía disponible", amount(c.energy.served * 100, "%"))}${row("Consumo nacional total", amount(c.materialConsumption[id], m.unit))}${row("Consumo mundial", amount(r.world.consumption, m.unit))}${row("Importado / exportado", amount(c.resourceImports[id]) + " / " + amount(c.resourceExports[id]))}${row("Nivel de utilización pública / privada", amount((c.publicUtilization[id] || 0) * 100, "%") + " / " + amount((c.privateUtilization[id] || 0) * 100, "%"))}${r.depositStatus ? row("Estado del depósito", esc(r.depositStatus)) : ""}${r.deposits ? row("Depósitos terrestre / marítimo", amount(r.deposits.land, m.unit) + " / " + amount(r.deposits.sea, m.unit)) : ""}</dl><p>${esc(r.reason || "Producción condicionada por demanda, personal, insumos y capacidad.")}</p>${D.getBuilding(m.unlock) ? btn("go-sector", "Ver construcción", `data-sector="${m.sector}"`) : ""} ${btn("view-research", "Investigar tecnología", `data-tech="${m.technology}"`)}</section>
    <section class="v6-section"><h3>Propiedad de esta ${ownershipAction}</h3><p>${nationalization.alreadyNationalized ? `La ${ownershipAction} de <strong>${esc(m.label)}</strong> está nacionalizada: la actividad privada de este recurso queda deshabilitada.` : `Nacionalizar transfiere al Estado las instalaciones vinculadas, el stock privado de ${esc(m.label)} y la parte proporcional de sus trabajadores.`}</p><dl class="v6-lines">${row("Estado", nationalization.alreadyNationalized ? "Nacionalizada" : "Mixta o privada")}${row("Costo de transferencia", dollars(nationalization.cost))}${row("Trabajadores transferidos", num(nationalization.workers))}${row("Stock transferido", amount(nationalization.stock, m.unit))}${nationalization.linkedProductions.length ? row("Instalación compartida", esc(nationalization.linkedProductions.join(", "))) : ""}</dl>${nationalization.alreadyNationalized ? "" : btn("nationalize", "Revisar nacionalización", `data-resource="${id}"`)}</section>
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
  function resourceExtras(s, id) {
    const c = s.countries[s.playerCountryId], r = E.resourceReport(s, id), m = r.material;
    const store = D.getBuilding(`store_${id}`), p = E.constructionPreview(s, store.id);
    const input = Object.entries(m.inputs).map(([key, q]) => `${amount(q * m.baseOutput)} ${esc(D.getMaterial(key)?.label || key)}`).join(" + ") || "sin insumos de receta";
    const diagnostics = r.automaticTrade;
    const overflow = Math.max(0, r.stock - r.storage.public) + Math.max(0, r.privateStock - r.storage.private);
    const wasteHelp = m.waste ? `<p>Tratamiento: ${id === "recyclables" ? "planta de reciclaje → minerales recuperados" : id === "organic_waste" ? "central de biomasa o compostaje → biomasa; también planta de tratamiento" : "planta de tratamiento"}. Capacidad receptora disponible: ${amount(E.wasteReceptionCapacity(c, m), m.unit)}. Compostaje efectivo del mes: ${amount(c.composted || 0, "u de biomasa")}. La exportación de basura con precio negativo es un <strong>pago de disposición</strong>, no un ingreso. Requiere receptor con capacidad.</p>` : "";
    const woodHelp = id === "timber" ? `<p>La central de madera quema 0,9 u/MWh. Compite con construcción, industria y exportación; el combustible consumido sale del stock del dueño de la central.</p>` : "";
return `${overflow > 0 ? `<p class="negative">Exceso heredado sin espacio: ${amount(overflow, m.unit)}. Se conserva el stock, pero no ingresa ni se produce más hasta liberarlo o ampliar el almacén.</p>` : ""}<section class="v6-section"><h3>Planificación específica de ${esc(m.label)}</h3><dl class="v6-lines">${row("Salida teórica por instalación", amount(m.baseOutput, m.unit) + "/mes")}${row("Insumos por instalación a plena carga", input)}${row("Producción pública / privada efectiva", amount(r.publicProduction, m.unit) + " / " + amount(r.privateProduction, m.unit))}${row("Funcionarios solicitados / asignados", num(r.staff.requested) + " / " + num(r.staff.assigned))}${row("Máximo operativo con instalaciones", num(r.staff.operatingMax))}${row("Sueldo público mensual", "US$ " + num(r.staff.salary, 2))}${row("Tecnología y energía", "Nivel " + r.technology + " · red cubierta " + amount(c.energy.served * 100, "%"))}${row("Almacén público: stock / capacidad", amount(r.stock, m.unit) + " / " + amount(r.storage.public, m.unit))}${row("Almacén privado: stock / capacidad", amount(r.privateStock, m.unit) + " / " + amount(r.storage.private, m.unit))}${row("Módulos de almacén público / privado", num(r.storage.publicModules, 2) + " / " + num(r.storage.privateModules, 2))}</dl>${form("resource-staff", field("staffLimit", "Máximo de funcionarios públicos solicitados", Number.isFinite(c.resourceStaffLimits?.[id]) ? c.resourceStaffLimits[id] : Math.ceil(r.staff.operatingMax), "number", 'min="0" step="1"'), `data-resource="${id}"`)}<p>La dotación sale de los funcionarios pagos del sector; aumentar el máximo no crea personas ni salta la cualificación.</p><article><h4>Almacén exclusivo</h4><p>Un módulo agrega ${amount(r.storage.module, m.unit)} solo a ${esc(m.label)}. Costo fijo ${dollars(p.baseCost)}; capacidad familiar antigua repartida al cargar.</p>${field("quantity", "Módulos", 1, "number", 'data-build-quantity min="1" max="999" step="1"')}<div data-build-quote>${constructionQuote(p, s.adminMode)}</div>${btn("build", "Construir almacén", `data-building="${store.id}"`, !!p.blocked)}</article>${wasteHelp}${woodHelp}</section><section class="v6-section"><h3>Exportación automática · último ciclo</h3><dl class="v6-lines">${row("Excedente elegible público / privado", amount(diagnostics.offeredPublic, m.unit) + " / " + amount(diagnostics.offeredPrivate, m.unit))}${row("Vendido público / privado", amount(diagnostics.soldPublic, m.unit) + " / " + amount(diagnostics.soldPrivate, m.unit))}${row("Cobro público / privado", dollars(diagnostics.receivedPublic) + " / " + dollars(diagnostics.receivedPrivate))}${row("Impuesto público sobre venta privada", dollars(diagnostics.tax))}${row("Comprador", diagnostics.buyer ? esc(s.countries[diagnostics.buyer]?.name || diagnostics.buyer) : "Ninguno")}${row("Resultado", esc(diagnostics.reason))}</dl></section>`;
  }
  function economyTutorial() {
    return `<section class="v6-section v6-economy-tutorial"><h3>Cómo leer Economía y deuda</h3><p>Todos los valores del resumen corresponden al <strong>último mes cerrado</strong>. Mirá primero el cambio de reservas: es la caja pública que realmente ganaste o perdiste.</p><details open><summary>1. Ingresos: qué los aumenta y qué los reduce</summary><dl class="v6-lines">${row("Entró al Tesoro", "Suma de impuestos, ventas y otros cobros públicos. Sube si hay más actividad gravada, producción/ventas públicas y comercio con aranceles; baja con menor empleo, consumo, ganancias, comercio o cierres de empresas.")}${row("Impuestos cobrados", "IVA: sube con consumo gravado. Ganancias: con empleo formal y utilidades. Herencias: tiene una base pequeña. Importación/exportación: solo suben si realmente existe comercio. Aumentar una alícuota no crea actividad y puede reducir el consumo o el comercio.")}${row("Ventas y servicios públicos", "Suben cuando instalaciones públicas venden excedentes o prestan servicios. Requieren capacidad, funcionarios pagos, energía, insumos, demanda y —para exportar— comprador y transporte.")}${row("PBI real y nominal", "El nominal cambia también con precios; el real refleja más producción/servicios. Ambos tienden a subir con empleo productivo, eficiencia, energía, tecnología, infraestructura y demanda; caen con escasez, desempleo, deterioro o producción detenida.")}${row("Balance comercial", "Exportaciones menos importaciones del país, públicas y privadas. Mejora al vender excedentes competitivos y reducir compras necesarias; empeora con importaciones altas o pérdida de capacidad exportadora. No todo superávit comercial entra al Tesoro.")}</dl></details><details><summary>2. Gasto: qué lo aumenta y cómo contenerlo</summary><dl class="v6-lines">${row("Sueldos públicos y obras", "Aumentan con funcionarios cubiertos, salarios más altos y obreros asignados. Para reducirlos, bajá puestos solicitados, salario u obras nuevas; una nómina impaga también reduce la producción pública.")}${row("Pensiones", "Suben con más jubilados y una pensión mensual mayor. Se puede ajustar la pensión por jubilado; reducirla baja el gasto desde el próximo cierre mensual, pero también ingresos de hogares, consumo y bienestar. La edad de retiro cambia gradualmente el número de jubilados.")}${row("Costos específicos", "La producción pública paga los insumos que compra; vivienda, educación e investigación conservan sus propios topes o costos. Ya no existe un presupuesto general duplicado por ministerio.")}${row("Obras e investigación", "Solo se ejecutan si hay Tesoro, su propio financiamiento cuando corresponda, materiales y trabajadores. Una obra detenida no se acelera subiendo impuestos de inmediato: abrí el ministerio y leé el bloqueo exacto.")}${row("Insumos y otros pagos", "Suben cuando el Estado compra recursos nacionales. Disminuyen al usar existencias propias, producir localmente o ajustar el ritmo de expansión.")}</dl></details><details><summary>3. Deuda, cuentas y riesgo</summary><dl class="v6-lines">${row("Intereses", "Costo mensual de la deuda. Suben al pedir préstamos o acumular deuda; bajan al amortizar capital y evitar nuevo crédito caro. No financian producción por sí mismos.")}${row("Amortización de capital", "Pago que reduce la deuda nominal. Puede salir de un superávit o de una cuota de préstamo. Es una salida de reservas, pero mejora la carga futura.")}${row("Cuotas próximas", "Compromisos de préstamos activos. Suben al contratar más crédito o elegir plazos cortos/tasas altas; bajan al pagar capital, terminar cuotas o no sumar deuda.")}${row("Reservas del Tesoro", "Caja del Estado. Suben con superávit, préstamos y ventas/cobros públicos; bajan con todo gasto, compra manual y servicio de deuda. No son el dinero de hogares ni empresas.")}${row("Caja privada y dinero de hogares", "Recursos de empresas y población. Suben con ventas, salarios, pensiones y actividad privada; bajan con compras, impuestos y pérdidas. No pagan directamente una obra pública ni una cuota estatal.")}${row("Cambio real de reservas", "Resultado final del mes: positivo acumula caja, negativo la consume. Si es negativo de forma persistente, primero identificá los mayores gastos antes de endeudarte.")}${row("Deuda nominal y % del PBI", "La nominal es lo adeudado; el porcentaje la compara con el tamaño de la economía. El PBI puede mejorar el porcentaje, pero no borra capital. Hay cesación de pagos si la deuda supera 205% del PBI y el Tesoro está agotado.")}${row("Crédito automático", "Cubre obligaciones públicas dentro del límite, pero transforma falta de caja en más deuda. Desactivarlo evita nueva deuda automática, aunque puede detener gastos y obras sin reservas.")}</dl></details><details><summary>4. Lectura práctica para decidir</summary><ol class="v6-guide-list"><li>Si <strong>cambio real de reservas</strong> es negativo, revisá los tres mayores gastos.</li><li>Si la <strong>operación antes de deuda</strong> es positiva pero el resultado final es negativo, los intereses son el problema principal: evitá nuevos préstamos y buscá superávit.</li><li>Si una obra no avanza, corregí el bloqueo indicado: material, Tesoro o desempleo disponible.</li><li>Usá impuestos sobre una base existente: IVA para consumo, ganancias para empleo/utilidades y aranceles solo si hay comercio. Aplicá el cambio y avanzá un mes para medirlo.</li><li>No confundas caja privada u hogares con reservas: solo el Tesoro paga la obra pública y la deuda.</li></ol></details></section>`;
  }
  function economy(s) {
    const c = s.countries[s.playerCountryId],
      v = c.finance.monthly,
      f = E.financeSummary(s),
      expenseLabels = {
        payroll: "Salarios públicos y de obra",
        pensions: "Pensiones",
        operations: "Otros gastos operativos",
        investment: "Obras e investigación",
        inputs: "Insumos nacionales",
        otherExpense: "Otros pagos",
        interest: "Intereses de deuda",
        principal: "Amortización de capital",
      },
      fiscalAdvice =
        f.reserveChange < -1e-9
          ? `Las reservas bajan ${dollars(-f.reserveChange)} por mes. Al ritmo actual alcanzan para ${f.runwayMonths === null ? "un plazo no estimable" : num(f.runwayMonths, 1) + " meses"}.`
          : `Las reservas suben ${dollars(f.reserveChange)} por mes con los datos del último mes.`,
      debtAdvice =
        f.debtPressure >= 0.25
          ? `Los intereses absorben ${amount(f.debtPressure * 100, "%")} de los ingresos públicos del último mes. Antes de sumar deuda, revisá gastos e inversión.`
          : "La carga de intereses está por debajo de una cuarta parte de los ingresos públicos del último mes.";
    return shell(
      "Economía y deuda",
      economyPensions(s) +
      `${economyTutorial()}<section class="v6-section v6-finance-summary"><h3>Resumen del último mes</h3><p class="method-note">Separa operación, deuda y financiación: así podés ver qué está vaciando el Tesoro sin leer cada asiento contable.</p><div class="v6-grid">${card("Entró al Tesoro", dollars(f.income), "Impuestos " + dollars(f.taxes) + " · ventas públicas " + dollars(f.publicSales))}${card("Operación antes de deuda", dollars(f.operatingBalance), f.operatingBalance < 0 ? "El gasto cotidiano supera a los ingresos" : "Los ingresos cubren el gasto cotidiano")}${card("Intereses", dollars(f.interest), amount(f.debtPressure * 100, "% de los ingresos"))}${card("Cambio real de reservas", dollars(f.reserveChange), f.reserveChange < 0 ? "Las reservas se redujeron" : "Las reservas crecieron")}</div><dl class="v6-lines">${row("Impuestos cobrados", dollars(f.taxes))}${row("Ventas y servicios públicos", dollars(f.publicSales))}${row("Sueldos públicos y obras", dollars(f.payroll))}${row("Pensiones", dollars(f.pensions))}${row("Otros gastos operativos", dollars(f.operations))}${row("Obras e investigación", dollars(f.investment))}${row("Insumos y otros pagos", dollars(f.inputs + f.otherExpense))}${row("Intereses", dollars(f.interest))}${row("Amortización de capital", dollars(f.principal))}</dl><div class="v6-alert ${f.reserveChange < 0 ? "v6-alert-warning" : ""}"><strong>Lectura rápida:</strong> ${esc(fiscalAdvice)} ${esc(debtAdvice)}</div><p>Mayores gastos del mes: ${f.topExpenses.length ? f.topExpenses.map((x) => `${esc(expenseLabels[x.key])} (${dollars(x.value)})`).join(" · ") : "sin pagos públicos registrados todavía"}.</p></section><section class="v6-section"><h3>Detalle patrimonial y financiación</h3><div class="v6-grid">${card("Reservas del Tesoro", dollars(c.reserves), "Saldo público disponible")}${card("Caja privada", dollars(c.finance.privateCash))}${card("Dinero de hogares", dollars(c.finance.householdCash))}${card("Deuda nominal", dollars(c.finance.nominalDebt), amount(c.debt, "% del PBI"))}${card("PBI real / nominal", dollars(c.realGdp) + " / " + dollars(c.gdp))}${card("Balance comercial nacional", dollars(c.tradeBalance), "Incluye comercio público y privado")}</div><p>Las operaciones privadas no se cargan al Tesoro. Un préstamo agrega capital disponible y deuda; las compras se descuentan una sola vez. La deuda no desaparece porque crezca el PBI.</p><dl class="v6-lines">${row("Resultado fiscal (incluye intereses)", dollars(c.fiscalCashFlowMonthly || 0))}${row("Cuotas próximas de préstamos", dollars(c.debtServiceMonthly))}${row("Crédito automático máximo", amount(c.finance.creditLimitShare, "% PBI"))}</dl>${btn("auto-credit", c.finance.automaticCredit ? "Desactivar crédito automático" : "Activar crédito automático")}<p>La financiación automática cubre gastos públicos hasta su límite; las compras manuales requieren reservas disponibles. Deuda superior al 205% del PBI y reservas agotadas mantienen la condición de cesación de pagos.</p></section><div class="v6-buildings">${E.LOAN_OPTIONS.map(
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
  function economyPensions(s) {
    const c = s.countries[s.playerCountryId], p = E.pensionPreview(c);
    const paid = c.pensionPolicy.paidPerRetireeUsd || 0;
    const measured = c.pensionPolicy.measured === true;
    return `<section class="v6-section"><h3>Pensión mensual por jubilado</h3><div class="v6-grid">${card("Jubilados", num(p.people))}${card("Pensión fijada", "US$ " + num(c.pensionPolicy.monthlyUsd, 2))}${card("Solicitado este mes", dollars(p.monthly))}${card("Pagado último mes", measured ? dollars(c.pensionPolicy.paid || 0) : "Pendiente")}${card("Cobertura efectiva", !measured ? "Pendiente" : p.monthly > 0 ? amount((c.pensionPolicy.paid || 0) / p.monthly * 100, "%") : "Sin obligación")}${card("Proyección anual", dollars(p.annual))}</div>${form("pension", field("monthlyUsd", "US$ mensuales por jubilado", c.pensionPolicy.monthlyUsd, "number", 'min="0" step="0.01"'))}<p>Reservas si se pagara hoy el mes completo: ${dollars(p.projectedReserves)}. Pago posible con caja actual: ${amount(p.coverage * 100, "%")}; el crédito automático, si está habilitado, puede cubrir parte. Pensión efectiva del último cierre: ${measured ? "US$ " + num(paid, 2) + " por jubilado" : "pendiente"}. Bajarla alivia el Tesoro, pero reduce ingresos de hogares, consumo y gradualmente bienestar.</p></section>`;
  }
  function trade(s) {
    const c = s.countries[s.playerCountryId];
    return shell(
      "Comercio exterior",
      tradeDiagnostics(s) +
      `<p>Seleccioná los recursos habilitados para exportación automática (pública y privada). Solo se ofrece el excedente; vender exige compradores, transporte y fondos. Las ventas privadas no ingresan al Tesoro.</p>
      ${btn("ban-all", c.importsBanned ? "Reabrir importaciones" : "Prohibir todas las importaciones")}
      <p>Importaciones: <strong>${c.importsBanned ? "cerradas" : "abiertas"}</strong>. Las prohibiciones por recurso también se respetan.</p>
      <section class="v6-section"><h3>Mercado automático por recurso</h3>
      <p>Importar repone el <strong>stock público</strong> hasta el umbral indicado en cada ciclo comercial mensual. Usa únicamente reservas disponibles, sin pedir préstamos. Puede comprar menos por falta de oferta, espacio o transporte. El umbral importado queda protegido de reventa automática. Las empresas mantienen sus compras privadas. Atención: exportar residuos con precio negativo cuesta dinero; importar residuos requiere capacidad de tratamiento.</p>
      ${form(
        "trade-policies",
        `<div class="v6-tabs"><button type="button" class="button compact" data-select-sales="true">Seleccionar todos para vender</button><button type="button" class="button compact" data-select-sales="false">Desmarcar todos</button></div><p>Estos botones editan la selección: presioná Aplicar para guardarla.</p><div class="table-wrap"><table class="v6-table"><thead><tr><th>Recurso / unidad</th><th>Vender excedente</th><th>Importar automáticamente</th><th>Si stock público baja de</th></tr></thead><tbody>${D.materials
          .map((m) => {
            const p = c.tradePolicies[m.id];
            return `<tr><th>${esc(m.label)}<small>${esc(m.unit)}</small></th><td><input aria-label="Vender ${esc(m.label)}" type="checkbox" name="sell_${m.id}" ${p.sell ? "checked" : ""}></td><td><input aria-label="Importar ${esc(m.label)}" type="checkbox" name="import_${m.id}" ${p.autoImport ? "checked" : ""}></td><td><input aria-label="Umbral ${esc(m.label)}" type="number" name="floor_${m.id}" min="0" max="1000000000000000" step="any" value="${p.importBelow}"></td></tr>`;
          })
          .join("")}</tbody></table></div>`,
      )}
      <p>Los acuerdos anteriores quedan cerrados al actualizar; el comercio continúa con estas reglas, sin contratos.</p></section><section class="v6-section"><h3>Flujos del último mes</h3><div class="table-wrap"><table class="v6-table"><thead><tr><th>Recurso</th><th>Origen</th><th>Destino</th><th>Cantidad</th><th>Valor</th></tr></thead><tbody>${s.market.trades
        .filter((t) => t.from === c.id || t.to === c.id)
        .slice(0, 60)
        .map(
          (t) =>
            `<tr><td>${esc(D.getMaterial(t.commodity)?.label || t.commodity)}</td><td>${esc(s.countries[t.from]?.name || t.from)}</td><td>${esc(s.countries[t.to]?.name || t.to)}</td><td>${amount(t.quantity)}</td><td>${dollars(t.value)}</td></tr>`,
        )
        .join("")}</tbody></table></div></section>`,
    );
  }
  function tradeDiagnostics(s) {
    const c = s.countries[s.playerCountryId];
    const rows = D.materials.map((m) => ({ m, r: E.automaticExportReport(s, m.id) }))
      .filter(({ r }) => r.enabled || r.soldPublic + r.soldPrivate > 0)
      .map(({ m, r }) => `<tr><th>${esc(m.label)}</th><td>${amount(r.offeredPublic + r.offeredPrivate, m.unit)}</td><td>${amount(r.soldPublic + r.soldPrivate, m.unit)}</td><td>${dollars(r.receivedPublic)}</td><td>${dollars(r.receivedPrivate)}</td><td>${dollars(r.tax)}</td><td>${esc(r.reason)}</td></tr>`).join("");
    return `<section class="v6-section"><h3>Diagnóstico de exportación automática</h3><p>Intentos y ventas del último ciclo mensual. El valor privado no entra íntegro al Tesoro. Las restricciones de comprador, transporte y espacio pueden frenar una oferta.</p><div class="table-wrap"><table class="v6-table"><thead><tr><th>Recurso</th><th>Excedente ofrecido</th><th>Vendido</th><th>Cobro público</th><th>Cobro privado</th><th>Impuesto al Tesoro</th><th>Motivo</th></tr></thead><tbody>${rows || "<tr><td colspan='7'>No hay recursos habilitados para venta automática.</td></tr>"}</tbody></table></div></section>`;
  }
  function territory(s) {
    const c = s.countries[s.playerCountryId],
      l = c.land;
    return shell(
      "Territorio y vivienda",
      `<div class="v6-grid">${card("Superficie terrestre", amount(l.areaKm2, "km²"))}${card("Densidad", amount((c.population * 1e6) / l.areaKm2, "hab/km²"))}${card("Techo del escenario", num(l.areaKm2 * 60000) + " habitantes")}${card("Suelo libre", amount(E.availableLand(c), "ha"))}${card("Residencial", amount(l.residentialHa, "ha"))}${card("Agrícola", amount(l.agricultureHa, "ha"))}${card("Irrigado", amount(l.irrigatedHa, "ha"))}${card("Industrial y redes", amount(l.industrialHa, "ha"))}${card("Restringido/no apto", amount(l.restrictedHa, "ha"))}${card("Viviendas nuevas", num(c.housingStock.new * 1e6))}${card("Viviendas normales", num(c.housingStock.normal * 1e6))}${card("A refaccionar", num(c.housingStock.repair * 1e6))}</div><p>Al ocupar suelo agrícola, la obra muestra un aviso previo y descuenta las hectáreas convertidas una sola vez. Densificar reduce el uso de suelo.</p><section class="v6-section"><h3>Redes e instalaciones iniciales y construidas</h3><dl class="v6-lines">${Object.entries(
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
  function nutrition(s) {
    const c = s.countries[s.playerCountryId], n = E.nutritionReport(s), w = n.wellbeing;
    const foodRows = Object.entries(D.foodProfiles).map(([id, p]) => {
      const m = D.getMaterial(id);
      return `<tr><th>${btn("resource", m.label, `data-resource="${id}"`)}</th><td>${num(p.rations)}</td><td>${amount(c.publicStocks[id])} / ${amount(c.privateStocks[id])}</td><td>${amount(c.householdConsumed[id])}</td><td>${dollars(s.market.resourcePrices[id])}</td><td>${amount(p.spoilage * 100, "%/mes")}</td></tr>`;
    }).join("");
    const advice = !n.measured ? "El primer cierre de consumo calculará cobertura, calidad y hambre. Actualizar una partida no aplica hambre retroactiva."
      : n.shortfall < 1 ? "Necesidades básicas cubiertas. Conservá reservas y mejorá la variedad para aumentar la calidad de la dieta."
      : `${n.unavailable > 0 ? "Faltan existencias: aumentá producción, habilitá importaciones o comprá alimentos. " : ""}${n.unaffordable > 0 ? "Hay alimentos que los hogares no pudieron pagar: revisá empleo, salarios e impuestos, o activá la distribución pública. " : ""}El efecto se mide en el siguiente cierre de consumo.`;
    return shell("Alimentación y bienestar", `
      <p>Unidades de juego: una ración diaria equivalente cubre las necesidades básicas de una persona durante un día. Se calculan con los días reales de cada mes. Último cierre alimentario: ${n.measured ? "mes " + n.closedTick : "pendiente"}.</p>
      <div class="v6-grid">
        ${card("Cobertura alimentaria", n.measured ? amount(n.coverage * 100, "%") : "Pendiente", "Consumo efectivo; los alimentos se sustituyen")}
        ${card("Hambre", amount(n.hunger, "/100"), `${n.hungerChange >= 0 ? "+" : ""}${amount(n.hungerChange)} puntos en el último cierre`)}
        ${card("Calidad de dieta", n.measured ? amount(n.quality, "/100") : "Pendiente", "Variedad y calidad, separadas de la cantidad")}
        ${card("Reservas alimentarias", amount(n.stockDays, "días"), `Públicas ${amount(n.publicDays)} · privadas ${amount(n.privateDays)}`)}
        ${card("Faltante del último cierre", num(n.shortfall) + " raciones", `Sin acceso económico ${num(n.unaffordable)} · sin existencias ${num(n.unavailable)}`)}
        ${card("Efecto sobre producción", amount((n.productivity - 1) * 100, "%"), "El hambre reduce la eficiencia productiva")}
        ${card("Ayuda entregada este ciclo", num(n.aidRations) + " raciones", `Gasto efectivo ${dollars(n.aidSpent)}`)}
        ${card("Muertes por hambre", num(n.hungerDeaths, 2), "Último cálculo demográfico; solo hambre grave y prolongada")}
      </div><p class="method-note">${esc(advice)}</p>
      <section class="v6-section"><h3>Distribución pública de emergencia</h3>
        <p>Cubre únicamente las raciones que faltan tras las compras de los hogares. Usa stock público y puede comprar stock privado nacional. El presupuesto paga compras y distribución (2% del valor de mercado). Se limita al dinero disponible; no pide préstamos. Las importaciones se gestionan en Comercio exterior.</p>
        ${form("food-policy",
          select("aidEnabled", "Distribución", [{ id: "false", label: "Desactivada" }, { id: "true", label: "Activada" }], String(n.aidEnabled)) +
          field("aidBudget", "Tope mensual de gasto (US$)", n.aidBudget * 1e9) +
          field("protectedDays", "Reserva protegida de exportación automática (días)", n.protectedDays, "number", 'min="0" max="365"'))}
        <p>Tesoro actual: ${dollars(c.reserves)}. Stock público entregado este ciclo: ${dollars(n.aidStockValue)} de valor de mercado, sin volver a cobrar su compra. Referencia mínima para comprar el faltante al precio actual más barato: ${dollars(n.estimatedPurchaseCost)}; no garantiza vendedores ni incluye aranceles de importación.</p>
        <p>Proteger reservas restringe las ventas automáticas, no el consumo ni las ventas manuales. El stock privado sigue necesitando compradores con dinero. Presupuesto cero o Tesoro agotado detienen la ayuda.</p>
      </section>
      <section class="v6-section"><h3>Alimentos y existencias actuales</h3><div class="table-wrap"><table class="v6-table"><thead><tr><th>Alimento</th><th>Raciones/u</th><th>Stock público / privado (u)</th><th>Consumido este ciclo (u)</th><th>Precio/u</th><th>Merma de stock</th></tr></thead><tbody>${foodRows}</tbody></table></div><p>Procesar mejora la calidad y la disponibilidad de alimento según la receta de unidades de juego. La merma se aplica una vez al cierre del consumo. Última pérdida: ${num(n.spoilageRations)} raciones equivalentes. Son coeficientes de equilibrio del juego, no datos nutricionales reales.</p></section>
      <section class="v6-section"><h3>Por qué cambia la felicidad</h3>
        <p>Actual: ${amount(c.happiness, "%")} · objetivo con los indicadores actuales: ${amount(w.target, "%")} · ajuste previsto: ${w.monthlyChange >= 0 ? "+" : ""}${amount(w.monthlyChange, "puntos/mes")}. Se recorre el 8% de la diferencia en cada cierre; no es una suma aplicada inmediatamente.</p>
        <dl class="v6-lines">${w.items.map((x) => row(x.label, `<span class="${x.points < 0 ? "negative" : "positive"}">${x.points >= 0 ? "+" : ""}${amount(x.points, "puntos")}</span>`)).join("")}</dl>
        <p>La suma es el objetivo. Los bienes de lujo no pueden compensar el hambre grave. IVA y ganancias tienen una penalización directa; aranceles y herencias afectan el acceso a bienes y el dinero disponible por sus circuitos económicos.</p>
        <p>Vida laboral: ${w.span} años. Entre 38 y 47 es neutral; menos mejora ese componente hasta +8 puntos y más lo penaliza hasta −18. Empezar antes de los 18 afecta educación y bienestar; retirarse después de los 67 agrega desgaste de salud. Una brecha corta reduce trabajadores y aumenta la carga previsional.</p>
      </section>
      <details class="v6-section"><summary>Cómo recuperar un país con hambre</summary><ol><li>Compará stock con acceso económico: un almacén lleno no garantiza que los hogares puedan comprar.</li><li>Para falta física, producí o importá alimentos. Para falta de dinero, mejorá empleo e ingresos o distribuí ayuda pública.</li><li>Protegé una reserva y revisá la caducidad. Granos y elaborados duran más que leche y carne.</li><li>El hambre sube como máximo 20 puntos mensuales ante falta total y baja hasta 12 con cobertura completa. Una dieta variada mejora salud y bienestar.</li><li>El hambre acumulada afecta producción y salud; los casos graves y prolongados aumentan mortalidad. La felicidad ya influye en la emigración del motor existente.</li></ol></details>
    `);
  }
  function demographics(s, u) {
    const c = s.countries[s.playerCountryId],
      p = c.laborSnapshot;
    return shell(
      "Población y trabajo",
      demographicPolicyPanel(s) +
      `<div class="v6-grid">${card("Habitantes", num(c.population * 1e6))}${card("Esperanza de vida", amount(c.lifeExpectancy, "años"))}${card("Menores de 18", num(p.children * 1e6))}${card("Edad laboral habilitada", num(p.workingAge * 1e6))}${card("Ocupados", num(p.employed * 1e6))}${card("Desocupados", num(p.unemployed * 1e6))}${card("Inactivos en edad laboral", num(p.inactive * 1e6))}${card("Edad previsional", num(p.retired * 1e6))}${card("Natalidad del mes", num(c.demographicFlows.births * 1e6, 2))}${card("Fallecimientos del mes", num(c.demographicFlows.deaths * 1e6, 2))}${card("Migración neta mensual", num(c.demographicFlows.migration * 1e6, 2))}${card("Pensiones pagadas", dollars(c.finance.pensions || 0))}</div><p>La habilitación laboral no obliga a trabajar. La cualificación, vacantes y salario determinan la ocupación; adelantar la incorporación puede perjudicar la educación.</p>${form("ages", field("start", "Edad inicial", c.workPolicy.start, "number", 'min="12" max="79" step="1"') + field("retire", "Edad de retiro", c.workPolicy.retire, "number", 'min="13" max="80" step="1"'))}<p class="method-note">Esperanza de vida inicial: ${c.dataSources.lifeExpectancy ? "Banco Mundial " + c.dataSources.lifeExpectancy.year : "estimación de juego"}. La mortalidad se calcula por grupos de edad.</p>${rankingTable(s, u, true)}`,
    );
  }
  function demographicPolicyPanel(s) {
    const c = s.countries[s.playerCountryId], p = c.demographicPolicy, r = c.demographicRequests;
    const levels = [{id:"promote",label:"Fomento"},{id:"neutral",label:"Neutralidad"},{id:"restrict",label:"Restricción moderada"},{id:"quota",label:"Cuota estricta"},{id:"ban",label:"Prohibición"}];
    const effects = `<div class="table-wrap"><table class="v6-table"><thead><tr><th>Nivel</th><th>Nacimientos</th><th>Entradas</th><th>Salidas</th><th>Costo administrativo por control/mes</th></tr></thead><tbody>${levels.map(x=>{ const rule=E.populationPolicyLevels[x.id]; return `<tr><th>${esc(x.label)}</th><td>×${amount(rule.birth)}</td><td>×${amount(rule.entry)}</td><td>×${amount(rule.exit)}</td><td>${dollars(c.gdp*rule.cost*0.000003/12)}</td></tr>`; }).join("")}</tbody></table></div>`;
    return `<section class="v6-section"><h3>Políticas de natalidad y migración</h3><p>Las solicitudes no son habitantes: solo ingresan cuando hay vivienda, suelo y permiso. Se priorizan destinos del mismo continente; como máximo 12% de las salidas busca otro continente por mes.</p>${effects}${form("demographic-policy", select("birth", "Natalidad", levels, p.birth) + select("entry", "Ingreso al país", levels, p.entry) + select("exit", "Egreso del país", levels, p.exit))}<p>Fomento eleva la tendencia con costo público; restricciones y prohibiciones reducen el movimiento formal y el bienestar. Si no se paga la administración, los controles pierden eficacia. Los nacimientos futuros cambian, no la población pasada.</p><div class="v6-grid">${card("Solicitudes de salida", num(r.exit, 2))}${card("Salidas realizadas", num(r.departed || 0,2))}${card("Solicitudes de entrada", num(r.entry,2))}${card("Ingresos aprobados", num(r.accepted,2))}${card("Solicitudes rechazadas", num(r.rejected,2))}${card("Demanda de salida pendiente", num(r.waiting,2))}${card("Costo de administración", dollars(p.cost || 0))}${card("Eficacia de control", amount((p.efficacy ?? 1)*100,"%"))}</div></section>`;
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
  function researchQueue(s, u) {
    const c = s.countries[s.playerCountryId],
      queue = c.research.queue || [],
      page = Math.max(
        0,
        Math.min(u.queuePage || 0, Math.ceil(queue.length / 40) - 1),
      ),
      head = queue[0],
      p = E.researchQueuePreview(c, head);
    return `<section class="v6-section"><h3>Cola compartida · ${queue.length} proyectos</h3><p>Solo avanza el primero. Los demás esperan sin gastar. El siguiente comienza en la próxima etapa mensual; un bloqueo no permite saltear el orden.</p>${p ? `<h4>${esc(p.label)}</h4><progress max="100" value="${p.currentProgress}"></progress><p>${amount(p.currentProgress, "%")} · avance previsto ${amount(p.rate, "puntos porcentuales/mes")} · restante ${p.remainingMonths === null ? "sin avance" : amount(p.remainingMonths, "meses")}</p><p>Científicos disponibles: ${num(c.researchScientists || 0)} / ${num(p.referenceScientists)} de referencia · formación ${amount(c.education, "/100")} · presupuesto de referencia ${dollars(p.referenceBudget)}/mes · gasto previsto ${dollars(p.cost)}.</p>${p.reasons.length ? `<p class="negative">${esc(p.reasons.join(" · "))}</p>` : ""}` : "<p>No hay proyectos pendientes.</p>"}${queue
      .slice(page * 40, page * 40 + 40)
      .map((item, i) => {
        const d = E.researchQueuePreview(c, item);
        return `<article class="v6-project"><strong>${page * 40 + i + 1}. ${esc(d.label)}</strong><span>${page * 40 + i === 0 ? "Activo" : "En espera"} · ${amount(d.currentProgress, "%")}</span>${btn("cancel-queue", "Quitar de la cola", `data-queue="${item.queueId}"`)}</article>`;
      })
      .join(
        "",
      )}${queue.length > 40 ? `<p>Página ${page + 1} / ${Math.ceil(queue.length / 40)}</p>${btn("queue-page", "Anterior", `data-page="${page - 1}"`, page === 0)} ${btn("queue-page", "Siguiente", `data-page="${page + 1}"`, (page + 1) * 40 >= queue.length)}` : ""}<p>El avance mensual es fijo mientras no cambien científicos, laboratorios, formación o tecnologías activas. El presupuesto mensual solo habilita el trabajo y define cuánto se paga; si no hay fondos, el proyecto queda detenido. La última etapa paga solo el trabajo restante.</p></section>`;
  }
  function technologyState(c, t) {
    const level = c.research.levels[t.id] || 0;
    const missing = t.requires.filter((id) => !(c.research.levels[id] > 0));
    const queued = (c.research.queue || []).filter((x) =>
      x.kind === "research" && x.technology === t.id);
    return {
      level, missing, queued,
      status: level > 0 ? "Investigada" : missing.length
        ? "Faltan otras investigaciones" : "Sin investigar",
    };
  }
  const researchEffects = {
    output: "producción", cost: "ahorro de insumos y operación",
    quality: "calidad", logistics: "logística", resilience: "resiliencia",
    education: "educación", health: "salud", services: "servicios",
    waste: "tratamiento", tax: "recaudación", capacity: "capacidad",
  };
  function researchCard(s, t) {
    const c = s.countries[s.playerCountryId],
      state = technologyState(c, t),
      admin = s.adminMode,
      linked = D.materials.some((m) => m.technology === t.id) ||
        D.constructions.some((b) => b.energyOutput && b.technology === t.id),
      blocked = !admin && !c.buildings.research_lab;
    return `<article data-tech="${esc(t.id)}"><h3>${state.level ? "Mejora de " : "Investigar "}${esc(t.label)}</h3><p>Nivel ${state.level}/${t.maxLevel} · ${t.effect === "capacity" ? "Capacidad: 1.000 MWh por unidad de red y nivel." : `${esc(researchEffects[t.effect] || t.effect)}: aporte sectorial de ${amount(t.improvement * 15, "%")} por nivel (tope conjunto 40%).`} ${linked ? "Desde el nivel 2: +8% de capacidad por nivel en la producción vinculada." : ""}</p><p>${t.requires.length ? "Requiere: " + t.requires.map((id) => esc(D.getTechnology(id).label)).join(", ") : "Tecnología de base"} · formación de referencia ${t.skill}/100</p><p>${admin ? `Próximo nivel: ${state.level + 1}. Modo admin: inmediato y gratis, sin científicos ni laboratorio.` : `Próximo nivel a encolar: ${state.level + 1}. Plazo base: ${t.months} meses; depende de científicos, laboratorios, formación y tecnologías activas.`}</p>${blocked ? `<p class="method-note">Construí un laboratorio público para iniciar esta investigación.</p>` : ""}${form("research", `<input type="hidden" name="technology" value="${t.id}">` + (admin ? `<input type="hidden" name="budget" value="0">` : field("budget", "Presupuesto mensual US$", Math.max(100, c.gdp * 1e9 * 0.00002).toFixed(2))), `data-blocked="${blocked}"`, admin ? "Investigar ahora" : "")}</article>`;
  }
  function researchChoices(s, u) {
    const c = s.countries[s.playerCountryId];
    const offered = D.technologies.filter((t) =>
      (!u.researchSector || t.sector === u.researchSector) &&
      technologyState(c, t).missing.length === 0 &&
      technologyState(c, t).queued.length === 0 &&
      (c.research.levels[t.id] || 0) < t.maxLevel);
    const newTech = offered.filter((t) => !(c.research.levels[t.id] > 0));
    const upgrades = offered.filter((t) => c.research.levels[t.id] > 0);
    return `<section class="v6-section"><h3>Investigaciones disponibles · ${newTech.length}</h3><p>Solo aparecen tecnologías cuyos requisitos ya fueron completados. Al terminar una investigación, se desbloquea la siguiente y esta desaparece de la lista inicial.</p><div class="v6-buildings">${newTech.length ? newTech.map((t) => researchCard(s, t)).join("") : "<p>No hay nuevas investigaciones disponibles en este sector. Revisá el árbol para ver requisitos pendientes.</p>"}</div></section><section class="v6-section"><h3>Mejoras disponibles · ${upgrades.length}</h3><p>Son niveles nuevos de tecnologías ya investigadas; los niveles completados solo figuran en el árbol.</p><div class="v6-buildings">${upgrades.length ? upgrades.map((t) => researchCard(s, t)).join("") : "<p>No hay mejoras disponibles en este sector.</p>"}</div></section>`;
  }
  function technologyTree(s, u) {
    const c = s.countries[s.playerCountryId], branches = new Map();
    for (const t of D.technologies) {
      if (u.researchSector && t.sector !== u.researchSector) continue;
      if (!branches.has(t.branchId)) branches.set(t.branchId, []);
      branches.get(t.branchId).push(t);
    }
    return `<section class="v6-section"><h3>Árbol de tecnologías</h3><p>Leé cada rama de arriba hacia abajo: las tecnologías más complejas aparecen debajo de sus requisitos. El estado «Sin investigar» indica que ya se puede comenzar; «Faltan otras investigaciones» muestra qué debe completarse antes.</p><div class="v6-tech-legend"><span class="v6-tech-badge researched">Investigada</span><span class="v6-tech-badge available">Sin investigar</span><span class="v6-tech-badge locked">Faltan otras investigaciones</span></div>${[...branches.entries()].map(([root, list]) => `<section class="v6-tech-branch"><h4>Rama: ${esc(D.getTechnology(root).label)}</h4><ol class="v6-tech-tree">${list.map((t) => {
      const state = technologyState(c, t);
      const kind = state.level > 0 ? "researched" : state.missing.length ? "locked" : "available";
      const queued = state.queued.length ? ` · En cola: nivel ${Math.max(...state.queued.map((x) => x.level))}` : "";
      const requirements = t.requires.length ? t.requires.map((id) => `${esc(D.getTechnology(id).label)} ${c.research.levels[id] > 0 ? "✓" : "pendiente"}`).join(" · ") : "Tecnología de base";
      return `<li class="v6-tech-node ${kind}" style="--tech-depth:${Math.min(5, t.depth)}" data-tech="${esc(t.id)}"><div><strong>${esc(t.label)}</strong><span class="v6-tech-badge ${kind}">${state.status}</span></div><small>Nivel ${state.level}/${t.maxLevel}${queued} · ${requirements}</small></li>`;
    }).join("")}</ol></section>`).join("")}</section>`;
  }
  function research(s, u) {
    const c = s.countries[s.playerCountryId];
    return shell(
      "Investigación y exploración",
      `<div class="v6-tabs">${btn("research-tab", "Investigaciones posibles", 'data-tab="available" aria-pressed="' + (!u.researchTab || u.researchTab === "available") + '"')}${btn("research-tab", "Árbol de tecnologías", 'data-tab="tree" aria-pressed="' + (u.researchTab === "tree") + '"')}</div>${u.researchTab === "tree" ? "" : researchQueue(s, u)}<div class="v6-tabs">${btn("research-filter", "Todas", 'data-sector="all" aria-pressed="' + (!u.researchSector) + '"')}${D.sectors.map((sec) => btn("research-filter", sec.short, `data-sector="${sec.id}" aria-pressed="${u.researchSector === sec.id}"`)).join("")}</div>${u.researchTab === "tree" ? technologyTree(s, u) : researchChoices(s, u)}${u.researchTab === "tree" ? "" : `<section class="v6-section"><h3>Exploración de recursos</h3>${form(
        "explore",
        select(
          "resource",
          "Recurso",
          D.materials.filter((m) => m.natural),
          u.exploreDraft?.resource || "crude_oil",
        ) +
          select(
            "site",
            "Zona",
            [
              { id: "land", label: "Terrestre" },
              { id: "sea", label: "Marítima (petróleo)" },
            ],
            u.exploreDraft?.site || "land",
          ) +
          field(
            "budget",
            "Presupuesto mensual US$",
            u.exploreDraft?.budget ??
              Math.max(100, c.gdp * 1e9 * 0.00001).toFixed(2),
          ),
      )}<p>La probabilidad depende del potencial geológico y tecnología. Reabrir un guardado no vuelve a sortear la campaña.</p>${
        c.research.explorations
          .filter((x) => !["En curso", "En espera"].includes(x.status))
          .slice((u.resultPage || 0) * 40, ((u.resultPage || 0) + 1) * 40)
          .map(
            (x) =>
              `<article class="v6-project"><span>${esc(D.getMaterial(x.resource).label)} · ${x.offshore ? "marítima" : "terrestre"} · ${amount(x.progress, "%")} · ${esc(x.status)}${x.discovered ? " · " + amount(x.discovered, D.getMaterial(x.resource).unit) : ""}</span>${["Sin hallazgo", "Agotado", "Cancelada"].includes(x.status) ? btn("remove-exploration", x.status === "Agotado" ? "Borrar depósito agotado" : "Borrar resultado", `data-exploration="${x.id}"`) : ""}</article>`,
          )
          .join("") || "<p>No hay resultados en esta página.</p>"
      }<p>Resultados · página ${(u.resultPage || 0) + 1}</p>${btn("result-page", "Anteriores", `data-page="${(u.resultPage || 0) - 1}"`, !(u.resultPage > 0))} ${btn("result-page", "Más resultados", `data-page="${(u.resultPage || 0) + 1}"`, c.research.explorations.filter((x) => !["En curso", "En espera"].includes(x.status)).length <= ((u.resultPage || 0) + 1) * 40)}</section>`}`,
    );
  }
  function modal(s, u) {
    if (!u.confirm) return "";
    const item = u.confirm;
    return `<div class="v6-overlay" role="dialog" aria-modal="true" aria-labelledby="v6-confirm-title"><section class="v6-dialog"><h2 id="v6-confirm-title">${esc(item.title)}</h2>${item.body}<div class="v6-tabs">${btn("confirm", "Confirmar")} ${btn("cancel-confirm", "Cancelar")}</div></section></div>`;
  }
  function render(s, view, u) {
    if (u.resource) return resourceDetail(s, u.resource, u) + modal(s, u);
    let html;
    if (D.sectors.some((x) => x.id === view)) html = sector(s, view, u);
    else if (view === "resources") html = resources(s, u);
    else if (view === "economy") html = economy(s);
    else if (view === "trade") html = trade(s);
    else if (view === "demographics") html = demographics(s, u);
    else if (view === "nutrition") html = nutrition(s);
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
      u.researchTab = "available";
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
    if (a === "research-tab") u.researchTab = target.dataset.tab;
    if (a === "research-filter") u.researchSector = target.dataset.sector === "all" ? null : target.dataset.sector;
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
    if (a === "close-agreement") E.closeAgreement(s, target.dataset.agreement);
    if (a === "renew-agreement") E.renewAgreement(s, target.dataset.agreement);
    if (a === "remove-exploration")
      E.removeExploration(s, target.dataset.exploration);
    if (a === "cancel-research" && c.research.queue?.[0])
      E.cancelResearchQueue(s, c.research.queue[0].queueId);
    if (a === "cancel-queue") E.cancelResearchQueue(s, target.dataset.queue);
    if (a === "queue-page") u.queuePage = Number(target.dataset.page);
    if (a === "result-page")
      u.resultPage = Math.max(0, Number(target.dataset.page));
    if (a === "build") {
      const factor = Number(
          target.closest("article")?.querySelector("[data-build-quantity]")
            ?.value ||
            target.dataset.quantity ||
            1,
        ),
        building = target.dataset.building;
      E.queueConstruction(s, building, factor, true);
      u.confirm = null;
    }
    if (a === "nationalize") {
      const p = E.nationalizePreview(s, target.dataset.resource);
      u.confirm = {
        type: "nationalize",
        id: target.dataset.resource,
        title: `Nacionalizar ${p.material.natural ? "extracción" : "producción"} de ${p.material.label}`,
        body: `<p>Costo ${dollars(p.cost)}. Se transfieren ${num(p.workers)} trabajadores, ${amount(p.stock, p.material.unit)} de stock y las instalaciones productivas vinculadas.</p>${p.linkedProductions.length ? `<p>Atención: la instalación también se utiliza para ${esc(p.linkedProductions.join(", "))}.</p>` : ""}<p>Reservas posteriores: ${dollars(c.reserves - p.cost)}. La producción privada de este recurso quedará deshabilitada.</p>`,
      };
    }
    if (a === "cancel-confirm") u.confirm = null;
    if (a === "confirm" && u.confirm) {
      if (u.confirm.type === "build")
        E.queueConstruction(s, u.confirm.id, u.confirm.factor || 1, true);
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
        requested: Number(v.requested),
        salary: Number(v.salary),
      });
    if (a === "housing-program")
      E.setHousingProgram(s, {
        buildBudget: Number(v.buildBudget) / 1e9,
        buildWorkers: Number(v.buildWorkers),
        repairBudget: Number(v.repairBudget) / 1e9,
        repairWorkers: Number(v.repairWorkers),
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
    if (a === "resource-staff")
      E.setResourcePolicy(s, formElement.dataset.resource, {
        staffLimit: Number(v.staffLimit),
      });
    if (a === "pension") E.setPension(s, Number(v.monthlyUsd));
    if (a === "demographic-policy") E.setDemographicPolicy(s, {
      birth: v.birth, entry: v.entry, exit: v.exit,
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
    if (a === "food-policy") E.setFoodPolicy(s, {
      aidEnabled: v.aidEnabled === "true",
      aidBudget: Number(v.aidBudget) / 1e9,
      protectedDays: Number(v.protectedDays),
    });
    if (a === "trade-policies")
      E.setTradePolicies(
        s,
        Object.fromEntries(
          D.materials.map((m) => [
            m.id,
            {
              sell: v["sell_" + m.id] === "on",
              autoImport: v["import_" + m.id] === "on",
              importBelow: Number(v["floor_" + m.id]),
            },
          ]),
        ),
      );
    if (a === "research") {
      const result = E.startResearch(s, v.technology, Number(v.budget) / 1e9);
      return result.admin
        ? `${D.getTechnology(v.technology).label}: nivel ${result.level} investigado al instante, sin gasto.`
        : `Investigación agregada: posición ${s.countries[s.playerCountryId].research.queue.length} de la cola.`;
    }
    if (a === "explore") {
      E.explore(s, v.resource, v.site === "sea", Number(v.budget) / 1e9);
      u.exploreDraft = { ...v };
      return `Exploración agregada: posición ${s.countries[s.playerCountryId].research.queue.length} de la cola.`;
    }
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
                  (k === "name"
                    ? esc(c.name) +
                      (c.blockedRawMaterials?.includes(id)
                        ? "<small>Requiere importar</small>"
                        : "")
                    : amount(c[k][id])) +
                  "</td>",
              )
              .join("") +
            "</tr>",
        )
        .join("") +
      "</tbody></table></div>"
    );
  }
  root.PulsoUI6 = { render, action, submit, quote, constructionQuote };
})(typeof globalThis !== "undefined" ? globalThis : this);
