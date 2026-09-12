(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./data.js") : root.PULSO_DATA);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PulsoEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (DATA) {
  "use strict";

  const SAVE_VERSION = 1;
  const START_YEAR = 2026;
  const START_MONTH = 1;
  const MONTHS_LIMIT = 96;

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function round(value, digits) {
    const factor = 10 ** (digits || 0);
    return Math.round((value + Number.EPSILON) * factor) / factor;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function sumValues(object) { return Object.values(object).reduce((sum, value) => sum + Number(value || 0), 0); }
  function monthLabel(date) {
    return new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(date.year, date.month - 1, 1)))
      .replace(" de ", " ");
  }
  function random(state) {
    let t = (state.rngState + 0x6D2B79F5) >>> 0;
    state.rngState = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick(state, array) { return array[Math.floor(random(state) * array.length)]; }

  function getCountryDefinition(id) { return DATA.countries.find((country) => country.id === id); }
  function getLeaderDefinition(countryId, leaderId) {
    const country = getCountryDefinition(countryId);
    return country ? country.leaders.find((leader) => leader.id === leaderId) : null;
  }

  function initialRelations(country) {
    const relations = {};
    DATA.countries.forEach((other) => {
      if (other.id === country.id) return;
      let score = country.region === other.region ? 65 : 50;
      const pair = [country.id, other.id].sort().join("-");
      const adjustments = {
        "ARG-BRA": 10, "ARG-USA": 3, "BRA-CHN": 8, "BRA-USA": 2,
        "CHN-RUS": 12, "CHN-USA": -14, "DEU-USA": 10, "DEU-RUS": -11,
        "ECU-USA": 5, "IND-RUS": 7, "CHN-IND": -5, "MEX-USA": 18,
        "RUS-USA": -18, "DEU-CHN": 4, "IND-USA": 8, "USA-ZAF": 3
      };
      score += adjustments[pair] || 0;
      relations[other.id] = clamp(score, 10, 90);
    });
    return relations;
  }

  function toCountryState(definition) {
    return {
      id: definition.id,
      name: definition.name,
      flag: definition.flag,
      region: definition.region,
      politicalSystem: definition.politicalSystem,
      currency: definition.currency,
      population: definition.population,
      gdp: definition.gdp,
      education: definition.education,
      unemployment: definition.unemployment,
      infrastructure: definition.infrastructure,
      debt: definition.debt,
      inflation: definition.inflation,
      popularity: definition.popularity,
      stability: definition.stability,
      birthRate: definition.birthRate,
      mortality: definition.mortality,
      migration: definition.migration,
      productivity: definition.productivity,
      reserves: definition.reserves,
      baseGrowth: definition.baseGrowth,
      spendingTarget: definition.spendingTarget,
      revenueRate: definition.revenueRate || definition.spendingTarget - 4,
      baseTaxEfficiency: definition.taxEfficiency,
      taxEfficiency: definition.taxEfficiency,
      resources: clone(definition.resources),
      budget: clone(definition.budget),
      labor: clone(definition.labor),
      leaderId: definition.leaders[0].id,
      growth: definition.baseGrowth,
      fiscalBalance: 0,
      tradeBalance: 0,
      sectorBalances: { food: 0, energy: 0, manufactures: 0, technology: 0 },
      sectorSupply: { food: 0, energy: 0, manufactures: 0, technology: 0 },
      sectorDemand: { food: 0, energy: 0, manufactures: 0, technology: 0 },
      relations: initialRelations(definition),
      modifiers: [],
      lowPopularityMonths: 0,
      policyShock: 0
    };
  }

  function createGame(countryId, leaderId, seed) {
    const countryDef = getCountryDefinition(countryId);
    const leaderDef = getLeaderDefinition(countryId, leaderId);
    if (!countryDef || !leaderDef) throw new Error("País o figura no válidos.");

    const countries = {};
    DATA.countries.forEach((definition) => { countries[definition.id] = toCountryState(definition); });
    countries[countryId].leaderId = leaderId;

    const game = {
      version: SAVE_VERSION,
      gameId: `pg-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      createdAt: new Date().toISOString(),
      savedAt: null,
      rngState: (Number(seed) || Date.now()) >>> 0,
      playerCountryId: countryId,
      playerLeaderId: leaderId,
      date: { year: START_YEAR, month: START_MONTH },
      tick: 0,
      globalDemand: 1,
      market: {
        prices: Object.fromEntries(DATA.commodities.map((item) => [item.id, item.basePrice])),
        previousPrices: Object.fromEntries(DATA.commodities.map((item) => [item.id, item.basePrice])),
        trades: []
      },
      countries,
      events: [],
      pendingDecision: null,
      monthsWithoutEvent: 0,
      history: [],
      gameOver: null
    };

    addNews(game, "briefing", `${leaderDef.name} asume la conducción de ${countryDef.name}. El primer presupuesto queda abierto a revisión.`);
    captureHistory(game);
    return game;
  }

  function addNews(state, type, text, countryId) {
    state.events.unshift({
      id: `news-${state.tick}-${state.events.length}-${Math.floor(random(state) * 100000)}`,
      tick: state.tick,
      date: monthLabel(state.date),
      type,
      countryId: countryId || null,
      text
    });
    state.events = state.events.slice(0, 80);
  }

  function leaderBonuses(country) {
    const leader = getLeaderDefinition(country.id, country.leaderId);
    return leader ? leader.bonuses : {};
  }

  function activeImpact(country) {
    return country.modifiers.reduce((impact, modifier) => {
      Object.entries(modifier.impact).forEach(([key, value]) => {
        if (key === "duration") return;
        const distributed = ["popularity", "stability", "inflation", "unemployment", "infrastructure", "education", "productivity", "reserves"].includes(key);
        const amount = distributed ? Number(value || 0) / Math.max(1, modifier.totalDuration || modifier.remaining) : Number(value || 0);
        impact[key] = (impact[key] || 0) + amount;
      });
      return impact;
    }, {});
  }

  function productionAndDemand(country, state) {
    const impact = activeImpact(country);
    const gdpScale = Math.max(0.08, country.gdp / 1000);
    const popScale = Math.max(0.05, country.population / 100);
    const gdpPerCapita = country.gdp * 1000 / country.population;
    const productivityFactor = 0.62 + country.productivity / 170;
    const infrastructureFactor = 0.62 + country.infrastructure / 170;
    const demandCycle = state.globalDemand * (0.94 + clamp(country.growth, -8, 10) / 120);
    const prices = state.market.prices;

    const supply = {
      food: popScale * (0.32 + country.resources.food * 0.82) * (0.55 + country.labor.agriculture / 12) * productivityFactor * (1 + (impact.food || 0)),
      energy: gdpScale * (0.22 + country.resources.energy * 0.76) * (0.58 + country.labor.energy / 10) * infrastructureFactor * (1 + (impact.energy || 0)),
      manufactures: gdpScale * (0.2 + country.resources.manufactures * 0.78) * (0.48 + country.labor.industry / 28) * productivityFactor * (1 + (impact.industry || 0)),
      technology: gdpScale * (0.08 + country.resources.technology * 0.68) * (0.4 + country.education / 105) * (0.55 + country.labor.education / 15) * (1 + (impact.technology || 0))
    };

    const demand = {
      food: popScale * (0.78 + gdpPerCapita / 90000) * demandCycle * Math.pow(prices.food, -0.16),
      energy: (popScale * (0.3 + gdpPerCapita / 39000) + gdpScale * country.labor.industry / 42) * demandCycle * Math.pow(prices.energy / 1.3, -0.2),
      manufactures: gdpScale * (0.55 + gdpPerCapita / 85000) * demandCycle * Math.pow(prices.manufactures / 1.1, -0.24),
      technology: gdpScale * (0.28 + country.education / 145) * demandCycle * Math.pow(prices.technology / 1.7, -0.28)
    };

    Object.keys(supply).forEach((key) => {
      supply[key] = Math.max(0.01, supply[key]);
      demand[key] = Math.max(0.01, demand[key]);
    });
    return { supply, demand };
  }

  function relationScore(importer, exporter) {
    const relation = importer.relations[exporter.id] || 50;
    const regional = importer.region === exporter.region ? 12 : 0;
    return relation + regional + exporter.infrastructure * 0.08;
  }

  function simulateMarkets(state) {
    const snapshots = {};
    const totalSupply = Object.fromEntries(DATA.commodities.map((item) => [item.id, 0]));
    const totalDemand = Object.fromEntries(DATA.commodities.map((item) => [item.id, 0]));

    Object.values(state.countries).forEach((country) => {
      const snapshot = productionAndDemand(country, state);
      snapshots[country.id] = snapshot;
      DATA.commodities.forEach((commodity) => {
        totalSupply[commodity.id] += snapshot.supply[commodity.id];
        totalDemand[commodity.id] += snapshot.demand[commodity.id];
      });
      country.tradeBalance = 0;
    });

    state.market.previousPrices = { ...state.market.prices };
    DATA.commodities.forEach((commodity) => {
      const id = commodity.id;
      const buffer = (totalSupply[id] + totalDemand[id]) * 0.82;
      const imbalance = (totalDemand[id] - totalSupply[id]) / Math.max(0.1, totalDemand[id] + totalSupply[id] + buffer * 2);
      const noise = (random(state) - 0.5) * 0.012;
      const change = clamp(imbalance * 0.24 + noise, -0.065, 0.065);
      state.market.prices[id] = round(clamp(state.market.prices[id] * (1 + change), commodity.basePrice * 0.48, commodity.basePrice * 2.6), 3);
    });

    const trades = [];
    DATA.commodities.forEach((commodity) => {
      const id = commodity.id;
      const exporters = Object.values(state.countries)
        .map((country) => ({ country, available: Math.max(0, snapshots[country.id].supply[id] - snapshots[country.id].demand[id]) }))
        .filter((entry) => entry.available > 0.01);
      const importers = Object.values(state.countries)
        .map((country) => ({ country, needed: Math.max(0, snapshots[country.id].demand[id] - snapshots[country.id].supply[id]) }))
        .filter((entry) => entry.needed > 0.01)
        .sort((a, b) => b.needed - a.needed);

      importers.forEach((importer) => {
        exporters.sort((a, b) => relationScore(importer.country, b.country) - relationScore(importer.country, a.country));
        for (const exporter of exporters) {
          if (importer.needed <= 0.005) break;
          if (exporter.available <= 0.005 || exporter.country.id === importer.country.id) continue;
          const quantity = Math.min(importer.needed, exporter.available);
          const diplomaticFactor = clamp((importer.country.relations[exporter.country.id] || 50) / 70, 0.55, 1.2);
          const actual = quantity * diplomaticFactor;
          const value = actual * state.market.prices[id] * 0.72;
          importer.needed -= actual;
          exporter.available -= actual;
          importer.country.tradeBalance -= value;
          exporter.country.tradeBalance += value;
          trades.push({ commodity: id, from: exporter.country.id, to: importer.country.id, quantity: round(actual, 2), value: round(value, 2) });
        }

        if (importer.needed > 0.005) {
          const value = importer.needed * state.market.prices[id] * 0.78;
          importer.country.tradeBalance -= value;
          trades.push({ commodity: id, from: "ROW", to: importer.country.id, quantity: round(importer.needed, 2), value: round(value, 2) });
        }
      });

      exporters.forEach((exporter) => {
        if (exporter.available > 0.005) {
          const value = exporter.available * state.market.prices[id] * 0.66;
          exporter.country.tradeBalance += value;
          trades.push({ commodity: id, from: exporter.country.id, to: "ROW", quantity: round(exporter.available, 2), value: round(value, 2) });
        }
      });
    });

    Object.values(state.countries).forEach((country) => {
      country.sectorSupply = Object.fromEntries(DATA.commodities.map((item) => [item.id, round(snapshots[country.id].supply[item.id], 2)]));
      country.sectorDemand = Object.fromEntries(DATA.commodities.map((item) => [item.id, round(snapshots[country.id].demand[item.id], 2)]));
      country.sectorBalances = Object.fromEntries(DATA.commodities.map((item) => [item.id, round(snapshots[country.id].supply[item.id] - snapshots[country.id].demand[item.id], 2)]));
      country.tradeBalance = round(country.tradeBalance, 2);
    });
    state.market.trades = trades.sort((a, b) => b.value - a.value).slice(0, 120);
  }

  function simulateCountry(country, state) {
    const bonuses = leaderBonuses(country);
    const impact = activeImpact(country);
    const previousGdp = country.gdp;
    const previousUnemployment = country.unemployment;
    const revenueRate = clamp(country.revenueRate + (country.taxEfficiency - country.baseTaxEfficiency) * 20 + (bonuses.efficiency || 0) * 0.12, 18, 52);
    const fiscalBalance = revenueRate - country.spendingTarget;
    const tradeImpulse = clamp(country.tradeBalance / Math.max(country.gdp, 1) * 95, -1.8, 1.8);
    const educationDrive = (country.budget.education - 15) * 0.035 + (bonuses.education || 0) * 0.035;
    const industryDrive = (country.budget.industry - 10) * 0.04 + (country.labor.industry - 18) * 0.025 + (bonuses.industry || 0) * 0.055;
    const infrastructureDrive = (country.infrastructure - 65) * 0.012 + (bonuses.infrastructure || 0) * 0.04;
    const inflationDrag = Math.max(0, country.inflation - 5) * 0.022;
    const unemploymentDrag = Math.max(0, country.unemployment - 6) * 0.07;
    const growth = clamp(
      country.baseGrowth + educationDrive + industryDrive + infrastructureDrive + tradeImpulse - inflationDrag - unemploymentDrag + (impact.growth || 0),
      -12, 14
    );

    country.growth = round(growth, 2);
    country.gdp = Math.max(5, country.gdp * (1 + growth / 1200));

    const employmentPulse = (2.5 - growth) * 0.012 - (country.budget.infrastructure - 14) * 0.0025;
    country.unemployment = clamp(country.unemployment + employmentPulse + (impact.unemployment || 0), 1.2, 42);

    const energyMove = (state.market.prices.energy / state.market.previousPrices.energy - 1) * 6;
    const structuralInflation = clamp(2.4 + Math.max(0, country.spendingTarget - revenueRate) * 0.34 - Math.max(0, country.productivity - 80) * 0.008, 1, 35);
    country.inflation = clamp(country.inflation + (structuralInflation - country.inflation) * 0.035 + energyMove + (impact.inflation || 0), 0.2, 250);

    const educationChange = (country.budget.education / 15 - 1) * 0.045 + (country.labor.education / 8 - 1) * 0.025 + (bonuses.education || 0) * 0.006;
    country.education = clamp(country.education + educationChange + (impact.education || 0), 25, 98);

    const infrastructureChange = (country.budget.infrastructure / 14 - 1) * 0.055 + (country.labor.infrastructure / 7 - 1) * 0.03 + (bonuses.infrastructure || 0) * 0.007;
    country.infrastructure = clamp(country.infrastructure + infrastructureChange + (impact.infrastructure || 0), 20, 98);

    country.productivity = clamp(country.productivity + (country.education - 65) * 0.0016 + (country.infrastructure - 60) * 0.0012 + (impact.productivity || 0), 35, 145);
    country.taxEfficiency = clamp(country.taxEfficiency + (impact.efficiency || 0) / 1000, 0.35, 0.98);

    const birthBalance = country.birthRate - country.mortality + country.migration;
    country.population = Math.max(1, country.population * (1 + birthBalance / 12000));

    country.fiscalBalance = round(fiscalBalance, 2);
    country.debt = clamp(country.debt + (-fiscalBalance) / 12 - growth * country.debt / 1200 + (bonuses.debtPressure || 0) / 24, 0, 240);
    country.reserves = Math.max(-20, country.reserves + country.tradeBalance * 0.08 + (impact.reserves || 0));

    const servicesApproval = ((country.budget.education + country.budget.health) - 35) * 0.012 + (bonuses.welfare || 0) * 0.012;
    const economyApproval = (growth - 2) * 0.025 - Math.max(0, country.inflation - 6) * 0.008 - Math.max(0, country.unemployment - 8) * 0.015;
    const fiscalConcern = Math.max(0, -fiscalBalance - 6) * 0.025 + Math.max(0, country.debt - 130) * 0.004;
    const laborChange = previousUnemployment - country.unemployment;
    const approvalRegression = (50 - country.popularity) * 0.01;
    country.popularity = clamp(country.popularity + approvalRegression + servicesApproval + economyApproval + laborChange * 0.35 - fiscalConcern + (impact.popularity || 0) - country.policyShock, 0, 100);
    country.policyShock *= 0.55;

    country.stability = clamp(country.stability + growth * 0.015 - Math.max(0, country.unemployment - 12) * 0.018 - Math.max(0, country.inflation - 12) * 0.008 + (bonuses.stability || 0) * 0.008 + (impact.stability || 0), 0, 100);

    if (country.popularity < 18) country.lowPopularityMonths += 1;
    else country.lowPopularityMonths = Math.max(0, country.lowPopularityMonths - 1);

    country.gdp = round(country.gdp, 2);
    country.population = round(country.population, 3);
    country.education = round(country.education, 2);
    country.unemployment = round(country.unemployment, 2);
    country.infrastructure = round(country.infrastructure, 2);
    country.debt = round(country.debt, 2);
    country.inflation = round(country.inflation, 2);
    country.popularity = round(country.popularity, 2);
    country.stability = round(country.stability, 2);
    country.productivity = round(country.productivity, 2);
    country.reserves = round(country.reserves, 2);
    country.lastGdpDelta = round(country.gdp - previousGdp, 3);
  }

  function transferShare(allocation, fromId, toId, amount) {
    const movable = Math.min(amount, Math.max(0, allocation[fromId] - 3));
    allocation[fromId] = round(allocation[fromId] - movable, 1);
    allocation[toId] = round(allocation[toId] + movable, 1);
  }

  function simulateAI(country, state) {
    if (state.tick % 3 !== 0 || country.id === state.playerCountryId) return;
    if (country.unemployment > 10) transferShare(country.budget, "security", "infrastructure", 0.8);
    if (country.inflation > 9) country.spendingTarget = clamp(country.spendingTarget - 0.5, 24, 52);
    if (country.growth < 1) transferShare(country.budget, "services", "industry", 0.6);
    if (country.education < 68) transferShare(country.budget, "security", "education", 0.5);
    if (country.infrastructure < 60) transferShare(country.labor, "services", "infrastructure", 0.5);
    if (random(state) < 0.28) {
      const sectorA = pick(state, DATA.sectors).id;
      const sectorB = pick(state, DATA.sectors).id;
      if (sectorA !== sectorB) transferShare(country.budget, sectorA, sectorB, 0.3);
    }
  }

  function decayModifiers(country) {
    country.modifiers.forEach((modifier) => { modifier.remaining -= 1; });
    country.modifiers = country.modifiers.filter((modifier) => modifier.remaining > 0);
  }

  function applyChoiceEffects(country, effects) {
    Object.entries(effects || {}).forEach(([key, amount]) => {
      if (key === "popularity") country.popularity = clamp(country.popularity + amount, 0, 100);
      else if (key === "stability") country.stability = clamp(country.stability + amount, 0, 100);
      else if (key === "debt") country.debt = clamp(country.debt + amount, 0, 240);
      else if (key === "reserves") country.reserves = Math.max(-20, country.reserves + amount);
      else if (key === "inflation") country.inflation = clamp(country.inflation + amount, 0.2, 250);
      else if (key === "infrastructure") country.infrastructure = clamp(country.infrastructure + amount, 20, 98);
      else if (key === "education") country.education = clamp(country.education + amount, 25, 98);
      else if (key === "unemployment") country.unemployment = clamp(country.unemployment + amount, 1.2, 42);
      else if (key === "productivity") country.productivity = clamp(country.productivity + amount, 35, 145);
      else if (key === "efficiency") country.taxEfficiency = clamp(country.taxEfficiency + amount / 100, 0.35, 0.98);
    });
  }

  function triggerEvent(state) {
    const probability = clamp(0.13 + state.monthsWithoutEvent * 0.035, 0.13, 0.38);
    if (random(state) > probability) {
      state.monthsWithoutEvent += 1;
      return;
    }

    state.monthsWithoutEvent = 0;
    const template = pick(state, DATA.events);
    let target = state.countries[state.playerCountryId];
    if (template.type !== "global" && random(state) > 0.42) target = pick(state, Object.values(state.countries));

    if (template.type === "global") {
      Object.values(state.countries).forEach((country) => {
        const impact = clone(template.impact);
        Object.keys(impact).forEach((key) => { if (key !== "duration") impact[key] *= country.id === state.playerCountryId ? 1 : 0.68; });
        country.modifiers.push({ eventId: template.id, title: template.title, impact, totalDuration: template.impact.duration, remaining: template.impact.duration });
      });
    } else {
      target.modifiers.push({ eventId: template.id, title: template.title, impact: clone(template.impact), totalDuration: template.impact.duration, remaining: template.impact.duration });
    }

    const countryName = template.type === "global" ? "el sistema mundial" : target.name;
    addNews(state, template.type, `${template.title} afecta a ${countryName}. ${template.summary}`, template.type === "global" ? null : target.id);

    if (template.type === "global" || target.id === state.playerCountryId) {
      state.pendingDecision = {
        id: `decision-${state.tick}-${template.id}`,
        templateId: template.id,
        countryId: state.playerCountryId,
        title: template.title,
        type: template.type,
        summary: template.summary,
        choices: clone(template.choices)
      };
    } else {
      const choiceIndex = random(state) < 0.62 ? 0 : 1;
      applyChoiceEffects(target, template.choices[choiceIndex].effects);
      addNews(state, "response", `${target.name} responde a “${template.title}”: ${template.choices[choiceIndex].label}.`, target.id);
    }
  }

  function resolveDecision(state, choiceIndex) {
    if (!state.pendingDecision) throw new Error("No hay una crisis pendiente.");
    const choice = state.pendingDecision.choices[choiceIndex];
    if (!choice) throw new Error("Respuesta de crisis no válida.");
    const country = state.countries[state.pendingDecision.countryId];
    applyChoiceEffects(country, choice.effects);
    addNews(state, "response", `${country.name} responde a “${state.pendingDecision.title}”: ${choice.label}.`, country.id);
    state.pendingDecision = null;
    return state;
  }

  function advanceDate(state) {
    state.date.month += 1;
    if (state.date.month > 12) {
      state.date.month = 1;
      state.date.year += 1;
    }
  }

  function captureHistory(state) {
    const country = state.countries[state.playerCountryId];
    state.history.push({
      tick: state.tick,
      date: monthLabel(state.date),
      gdp: country.gdp,
      growth: country.growth,
      population: country.population,
      education: country.education,
      unemployment: country.unemployment,
      infrastructure: country.infrastructure,
      debt: country.debt,
      inflation: country.inflation,
      popularity: country.popularity,
      stability: country.stability,
      tradeBalance: country.tradeBalance
    });
    state.history = state.history.slice(-120);
  }

  function evaluateGame(state) {
    const country = state.countries[state.playerCountryId];
    if (country.lowPopularityMonths >= 4) {
      state.gameOver = { won: false, title: "Gobierno sin respaldo", detail: "Cuatro meses bajo 18% de apoyo terminaron con tu mandato." };
      return;
    }
    if (country.stability < 15) {
      state.gameOver = { won: false, title: "Crisis institucional", detail: "La estabilidad cayó por debajo del umbral de gobernabilidad." };
      return;
    }
    if (country.debt > 190 && country.reserves <= 0) {
      state.gameOver = { won: false, title: "Cesación de pagos", detail: "La deuda y la falta de reservas bloquearon el funcionamiento del Estado." };
      return;
    }
    if (state.tick > 0 && state.tick % 48 === 0) {
      const electoralScore = country.popularity * 0.7 + country.stability * 0.3;
      if (electoralScore < 45) {
        state.gameOver = { won: false, title: "Derrota electoral", detail: `La coalición obtuvo ${round(electoralScore, 1)} puntos de competitividad electoral.` };
      } else {
        country.popularity = clamp(country.popularity + 2, 0, 100);
        addNews(state, "election", `El gobierno de ${country.name} renueva su mandato con una base electoral competitiva.`, country.id);
      }
    }
    if (state.tick >= MONTHS_LIMIT && !state.gameOver) {
      const score = calculateScore(state);
      state.gameOver = { won: true, title: "Ciclo de gobierno completado", detail: `Sostuviste ocho años de gobierno. Puntaje final: ${score}.`, score };
    }
  }

  function calculateScore(state) {
    const current = state.countries[state.playerCountryId];
    const initial = state.history[0];
    const gdpGain = (current.gdp / initial.gdp - 1) * 100;
    return Math.max(0, Math.round(current.popularity * 7 + current.stability * 4 + gdpGain * 8 - Math.max(0, current.debt - initial.debt) * 3));
  }

  function advanceTick(state) {
    if (state.gameOver || state.pendingDecision) return state;
    state.tick += 1;
    state.globalDemand = clamp(state.globalDemand * 0.84 + (0.96 + random(state) * 0.09) * 0.16, 0.82, 1.18);
    simulateMarkets(state);
    Object.values(state.countries).forEach((country) => {
      simulateCountry(country, state);
      simulateAI(country, state);
      decayModifiers(country);
    });
    advanceDate(state);
    triggerEvent(state);
    captureHistory(state);
    evaluateGame(state);
    return state;
  }

  function normalizeAllocation(allocation) {
    const normalized = {};
    DATA.sectors.forEach((sector) => { normalized[sector.id] = clamp(Number(allocation[sector.id]) || 0, 2, 65); });
    const total = sumValues(normalized);
    const scale = 100 / total;
    DATA.sectors.forEach((sector) => { normalized[sector.id] = round(normalized[sector.id] * scale, 1); });
    const correctedTotal = sumValues(normalized);
    normalized.services = round(normalized.services + (100 - correctedTotal), 1);
    return normalized;
  }

  function applyAllocations(state, input) {
    if (state.gameOver) throw new Error("La partida terminó.");
    const country = state.countries[state.playerCountryId];
    const budget = normalizeAllocation(input.budget || country.budget);
    const labor = normalizeAllocation(input.labor || country.labor);
    const oldBudget = country.budget;
    const oldLabor = country.labor;
    const movement = DATA.sectors.reduce((total, sector) => total + Math.abs(budget[sector.id] - oldBudget[sector.id]) + Math.abs(labor[sector.id] - oldLabor[sector.id]), 0);
    country.budget = budget;
    country.labor = labor;
    country.spendingTarget = clamp(Number(input.spendingTarget) || country.spendingTarget, 22, 58);
    country.policyShock = clamp(movement / 180, 0, 0.7);
    addNews(state, "policy", `El gobierno de ${country.name} reasigna presupuesto y fuerza laboral. El impacto comenzará a verse en los próximos meses.`, country.id);
    return state;
  }

  function validateSave(candidate) {
    if (!candidate || typeof candidate !== "object") throw new Error("El archivo no contiene una partida.");
    if (candidate.version !== SAVE_VERSION) throw new Error("La versión de la partida no es compatible.");
    if (!candidate.playerCountryId || !candidate.countries || !candidate.countries[candidate.playerCountryId]) throw new Error("La partida está incompleta.");
    if (!candidate.date || !Number.isFinite(candidate.tick)) throw new Error("La fecha de la partida no es válida.");
    return true;
  }

  function hydrate(candidate) {
    const state = clone(candidate);
    validateSave(state);
    return state;
  }

  return {
    SAVE_VERSION,
    MONTHS_LIMIT,
    createGame,
    advanceTick,
    applyAllocations,
    resolveDecision,
    calculateScore,
    validateSave,
    hydrate,
    getCountryDefinition,
    getLeaderDefinition,
    monthLabel,
    normalizeAllocation,
    clone
  };
});
