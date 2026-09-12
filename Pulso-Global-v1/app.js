(function () {
  "use strict";

  const DATA = window.PULSO_DATA;
  const Engine = window.PulsoEngine;
  const app = document.querySelector("#app");
  const speedIntervals = { 1: 2600, 3: 1050, 6: 430 };
  const navItems = [
    { id: "government", label: "Gobierno", icon: "G" },
    { id: "indicators", label: "Indicadores", icon: "I" },
    { id: "trade", label: "Comercio", icon: "C" },
    { id: "world", label: "Mundo", icon: "M" },
    { id: "crises", label: "Crisis", icon: "!" }
  ];

  const sectorHelp = {
    agriculture: "Oferta de alimentos, exportaciones y precios internos.",
    industry: "Manufacturas, empleo formal, inversión y exportaciones.",
    services: "Consumo, actividad urbana, administración y comercio.",
    education: "Capital humano y productividad, con efecto gradual.",
    health: "Mortalidad, bienestar y resiliencia ante desastres.",
    infrastructure: "Empleo inmediato; productividad y logística futuras.",
    security: "Estabilidad y respuesta a crisis políticas.",
    energy: "Producción energética, industria y exposición a precios globales."
  };

  let game = null;
  let currentView = "government";
  let selectedCountryId = "ARG";
  let selectedLeaderId = null;
  let timer = null;
  let speed = 0;
  let draft = null;
  let draftDirty = false;
  let toastTimer = null;
  let lastSaveLabel = "Sin guardar";

  const SaveStore = {
    dbPromise: null,
    open() {
      if (!window.indexedDB) return Promise.reject(new Error("IndexedDB no disponible"));
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open("pulso-global", 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("saves")) db.createObjectStore("saves", { keyPath: "slot" });
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("No se pudo abrir el guardado"));
      });
      return this.dbPromise;
    },
    async put(slot, state) {
      const payload = { slot, savedAt: new Date().toISOString(), state: Engine.clone(state) };
      payload.state.savedAt = payload.savedAt;
      try {
        const db = await this.open();
        await new Promise((resolve, reject) => {
          const tx = db.transaction("saves", "readwrite");
          tx.objectStore("saves").put(payload);
          tx.oncomplete = resolve;
          tx.onerror = () => reject(tx.error);
        });
      } catch (error) {
        localStorage.setItem(`pulso-global-${slot}`, JSON.stringify(payload));
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => false);
      return payload;
    },
    async get(slot) {
      try {
        const db = await this.open();
        return await new Promise((resolve, reject) => {
          const request = db.transaction("saves", "readonly").objectStore("saves").get(slot);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
      } catch (error) {
        try { return JSON.parse(localStorage.getItem(`pulso-global-${slot}`)) || null; }
        catch (_) { return null; }
      }
    },
    async latest() {
      const saves = (await Promise.all([this.get("manual"), this.get("autosave")])).filter(Boolean);
      return saves.sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))[0] || null;
    }
  };

  function e(value) {
    return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);
  }
  function fmt(value, digits) {
    return new Intl.NumberFormat("es-AR", { maximumFractionDigits: digits ?? 1, minimumFractionDigits: digits ?? 0 }).format(value);
  }
  function money(value) {
    const absolute = Math.abs(value);
    if (absolute >= 1000) return `${value < 0 ? "−" : ""}US$ ${fmt(absolute / 1000, 2)} B`;
    const digits = absolute < 1 ? 2 : absolute < 10 ? 1 : 0;
    return `${value < 0 ? "−" : ""}US$ ${fmt(absolute, digits)} mil M`;
  }
  function signed(value, suffix) { return `${value > 0 ? "+" : ""}${fmt(value, 1)}${suffix || ""}`; }
  function playerCountry() { return game.countries[game.playerCountryId]; }
  function playerLeader() { return Engine.getLeaderDefinition(game.playerCountryId, game.playerLeaderId); }
  function commodityById(id) { return DATA.commodities.find((item) => item.id === id); }

  function showToast(message, tone) {
    let element = document.querySelector("#toast");
    if (!element) {
      element = document.createElement("div");
      element.id = "toast";
      element.className = "toast";
      document.body.appendChild(element);
    }
    element.className = `toast show ${tone || ""}`;
    element.textContent = message;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => element.classList.remove("show"), 2600);
  }

  async function renderStart() {
    const latest = await SaveStore.latest();
    const countries = DATA.countries.map((country) => `
      <button class="country-card ${country.id === selectedCountryId ? "selected" : ""}" type="button" data-action="select-country" data-country="${e(country.id)}" aria-pressed="${country.id === selectedCountryId}">
        <span class="flag" aria-hidden="true">${country.flag}</span>
        <span class="country-name">${e(country.name)}</span>
        <span class="country-meta">${e(country.region)}</span>
      </button>
    `).join("");

    app.innerHTML = `
      <section class="start-screen" aria-labelledby="game-title">
        <header class="start-header">
          <div class="brand-mark" aria-hidden="true"><span></span></div>
          <div><p class="eyebrow">Simulador de gobierno</p><h1 id="game-title">Pulso Global</h1></div>
          ${latest ? `<button class="button button-quiet" type="button" data-action="continue-game">Continuar · ${e(latest.state.date ? Engine.monthLabel(latest.state.date) : "partida")}</button>` : ""}
        </header>
        <div class="briefing">
          <div><p class="briefing-label">01 · Elegí tu país</p><h2>El poder empieza con una decisión.</h2></div>
          <p>Administrá presupuesto y trabajo, respondé a crisis y sostené el apoyo social mientras el resto del mundo también evoluciona.</p>
        </div>
        <div class="country-grid" aria-label="Países disponibles">${countries}</div>
        <section id="leader-panel" class="leader-panel" aria-live="polite">${renderLeaderPanel(selectedCountryId)}</section>
        <p class="simulation-note">${e(DATA.disclaimer)}</p>
      </section>
    `;
  }

  function renderLeaderPanel(countryId) {
    const country = DATA.countries.find((item) => item.id === countryId);
    if (!country) return "";
    selectedLeaderId = country.leaders.some((leader) => leader.id === selectedLeaderId) ? selectedLeaderId : country.leaders[0].id;
    return `
      <div class="leader-heading">
        <div><p class="briefing-label">02 · Elegí una figura</p><h2>${country.flag} ${e(country.name)}</h2></div>
        <p>Cada perfil ofrece una ventaja y una tensión distinta.</p>
      </div>
      <div class="leader-grid">
        ${country.leaders.map((leader) => `
          <article class="leader-card ${leader.id === selectedLeaderId ? "selected" : ""}">
            <div class="portrait-token" aria-hidden="true">${e(leader.initials)}</div>
            <div class="leader-archetype">${e(leader.archetype)}</div>
            <h3>${e(leader.name)}</h3>
            <p>${e(leader.description)}</p>
            <button class="button ${leader.id === selectedLeaderId ? "button-gold" : ""}" type="button" data-action="start-game" data-country="${e(country.id)}" data-leader="${e(leader.id)}">
              ${leader.id === selectedLeaderId ? "Iniciar gobierno" : "Elegir e iniciar"}
            </button>
          </article>
        `).join("")}
      </div>
    `;
  }

  function startGame(countryId, leaderId) {
    game = Engine.createGame(countryId, leaderId);
    selectedCountryId = countryId;
    selectedLeaderId = leaderId;
    currentView = "government";
    speed = 0;
    draftFromGame();
    renderGame();
    window.scrollTo(0, 0);
    saveGame("autosave", false);
  }

  function draftFromGame() {
    if (!game) return;
    const country = playerCountry();
    draft = { budget: Engine.clone(country.budget), labor: Engine.clone(country.labor), spendingTarget: country.spendingTarget };
    draftDirty = false;
  }

  function renderGame() {
    const country = playerCountry();
    const leader = playerLeader();
    app.innerHTML = `
      <div class="game-shell">
        <aside class="sidebar">
          <div class="game-brand"><div class="brand-mark small" aria-hidden="true"><span></span></div><strong>Pulso Global</strong></div>
          <nav class="game-nav" aria-label="Secciones del gobierno">
            ${navItems.map((item) => `<button type="button" class="nav-button ${currentView === item.id ? "active" : ""}" data-action="view" data-view="${item.id}"><span>${item.icon}</span>${item.label}</button>`).join("")}
          </nav>
          <div class="mandate-card">
            <span class="mini-flag">${country.flag}</span>
            <strong>${e(country.name)}</strong>
            <small>${e(leader.name)}</small>
            <span class="mandate-time">Mandato · ${game.tick + 1}/${Engine.MONTHS_LIMIT} meses</span>
          </div>
        </aside>
        <section class="workspace">
          <header class="command-bar">
            <div class="mobile-brand"><strong>Pulso Global</strong><span>${country.flag}</span></div>
            <div class="date-block"><span>Fecha de simulación</span><strong>${e(Engine.monthLabel(game.date))}</strong></div>
            <div class="time-controls" aria-label="Velocidad del tiempo">
              <button class="icon-button ${speed === 0 ? "active" : ""}" type="button" data-action="speed" data-speed="0" aria-label="Pausar">Ⅱ</button>
              <button class="icon-button ${speed === 1 ? "active" : ""}" type="button" data-action="speed" data-speed="1">1×</button>
              <button class="icon-button ${speed === 3 ? "active" : ""}" type="button" data-action="speed" data-speed="3">3×</button>
              <button class="icon-button ${speed === 6 ? "active" : ""}" type="button" data-action="speed" data-speed="6">6×</button>
              <button class="icon-button next" type="button" data-action="step" aria-label="Avanzar un mes">+1 mes</button>
            </div>
            <div class="save-cluster">
              <span>${e(lastSaveLabel)}</span>
              <button class="button button-quiet compact" type="button" data-action="save">Guardar</button>
              <button class="menu-button" type="button" data-action="toggle-menu" aria-label="Más opciones">•••</button>
              <div class="save-menu" id="save-menu" hidden>
                <button type="button" data-action="export">Exportar partida</button>
                <button type="button" data-action="import">Importar partida</button>
                <button type="button" data-action="new-game">Nueva partida</button>
              </div>
            </div>
          </header>
          <nav class="mobile-nav" aria-label="Secciones">
            ${navItems.map((item) => `<button type="button" class="${currentView === item.id ? "active" : ""}" data-action="view" data-view="${item.id}"><span>${item.icon}</span>${item.label}</button>`).join("")}
          </nav>
          <main class="view" id="view-content">${renderCurrentView()}</main>
        </section>
      </div>
      <input id="import-file" type="file" accept="application/json,.json" hidden />
      ${renderDecisionModal()}
      ${renderGameOverModal()}
    `;
  }

  function renderCurrentView() {
    if (currentView === "government") return renderGovernment();
    if (currentView === "indicators") return renderIndicators();
    if (currentView === "trade") return renderTrade();
    if (currentView === "world") return renderWorld();
    return renderCrises();
  }

  function metricCard(label, value, detail, tone) {
    return `<article class="metric-card ${tone || ""}"><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></article>`;
  }

  function renderGovernment() {
    const country = playerCountry();
    const leader = playerLeader();
    const fiscalTone = country.fiscalBalance < -5 ? "bad" : country.fiscalBalance > 0 ? "good" : "";
    return `
      <div class="view-heading">
        <div><p class="eyebrow">Sala de situación</p><h2>Gobierno de ${e(country.name)}</h2></div>
        <div class="leader-chip"><div class="portrait-token mini">${e(leader.initials)}</div><div><span>${e(leader.archetype)}</span><strong>${e(leader.name)}</strong></div></div>
      </div>
      <section class="metrics-grid" aria-label="Indicadores principales">
        ${metricCard("Popularidad", `${fmt(country.popularity)}%`, country.popularity >= 50 ? "Respaldo competitivo" : "Gobierno bajo presión", country.popularity < 35 ? "bad" : country.popularity > 60 ? "good" : "")}
        ${metricCard("PBI", money(country.gdp), `${signed(country.growth, "%")} anualizado`, country.growth < 0 ? "bad" : "good")}
        ${metricCard("Desocupación", `${fmt(country.unemployment)}%`, country.unemployment > 12 ? "Tensión laboral" : "Mercado en seguimiento", country.unemployment > 15 ? "bad" : "")}
        ${metricCard("Balance fiscal", `${signed(country.fiscalBalance, "% PBI")}`, `Deuda ${fmt(country.debt)}%`, fiscalTone)}
        ${metricCard("Estabilidad", `${fmt(country.stability)}/100`, country.modifiers.length ? `${country.modifiers.length} crisis activas` : "Sin crisis activa", country.stability < 40 ? "bad" : "")}
      </section>
      <div class="government-layout">
        <section class="panel allocation-panel">
          <div class="panel-heading">
            <div><p class="panel-kicker">Decisión presidencial</p><h3>Asignación nacional</h3></div>
            <div class="allocation-actions"><button type="button" class="text-button" data-action="reset-draft" ${draftDirty ? "" : "disabled"}>Deshacer</button><button type="button" class="button compact" data-action="apply-allocation" ${draftDirty ? "" : "disabled"}>Aplicar cambios</button></div>
          </div>
          <div class="spending-control">
            <div><strong>Gasto público objetivo</strong><small>Porcentaje anual del PBI destinado al Estado.</small></div>
            <input type="range" min="22" max="58" step="0.5" value="${draft.spendingTarget}" data-kind="spending" aria-label="Gasto público objetivo" />
            <output id="spending-output">${fmt(draft.spendingTarget)}% PBI</output>
          </div>
          <div class="allocation-head"><span>Sector</span><span>Presupuesto</span><span>Mano de obra</span></div>
          <div class="allocation-list">
            ${DATA.sectors.map((sector) => `
              <div class="allocation-row" data-sector-row="${sector.id}">
                <div class="sector-name"><strong>${e(sector.label)}</strong><small>${e(sectorHelp[sector.id])}</small></div>
                <label><span><b data-output="budget-${sector.id}">${fmt(draft.budget[sector.id])}%</b></span><input type="range" min="2" max="40" step="0.5" value="${draft.budget[sector.id]}" data-kind="budget" data-sector="${sector.id}" aria-label="Presupuesto para ${e(sector.label)}" /></label>
                <label><span><b data-output="labor-${sector.id}">${fmt(draft.labor[sector.id])}%</b></span><input type="range" min="2" max="40" step="0.5" value="${draft.labor[sector.id]}" data-kind="labor" data-sector="${sector.id}" aria-label="Mano de obra para ${e(sector.label)}" /></label>
              </div>
            `).join("")}
          </div>
          <div class="allocation-total"><span>Los porcentajes se compensan automáticamente entre sectores.</span><strong>Presupuesto 100% · Trabajo 100%</strong></div>
        </section>
        <aside class="panel pulse-panel">
          <div class="panel-heading"><div><p class="panel-kicker">Últimos movimientos</p><h3>Pulso del país</h3></div><button class="text-button" type="button" data-action="view" data-view="crises">Ver todos</button></div>
          <div class="news-list compact-news">${renderNewsItems(game.events.slice(0, 6))}</div>
          <div class="causal-note"><span>Cómo leer el motor</span><p>La obra pública genera empleo rápido; educación y productividad necesitan varios años. La deuda reacciona cada mes al gasto, los ingresos y el crecimiento.</p></div>
        </aside>
      </div>
    `;
  }

  function sparkline(key, color) {
    const values = game.history.slice(-24).map((item) => Number(item[key]));
    if (values.length < 2) return `<span class="spark-empty">Avanzá un mes para iniciar la serie.</span>`;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const points = values.map((value, index) => `${(index / (values.length - 1)) * 100},${38 - ((value - min) / range) * 34}`).join(" ");
    return `<svg class="spark" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
  }

  function renderIndicators() {
    const c = playerCountry();
    const indicators = [
      ["PBI", money(c.gdp), "gdp", "#38d9c5", `${signed(c.growth, "%")} anualizado`],
      ["Población", `${fmt(c.population, 2)} M`, "population", "#6ea8fe", `Natalidad ${fmt(c.birthRate)}‰`],
      ["Educación", `${fmt(c.education)}/100`, "education", "#f4b860", "Efecto productivo gradual"],
      ["Productividad", `${fmt(c.productivity)}/145`, "productivity", "#d98cff", "Capital humano e infraestructura"],
      ["Desocupación", `${fmt(c.unemployment)}%`, "unemployment", "#ff8d6b", "Responde a actividad y empleo público"],
      ["Infraestructura", `${fmt(c.infrastructure)}/100`, "infrastructure", "#85db79", "Exige inversión y mantenimiento"],
      ["Inflación", `${fmt(c.inflation)}%`, "inflation", "#ff6b6b", "Demanda, energía y productividad"],
      ["Deuda pública", `${fmt(c.debt)}% PBI`, "debt", "#f0d36b", `${signed(c.fiscalBalance, "% PBI")} de balance`]
    ];
    return `
      <div class="view-heading"><div><p class="eyebrow">Series nacionales</p><h2>Indicadores</h2></div><p class="view-note">Cada punto representa un mes de simulación.</p></div>
      <section class="indicator-grid">
        ${indicators.map(([label, value, key, color, detail]) => `<article class="indicator-card"><div><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></div>${sparkline(key, color)}</article>`).join("")}
      </section>
      <section class="panel history-panel">
        <div class="panel-heading"><div><p class="panel-kicker">Registro reciente</p><h3>Evolución mensual</h3></div></div>
        <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>PBI</th><th>Variación</th><th>Desocupación</th><th>Inflación</th><th>Popularidad</th><th>Comercio</th></tr></thead><tbody>
          ${game.history.slice(-12).reverse().map((row) => `<tr><td>${e(row.date)}</td><td>${money(row.gdp)}</td><td class="${row.growth < 0 ? "negative" : "positive"}">${signed(row.growth, "%")}</td><td>${fmt(row.unemployment)}%</td><td>${fmt(row.inflation)}%</td><td>${fmt(row.popularity)}%</td><td class="${row.tradeBalance < 0 ? "negative" : "positive"}">${money(row.tradeBalance)}</td></tr>`).join("")}
        </tbody></table></div>
      </section>
    `;
  }

  function renderTrade() {
    const c = playerCountry();
    const flows = game.market.trades.filter((trade) => trade.from === c.id || trade.to === c.id).slice(0, 16);
    return `
      <div class="view-heading"><div><p class="eyebrow">Mercado internacional</p><h2>Comercio exterior</h2></div><div class="trade-total ${c.tradeBalance < 0 ? "negative" : "positive"}"><span>Balance mensual</span><strong>${money(c.tradeBalance)}</strong></div></div>
      <section class="market-grid">
        ${DATA.commodities.map((commodity) => {
          const price = game.market.prices[commodity.id];
          const before = game.market.previousPrices[commodity.id];
          const change = before ? (price / before - 1) * 100 : 0;
          const balance = c.sectorBalances[commodity.id];
          return `<article class="market-card"><div class="commodity-icon">${commodity.icon}</div><div><span>${e(commodity.label)}</span><strong>Índice ${fmt(price, 3)}</strong><small class="${change < 0 ? "negative" : "positive"}">${signed(change, "%")} este mes</small></div><div class="balance-pill ${balance < 0 ? "deficit" : "surplus"}">${balance < 0 ? "Déficit" : "Superávit"} ${fmt(Math.abs(balance), 2)}</div></article>`;
        }).join("")}
      </section>
      <div class="trade-layout">
        <section class="panel">
          <div class="panel-heading"><div><p class="panel-kicker">Producción y consumo</p><h3>Balance por mercado</h3></div></div>
          <div class="balance-list">
            ${DATA.commodities.map((commodity) => {
              const supply = c.sectorSupply[commodity.id] || 0;
              const demand = c.sectorDemand[commodity.id] || 0;
              const max = Math.max(supply, demand, 0.1);
              return `<div class="balance-row"><div><strong>${e(commodity.label)}</strong><small>Oferta ${fmt(supply, 2)} · Consumo ${fmt(demand, 2)}</small></div><div class="dual-bar"><i style="width:${(supply / max) * 100}%"></i><b style="width:${(demand / max) * 100}%"></b></div></div>`;
            }).join("")}
          </div>
          <div class="legend"><span><i class="supply"></i>Oferta propia</span><span><i class="demand"></i>Consumo interno</span></div>
        </section>
        <section class="panel">
          <div class="panel-heading"><div><p class="panel-kicker">Contrapartes automáticas</p><h3>Flujos principales</h3></div></div>
          ${flows.length ? `<div class="flow-list">${flows.map((flow) => {
            const exporting = flow.from === c.id;
            const otherId = exporting ? flow.to : flow.from;
            const other = game.countries[otherId];
            const name = other ? `${other.flag} ${other.name}` : "🌐 Resto del mundo";
            return `<div class="flow-row"><span class="flow-direction ${exporting ? "out" : "in"}">${exporting ? "EXP" : "IMP"}</span><div><strong>${e(commodityById(flow.commodity).label)}</strong><small>${exporting ? "hacia" : "desde"} ${e(name)}</small></div><b>${money(flow.value)}</b></div>`;
          }).join("")}</div>` : `<div class="empty-state"><strong>Mercado en apertura</strong><p>Avanzá un mes para calcular oferta, consumo y socios comerciales.</p></div>`}
        </section>
      </div>
      <p class="method-note">El consumo responde a población, ingreso, actividad y precios. La oferta depende de recursos, productividad, infraestructura y mano de obra. Los socios se priorizan por disponibilidad, relación y cercanía regional; el resto del mundo absorbe desequilibrios residuales.</p>
    `;
  }

  function renderWorld() {
    const countries = Object.values(game.countries).sort((a, b) => b.gdp - a.gdp);
    return `
      <div class="view-heading"><div><p class="eyebrow">Simulación internacional</p><h2>El mundo</h2></div><p class="view-note">Las demás economías reasignan recursos trimestralmente.</p></div>
      <section class="world-grid">
        ${countries.map((country) => {
          const leader = Engine.getLeaderDefinition(country.id, country.leaderId);
          return `<article class="world-card ${country.id === game.playerCountryId ? "player" : ""}">
            <div class="world-country"><span>${country.flag}</span><div><strong>${e(country.name)}</strong><small>${e(leader ? leader.name : "Gobierno")}</small></div>${country.id === game.playerCountryId ? "<em>Tu país</em>" : ""}</div>
            <div class="world-stats"><div><span>PBI</span><b>${money(country.gdp)}</b></div><div><span>Crecimiento</span><b class="${country.growth < 0 ? "negative" : "positive"}">${signed(country.growth, "%")}</b></div><div><span>Inflación</span><b>${fmt(country.inflation)}%</b></div><div><span>Estabilidad</span><b>${fmt(country.stability)}</b></div></div>
            <div class="stability-track"><i style="width:${country.stability}%"></i></div>
          </article>`;
        }).join("")}
      </section>
    `;
  }

  function eventIcon(type) { return type === "natural" ? "N" : type === "political" ? "P" : type === "global" ? "G" : type === "response" ? "R" : type === "policy" ? "$" : "•"; }
  function renderNewsItems(items) {
    if (!items.length) return `<div class="empty-state"><strong>Sin novedades</strong><p>El mundo comenzará a moverse con el primer mes.</p></div>`;
    return items.map((item) => `<article class="news-item"><span class="event-icon ${e(item.type)}">${eventIcon(item.type)}</span><div><small>${e(item.date)}</small><p>${e(item.text)}</p></div></article>`).join("");
  }

  function renderCrises() {
    const c = playerCountry();
    return `
      <div class="view-heading"><div><p class="eyebrow">Acontecimientos</p><h2>Crisis y decisiones</h2></div><div class="active-count"><strong>${c.modifiers.length}</strong><span>efectos activos</span></div></div>
      <div class="crisis-layout">
        <section class="panel">
          <div class="panel-heading"><div><p class="panel-kicker">Agenda mundial</p><h3>Últimas noticias</h3></div></div>
          <div class="news-list">${renderNewsItems(game.events)}</div>
        </section>
        <aside class="panel">
          <div class="panel-heading"><div><p class="panel-kicker">Impacto acumulado</p><h3>Situaciones activas</h3></div></div>
          ${c.modifiers.length ? `<div class="modifier-list">${c.modifiers.map((modifier) => `<article><div><strong>${e(modifier.title)}</strong><small>${modifier.remaining} meses restantes</small></div><span>${Object.entries(modifier.impact).filter(([key]) => key !== "duration").slice(0, 2).map(([key, value]) => `${e(key)} ${signed(value)}`).join(" · ")}</span></article>`).join("")}</div>` : `<div class="empty-state"><strong>Sin crisis activa</strong><p>Los desastres naturales, conflictos políticos y shocks globales aparecerán de forma dinámica.</p></div>`}
        </aside>
      </div>
    `;
  }

  function renderDecisionModal() {
    if (!game.pendingDecision) return "";
    const decision = game.pendingDecision;
    return `<div class="modal-backdrop" role="presentation"><section class="decision-modal" role="dialog" aria-modal="true" aria-labelledby="decision-title"><div class="crisis-badge ${e(decision.type)}">${e(decision.type === "natural" ? "Desastre natural" : decision.type === "political" ? "Crisis política" : "Shock mundial")}</div><h2 id="decision-title">${e(decision.title)}</h2><p>${e(decision.summary)}</p><div class="decision-options">${decision.choices.map((choice, index) => `<button type="button" data-action="resolve-decision" data-choice="${index}"><strong>${e(choice.label)}</strong><span>${e(choice.detail)}</span><small>${Object.entries(choice.effects).map(([key, value]) => `${e(key)} ${signed(value)}`).join(" · ")}</small></button>`).join("")}</div><p class="modal-note">El tiempo queda pausado hasta que el gobierno responda.</p></section></div>`;
  }

  function renderGameOverModal() {
    if (!game.gameOver) return "";
    return `<div class="modal-backdrop"><section class="decision-modal game-over" role="dialog" aria-modal="true"><div class="crisis-badge ${game.gameOver.won ? "won" : "political"}">${game.gameOver.won ? "Mandato completado" : "Fin del gobierno"}</div><h2>${e(game.gameOver.title)}</h2><p>${e(game.gameOver.detail)}</p><div class="game-over-actions"><button class="button" type="button" data-action="export">Exportar resultado</button><button class="button button-quiet" type="button" data-action="new-game">Nueva partida</button></div></section></div>`;
  }

  function rebalanceDraft(kind, sectorId, requestedValue) {
    const allocation = draft[kind];
    const oldValue = allocation[sectorId];
    const value = Math.max(2, Math.min(40, requestedValue));
    let delta = value - oldValue;
    const others = DATA.sectors.map((sector) => sector.id).filter((id) => id !== sectorId);
    if (delta > 0) {
      let remaining = delta;
      const available = others.reduce((sum, id) => sum + Math.max(0, allocation[id] - 2), 0);
      if (available < delta) delta = available;
      allocation[sectorId] = oldValue + delta;
      others.forEach((id, index) => {
        const share = available ? Math.max(0, allocation[id] - 2) / available : 0;
        const reduction = index === others.length - 1 ? remaining : Math.min(remaining, delta * share);
        allocation[id] -= reduction;
        remaining -= reduction;
      });
    } else {
      const freed = -delta;
      allocation[sectorId] = value;
      const totalOther = others.reduce((sum, id) => sum + allocation[id], 0);
      let remaining = freed;
      others.forEach((id, index) => {
        const addition = index === others.length - 1 ? remaining : freed * (allocation[id] / totalOther);
        allocation[id] += addition;
        remaining -= addition;
      });
    }
    draft[kind] = Engine.normalizeAllocation(allocation);
    draftDirty = true;
  }

  function syncAllocationControls(kind) {
    DATA.sectors.forEach((sector) => {
      const input = document.querySelector(`input[data-kind="${kind}"][data-sector="${sector.id}"]`);
      const output = document.querySelector(`[data-output="${kind}-${sector.id}"]`);
      if (input) input.value = draft[kind][sector.id];
      if (output) output.textContent = `${fmt(draft[kind][sector.id])}%`;
    });
    document.querySelectorAll("[data-action='apply-allocation'], [data-action='reset-draft']").forEach((button) => { button.disabled = !draftDirty; });
  }

  function setSpeed(nextSpeed) {
    clearInterval(timer);
    timer = null;
    speed = Number(nextSpeed);
    if (game && (game.pendingDecision || game.gameOver)) speed = 0;
    if (speedIntervals[speed]) timer = setInterval(stepGame, speedIntervals[speed]);
    if (game) renderGame();
  }

  async function stepGame() {
    if (!game || game.pendingDecision || game.gameOver) {
      setSpeed(0);
      return;
    }
    Engine.advanceTick(game);
    if (!draftDirty) draftFromGame();
    if (game.tick % 3 === 0) await saveGame("autosave", false);
    if (game.pendingDecision || game.gameOver) {
      clearInterval(timer);
      timer = null;
      speed = 0;
    }
    renderGame();
  }

  async function saveGame(slot, notify) {
    if (!game) return;
    const payload = await SaveStore.put(slot, game);
    game.savedAt = payload.savedAt;
    lastSaveLabel = `Guardado ${new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit" }).format(new Date(payload.savedAt))}`;
    if (notify) showToast("Partida guardada en este dispositivo", "success");
  }

  async function continueGame() {
    const latest = await SaveStore.latest();
    if (!latest) return showToast("No se encontró una partida guardada", "error");
    try {
      game = Engine.hydrate(latest.state);
      selectedCountryId = game.playerCountryId;
      selectedLeaderId = game.playerLeaderId;
      lastSaveLabel = "Partida recuperada";
      currentView = "government";
      draftFromGame();
      renderGame();
      window.scrollTo(0, 0);
    } catch (error) { showToast(error.message, "error"); }
  }

  function exportGame() {
    if (!game) return;
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `pulso-global-${game.playerCountryId}-${game.date.year}-${String(game.date.month).padStart(2, "0")}.json`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importGame(file) {
    if (!file) return;
    try {
      const candidate = JSON.parse(await file.text());
      game = Engine.hydrate(candidate);
      selectedCountryId = game.playerCountryId;
      selectedLeaderId = game.playerLeaderId;
      currentView = "government";
      speed = 0;
      draftFromGame();
      await saveGame("manual", false);
      renderGame();
      window.scrollTo(0, 0);
      showToast("Partida importada correctamente", "success");
    } catch (error) { showToast(`No se pudo importar: ${error.message}`, "error"); }
  }

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context || typeof context.registerTool !== "function") return;
    const register = (tool) => { try { Promise.resolve(context.registerTool(tool)).catch(() => undefined); } catch (_) { /* función opcional */ } };
    register({
      name: "read_government_state", title: "Leer estado del gobierno",
      description: "Devuelve los indicadores actuales de la partida activa sin modificarla.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        if (!game) return { active: false };
        const c = playerCountry();
        return { active: true, date: Engine.monthLabel(game.date), country: c.name, leader: playerLeader().name, popularity: c.popularity, gdp: c.gdp, growth: c.growth, unemployment: c.unemployment, inflation: c.inflation, debt: c.debt, stability: c.stability };
      }
    });
    register({
      name: "advance_simulation_months", title: "Avanzar simulación",
      description: "Avanza entre uno y doce meses, deteniéndose si aparece una crisis que requiere decisión.",
      inputSchema: { type: "object", properties: { months: { type: "integer", minimum: 1, maximum: 12 } }, required: ["months"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!game) throw new Error("No hay una partida activa.");
        const months = Number(input && input.months);
        if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error("months debe ser un entero entre 1 y 12.");
        let advanced = 0;
        while (advanced < months && !game.pendingDecision && !game.gameOver) { Engine.advanceTick(game); advanced += 1; }
        if (!draftDirty) draftFromGame();
        await saveGame("autosave", false);
        renderGame();
        return { advanced, date: Engine.monthLabel(game.date), pendingDecision: game.pendingDecision ? game.pendingDecision.title : null, gameOver: game.gameOver ? game.gameOver.title : null };
      }
    });
    register({
      name: "resolve_government_crisis", title: "Resolver crisis",
      description: "Elige una de las respuestas disponibles para la crisis pendiente.",
      inputSchema: { type: "object", properties: { choice: { type: "integer", minimum: 0, maximum: 1 } }, required: ["choice"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!game || !game.pendingDecision) throw new Error("No hay una crisis pendiente.");
        const choice = Number(input && input.choice);
        if (!Number.isInteger(choice) || choice < 0 || choice >= game.pendingDecision.choices.length) throw new Error("Elección no válida.");
        Engine.resolveDecision(game, choice);
        await saveGame("autosave", false);
        renderGame();
        return { resolved: true, date: Engine.monthLabel(game.date) };
      }
    });
  }

  app.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "select-country") {
      selectedCountryId = target.dataset.country;
      selectedLeaderId = null;
      document.querySelector("#leader-panel").innerHTML = renderLeaderPanel(selectedCountryId);
      document.querySelectorAll(".country-card").forEach((card) => {
        const selected = card.dataset.country === selectedCountryId;
        card.classList.toggle("selected", selected);
        card.setAttribute("aria-pressed", String(selected));
      });
    } else if (action === "start-game") startGame(target.dataset.country, target.dataset.leader);
    else if (action === "continue-game") await continueGame();
    else if (action === "view") { currentView = target.dataset.view; renderGame(); window.scrollTo(0, 0); }
    else if (action === "speed") setSpeed(Number(target.dataset.speed));
    else if (action === "step") await stepGame();
    else if (action === "apply-allocation") {
      Engine.applyAllocations(game, draft);
      draftFromGame();
      await saveGame("autosave", false);
      renderGame();
      showToast("Asignación aplicada: sus efectos aparecerán mes a mes", "success");
    } else if (action === "reset-draft") { draftFromGame(); renderGame(); }
    else if (action === "resolve-decision") {
      Engine.resolveDecision(game, Number(target.dataset.choice));
      await saveGame("autosave", false);
      renderGame();
    } else if (action === "save") { await saveGame("manual", true); renderGame(); }
    else if (action === "toggle-menu") {
      const menu = document.querySelector("#save-menu");
      menu.hidden = !menu.hidden;
    } else if (action === "export") exportGame();
    else if (action === "import") document.querySelector("#import-file").click();
    else if (action === "new-game") { setSpeed(0); game = null; selectedLeaderId = null; await renderStart(); }
  });

  app.addEventListener("input", (event) => {
    const input = event.target;
    if (!draft || input.type !== "range") return;
    if (input.dataset.kind === "spending") {
      draft.spendingTarget = Number(input.value);
      draftDirty = true;
      const output = document.querySelector("#spending-output");
      if (output) output.textContent = `${fmt(draft.spendingTarget)}% PBI`;
      document.querySelectorAll("[data-action='apply-allocation'], [data-action='reset-draft']").forEach((button) => { button.disabled = false; });
    } else if (input.dataset.kind === "budget" || input.dataset.kind === "labor") {
      rebalanceDraft(input.dataset.kind, input.dataset.sector, Number(input.value));
      syncAllocationControls(input.dataset.kind);
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.id === "import-file") importGame(event.target.files[0]);
  });

  document.addEventListener("click", (event) => {
    const menu = document.querySelector("#save-menu");
    if (menu && !menu.hidden && !event.target.closest(".save-cluster")) menu.hidden = true;
  });

  window.addEventListener("beforeunload", () => {
    if (game) SaveStore.put("autosave", game).catch(() => undefined);
  });

  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
  }

  renderStart().then(registerWebMCP);
})();
