(function () {
  "use strict";

  const DATA = window.PULSO_DATA;
  const Engine = window.PulsoEngine;
  const app = document.querySelector("#app");
  const speedIntervals = { 1: 2600, 3: 1050, 6: 430 };
  const mapViews = [
    { id: "map", label: "Mapa mundial", icon: "◎" },
    ...DATA.sectors,
    { id: "taxes", label: "Impuestos", icon: "$" },
    { id: "trade", label: "Comercio exterior", icon: "↔" },
    { id: "demographics", label: "Demografía", icon: "◒" },
    { id: "indicators", label: "Indicadores", icon: "▧" }
  ];
  const sectorHelp = {
    infrastructure: "Vivienda, rutas, ferrocarril y aeropuertos conectan el país y elevan su atractivo.",
    agriculture: "La producción de alimentos abastece el consumo interno y genera exportaciones.",
    industry: "Manufacturas, materiales, empleo formal y maquinaria para el desarrollo nacional.",
    services: "Comercio, logística y turismo conectan producción, consumo y visitantes.",
    education: "El capital humano mejora de forma gradual la productividad y la tecnología.",
    health: "La atención sanitaria reduce mortalidad y sostiene el bienestar de la población.",
    security: "La capacidad estatal protege estabilidad, convivencia y confianza social.",
    energy: "La oferta eléctrica y de combustibles sostiene hogares, industria y transporte."
  };
  const effectNames = {
    housing: "Vivienda", happiness: "Felicidad", immigration: "Atracción migratoria",
    tourism: "Turismo", tradeCapacity: "Logística", infrastructure: "Infraestructura",
    foodCapacity: "Capacidad alimentaria", industryCapacity: "Capacidad industrial",
    energyCapacity: "Capacidad energética", materialMachinery: "Maquinaria nacional",
    productivity: "Productividad", jobs: "Empleo", education: "Educación",
    health: "Salud", mortality: "Mortalidad", stability: "Estabilidad"
  };

  let game = null;
  let currentView = "map";
  let panelTab = "overview";
  let focusedCountryId = null;
  let selectedCountryId = "ARG";
  let timer = null;
  let speed = 0;
  let draft = null;
  let draftDirty = false;
  let taxDraft = null;
  let taxDraftDirty = false;
  let demographicCountryId = null;
  let toastTimer = null;
  let lastSaveLabel = "Sin guardar";
  let lastPanelKey = null;
  let worldData = null;
  let worldPromise = null;

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
      } catch (_) {
        localStorage.setItem(`pulso-global-${slot}`, JSON.stringify(payload));
      }
      if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => false);
      return payload;
    },
    async get(slot) {
      try {
        const db = await this.open();
        const stored = await new Promise((resolve, reject) => {
          const request = db.transaction("saves", "readonly").objectStore("saves").get(slot);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error);
        });
        if (stored) return stored;
      } catch (_) { /* respaldo local */ }
      const raw = localStorage.getItem(`pulso-global-${slot}`);
      return raw ? JSON.parse(raw) : null;
    },
    async latest() {
      const candidates = (await Promise.all(["manual", "autosave"].map((slot) => this.get(slot)))).filter(Boolean);
      return candidates.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt))[0] || null;
    }
  };

  function e(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }
  function fmt(value, digits) {
    return new Intl.NumberFormat("es-AR", { minimumFractionDigits: digits == null ? 1 : digits, maximumFractionDigits: digits == null ? 1 : digits }).format(Number(value) || 0);
  }
  function money(value) { return `US$ ${fmt(value, Math.abs(value) < 100 ? 2 : 0)} mil M`; }
  function signed(value, suffix) { return `${value > 0 ? "+" : ""}${fmt(value, 1)}${suffix || ""}`; }
  function playerCountry() { return game.countries[game.playerCountryId]; }
  function playerLeader() { return Engine.getLeaderDefinition(game.playerCountryId, game.playerLeaderId); }
  function materialById(id) { return DATA.materials.find((item) => item.id === id); }
  function constructionById(id) { return DATA.constructions.find((item) => item.id === id); }
  function isSector(id) { return DATA.sectors.some((sector) => sector.id === id); }
  function activeProjects(country, sector) { return country.projects.filter((project) => project.progress < 100 && (!sector || project.sector === sector)); }

  function showToast(message, tone) {
    clearTimeout(toastTimer);
    let toast = document.querySelector("#toast");
    if (!toast) {
      toast = document.createElement("div");
      toast.id = "toast";
      toast.className = "toast";
      document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.className = `toast show ${tone || ""}`;
    toastTimer = setTimeout(() => { toast.className = "toast"; }, 3200);
  }

  async function renderStart() {
    const saved = await SaveStore.latest();
    app.innerHTML = `
      <section class="start-screen" aria-labelledby="game-title">
        <header class="start-header">
          <div class="brand-mark" aria-hidden="true"><span></span></div>
          <div><p class="eyebrow">Simulador de gobierno</p><h1 id="game-title">Pulso Global</h1></div>
          <button class="button button-quiet" type="button" data-action="continue-game" ${saved ? "" : "hidden"}>Continuar partida</button>
        </header>
        <div class="briefing">
          <div><p class="briefing-label">01 · Elegí tu país</p><h2>Goberná sobre un mundo que nunca se detiene.</h2></div>
          <p>Planificá presupuesto, impuestos, trabajo, subsidios y obras en una simulación sin límite de tiempo. Cada mes transforma la economía y la población.</p>
        </div>
        <div class="start-badge"><span>Motor base v3</span><b>Simulación abierta · eventos aleatorios desactivados</b></div>
        <div class="country-grid" aria-label="Países disponibles">
          ${DATA.countries.map((country) => `
            <button class="country-card ${country.id === selectedCountryId ? "selected" : ""}" type="button" data-action="select-country" data-country="${country.id}" aria-pressed="${country.id === selectedCountryId}">
              <span class="flag">${country.flag}</span><span class="country-name">${e(country.name)}</span>
              <span class="country-meta">${fmt(country.population, 2)} M habitantes · PBI ${money(country.gdp)}</span>
            </button>`).join("")}
        </div>
        <section id="leader-panel" class="leader-panel" aria-live="polite">${renderLeaderPanel(selectedCountryId)}</section>
        <p class="simulation-note">${e(DATA.disclaimer)} Las figuras representan escenarios hipotéticos de conducción.</p>
      </section>`;
  }

  function renderLeaderPanel(countryId) {
    const country = DATA.countries.find((item) => item.id === countryId);
    if (!country) return "";
    return `
      <div class="leader-heading"><div><p class="briefing-label">02 · Elegí una figura</p><h3>${country.flag} Conducción de ${e(country.name)}</h3></div><p>Sus rasgos modifican el punto de partida del motor.</p></div>
      <div class="leader-grid">
        ${country.leaders.map((leader) => `
          <article class="leader-card">
            <div class="portrait-token">${e(leader.initials)}</div><div class="leader-archetype">${e(leader.archetype)}</div>
            <h3>${e(leader.name)}</h3><p>${e(leader.description)}</p>
            <button class="button" type="button" data-action="start-game" data-country="${country.id}" data-leader="${leader.id}">Gobernar con ${e(leader.name.split(" ")[0])}</button>
          </article>`).join("")}
      </div>`;
  }

  function startGame(countryId, leaderId) {
    game = Engine.createGame(countryId, leaderId, Date.now());
    selectedCountryId = countryId;
    focusedCountryId = countryId;
    demographicCountryId = countryId;
    taxDraftDirty = false;
    currentView = "map";
    panelTab = "overview";
    lastSaveLabel = "Partida nueva";
    draftFromGame();
    renderGame();
    saveGame("autosave", false);
  }

  function draftFromGame() {
    if (!game) return;
    const country = playerCountry();
    draft = {
      budget: Engine.clone(country.budget),
      labor: Engine.clone(country.labor),
      subsidies: Engine.clone(country.subsidies),
      spendingTarget: country.spendingTarget
    };
    draftDirty = false;
    if (!taxDraftDirty) taxDraft = Engine.clone(country.taxes);
  }

  function renderGame() {
    const panelKey = [game.gameId, currentView, isSector(currentView) ? panelTab : "", currentView === "demographics" ? demographicCountryId : ""].join(":");
    const samePanel = panelKey === lastPanelKey;
    const previousScroll = { page: window.scrollY, panel: document.querySelector(".panel-body")?.scrollTop || 0,
      table: document.querySelector(".population-world .table-wrap")?.scrollLeft || 0 };
    const country = playerCountry();
    const leader = playerLeader();
    const lowStock = DATA.materials.filter((item) => country.materialStocks[item.id] / country.materialCapacity[item.id] < 0.18).length;
    app.innerHTML = `
      <div class="game-shell">
        <aside class="sidebar">
          <div class="game-brand"><div class="brand-mark small" aria-hidden="true"><span></span></div><div><strong>Pulso Global</strong><small>Centro de mando</small></div></div>
          <nav class="game-nav" aria-label="Áreas de gobierno">
            ${mapViews.map((item, index) => `
              ${index === 1 ? '<span class="nav-divider">Ministerios</span>' : index === DATA.sectors.length + 1 ? '<span class="nav-divider">Sistema</span>' : ""}
              <button class="nav-button ${currentView === item.id ? "active" : ""}" type="button" data-action="view" data-view="${item.id}">
                <span>${e(item.icon || item.short.slice(0, 1))}</span><b>${e(item.short || item.label)}</b>
              </button>`).join("")}
          </nav>
          <div class="mandate-card"><span class="mini-flag">${country.flag}</span><strong>${e(leader.name)}</strong><small>${e(country.name)}</small><span class="mandate-time">Mes ${game.tick} · Sin límite</span></div>
        </aside>

        <section class="workspace">
          <header class="command-bar">
            <div class="mobile-brand"><div class="brand-mark small"><span></span></div><strong>Pulso Global</strong></div>
            <div class="date-block"><span>Fecha de gobierno</span><strong>${e(Engine.monthLabel(game.date))}</strong></div>
            <div class="hud-stats">
              <div class="hud-population"><span>Población</span><strong>${fmt(country.population, 2)} M</strong><small>${e(country.name)}</small></div>
              <div><span>PBI</span><strong>${money(country.gdp)}</strong><small class="${country.growth < 0 ? "negative" : "positive"}">${signed(country.growth, "%")}</small></div>
              <div><span>Felicidad</span><strong>${fmt(country.happiness)}%</strong><small>${fmt(country.popularity)}% apoyo</small></div>
              <div><span>Empleo</span><strong>${fmt(100 - country.unemployment)}%</strong><small>${fmt(country.unemployment)}% desocupación</small></div>
              <div><span>Insumos</span><strong>${lowStock ? `${lowStock} críticos` : "Estables"}</strong><small>${activeProjects(country).length} obras activas</small></div>
            </div>
            <div class="time-controls" aria-label="Controles de tiempo">
              <button class="icon-button ${speed === 0 ? "active" : ""}" type="button" data-action="speed" data-speed="0" aria-label="Pausa">Ⅱ</button>
              <button class="icon-button ${speed === 1 ? "active" : ""}" type="button" data-action="speed" data-speed="1">1×</button>
              <button class="icon-button ${speed === 3 ? "active" : ""}" type="button" data-action="speed" data-speed="3">3×</button>
              <button class="icon-button ${speed === 6 ? "active" : ""}" type="button" data-action="speed" data-speed="6">6×</button>
              <button class="icon-button next" type="button" data-action="step">+1 mes</button>
            </div>
            <div class="save-cluster">
              <span>${e(lastSaveLabel)}</span><button class="button compact" type="button" data-action="save">Guardar</button>
              <button class="menu-button" type="button" data-action="toggle-menu" aria-label="Más opciones">•••</button>
              <div id="save-menu" class="save-menu" hidden>
                <button type="button" data-action="export">Exportar JSON</button><button type="button" data-action="import">Importar JSON</button>
                <button type="button" data-action="new-game">Nueva partida</button>
              </div>
              <input id="import-file" type="file" accept="application/json" hidden />
            </div>
          </header>

          <main class="map-stage">
            <svg id="world-map" class="world-map" viewBox="0 0 1000 520" role="img" aria-label="Mapa mundial de la simulación">
              <defs>
                <radialGradient id="oceanGlow" cx="50%" cy="42%" r="65%"><stop offset="0" stop-color="#123247"/><stop offset="1" stop-color="#06121e"/></radialGradient>
                <filter id="markerGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
              </defs>
              <rect width="1000" height="520" fill="url(#oceanGlow)"></rect>
              <g class="map-grid">${renderMapGrid()}</g>
              <g id="map-content"><text x="500" y="260" text-anchor="middle" class="map-loading">Cargando cartografía…</text></g>
            </svg>
            <div class="map-vignette"></div>
            <div class="map-legend"><span><i class="player-dot"></i>Tu país</span><span><i></i>Economías simuladas</span><span><b></b>Flujos comerciales</span></div>
            ${renderCurrentPanel()}
          </main>

          <nav class="mobile-nav" aria-label="Áreas de gobierno">
            ${mapViews.map((item) => `<button class="${currentView === item.id ? "active" : ""}" type="button" data-action="view" data-view="${item.id}"><span>${e(item.icon || item.short.slice(0, 1))}</span><small>${e(item.short || item.label)}</small></button>`).join("")}
          </nav>
        </section>
      </div>
      ${renderGameOverModal()}`;
    if (samePanel) {
      const body = document.querySelector(".panel-body");
      const table = document.querySelector(".population-world .table-wrap");
      if (body) body.scrollTop = previousScroll.panel;
      if (table) table.scrollLeft = previousScroll.table;
    }
    const mobileNav = document.querySelector(".mobile-nav");
    const activeNav = mobileNav.querySelector(".active");
    if (activeNav) mobileNav.scrollLeft = activeNav.offsetLeft - (mobileNav.clientWidth - activeNav.offsetWidth) / 2;
    if (window.matchMedia("(max-width: 820px)").matches) window.scrollTo(0, samePanel ? previousScroll.page : 0);
    lastPanelKey = panelKey;
    drawWorldMap();
  }

  function renderMapGrid() {
    let lines = "";
    for (let x = 100; x < 1000; x += 100) lines += `<line x1="${x}" y1="0" x2="${x}" y2="520"></line>`;
    for (let y = 65; y < 520; y += 65) lines += `<line x1="0" y1="${y}" x2="1000" y2="${y}"></line>`;
    return lines;
  }

  function renderCurrentPanel() {
    if (currentView === "map") return renderMapPanel();
    if (currentView === "taxes") return renderTaxesPanel();
    if (currentView === "demographics") return renderDemographicsPanel();
    if (currentView === "trade") return renderTradePanel();
    if (currentView === "indicators") return renderIndicatorsPanel();
    return renderSectorPanel(currentView);
  }

  function renderMapPanel() {
    const country = playerCountry();
    const focus = game.countries[focusedCountryId] || country;
    const focusLeader = Engine.getLeaderDefinition(focus.id, focus.leaderId);
    return `
      <section class="map-dashboard">
        <div class="dashboard-heading">
          <div><p class="panel-kicker">Sala de situación</p><h2>${country.flag} ${e(country.name)}</h2></div>
          <span class="events-off">Eventos: desactivados</span>
        </div>
        <div class="dashboard-kpis">
          <article><span>Infraestructura</span><strong>${fmt(country.infrastructure)}/100</strong><small>Vivienda ${fmt(country.housing)}</small></article>
          <article><span>Turismo anual</span><strong>${fmt(country.tourism, 2)} M</strong><small>Capacidad +${fmt(country.tourismPotential, 1)}</small></article>
          <article><span>Migración neta</span><strong class="${country.migration < 0 ? "negative" : "positive"}">${signed(country.migration, "‰")}</strong><small>Natalidad ${fmt(country.birthRate)}‰</small></article>
          <article><span>Balance fiscal</span><strong class="${country.fiscalBalance < 0 ? "negative" : "positive"}">${signed(country.fiscalBalance, "%")}</strong><small>Deuda ${fmt(country.debt)}% PBI</small></article>
        </div>
        <div class="dashboard-bottom">
          <div class="focus-country">
            <span class="focus-flag">${focus.flag}</span><div><small>País seleccionado en el mapa</small><strong>${e(focus.name)}</strong><span>${e(focusLeader ? focusLeader.name : "Gobierno")}</span></div>
            <div class="focus-numbers"><b>${fmt(focus.population, 2)} M</b><small>Habitantes</small><small>${signed(focus.growth, "%")} PBI</small></div>
          </div>
          <div class="project-summary">
            <strong>${activeProjects(country).length}</strong><span>obras en ejecución</span>
            <button type="button" data-action="view" data-view="infrastructure">Abrir obra pública →</button>
          </div>
        </div>
      </section>`;
  }

  function sectorMetrics(id, country) {
    const foodBalance = country.sectorBalances.food || 0;
    const industryBalance = country.sectorBalances.manufactures || 0;
    const energyBalance = country.sectorBalances.energy || 0;
    const metrics = {
      infrastructure: [["Infraestructura", `${fmt(country.infrastructure)}/100`, "Red nacional"], ["Vivienda", `${fmt(country.housing)}/100`, "Capacidad urbana"], ["Turismo", `${fmt(country.tourism, 2)} M`, "Visitantes anuales"], ["Migración", signed(country.migration, "‰"), "Saldo por mil"]],
      agriculture: [["Oferta propia", fmt(country.sectorSupply.food, 2), "Unidades de mercado"], ["Consumo", fmt(country.sectorDemand.food, 2), "Demanda interna"], ["Balance", signed(foodBalance), foodBalance < 0 ? "Déficit" : "Superávit"], ["Madera", fmt(country.materialStocks.timber, 1), `+${fmt(country.materialProduction.timber, 1)}/mes`]],
      industry: [["Oferta industrial", fmt(country.sectorSupply.manufactures, 2), "Manufacturas"], ["Balance", signed(industryBalance), industryBalance < 0 ? "Importador" : "Exportador"], ["Productividad", `${fmt(country.productivity)}/150`, "Capacidad laboral"], ["Acero", fmt(country.materialStocks.steel, 1), `+${fmt(country.materialProduction.steel, 1)}/mes`]],
      services: [["Crecimiento", signed(country.growth, "%"), "Ritmo anualizado"], ["Turismo", `${fmt(country.tourism, 2)} M`, "Visitantes anuales"], ["Felicidad", `${fmt(country.happiness)}%`, "Bienestar percibido"], ["Logística", `+${fmt(country.tradeCapacity, 1)}`, "Capacidad adicional"]],
      education: [["Educación", `${fmt(country.education)}/100`, "Capital humano"], ["Productividad", `${fmt(country.productivity)}/150`, "Efecto acumulado"], ["Tecnología", fmt(country.sectorSupply.technology, 2), "Oferta propia"], ["Electrónica", fmt(country.materialStocks.electronics, 1), `+${fmt(country.materialProduction.electronics, 1)}/mes`]],
      health: [["Salud", `${fmt(country.health)}/100`, "Cobertura y calidad"], ["Mortalidad", `${fmt(country.mortality)}‰`, "Por mil habitantes"], ["Felicidad", `${fmt(country.happiness)}%`, "Bienestar percibido"], ["Población", `${fmt(country.population, 2)} M`, "Habitantes"]],
      security: [["Estabilidad", `${fmt(country.stability)}/100`, "Gobernabilidad"], ["Popularidad", `${fmt(country.popularity)}%`, "Apoyo al gobierno"], ["Felicidad", `${fmt(country.happiness)}%`, "Confianza social"], ["Empleo", `${fmt(100 - country.unemployment)}%`, "Población activa"]],
      energy: [["Oferta propia", fmt(country.sectorSupply.energy, 2), "Unidades de mercado"], ["Consumo", fmt(country.sectorDemand.energy, 2), "Demanda interna"], ["Balance", signed(energyBalance), energyBalance < 0 ? "Déficit" : "Superávit"], ["Combustible", fmt(country.materialStocks.fuel, 1), `+${fmt(country.materialProduction.fuel, 1)}/mes`]]
    };
    return metrics[id] || [];
  }

  function renderSectorPanel(sectorId) {
    const sector = DATA.sectors.find((item) => item.id === sectorId);
    const country = playerCountry();
    return `
      <section class="management-panel">
        <header class="management-heading">
          <div class="section-symbol">${e(sector.icon)}</div>
          <div><p class="panel-kicker">Ministerio · ${country.flag} ${e(country.name)}</p><h2>${e(sector.label)}</h2></div>
          <button class="panel-close" type="button" data-action="view" data-view="map" aria-label="Cerrar panel">×</button>
        </header>
        <nav class="panel-tabs" aria-label="Submenú de ${e(sector.label)}">
          ${[["overview", "Informe"], ["management", "Gestión"], ["build", "Construcciones"], ["stocks", "Recursos"]].map(([id, label]) => `<button class="${panelTab === id ? "active" : ""}" type="button" data-action="panel-tab" data-tab="${id}">${label}</button>`).join("")}
        </nav>
        <div class="panel-body">${renderSectorTab(sector, country)}</div>
        <footer class="panel-footer"><span>El motor actualiza producción, consumo, población y obras una vez por mes.</span><b>Eventos aleatorios pausados</b></footer>
      </section>`;
  }

  function renderSectorTab(sector, country) {
    if (panelTab === "management") return renderManagementTab(sector, country);
    if (panelTab === "build") return renderBuildTab(sector, country);
    if (panelTab === "stocks") return renderStocksTab(sector, country);
    const projects = activeProjects(country, sector.id);
    return `
      <div class="sector-intro"><div><span>Informe sectorial</span><p>${e(sectorHelp[sector.id])}</p></div><div class="policy-pill"><small>Impulso estatal</small><strong>${fmt(country.budget[sector.id] + country.subsidies[sector.id] / 5, 1)} pts</strong></div></div>
      <div class="sector-metrics">${sectorMetrics(sector.id, country).map(([label, value, detail]) => `<article><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></article>`).join("")}</div>
      <div class="overview-grid">
        <section class="inner-card"><div class="inner-heading"><div><small>Cartera</small><h3>Obras del sector</h3></div><strong>${projects.length} activas</strong></div>${renderProjectList(projects, true)}</section>
        <section class="inner-card causal-chain"><div class="inner-heading"><div><small>Lógica</small><h3>Cadena de impacto</h3></div></div>
          <div><span>Presupuesto + trabajo + subsidio</span><i>→</i><span>Producción y velocidad de obra</span><i>→</i><span>Indicadores sociales y económicos</span></div>
          <p>Los resultados estructurales tardan. Abrir varias obras del mismo ministerio divide su capacidad de ejecución.</p>
        </section>
      </div>`;
  }

  function renderManagementTab(sector, country) {
    const values = [
      ["budget", "Presupuesto nacional", "Participación dentro del gasto sectorial total", draft.budget[sector.id], 2, 40, "%"],
      ["labor", "Mano de obra", "Trabajadores asignados a esta rama", draft.labor[sector.id], 2, 40, "%"],
      ["subsidy", "Subsidio gubernamental", "Acelera actividad, pero amplía el costo fiscal", draft.subsidies[sector.id], 0, 60, "%"]
    ];
    const subsidyBurden = DATA.sectors.reduce((sum, item) => sum + draft.budget[item.id] * draft.subsidies[item.id] / 1000, 0);
    return `
      <div class="micro-layout">
        <section class="control-stack">
          <div class="inner-heading"><div><small>Microgestión</small><h3>Palancas del ministerio</h3></div><span>Vigentes desde el próximo mes</span></div>
          ${values.map(([kind, label, help, value, min, max, suffix]) => `
            <label class="control-row">
              <span class="control-icon">${kind === "budget" ? "$" : kind === "labor" ? "P" : "%"}</span>
              <span class="control-copy"><strong>${e(label)}</strong><small>${e(help)}</small></span>
              <input type="range" min="${min}" max="${max}" step="0.5" value="${value}" data-kind="${kind}" data-sector="${sector.id}" />
              <output data-output="${kind}-${sector.id}">${fmt(value)}${suffix}</output>
            </label>`).join("")}
          <div class="spending-row"><div><strong>Gasto público total</strong><small>Objetivo anual sobre el PBI</small></div><input type="range" min="22" max="58" step="0.5" value="${draft.spendingTarget}" data-kind="spending" /><output id="spending-output">${fmt(draft.spendingTarget)}%</output></div>
          <div class="control-actions"><button class="button button-quiet" type="button" data-action="reset-draft" ${draftDirty ? "" : "disabled"}>Restablecer</button><button class="button" type="button" data-action="apply-allocation" ${draftDirty ? "" : "disabled"}>Aplicar política</button></div>
        </section>
        <aside class="policy-impact">
          <p class="panel-kicker">Costo e impacto</p><h3>Lectura presupuestaria</h3>
          <div><span>Gasto objetivo</span><strong>${fmt(draft.spendingTarget)}% PBI</strong></div>
          <div><span>Carga estimada de subsidios</span><strong>+${fmt(subsidyBurden, 2)} pts</strong></div>
          <div><span>Balance fiscal actual</span><strong class="${country.fiscalBalance < 0 ? "negative" : "positive"}">${signed(country.fiscalBalance, "% PBI")}</strong></div>
          <p>Presupuesto y trabajo se compensan automáticamente contra los demás ministerios para conservar un total de 100%.</p>
        </aside>
      </div>`;
  }

  function renderBuildTab(sector, country) {
    const available = DATA.constructions.filter((item) => item.sector === sector.id);
    const activeCount = activeProjects(country).length;
    return `
      <div class="build-heading"><div><p class="panel-kicker">Catálogo nacional</p><h3>Construcciones temáticas</h3><p>Cada obra consume una fracción de sus insumos todos los meses. Si falta un material, el avance se ralentiza o se detiene.</p></div><div><strong>${activeCount}/8</strong><span>cupos activos</span></div></div>
      <div class="construction-grid">
        ${available.map((item) => {
          const preview = Engine.constructionPreview(game, item.id);
          const count = country.buildings[item.id] || 0;
          return `<article class="construction-card">
            <div class="construction-title"><span>${e(item.icon)}</span><div><small>${count} completadas</small><h3>${e(item.label)}</h3></div></div>
            <p>${e(item.description)}</p>
            <div class="construction-meta"><span><small>Plazo base</small><b>${item.months} meses</b></span><span><small>Costo estimado</small><b>${money(preview.totalCost)}</b></span></div>
            <div class="requirements">${Object.entries(item.requirements).map(([id, amount]) => `<span title="${e(materialById(id).label)}"><b>${e(materialById(id).icon)}</b>${fmt(amount, 0)}</span>`).join("")}</div>
            <div class="effects">${Object.entries(item.effects).slice(0, 3).map(([id, amount]) => `<span>+${fmt(Math.abs(amount), amount % 1 ? 1 : 0)} ${e(effectNames[id] || id)}</span>`).join("")}</div>
            <button class="button" type="button" data-action="build" data-building="${item.id}" ${activeCount >= 8 ? "disabled" : ""}>Iniciar construcción</button>
          </article>`;
        }).join("")}
      </div>`;
  }

  function renderStocksTab(sector, country) {
    const projects = country.projects.filter((project) => project.sector === sector.id).slice().reverse();
    return `
      <div class="stock-heading"><div><p class="panel-kicker">Inventario estratégico</p><h3>Materias primas nacionales</h3></div><p>La producción se suma al comienzo del mes; después las obras retiran insumos según su avance real.</p></div>
      <div class="stock-grid">
        ${DATA.materials.map((item) => {
          const stock = country.materialStocks[item.id];
          const capacity = country.materialCapacity[item.id];
          const pct = Math.min(100, stock / capacity * 100);
          return `<article class="${pct < 18 ? "low" : ""}"><div><span>${e(item.icon)}</span><strong>${e(item.label)}</strong></div><b>${fmt(stock, 1)} <small>/ ${fmt(capacity, 0)}</small></b><div class="stock-track"><i style="width:${pct}%"></i></div><small>Producción +${fmt(country.materialProduction[item.id], 2)} por mes</small></article>`;
        }).join("")}
      </div>
      <section class="queue-card"><div class="inner-heading"><div><small>Ejecución</small><h3>Cola del ministerio</h3></div><strong>${activeProjects(country, sector.id).length} activas</strong></div>${renderProjectList(projects, false)}</section>`;
  }

  function renderProjectList(projects, compact) {
    if (!projects.length) return `<div class="empty-state"><strong>Sin obras en esta categoría</strong><p>Elegí “Construcciones” para iniciar un proyecto.</p></div>`;
    return `<div class="project-list ${compact ? "compact" : ""}">${projects.map((project) => {
      const definition = constructionById(project.typeId);
      const blocked = project.blockedBy || [];
      return `<article class="${blocked.length ? "blocked" : project.progress >= 100 ? "complete" : ""}">
        <span class="project-icon">${e(definition.icon)}</span><div class="project-copy"><strong>${e(definition.label)}</strong><small>${project.progress >= 100 ? `Completada ${e(project.completedAt)}` : blocked.length ? `Falta: ${blocked.map((id) => materialById(id).label).join(", ")}` : `En obra · ${project.monthsActive} meses`}</small><div class="project-track"><i style="width:${project.progress}%"></i></div></div><b>${fmt(project.progress, 0)}%</b>
      </article>`;
    }).join("")}</div>`;
  }

  function renderTaxesPanel() {
    const country = playerCountry();
    return `
      <section class="management-panel system-panel policy-system">
        <header class="management-heading"><div class="section-symbol">$</div><div><p class="panel-kicker">Tesoro nacional · ${e(country.name)}</p><h2>Impuestos</h2></div><button class="panel-close" type="button" data-action="view" data-view="map" aria-label="Cerrar impuestos">×</button></header>
        <div class="panel-body fiscal-body">
          <p class="module-intro">Ajustá las alícuotas. La proyección cambia al mover los controles; el nuevo esquema entra en la simulación cuando lo aplicás.</p>
          <div class="fiscal-layout">
            <section class="tax-controls" aria-label="Alícuotas nacionales">
              ${DATA.taxes.map((tax) => `<div class="tax-control">
                <label for="tax-${tax.id}">${e(tax.label)}</label>
                <span class="tax-current">Vigente ${fmt(country.taxes[tax.id])}%</span>
                <p id="tax-help-${tax.id}">${e(tax.description)}</p>
                <input id="tax-${tax.id}" type="range" min="${tax.min}" max="${tax.max}" step="0.5" value="${taxDraft[tax.id]}" data-kind="tax" data-tax="${tax.id}" aria-describedby="tax-help-${tax.id}" />
                <label class="tax-number"><span class="sr-only">${e(tax.short)} en porcentaje</span><input type="number" min="${tax.min}" max="${tax.max}" step="0.5" value="${taxDraft[tax.id]}" data-kind="tax" data-tax="${tax.id}" />%</label>
              </div>`).join("")}
              <div class="control-actions"><button class="button button-quiet" data-action="reset-taxes" type="button" ${taxDraftDirty ? "" : "disabled"}>Restablecer</button><button class="button" data-action="apply-taxes" type="button" ${taxDraftDirty ? "" : "disabled"}>Aplicar impuestos</button></div>
            </section>
            <aside id="tax-preview" class="tax-preview" aria-live="polite">${renderTaxPreview()}</aside>
          </div>
        </div>
        <footer class="panel-footer">Alícuotas iniciales y bases simplificadas para el juego. “Otros ingresos” agrupa tributos y aportes no gestionados aquí.</footer>
      </section>`;
  }

  function renderTaxPreview() {
    const c = playerCountry();
    const preview = Engine.estimateTaxes(game, taxDraft);
    const current = Engine.estimateTaxes(game, c.taxes);
    const delta = preview.breakdown.total - current.breakdown.total;
    const subsidies = DATA.sectors.reduce((sum, s) => sum + c.budget[s.id] * c.subsidies[s.id] / 1000, 0);
    const bonus = (playerLeader().bonuses.efficiency || 0) * 0.12;
    const balance = Math.max(0, preview.breakdown.total + bonus) - c.spendingTarget - subsidies;
    return `
      <p class="panel-kicker">Proyección anual</p><h3>Recaudación estimada</h3>
      <div class="tax-total">${fmt(preview.breakdown.total, 2)}<span>% del PBI</span></div>
      <p class="tax-change ${delta < 0 ? "negative" : "positive"}">${signed(delta, " puntos")} frente al esquema vigente</p>
      <dl class="revenue-lines">
        ${DATA.taxes.map((tax) => `<div><dt>${e(tax.short)}</dt><dd>${fmt(preview.breakdown[tax.id], 2)}%</dd></div>`).join("")}
        <div><dt>Otros ingresos</dt><dd>${fmt(preview.breakdown.other, 2)}%</dd></div>
        <div><dt>Ajuste de gestión</dt><dd>${signed(bonus, " pts")}</dd></div>
        <div class="revenue-balance"><dt>Balance fiscal proyectado</dt><dd class="${balance < 0 ? "negative" : "positive"}">${signed(balance, "%")}</dd></div>
      </dl>
      <div class="tax-effects"><strong>Efecto directo del cambio</strong>
        <span>Crecimiento anual <b>${signed(preview.growthEffect - current.growthEffect, " pts")}</b></span>
        <span>Presión sobre precios <b>${signed(preview.inflationEffect - current.inflationEffect, " pts")}</b></span>
      </div>
      <p class="tax-footnote">Estimación con la economía actual. La recaudación final cambia con el empleo, el PBI y los flujos comerciales. Los derechos aduaneros se calculan sobre comercio mensual anualizado.</p>`;
  }

  function renderDemographicsPanel() {
    const id = demographicCountryId || game.playerCountryId;
    const c = game.countries[id];
    const d = Engine.demographicSnapshot(c);
    const flows = c.demographicFlows;
    const groups = [
      { key: "children", label: "Menores", count: d.children, share: c.demographics.children, detail: "0 a 17 años" },
      { key: "workers", label: "Edad laboral", count: d.workingAge, share: c.demographics.workers, detail: "18 a 64 años" },
      { key: "retired", label: "Jubilados", count: d.retired, share: c.demographics.retired, detail: "65 años o más en este modelo" }
    ];
    const countries = Object.values(game.countries).sort((a, b) => b.population - a.population);
    return `
      <section class="management-panel system-panel policy-system">
        <header class="management-heading"><div class="section-symbol">◒</div><div><p class="panel-kicker">Población y trabajo</p><h2>Demografía</h2></div><button class="panel-close" type="button" data-action="view" data-view="map" aria-label="Cerrar demografía">×</button></header>
        <div class="panel-body demographic-body">
          <div class="population-heading"><div><label for="demographic-country">Consultar país</label><select id="demographic-country">${DATA.countries.map((item) => `<option value="${item.id}" ${item.id === id ? "selected" : ""}>${e(item.name)}${item.id === game.playerCountryId ? " · Tu país" : ""}</option>`).join("")}</select></div>
            <div class="population-total"><span>Población total de ${e(c.name)}</span><strong>${fmt(c.population, 2)} <small>millones</small></strong><span>${fmt(c.population * 1000000, 0)} habitantes · ${e(Engine.monthLabel(game.date))}</span></div>
          </div>
          <div class="population-stack" role="img" aria-label="${groups.map((g) => g.label + ': ' + fmt(g.share) + '%').join(', ')}">${groups.map((g) => `<span class="${g.key}" style="width:${g.share}%"></span>`).join("")}</div>
          <div class="demographic-cards">${groups.map((g) => `<article class="${g.key}"><span>${g.label}</span><strong>${fmt(g.count, 2)} M</strong><b>${fmt(g.share)}% de la población</b><small>${g.detail}</small></article>`).join("")}</div>
          <div class="population-detail-grid">
            <section class="population-detail"><h3>Trabajadores y empleo</h3><dl>
              <div><dt>Ocupados</dt><dd>${fmt(d.employed, 2)} M</dd></div>
              <div><dt>Desocupados</dt><dd>${fmt(d.unemployed, 2)} M</dd></div>
              <div><dt>Inactivos en edad laboral</dt><dd>${fmt(d.inactive, 2)} M</dd></div>
              <div><dt>Tasa de desocupación</dt><dd>${fmt(c.unemployment)}%</dd></div>
            </dl><p>Participación laboral del modelo: 72% de los adultos de 18–64 años. La desocupación se mide sobre esa fuerza laboral.</p></section>
            <section class="population-detail"><h3>Movimientos del último mes</h3><dl>
              <div><dt>Nacimientos</dt><dd>+${fmt(flows.births * 1000000, 0)}</dd></div>
              <div><dt>Fallecimientos</dt><dd>−${fmt(flows.deaths * 1000000, 0)}</dd></div>
              <div><dt>Migración neta</dt><dd>${flows.migration >= 0 ? "+" : ""}${fmt(flows.migration * 1000000, 0)}</dd></div>
              <div><dt>Dependencia demográfica</dt><dd>${fmt(d.dependency)} por 100</dd></div>
            </dl><p>Menores y jubilados por cada 100 adultos en edad laboral. Los grupos evolucionan por nacimientos, envejecimiento, fallecimientos y migración.</p></section>
          </div>
          <section class="population-world"><div><h3>Población de los países simulados</h3><p>Elegí un país para ver su desglose. Todos evolucionan con el tiempo.</p></div>
            <div class="table-wrap"><table><caption class="sr-only">Comparación de población por país; valores en millones de habitantes</caption><thead><tr><th>País</th><th>Población</th><th>Menores</th><th>Edad laboral</th><th>Jubilados</th></tr></thead><tbody>
              ${countries.map((other) => {
                const s = Engine.demographicSnapshot(other);
                return `<tr class="${other.id === id ? "selected" : ""}" data-demographic-row="${other.id}"><th scope="row"><button type="button" data-action="inspect-demographic" data-country="${other.id}">${e(other.name)}${other.id === game.playerCountryId ? ' <small>Tu país</small>' : ""}</button></th><td>${fmt(s.total, 2)} M</td><td>${fmt(s.children, 2)} M</td><td>${fmt(s.workingAge, 2)} M</td><td>${fmt(s.retired, 2)} M</td></tr>`;
              }).join("")}
            </tbody></table></div>
          </section>
        </div>
        <footer class="panel-footer">Distribuciones iniciales de juego. La edad de jubilación se aproxima a 65 años para todos los países.</footer>
      </section>`;
  }

  function renderTradePanel() {
    const country = playerCountry();
    const flows = game.market.trades.filter((trade) => trade.from === country.id || trade.to === country.id).slice(0, 10);
    return `
      <section class="management-panel system-panel">
        <header class="management-heading"><div class="section-symbol">↔</div><div><p class="panel-kicker">Mercado mundial</p><h2>Comercio exterior</h2></div><button class="panel-close" type="button" data-action="view" data-view="map">×</button></header>
        <div class="panel-body trade-panel-body">
          <div class="market-strip">${DATA.commodities.map((item) => {
            const before = game.market.previousPrices[item.id];
            const change = before ? (game.market.prices[item.id] / before - 1) * 100 : 0;
            return `<article><span>${e(item.icon)}</span><div><small>${e(item.label)}</small><strong>Índice ${fmt(game.market.prices[item.id], 3)}</strong><b class="${change < 0 ? "negative" : "positive"}">${signed(change, "%")}</b></div></article>`;
          }).join("")}</div>
          <div class="trade-columns">
            <section class="inner-card"><div class="inner-heading"><div><small>Economía real</small><h3>Oferta frente a consumo</h3></div><strong class="${country.tradeBalance < 0 ? "negative" : "positive"}">${money(country.tradeBalance)}</strong></div>
              ${DATA.commodities.map((item) => {
                const supply = country.sectorSupply[item.id] || 0;
                const demand = country.sectorDemand[item.id] || 0;
                const max = Math.max(supply, demand, 0.01);
                return `<div class="balance-row"><div><strong>${e(item.label)}</strong><small>Oferta ${fmt(supply, 2)} · consumo ${fmt(demand, 2)}</small></div><div class="dual-bar"><i style="width:${supply / max * 100}%"></i><b style="width:${demand / max * 100}%"></b></div></div>`;
              }).join("")}
            </section>
            <section class="inner-card"><div class="inner-heading"><div><small>Contrapartes automáticas</small><h3>Flujos principales</h3></div></div>
              ${flows.length ? `<div class="flow-list">${flows.map((flow) => {
                const exporting = flow.from === country.id;
                const otherId = exporting ? flow.to : flow.from;
                const other = game.countries[otherId];
                return `<article><span class="${exporting ? "out" : "in"}">${exporting ? "EXP" : "IMP"}</span><div><strong>${e(DATA.commodities.find((item) => item.id === flow.commodity).label)}</strong><small>${exporting ? "hacia" : "desde"} ${other ? `${other.flag} ${e(other.name)}` : "resto del mundo"}</small></div><b>${money(flow.value)}</b></article>`;
              }).join("")}</div>` : '<div class="empty-state"><strong>Mercado en apertura</strong><p>Avanzá un mes para calcular los primeros flujos.</p></div>'}
            </section>
          </div>
          <p class="method-note">El consumo depende de población, ingreso, actividad y precios. La oferta combina recursos, productividad, infraestructura, inversiones terminadas y mano de obra.</p>
        </div>
      </section>`;
  }

  function sparkline(key, color) {
    const values = game.history.slice(-24).map((item) => Number(item[key])).filter(Number.isFinite);
    if (values.length < 2) return '<span class="spark-empty">Avanzá un mes para iniciar la serie.</span>';
    const min = Math.min(...values); const max = Math.max(...values); const range = max - min || 1;
    const points = values.map((value, index) => `${index / (values.length - 1) * 100},${38 - (value - min) / range * 34}`).join(" ");
    return `<svg class="spark" viewBox="0 0 100 42" preserveAspectRatio="none" aria-hidden="true"><polyline points="${points}" fill="none" stroke="${color}" stroke-width="2" vector-effect="non-scaling-stroke" /></svg>`;
  }

  function renderIndicatorsPanel() {
    const country = playerCountry();
    const indicators = [
      ["PBI", money(country.gdp), "gdp", "#48d7c5", `${signed(country.growth, "%")} anualizado`],
      ["Población", `${fmt(country.population, 2)} M`, "population", "#74a8ff", `Migración ${signed(country.migration, "‰")}`],
      ["Felicidad", `${fmt(country.happiness)}%`, "happiness", "#f4bd63", `Apoyo ${fmt(country.popularity)}%`],
      ["Turismo", `${fmt(country.tourism, 2)} M`, "tourism", "#d08cff", "Visitantes anuales"],
      ["Educación", `${fmt(country.education)}/100`, "education", "#f4bd63", "Productividad gradual"],
      ["Desocupación", `${fmt(country.unemployment)}%`, "unemployment", "#ff8d6b", "Actividad y obra pública"],
      ["Infraestructura", `${fmt(country.infrastructure)}/100`, "infrastructure", "#85db79", `Vivienda ${fmt(country.housing)}`],
      ["Deuda pública", `${fmt(country.debt)}% PBI`, "debt", "#f0d36b", `${signed(country.fiscalBalance, "%")} fiscal`]
    ];
    return `
      <section class="management-panel system-panel">
        <header class="management-heading"><div class="section-symbol">▧</div><div><p class="panel-kicker">Series nacionales</p><h2>Indicadores</h2></div><button class="panel-close" type="button" data-action="view" data-view="map">×</button></header>
        <div class="panel-body">
          <div class="indicator-grid">${indicators.map(([label, value, key, color, detail]) => `<article><div><span>${e(label)}</span><strong>${e(value)}</strong><small>${e(detail)}</small></div>${sparkline(key, color)}</article>`).join("")}</div>
          <section class="inner-card history-card"><div class="inner-heading"><div><small>Registro reciente</small><h3>Evolución mensual</h3></div></div>
            <div class="table-wrap"><table><thead><tr><th>Fecha</th><th>PBI</th><th>Variación</th><th>Desocupación</th><th>Felicidad</th><th>Turismo</th><th>Comercio</th></tr></thead><tbody>
              ${game.history.slice(-12).reverse().map((row) => `<tr><td>${e(row.date)}</td><td>${money(row.gdp)}</td><td class="${row.growth < 0 ? "negative" : "positive"}">${signed(row.growth, "%")}</td><td>${fmt(row.unemployment)}%</td><td>${fmt(row.happiness)}%</td><td>${fmt(row.tourism, 2)} M</td><td class="${row.tradeBalance < 0 ? "negative" : "positive"}">${money(row.tradeBalance)}</td></tr>`).join("")}
            </tbody></table></div>
          </section>
        </div>
      </section>`;
  }

  function projectPoint(center) { return [(center[0] + 180) / 360 * 1000, (90 - center[1]) / 180 * 520]; }
  function ringPath(ring) {
    let path = ""; let previousX = null;
    ring.forEach((point, index) => {
      const [x, y] = projectPoint(point);
      const jump = previousX != null && Math.abs(x - previousX) > 480;
      path += `${index === 0 || jump ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      previousX = x;
    });
    return path + "Z";
  }
  function geometryPath(geometry) {
    if (!geometry) return "";
    const polygons = geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
    return polygons.map((polygon) => polygon.map(ringPath).join("")).join("");
  }
  function requestWorldData() {
    if (worldData) return Promise.resolve(worldData);
    if (!worldPromise) worldPromise = fetch("./world.geojson").then((response) => {
      if (!response.ok) throw new Error("No se pudo cargar la cartografía");
      return response.json();
    }).then((data) => { worldData = data; return data; });
    return worldPromise;
  }
  async function drawWorldMap() {
    const target = document.querySelector("#map-content");
    if (!target) return;
    try {
      const geojson = await requestWorldData();
      if (!document.querySelector("#map-content")) return;
      const land = geojson.features.map((feature) => `<path class="land" d="${geometryPath(feature.geometry)}"></path>`).join("");
      const flows = game.market.trades.filter((flow) => game.countries[flow.from] && game.countries[flow.to]).slice(0, 14).map((flow) => {
        const [x1, y1] = projectPoint(game.countries[flow.from].center);
        const [x2, y2] = projectPoint(game.countries[flow.to].center);
        if (Math.abs(x2 - x1) > 520) return "";
        const cx = (x1 + x2) / 2; const cy = Math.min(y1, y2) - 24;
        return `<path class="trade-arc" d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}"></path>`;
      }).join("");
      const markers = Object.values(game.countries).map((country) => {
        const [x, y] = projectPoint(country.center);
        const player = country.id === game.playerCountryId;
        return `<g class="country-marker ${player ? "player" : ""} ${focusedCountryId === country.id ? "focused" : ""}" transform="translate(${x} ${y})" data-action="inspect-country" data-country="${country.id}" tabindex="0" role="button" aria-label="${e(country.name)}">
          ${player ? '<circle class="pulse-ring" r="15"></circle>' : ""}<circle class="marker-core" r="${player ? 6.5 : 4.5}"></circle>
          <text x="10" y="-8">${e(country.id)}</text><title>${e(country.name)} · PBI ${money(country.gdp)} · ${signed(country.growth, "%")}</title>
        </g>`;
      }).join("");
      document.querySelector("#map-content").innerHTML = `<g class="land-layer">${land}</g><g class="trade-layer">${flows}</g><g class="marker-layer">${markers}</g>`;
    } catch (_) {
      const current = document.querySelector("#map-content");
      if (current) current.innerHTML = '<text x="500" y="260" text-anchor="middle" class="map-loading">Mapa no disponible; la simulación continúa.</text>';
    }
  }

  function renderGameOverModal() {
    if (!game.gameOver) return "";
    return `<div class="modal-backdrop"><section class="game-over-modal" role="dialog" aria-modal="true"><span>${game.gameOver.won ? "Mandato completado" : "Fin del gobierno"}</span><h2>${e(game.gameOver.title)}</h2><p>${e(game.gameOver.detail)}</p><div><button class="button" type="button" data-action="export">Exportar resultado</button><button class="button button-quiet" type="button" data-action="new-game">Nueva partida</button></div></section></div>`;
  }

  function rebalanceDraft(kind, sectorId, requestedValue) {
    const allocation = draft[kind];
    const oldValue = allocation[sectorId];
    const value = Math.max(2, Math.min(40, requestedValue));
    let delta = value - oldValue;
    const others = DATA.sectors.map((sector) => sector.id).filter((id) => id !== sectorId);
    if (delta > 0) {
      const available = others.reduce((sum, id) => sum + Math.max(0, allocation[id] - 2), 0);
      delta = Math.min(delta, available);
      allocation[sectorId] = oldValue + delta;
      let remaining = delta;
      others.forEach((id, index) => {
        const reduction = index === others.length - 1 ? remaining : delta * Math.max(0, allocation[id] - 2) / Math.max(available, 1);
        allocation[id] -= Math.min(remaining, reduction); remaining -= Math.min(remaining, reduction);
      });
    } else {
      const freed = -delta;
      allocation[sectorId] = value;
      const totalOther = others.reduce((sum, id) => sum + allocation[id], 0);
      let remaining = freed;
      others.forEach((id, index) => {
        const addition = index === others.length - 1 ? remaining : freed * allocation[id] / totalOther;
        allocation[id] += addition; remaining -= addition;
      });
    }
    draft[kind] = Engine.normalizeAllocation(allocation);
    draftDirty = true;
  }

  function updateDraftOutput(kind, sectorId) {
    const output = document.querySelector(`[data-output="${kind}-${sectorId}"]`);
    if (output) output.textContent = `${fmt(kind === "subsidy" ? draft.subsidies[sectorId] : draft[kind][sectorId])}%`;
    const input = document.querySelector(`input[data-kind="${kind}"][data-sector="${sectorId}"]`);
    if (input) input.value = kind === "subsidy" ? draft.subsidies[sectorId] : draft[kind][sectorId];
    document.querySelectorAll("[data-action='apply-allocation'], [data-action='reset-draft']").forEach((button) => { button.disabled = !draftDirty; });
  }

  function setSpeed(nextSpeed) {
    clearInterval(timer); timer = null; speed = Number(nextSpeed);
    if (game && game.gameOver) speed = 0;
    if (speedIntervals[speed]) timer = setInterval(stepGame, speedIntervals[speed]);
    if (game) renderGame();
  }

  async function stepGame() {
    if (!game || game.gameOver) { setSpeed(0); return; }
    Engine.advanceTick(game);
    if (!draftDirty) draftFromGame();
    if (game.tick % 3 === 0) await saveGame("autosave", false);
    if (game.gameOver) { clearInterval(timer); timer = null; speed = 0; }
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
      game = Engine.hydrate(latest.state); selectedCountryId = game.playerCountryId; focusedCountryId = game.playerCountryId;
      demographicCountryId = game.playerCountryId; taxDraftDirty = false;
      currentView = "map"; panelTab = "overview"; lastSaveLabel = "Partida recuperada"; draftFromGame(); renderGame();
    } catch (error) { showToast(error.message, "error"); }
  }

  function exportGame() {
    if (!game) return;
    const blob = new Blob([JSON.stringify(game, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob); const anchor = document.createElement("a");
    anchor.href = url; anchor.download = `pulso-global-${game.playerCountryId}-${game.date.year}-${String(game.date.month).padStart(2, "0")}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  async function importGame(file) {
    if (!file) return;
    try {
      const imported = Engine.hydrate(JSON.parse(await file.text()));
      clearInterval(timer); timer = null;
      game = imported; selectedCountryId = game.playerCountryId; focusedCountryId = game.playerCountryId;
      demographicCountryId = game.playerCountryId; taxDraftDirty = false;
      currentView = "map"; panelTab = "overview"; speed = 0; draftFromGame(); await saveGame("manual", false); renderGame();
      showToast("Partida importada correctamente", "success");
    } catch (error) { showToast(`No se pudo importar: ${error.message}`, "error"); }
  }

  function registerWebMCP() {
    const context = document.modelContext;
    if (!context || typeof context.registerTool !== "function") return;
    const register = (tool) => { try { Promise.resolve(context.registerTool(tool)).catch(() => undefined); } catch (_) { /* API opcional */ } };
    register({
      name: "read_government_state", title: "Leer estado del gobierno",
      description: "Devuelve indicadores, inventario y obras de la partida activa sin modificarla.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute() {
        if (!game) return { active: false };
        const c = playerCountry();
        return { active: true, date: Engine.monthLabel(game.date), month: game.tick, openEnded: game.openEnded, country: c.name, leader: playerLeader().name, population: c.population, demographics: Engine.demographicSnapshot(c), taxes: c.taxes, revenueRate: c.revenueRate, happiness: c.happiness, gdp: c.gdp, growth: c.growth, unemployment: c.unemployment, tourism: c.tourism, migration: c.migration, activeProjects: activeProjects(c).length, materialStocks: c.materialStocks };
      }
    });
    register({
      name: "advance_simulation_months", title: "Avanzar simulación",
      description: "Avanza entre uno y doce meses del motor base, sin eventos aleatorios.",
      inputSchema: { type: "object", properties: { months: { type: "integer", minimum: 1, maximum: 12 } }, required: ["months"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!game) throw new Error("No hay una partida activa.");
        const months = Number(input && input.months);
        if (!Number.isInteger(months) || months < 1 || months > 12) throw new Error("months debe ser un entero entre 1 y 12.");
        let advanced = 0;
        while (advanced < months && !game.gameOver) { Engine.advanceTick(game); advanced += 1; }
        if (!draftDirty) draftFromGame(); await saveGame("autosave", false); renderGame();
        return { advanced, date: Engine.monthLabel(game.date), gameOver: game.gameOver ? game.gameOver.title : null };
      }
    });
    register({
      name: "start_public_project", title: "Iniciar obra pública",
      description: "Inicia una construcción disponible en la partida activa.",
      inputSchema: { type: "object", properties: { constructionId: { type: "string", enum: DATA.constructions.map((item) => item.id) } }, required: ["constructionId"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      async execute(input) {
        if (!game) throw new Error("No hay una partida activa.");
        const project = Engine.queueConstruction(game, input.constructionId); await saveGame("autosave", false); renderGame();
        return { projectId: project.id, construction: input.constructionId, startedAt: project.startedAt };
      }
    });
  }

  app.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;
    const action = target.dataset.action;
    if (action === "select-country") {
      selectedCountryId = target.dataset.country;
      document.querySelector("#leader-panel").innerHTML = renderLeaderPanel(selectedCountryId);
      document.querySelectorAll(".country-card").forEach((card) => {
        const selected = card.dataset.country === selectedCountryId;
        card.classList.toggle("selected", selected); card.setAttribute("aria-pressed", String(selected));
      });
    } else if (action === "start-game") startGame(target.dataset.country, target.dataset.leader);
    else if (action === "continue-game") await continueGame();
    else if (action === "view") {
      currentView = target.dataset.view; panelTab = isSector(currentView) ? "overview" : panelTab; renderGame();
    } else if (action === "panel-tab") { panelTab = target.dataset.tab; renderGame(); }
    else if (action === "inspect-demographic") { demographicCountryId = target.dataset.country; renderGame(); }
    else if (action === "inspect-country") { focusedCountryId = target.dataset.country; if (currentView !== "map") currentView = "map"; renderGame(); }
    else if (action === "speed") setSpeed(Number(target.dataset.speed));
    else if (action === "step") await stepGame();
    else if (action === "apply-allocation") {
      Engine.applyAllocations(game, draft); draftFromGame(); await saveGame("autosave", false); renderGame();
      showToast("Política aplicada: el efecto se calcula mes a mes", "success");
    } else if (action === "reset-draft") { draftFromGame(); renderGame(); }
    else if (action === "apply-taxes") {
      Engine.applyTaxes(game, taxDraft);
      taxDraftDirty = false; taxDraft = Engine.clone(playerCountry().taxes);
      await saveGame("autosave", false); renderGame();
      showToast("Impuestos aplicados. El próximo mes reflejará su efecto.", "success");
    } else if (action === "reset-taxes") {
      taxDraftDirty = false; taxDraft = Engine.clone(playerCountry().taxes); renderGame();
    }
    else if (action === "build") {
      try {
        const definition = constructionById(target.dataset.building);
        Engine.queueConstruction(game, target.dataset.building); panelTab = "stocks"; await saveGame("autosave", false); renderGame();
        showToast(`${definition.label}: obra iniciada`, "success");
      } catch (error) { showToast(error.message, "error"); }
    } else if (action === "save") { await saveGame("manual", true); renderGame(); }
    else if (action === "toggle-menu") {
      const menu = document.querySelector("#save-menu"); menu.hidden = !menu.hidden;
    } else if (action === "export") exportGame();
    else if (action === "import") document.querySelector("#import-file").click();
    else if (action === "new-game") { setSpeed(0); game = null; await renderStart(); }
  });

  app.addEventListener("keydown", (event) => {
    const target = event.target.closest("[data-action='inspect-country']");
    if (target && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); target.dispatchEvent(new MouseEvent("click", { bubbles: true })); }
  });

  app.addEventListener("input", (event) => {
    const input = event.target;
    if (input.dataset.kind === "tax" && game) {
      if (input.value === "" || !Number.isFinite(Number(input.value))) return;
      const tax = DATA.taxes.find((t) => t.id === input.dataset.tax);
      taxDraft[tax.id] = Engine.clamp(Number(input.value), tax.min, tax.max);
      taxDraftDirty = DATA.taxes.some((t) => taxDraft[t.id] !== playerCountry().taxes[t.id]);
      document.querySelectorAll(`input[data-kind="tax"][data-tax="${tax.id}"]`).forEach((field) => { if (field !== input) field.value = taxDraft[tax.id]; });
      document.querySelector("#tax-preview").innerHTML = renderTaxPreview();
      document.querySelectorAll('[data-action="apply-taxes"],[data-action="reset-taxes"]').forEach((button) => { button.disabled = !taxDraftDirty; });
      return;
    }
    if (!draft || input.type !== "range") return;
    if (input.dataset.kind === "spending") {
      draft.spendingTarget = Number(input.value); draftDirty = true;
      const output = document.querySelector("#spending-output"); if (output) output.textContent = `${fmt(draft.spendingTarget)}%`;
      document.querySelectorAll("[data-action='apply-allocation'], [data-action='reset-draft']").forEach((button) => { button.disabled = false; });
    } else if (input.dataset.kind === "budget" || input.dataset.kind === "labor") {
      rebalanceDraft(input.dataset.kind, input.dataset.sector, Number(input.value)); updateDraftOutput(input.dataset.kind, input.dataset.sector);
    } else if (input.dataset.kind === "subsidy") {
      draft.subsidies[input.dataset.sector] = Number(input.value); draftDirty = true; updateDraftOutput("subsidy", input.dataset.sector);
    }
  });

  app.addEventListener("change", (event) => {
    if (event.target.id === "import-file") importGame(event.target.files[0]);
    if (event.target.id === "demographic-country") { demographicCountryId = event.target.value; renderGame(); }
    if (event.target.dataset.kind === "tax") event.target.value = taxDraft[event.target.dataset.tax];
  });
  document.addEventListener("click", (event) => {
    const menu = document.querySelector("#save-menu");
    if (menu && !menu.hidden && !event.target.closest(".save-cluster")) menu.hidden = true;
  });
  window.addEventListener("beforeunload", () => { if (game) SaveStore.put("autosave", game).catch(() => undefined); });
  if ("serviceWorker" in navigator && location.protocol !== "file:") window.addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(() => undefined));
  renderStart().then(registerWebMCP);
})();
