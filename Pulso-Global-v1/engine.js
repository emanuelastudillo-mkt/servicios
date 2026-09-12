(function (root, factory) {
  const api = factory(typeof module === "object" && module.exports ? require("./data.js") : root.PULSO_DATA);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.PulsoEngine = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (DATA) {
  "use strict";

  const SAVE_VERSION = 3;
  const START_YEAR = 2026;
  const START_MONTH = 1;
  const ENDLESS = true;
  const MIN_SHARE = 2;
  const MATERIAL_IDS = DATA.materials.map((item) => item.id);

  function clamp(value, min, max) { return Math.min(max, Math.max(min, value)); }
  function round(value, digits) {
    const factor = 10 ** (digits || 0);
    return Math.round((Number(value) + Number.EPSILON) * factor) / factor;
  }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function sumValues(object) { return Object.values(object || {}).reduce((sum, value) => sum + Number(value || 0), 0); }
  function monthLabel(date) {
    return new Intl.DateTimeFormat("es-AR", { month: "short", year: "numeric", timeZone: "UTC" })
      .format(new Date(Date.UTC(date.year, date.month - 1, 1))).replace(" de ", " ");
  }
  function random(state) {
    let t = (state.rngState + 0x6D2B79F5) >>> 0;
    state.rngState = t;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  function pick(state, array) { return array[Math.floor(random(state) * array.length)]; }
  function blankByMaterial(value) { return Object.fromEntries(MATERIAL_IDS.map((id) => [id, value])); }
  function blankByConstruction(value) { return Object.fromEntries(DATA.constructions.map((item) => [item.id, value])); }
  function getCountryDefinition(id) { return DATA.countries.find((country) => country.id === id); }
  function getLeaderDefinition(countryId, leaderId) {
    const country = getCountryDefinition(countryId);
    return country ? country.leaders.find((leader) => leader.id === leaderId) : null;
  }
  function getConstructionDefinition(id) { return DATA.constructions.find((item) => item.id === id); }

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
      relations[other.id] = clamp(score + (adjustments[pair] || 0), 10, 90);
    });
    return relations;
  }

  function initialMaterialCapacity(definition) {
    const scale = clamp(Math.pow(definition.gdp, 0.22), 3, 9);
    return {
      cement: round(75 + definition.infrastructure * 0.75 + scale * 5, 1),
      steel: round(62 + definition.resources.manufactures * 38 + scale * 4, 1),
      timber: round(70 + definition.resources.food * 30 + scale * 3, 1),
      fuel: round(60 + definition.resources.energy * 48 + scale * 3, 1),
      machinery: round(48 + definition.resources.manufactures * 34 + definition.productivity * 0.25, 1),
      electronics: round(38 + definition.resources.technology * 38 + definition.education * 0.25, 1)
    };
  }

  function initialSubsidies() {
    return {
      infrastructure: 12, agriculture: 10, industry: 10, services: 8,
      education: 22, health: 20, security: 5, energy: 12
    };
  }

  function domesticTaxPoints(taxes, demographics, efficiency) {
    const workerFactor = clamp((demographics.workers || 65) / 65, 0.72, 1.2);
    return {
      vat: taxes.vat * 0.38 * efficiency,
      income: taxes.income * 0.29 * efficiency * workerFactor,
      inheritance: taxes.inheritance * 0.02 * efficiency
    };
  }

  function toCountryState(definition) {
    const capacity = initialMaterialCapacity(definition);
    const happiness = clamp(45 + definition.popularity * 0.18 + definition.infrastructure * 0.08 - definition.unemployment * 0.25 - definition.inflation * 0.08, 30, 82);
    const taxes = clone(definition.taxes);
    const demographics = clone(definition.demographics);
    const domesticTaxes = domesticTaxPoints(taxes, demographics, definition.taxEfficiency);
    const startingRevenue = definition.revenueRate || definition.spendingTarget - 4;
    const nonTaxRevenue = Math.max(3, startingRevenue - sumValues(domesticTaxes));
    return {
      id: definition.id, name: definition.name, flag: definition.flag, region: definition.region,
      center: clone(definition.center), politicalSystem: definition.politicalSystem, currency: definition.currency,
      population: definition.population, gdp: definition.gdp, education: definition.education,
      health: clamp(58 + definition.education * 0.18, 45, 88), unemployment: definition.unemployment,
      infrastructure: definition.infrastructure, housing: clamp(definition.infrastructure - 3, 35, 90),
      happiness: round(happiness, 2), tourism: round(Math.max(0.15, definition.population * 0.022 * definition.infrastructure / 70), 2),
      tourismPotential: 0, tradeCapacity: 0, foodCapacity: 0, industryCapacity: 0,
      energyCapacity: 0, materialMachinery: 0, debt: definition.debt, inflation: definition.inflation,
      popularity: definition.popularity, stability: definition.stability, birthRate: definition.birthRate,
      mortality: definition.mortality, baseMigration: definition.migration, migration: definition.migration,
      migrationAttraction: 0, productivity: definition.productivity, reserves: definition.reserves,
      baseGrowth: definition.baseGrowth, spendingTarget: definition.spendingTarget,
      revenueRate: startingRevenue, nonTaxRevenue: round(nonTaxRevenue, 2),
      baseTaxEfficiency: definition.taxEfficiency, taxEfficiency: definition.taxEfficiency,
      taxes, demographics,
      demographicFlows: { births: 0, deaths: 0, migration: 0, enteringWorkAge: 0, retiring: 0 },
      taxRevenueBreakdown: { ...domesticTaxes, imports: 0, exports: 0, other: round(nonTaxRevenue, 2), total: round(startingRevenue, 2) },
      grossImports: 0, grossExports: 0,
      resources: clone(definition.resources), budget: clone(definition.budget), labor: clone(definition.labor),
      subsidies: initialSubsidies(), leaderId: definition.leaders[0].id, growth: definition.baseGrowth,
      fiscalBalance: round(startingRevenue - definition.spendingTarget - DATA.sectors.reduce((sum, s) => sum + definition.budget[s.id] * initialSubsidies()[s.id] / 1000, 0), 2), tradeBalance: 0,
      sectorBalances: { food: 0, energy: 0, manufactures: 0, technology: 0 },
      sectorSupply: { food: 0, energy: 0, manufactures: 0, technology: 0 },
      sectorDemand: { food: 0, energy: 0, manufactures: 0, technology: 0 },
      relations: initialRelations(definition),
      materialStocks: Object.fromEntries(MATERIAL_IDS.map((id) => [id, round(capacity[id] * 0.62, 1)])),
      materialCapacity: capacity, materialProduction: blankByMaterial(0), buildings: blankByConstruction(0),
      projects: [], nextProjectId: 1, lowPopularityMonths: 0, policyShock: 0
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
      version: SAVE_VERSION, gameId: `pg-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      createdAt: new Date().toISOString(), savedAt: null, rngState: (Number(seed) || Date.now()) >>> 0,
      playerCountryId: countryId, playerLeaderId: leaderId, date: { year: START_YEAR, month: START_MONTH },
      tick: 0, globalDemand: 1,
      market: {
        prices: Object.fromEntries(DATA.commodities.map((item) => [item.id, item.basePrice])),
        previousPrices: Object.fromEntries(DATA.commodities.map((item) => [item.id, item.basePrice])), trades: []
      },
      countries, eventsEnabled: false, openEnded: true, activity: [], history: [], gameOver: null
    };
    addActivity(game, "briefing", `${leaderDef.name} asume la conducción de ${countryDef.name}. El motor base opera sin eventos aleatorios.`);
    captureHistory(game);
    return game;
  }

  function addActivity(state, type, text, countryId) {
    if (!Array.isArray(state.activity)) state.activity = [];
    state.activity.unshift({ id: `activity-${state.tick}-${state.activity.length}-${Math.floor(random(state) * 100000)}`,
      tick: state.tick, date: monthLabel(state.date), type, countryId: countryId || null, text });
    state.activity = state.activity.slice(0, 80);
  }

  function leaderBonuses(country) {
    const leader = getLeaderDefinition(country.id, country.leaderId);
    return leader ? leader.bonuses : {};
  }

  function sectorEffect(country, sectorId) {
    const budget = country.budget[sectorId] || 0;
    const labor = country.labor[sectorId] || 0;
    const subsidy = country.subsidies[sectorId] || 0;
    return (0.58 + budget / 25 + labor / 35) * (1 + subsidy / 260);
  }

  function productionAndDemand(country, state) {
    // Pisos pequeños para que los microestados mantengan su escala real.
    const gdpScale = Math.max(0.00005, country.gdp / 1000);
    const popScale = Math.max(0.00005, country.population / 100);
    const gdpPerCapita = country.gdp * 1000 / country.population;
    const productivityFactor = 0.62 + country.productivity / 170;
    const infrastructureFactor = 0.62 + country.infrastructure / 170 + country.tradeCapacity / 240;
    const baseline = getCountryDefinition(country.id);
    const disposableIncome = clamp(1 - (country.taxes.vat - baseline.taxes.vat) * 0.006 - (country.taxes.income - baseline.taxes.income) * 0.002, 0.6, 1.4);
    const demandCycle = state.globalDemand * (0.94 + clamp(country.growth, -8, 10) / 120) * disposableIncome;
    const workforceFactor = clamp(country.demographics.workers / baseline.demographics.workers, 0.45, 1.4);
    const prices = state.market.prices;
    const supply = {
      food: popScale * (0.32 + country.resources.food * 0.82) * (0.55 + country.labor.agriculture / 12) * productivityFactor * (1 + country.foodCapacity / 100),
      energy: gdpScale * (0.22 + country.resources.energy * 0.76) * (0.58 + country.labor.energy / 10) * infrastructureFactor * (1 + country.energyCapacity / 100),
      manufactures: gdpScale * (0.2 + country.resources.manufactures * 0.78) * (0.48 + country.labor.industry / 28) * productivityFactor * (1 + country.industryCapacity / 100),
      technology: gdpScale * (0.08 + country.resources.technology * 0.68) * (0.4 + country.education / 105) * (0.55 + country.labor.education / 15)
    };
    const demand = {
      food: popScale * (0.78 + gdpPerCapita / 90000) * demandCycle * Math.pow(prices.food, -0.16),
      energy: (popScale * (0.3 + gdpPerCapita / 39000) + gdpScale * country.labor.industry / 42) * demandCycle * Math.pow(prices.energy / 1.3, -0.2),
      manufactures: gdpScale * (0.55 + gdpPerCapita / 85000) * demandCycle * Math.pow(prices.manufactures / 1.1, -0.24),
      technology: gdpScale * (0.28 + country.education / 145) * demandCycle * Math.pow(prices.technology / 1.7, -0.28)
    };
    Object.keys(supply).forEach((key) => { supply[key] = Math.max(0.00001, supply[key] * workforceFactor); demand[key] = Math.max(0.00001, demand[key]); });
    return { supply, demand };
  }

  function relationScore(importer, exporter) {
    const relation = importer.relations[exporter.id] || 50;
    const regional = importer.region === exporter.region ? 12 : 0;
    return relation + regional + exporter.infrastructure * 0.08 + exporter.tradeCapacity * 0.12;
  }

  function simulateMarkets(state) {
    const snapshots = {};
    const totalSupply = Object.fromEntries(DATA.commodities.map((item) => [item.id, 0]));
    const totalDemand = Object.fromEntries(DATA.commodities.map((item) => [item.id, 0]));
    Object.values(state.countries).forEach((country) => {
      const snapshot = productionAndDemand(country, state);
      snapshots[country.id] = snapshot;
      DATA.commodities.forEach((commodity) => { totalSupply[commodity.id] += snapshot.supply[commodity.id]; totalDemand[commodity.id] += snapshot.demand[commodity.id]; });
      country.tradeBalance = 0;
      country.grossImports = 0;
      country.grossExports = 0;
    });
    state.market.previousPrices = { ...state.market.prices };
    DATA.commodities.forEach((commodity) => {
      const id = commodity.id;
      const buffer = (totalSupply[id] + totalDemand[id]) * 0.82;
      const imbalance = (totalDemand[id] - totalSupply[id]) / Math.max(0.1, totalDemand[id] + totalSupply[id] + buffer * 2);
      const change = clamp(imbalance * 0.24 + (random(state) - 0.5) * 0.012, -0.065, 0.065);
      state.market.prices[id] = round(clamp(state.market.prices[id] * (1 + change), commodity.basePrice * 0.48, commodity.basePrice * 2.6), 3);
    });
    const trades = [];
    DATA.commodities.forEach((commodity) => {
      const id = commodity.id;
      const exporters = Object.values(state.countries).map((country) => ({
        country,
        available: Math.max(0, snapshots[country.id].supply[id] - snapshots[country.id].demand[id]) * (1 - country.taxes.exports * 0.006)
      })).filter((entry) => entry.available > 0.01);
      const importers = Object.values(state.countries).map((country) => ({
        country,
        needed: Math.max(0, snapshots[country.id].demand[id] - snapshots[country.id].supply[id]) * (1 - country.taxes.imports * 0.004)
      })).filter((entry) => entry.needed > 0.01).sort((a, b) => b.needed - a.needed);
      importers.forEach((importer) => {
        exporters.sort((a, b) => relationScore(importer.country, b.country) - relationScore(importer.country, a.country));
        for (const exporter of exporters) {
          if (importer.needed <= 0.005) break;
          if (exporter.available <= 0.005 || exporter.country.id === importer.country.id) continue;
          const quantity = Math.min(importer.needed, exporter.available);
          const actual = quantity * clamp((importer.country.relations[exporter.country.id] || 50) / 70, 0.55, 1);
          const value = actual * state.market.prices[id] * 0.72;
          importer.needed -= actual; exporter.available -= actual;
          importer.country.tradeBalance -= value;
          exporter.country.tradeBalance += value;
          importer.country.grossImports += value;
          exporter.country.grossExports += value;
          trades.push({ commodity: id, from: exporter.country.id, to: importer.country.id, quantity: round(actual, 2), value: round(value, 2) });
        }
        if (importer.needed > 0.005) {
          const value = importer.needed * state.market.prices[id] * 0.78;
          importer.country.tradeBalance -= value;
          importer.country.grossImports += value;
          trades.push({ commodity: id, from: "ROW", to: importer.country.id, quantity: round(importer.needed, 2), value: round(value, 2) });
        }
      });
      exporters.forEach((exporter) => {
        if (exporter.available > 0.005) {
          const value = exporter.available * state.market.prices[id] * 0.66;
          exporter.country.tradeBalance += value;
          exporter.country.grossExports += value;
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

  function calculateTaxBreakdown(country, rates) {
    const taxes = rates || country.taxes;
    const domestic = domesticTaxPoints(taxes, country.demographics, country.taxEfficiency);
    // Flujos mensuales -> recaudación anual como puntos de PBI.
    const imports = country.grossImports * taxes.imports * 12 * country.taxEfficiency / Math.max(country.gdp, 1);
    const exports = country.grossExports * taxes.exports * 12 * country.taxEfficiency / Math.max(country.gdp, 1);
    const breakdown = {
      vat: domestic.vat,
      income: domestic.income,
      inheritance: domestic.inheritance,
      imports,
      exports,
      other: country.nonTaxRevenue
    };
    breakdown.total = sumValues(breakdown);
    Object.keys(breakdown).forEach((key) => { breakdown[key] = round(breakdown[key], 2); });
    return breakdown;
  }

  function estimateTaxes(state, input) {
    const country = state.countries[state.playerCountryId];
    const rates = {};
    DATA.taxes.forEach((tax) => {
      const value = Number(input && input[tax.id] !== undefined ? input[tax.id] : country.taxes[tax.id]);
      if (!Number.isFinite(value)) throw new Error("La alícuota debe ser un número válido.");
      rates[tax.id] = round(clamp(value, tax.min, tax.max), 2);
    });
    const growthEffect = -(rates.vat - 18) * 0.012 - (rates.income - 28) * 0.01 - rates.exports * 0.012 + rates.imports * 0.004;
    const inflationEffect = (rates.vat - 18) * 0.012 + rates.imports * 0.018;
    const happinessEffect = rates.inheritance * 0.015 - rates.vat * 0.01;
    return {
      rates,
      breakdown: calculateTaxBreakdown(country, rates),
      growthEffect: round(growthEffect, 2),
      inflationEffect: round(inflationEffect, 2),
      happinessEffect: round(happinessEffect, 2),
      tradeFriction: round(rates.imports * 0.4 + rates.exports * 0.6, 1)
    };
  }

  function simulateDemographics(country) {
    const pop = country.population;
    const cohorts = Object.fromEntries(Object.entries(country.demographics).map(([key, share]) => [key, pop * share / 100]));
    const births = pop * country.birthRate / 12000;
    const deaths = pop * country.mortality / 12000;
    const netMigration = pop * country.migration / 12000;
    const enteringWorkAge = cohorts.children / (18 * 12);
    const retiring = cohorts.workers / (47 * 12);
    const deathWeights = { children: 0.15, workers: 0.45, retired: 4.5 };
    const weightedTotal = Object.keys(cohorts).reduce((sum, key) => sum + cohorts[key] * deathWeights[key], 0);
    const migrationShares = { children: 0.15, workers: 0.8, retired: 0.05 };
    for (const key of Object.keys(cohorts)) {
      cohorts[key] -= deaths * cohorts[key] * deathWeights[key] / Math.max(0.000001, weightedTotal);
      cohorts[key] += netMigration * migrationShares[key];
    }
    cohorts.children += births - enteringWorkAge;
    cohorts.workers += enteringWorkAge - retiring;
    cohorts.retired += retiring;
    for (const key of Object.keys(cohorts)) cohorts[key] = Math.max(0.000001, cohorts[key]);
    country.population = sumValues(cohorts);
    country.demographics.children = cohorts.children / country.population * 100;
    country.demographics.retired = cohorts.retired / country.population * 100;
    country.demographics.workers = 100 - country.demographics.children - country.demographics.retired;
    country.demographicFlows = { births, deaths, migration: netMigration, enteringWorkAge, retiring };
  }

  function demographicSnapshot(country) {
    const total = country.population;
    const children = total * country.demographics.children / 100;
    const retired = total * country.demographics.retired / 100;
    const workingAge = total - children - retired;
    const laborForce = workingAge * 0.72; // Participación agregada de juego.
    const unemployed = laborForce * country.unemployment / 100;
    return { total, children, retired, workingAge, laborForce, unemployed,
      employed: laborForce - unemployed, inactive: workingAge - laborForce,
      dependency: (children + retired) / Math.max(workingAge, 0.000001) * 100 };
  }

  function produceMaterials(country) {
    const industry = sectorEffect(country, "industry");
    const infrastructure = sectorEffect(country, "infrastructure");
    const energy = sectorEffect(country, "energy");
    const agriculture = sectorEffect(country, "agriculture");
    const education = sectorEffect(country, "education");
    const production = {
      cement: 2.4 + industry * 1.8 + infrastructure * 0.9, steel: 1.5 + industry * 2.1,
      timber: 2.2 + agriculture * 1.7, fuel: 1.4 + energy * 2.4,
      machinery: 0.9 + industry * 1.35 + country.materialMachinery,
      electronics: 0.55 + education * 0.85 + country.resources.technology * 0.75
    };
    MATERIAL_IDS.forEach((id) => {
      country.materialProduction[id] = round(production[id], 2);
      country.materialStocks[id] = round(Math.min(country.materialCapacity[id], country.materialStocks[id] + production[id]), 2);
    });
  }

  function projectSpeed(country, definition) {
    const sameSector = Math.max(1, country.projects.filter((project) => project.sector === definition.sector && project.progress < 100).length);
    return clamp((100 / definition.months) * sectorEffect(country, definition.sector) / sameSector, 0.25, 24);
  }

  function applyConstructionEffects(country, effects) {
    Object.entries(effects || {}).forEach(([key, amount]) => {
      if (key === "housing") country.housing = clamp(country.housing + amount, 20, 100);
      else if (key === "happiness") country.happiness = clamp(country.happiness + amount, 0, 100);
      else if (key === "immigration") country.migrationAttraction = clamp(country.migrationAttraction + amount, -5, 8);
      else if (key === "tourism") country.tourismPotential += amount;
      else if (key === "tradeCapacity") country.tradeCapacity += amount;
      else if (key === "foodCapacity") country.foodCapacity += amount;
      else if (key === "industryCapacity") country.industryCapacity += amount;
      else if (key === "energyCapacity") country.energyCapacity += amount;
      else if (key === "materialMachinery") country.materialMachinery += amount;
      else if (key === "health") country.health = clamp(country.health + amount, 20, 100);
      else if (key === "mortality") country.mortality = clamp(country.mortality + amount, 2, 22);
      else if (key === "jobs") country.unemployment = clamp(country.unemployment - amount, 1.2, 42);
      else if (key === "infrastructure") country.infrastructure = clamp(country.infrastructure + amount, 20, 100);
      else if (key === "education") country.education = clamp(country.education + amount, 25, 100);
      else if (key === "productivity") country.productivity = clamp(country.productivity + amount, 35, 150);
      else if (key === "stability") country.stability = clamp(country.stability + amount, 0, 100);
    });
  }

  function advanceProjects(country, state) {
    country.projects.forEach((project) => {
      if (project.progress >= 100) return;
      const definition = getConstructionDefinition(project.typeId);
      const desired = Math.min(100 - project.progress, projectSpeed(country, definition));
      let stockRatio = 1;
      const blocked = [];
      MATERIAL_IDS.forEach((id) => {
        const need = (project.requirements[id] || 0) * desired / 100;
        if (need <= 0) return;
        stockRatio = Math.min(stockRatio, country.materialStocks[id] / need);
        if (country.materialStocks[id] + 0.001 < need) blocked.push(id);
      });
      const actual = desired * clamp(stockRatio, 0, 1);
      project.blockedBy = actual < desired * 0.98 ? blocked : [];
      if (actual < 0.01) return;
      MATERIAL_IDS.forEach((id) => {
        const used = (project.requirements[id] || 0) * actual / 100;
        country.materialStocks[id] = round(Math.max(0, country.materialStocks[id] - used), 2);
        project.consumed[id] = round((project.consumed[id] || 0) + used, 2);
      });
      project.progress = round(Math.min(100, project.progress + actual), 2);
      project.monthsActive += 1;
      const monthlyCost = project.totalCost * actual / 100;
      project.spent = round(project.spent + monthlyCost, 3);
      country.debt = clamp(country.debt + monthlyCost / Math.max(1, country.gdp) * 100, 0, 260);
      if (project.progress >= 99.999) {
        project.progress = 100;
        project.completedAt = monthLabel(state.date);
        country.buildings[definition.id] = (country.buildings[definition.id] || 0) + 1;
        applyConstructionEffects(country, definition.effects);
        addActivity(state, "construction", `${country.name} completa ${definition.label.toLowerCase()}.`, country.id);
      }
    });
    // Conservar todas las obras activas, incluso tras décadas de construcción.
    const recentCompleted = country.projects.filter((project) => project.progress >= 100).slice(-40);
    country.projects = country.projects.filter((project) => project.progress < 100 || recentCompleted.includes(project));
  }

  function simulateCountry(country, state) {
    const bonuses = leaderBonuses(country);
    const previousGdp = country.gdp;
    const previousUnemployment = country.unemployment;
    const subsidyBurden = DATA.sectors.reduce((sum, sector) => sum + country.budget[sector.id] * country.subsidies[sector.id] / 1000, 0);
    country.taxRevenueBreakdown = calculateTaxBreakdown(country);
    const revenueRate = Math.max(0, country.taxRevenueBreakdown.total + (bonuses.efficiency || 0) * 0.12);
    country.revenueRate = round(revenueRate, 2);
    const fiscalBalance = revenueRate - country.spendingTarget - subsidyBurden;
    const tradeImpulse = clamp(country.tradeBalance / Math.max(country.gdp, 1) * 95, -1.8, 1.8);
    const educationDrive = (country.budget.education - 15) * 0.035 + (bonuses.education || 0) * 0.035 + country.education / 4000;
    const industryDrive = (country.budget.industry - 10) * 0.04 + (country.labor.industry - 18) * 0.025 + (bonuses.industry || 0) * 0.055 + country.industryCapacity * 0.018;
    const infrastructureDrive = (country.infrastructure - 65) * 0.012 + (bonuses.infrastructure || 0) * 0.04 + country.tradeCapacity * 0.008;
    const taxGrowthEffect = -(country.taxes.vat - 18) * 0.012 - (country.taxes.income - 28) * 0.01 - country.taxes.exports * 0.012 + country.taxes.imports * 0.004;
    const inflationDrag = Math.max(0, country.inflation - 5) * 0.022;
    const unemploymentDrag = Math.max(0, country.unemployment - 6) * 0.07;
    const growth = clamp(country.baseGrowth + educationDrive + industryDrive + infrastructureDrive + tradeImpulse + taxGrowthEffect - inflationDrag - unemploymentDrag, -12, 14);
    country.growth = round(growth, 2);
    country.gdp = Math.max(0.05, country.gdp * (1 + growth / 1200));
    const employmentPulse = (2.5 - growth) * 0.012 - (sectorEffect(country, "infrastructure") - 1.5) * 0.018 - country.projects.filter((project) => project.progress < 100).length * 0.012;
    country.unemployment = clamp(country.unemployment + employmentPulse, 1.2, 42);
    const energyMove = (state.market.prices.energy / state.market.previousPrices.energy - 1) * 6;
    const taxPricePressure = (country.taxes.vat - 18) * 0.012 + country.taxes.imports * 0.018;
    const structuralInflation = clamp(2.4 + Math.max(0, country.spendingTarget + subsidyBurden - revenueRate) * 0.34 - Math.max(0, country.productivity - 80) * 0.008 + taxPricePressure, 1, 35);
    country.inflation = clamp(country.inflation + (structuralInflation - country.inflation) * 0.035 + energyMove, 0.2, 250);
    country.education = clamp(country.education + (sectorEffect(country, "education") - 1.5) * 0.04 + (bonuses.education || 0) * 0.006, 25, 100);
    country.health = clamp(country.health + (sectorEffect(country, "health") - 1.45) * 0.035, 25, 100);
    country.infrastructure = clamp(country.infrastructure + (sectorEffect(country, "infrastructure") - 1.45) * 0.035 + (bonuses.infrastructure || 0) * 0.007, 20, 100);
    country.productivity = clamp(country.productivity + (country.education - 65) * 0.0016 + (country.infrastructure - 60) * 0.0012, 35, 150);
    country.taxEfficiency = clamp(country.taxEfficiency, 0.35, 0.98);
    const taxSocialEffect = country.taxes.inheritance * 0.015 - country.taxes.vat * 0.01;
    const happinessTarget = clamp(52 + (country.education - 65) * 0.13 + (country.health - 65) * 0.14 + (country.infrastructure - 60) * 0.1 + (country.housing - 60) * 0.14 - Math.max(0, country.unemployment - 6) * 0.55 - Math.max(0, country.inflation - 5) * 0.17 + taxSocialEffect, 10, 92);
    country.happiness = clamp(country.happiness + (happinessTarget - country.happiness) * 0.055, 0, 100);
    const tourismTarget = Math.max(0.05, country.population * 0.018 * (0.5 + country.infrastructure / 130) * (0.5 + country.stability / 140) + country.tourismPotential);
    country.tourism = Math.max(0, country.tourism + (tourismTarget - country.tourism) * 0.08);
    const migrationPull = (country.happiness - 52) * 0.055 + (country.housing - 55) * 0.035 + (8 - country.unemployment) * 0.06 + country.migrationAttraction;
    country.migration = clamp(country.migration + (country.baseMigration + migrationPull - country.migration) * 0.07, -12, 16);
    simulateDemographics(country);
    country.fiscalBalance = round(fiscalBalance, 2);
    country.debt = clamp(country.debt + (-fiscalBalance) / 12 - growth * country.debt / 1200 + (bonuses.debtPressure || 0) / 24, 0, 260);
    country.reserves = Math.max(-20, country.reserves + country.tradeBalance * 0.08);
    const servicesApproval = ((country.budget.education + country.budget.health) - 35) * 0.012 + (bonuses.welfare || 0) * 0.012;
    const economyApproval = (growth - 2) * 0.025 - Math.max(0, country.inflation - 6) * 0.008 - Math.max(0, country.unemployment - 8) * 0.015;
    const fiscalConcern = Math.max(0, -fiscalBalance - 6) * 0.025 + Math.max(0, country.debt - 130) * 0.004;
    const laborChange = previousUnemployment - country.unemployment;
    const approvalRegression = (50 - country.popularity) * 0.01;
    country.popularity = clamp(country.popularity + approvalRegression + servicesApproval + economyApproval + laborChange * 0.35 + (country.happiness - 50) * 0.006 - fiscalConcern - country.policyShock, 0, 100);
    country.policyShock *= 0.55;
    country.stability = clamp(country.stability + growth * 0.015 - Math.max(0, country.unemployment - 12) * 0.018 - Math.max(0, country.inflation - 12) * 0.008 + (bonuses.stability || 0) * 0.008, 0, 100);
    if (country.popularity < 18) country.lowPopularityMonths += 1;
    else country.lowPopularityMonths = Math.max(0, country.lowPopularityMonths - 1);
    ["gdp", "population", "education", "health", "unemployment", "infrastructure", "housing", "happiness", "tourism", "migration", "debt", "inflation", "popularity", "stability", "productivity", "reserves"].forEach((key) => { country[key] = round(country[key], key === "population" ? 3 : 2); });
    country.lastGdpDelta = round(country.gdp - previousGdp, 3);
  }

  function transferShare(allocation, fromId, toId, amount) {
    const movable = Math.min(amount, Math.max(0, allocation[fromId] - MIN_SHARE));
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

  function advanceDate(state) {
    state.date.month += 1;
    if (state.date.month > 12) { state.date.month = 1; state.date.year += 1; }
  }

  function captureHistory(state) {
    const country = state.countries[state.playerCountryId];
    state.history.push({ tick: state.tick, date: monthLabel(state.date), gdp: country.gdp,
      growth: country.growth, population: country.population, education: country.education,
      unemployment: country.unemployment, infrastructure: country.infrastructure, debt: country.debt,
      inflation: country.inflation, popularity: country.popularity, stability: country.stability,
      happiness: country.happiness, tourism: country.tourism, migration: country.migration,
      workers: country.demographics.workers, children: country.demographics.children,
      retired: country.demographics.retired, taxRevenue: country.revenueRate,
      tradeBalance: country.tradeBalance });
    state.history = state.history.slice(-120);
  }

  function calculateScore(state) {
    const current = state.countries[state.playerCountryId];
    const initial = state.history[0];
    const gdpGain = (current.gdp / initial.gdp - 1) * 100;
    const completed = sumValues(current.buildings);
    return Math.max(0, Math.round(current.popularity * 6 + current.stability * 3 + current.happiness * 3 + gdpGain * 8 + completed * 18 - Math.max(0, current.debt - initial.debt) * 3));
  }

  function evaluateGame(state) {
    const country = state.countries[state.playerCountryId];
    if (country.lowPopularityMonths >= 4) state.gameOver = { won: false, title: "Gobierno sin respaldo", detail: "Cuatro meses bajo 18% de apoyo terminaron con tu mandato." };
    else if (country.stability < 15) state.gameOver = { won: false, title: "Crisis institucional", detail: "La estabilidad cayó por debajo del umbral de gobernabilidad." };
    else if (country.debt > 205 && country.reserves <= 0) state.gameOver = { won: false, title: "Cesación de pagos", detail: "La deuda y la falta de reservas bloquearon el funcionamiento del Estado." };
  }

  function advanceTick(state) {
    if (state.gameOver) return state;
    state.tick += 1;
    state.globalDemand = clamp(state.globalDemand * 0.84 + (0.96 + random(state) * 0.09) * 0.16, 0.82, 1.18);
    simulateMarkets(state);
    Object.values(state.countries).forEach((country) => {
      produceMaterials(country);
      advanceProjects(country, state);
      simulateCountry(country, state);
      simulateAI(country, state);
    });
    advanceDate(state);
    captureHistory(state);
    evaluateGame(state);
    return state;
  }

  function normalizeAllocation(allocation) {
    const normalized = {};
    DATA.sectors.forEach((sector) => { normalized[sector.id] = clamp(Number(allocation[sector.id]) || 0, MIN_SHARE, 65); });
    const scale = 100 / sumValues(normalized);
    DATA.sectors.forEach((sector) => { normalized[sector.id] = round(normalized[sector.id] * scale, 1); });
    normalized.services = round(normalized.services + (100 - sumValues(normalized)), 1);
    return normalized;
  }

  function applyAllocations(state, input) {
    if (state.gameOver) throw new Error("La partida terminó.");
    const country = state.countries[state.playerCountryId];
    const budget = normalizeAllocation(input.budget || country.budget);
    const labor = normalizeAllocation(input.labor || country.labor);
    const subsidies = {};
    DATA.sectors.forEach((sector) => { subsidies[sector.id] = round(clamp(Number((input.subsidies || country.subsidies)[sector.id]) || 0, 0, 60), 1); });
    const movement = DATA.sectors.reduce((total, sector) => total + Math.abs(budget[sector.id] - country.budget[sector.id]) + Math.abs(labor[sector.id] - country.labor[sector.id]) + Math.abs(subsidies[sector.id] - country.subsidies[sector.id]) * 0.25, 0);
    country.budget = budget; country.labor = labor; country.subsidies = subsidies;
    country.spendingTarget = clamp(Number(input.spendingTarget) || country.spendingTarget, 22, 58);
    country.policyShock = clamp(movement / 180, 0, 0.7);
    addActivity(state, "policy", `El gobierno de ${country.name} actualiza presupuesto, empleo sectorial y subsidios.`, country.id);
    return state;
  }

  function applyTaxes(state, input) {
    if (state.gameOver) throw new Error("La partida terminó.");
    const country = state.countries[state.playerCountryId];
    const preview = estimateTaxes(state, input);
    const movement = DATA.taxes.reduce((sum, tax) => sum + Math.abs(preview.rates[tax.id] - country.taxes[tax.id]), 0);
    country.taxes = preview.rates;
    country.taxRevenueBreakdown = preview.breakdown;
    country.policyShock = clamp(country.policyShock + movement / 130, 0, 0.9);
    addActivity(state, "tax", `El gobierno de ${country.name} actualiza el esquema impositivo nacional.`, country.id);
    return state;
  }

  function constructionPreview(state, constructionId) {
    const definition = getConstructionDefinition(constructionId);
    if (!definition) throw new Error("Construcción no válida.");
    const country = state.countries[state.playerCountryId];
    return { totalCost: round(Math.max(0.08, country.gdp * definition.costShare / 100), 2),
      speed: round(projectSpeed(country, definition), 2), requirements: clone(definition.requirements) };
  }

  function queueConstruction(state, constructionId) {
    if (state.gameOver) throw new Error("La partida terminó.");
    const definition = getConstructionDefinition(constructionId);
    if (!definition) throw new Error("Construcción no válida.");
    const country = state.countries[state.playerCountryId];
    if (country.projects.filter((project) => project.progress < 100).length >= 8) throw new Error("La cartera admite hasta ocho obras activas.");
    const preview = constructionPreview(state, constructionId);
    const project = { id: `project-${country.nextProjectId++}`, typeId: definition.id, sector: definition.sector,
      startedAt: monthLabel(state.date), progress: 0, monthsActive: 0, totalCost: preview.totalCost,
      spent: 0, requirements: clone(definition.requirements), consumed: blankByMaterial(0),
      blockedBy: [], completedAt: null };
    country.projects.push(project);
    addActivity(state, "construction", `${country.name} inicia ${definition.label.toLowerCase()}.`, country.id);
    return project;
  }

  function ensureCountryV3(country, definition) {
    const fresh = toCountryState(definition);
    Object.keys(fresh).forEach((key) => { if (country[key] === undefined || country[key] === null) country[key] = clone(fresh[key]); });
    country.subsidies = { ...fresh.subsidies, ...(country.subsidies || {}) };
    country.materialStocks = { ...fresh.materialStocks, ...(country.materialStocks || {}) };
    country.materialCapacity = { ...fresh.materialCapacity, ...(country.materialCapacity || {}) };
    country.materialProduction = { ...fresh.materialProduction, ...(country.materialProduction || {}) };
    country.buildings = { ...fresh.buildings, ...(country.buildings || {}) };
    country.taxes = { ...fresh.taxes, ...(country.taxes || {}) };
    country.demographics = { ...fresh.demographics, ...(country.demographics || {}) };
    country.taxRevenueBreakdown = { ...fresh.taxRevenueBreakdown, ...(country.taxRevenueBreakdown || {}) };
    country.projects = Array.isArray(country.projects) ? country.projects : [];
    delete country.modifiers;
    return country;
  }

  function migrate(candidate) {
    const state = clone(candidate);
    if (![1, 2, SAVE_VERSION].includes(state.version)) throw new Error("La versión de la partida no es compatible.");
    if (!state.playerCountryId || !state.countries || !state.countries[state.playerCountryId]) throw new Error("La partida está incompleta.");
    DATA.countries.forEach((definition) => {
      if (!state.countries[definition.id]) state.countries[definition.id] = toCountryState(definition);
      else ensureCountryV3(state.countries[definition.id], definition);
    });
    state.activity = Array.isArray(state.activity) ? state.activity : (Array.isArray(state.events) ? state.events.filter((item) => ["briefing", "policy", "election"].includes(item.type)) : []);
    state.eventsEnabled = false;
    state.openEnded = true;
    state.version = SAVE_VERSION;
    state.gameOver = state.gameOver && !state.gameOver.won ? state.gameOver : null;
    state.history = Array.isArray(state.history) ? state.history : [];
    delete state.pendingDecision; delete state.monthsWithoutEvent; delete state.events;
    return state;
  }

  function validateSave(candidate) {
    if (!candidate || typeof candidate !== "object") throw new Error("El archivo no contiene una partida.");
    if (![1, 2, SAVE_VERSION].includes(candidate.version)) throw new Error("La versión de la partida no es compatible.");
    if (!candidate.playerCountryId || !candidate.countries || !candidate.countries[candidate.playerCountryId]) throw new Error("La partida está incompleta.");
    if (!candidate.date || !Number.isSafeInteger(candidate.tick) || candidate.tick < 0 ||
      !Number.isSafeInteger(candidate.date.year) || candidate.date.year < START_YEAR ||
      !Number.isInteger(candidate.date.month) || candidate.date.month < 1 || candidate.date.month > 12) throw new Error("La fecha de la partida no es válida.");
    if (!getLeaderDefinition(candidate.playerCountryId, candidate.playerLeaderId)) throw new Error("El país o la figura de la partida no son válidos.");
    for (const [id, country] of Object.entries(candidate.countries)) {
      if (!getCountryDefinition(id) || !country || country.id !== id) throw new Error("Los países de la partida no son válidos.");
      for (const key of ["population", "gdp", "unemployment", "debt", "inflation", "popularity", "stability"]) {
        if (!Number.isFinite(country[key])) throw new Error("Los indicadores de la partida no son válidos.");
      }
      if (country.population <= 0 || country.gdp <= 0) throw new Error("La población y el PBI deben ser positivos.");
      if (country.taxes !== undefined) {
        for (const tax of DATA.taxes) {
          const value = country.taxes && country.taxes[tax.id];
          if (!Number.isFinite(value) || value < tax.min || value > tax.max) throw new Error("Los impuestos de la partida no son válidos.");
        }
      }
      if (country.demographics !== undefined) {
        if (!country.demographics || !["children", "workers", "retired"].every((key) => Number.isFinite(country.demographics[key]) && country.demographics[key] >= 0) ||
          Math.abs(sumValues(country.demographics) - 100) > 0.00001) throw new Error("La demografía de la partida no es válida.");
      }
    }
    return true;
  }

  function hydrate(candidate) { validateSave(candidate); return migrate(candidate); }

  return {
    SAVE_VERSION, ENDLESS, createGame, advanceTick, applyAllocations, applyTaxes, estimateTaxes, demographicSnapshot, queueConstruction,
    constructionPreview, calculateScore, validateSave, hydrate, getCountryDefinition,
    getLeaderDefinition, getConstructionDefinition, normalizeAllocation, monthLabel,
    clone, clamp, sumValues
  };
});
