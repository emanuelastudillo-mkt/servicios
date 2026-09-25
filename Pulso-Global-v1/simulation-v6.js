(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory;
  else root.PulsoV6 = factory;
})(typeof globalThis !== "undefined" ? globalThis : this, function (L, D, H) {
  "use strict";
  const clamp = L.clamp,
    clone = L.clone,
    sum = L.sumValues,
    owners = ["public", "private"];
  const sectors = D.sectors.map((s) => s.id),
    materials = D.materials,
    buildings = D.constructions;
  const techGroups = {};
  const storageFamilies = Object.fromEntries(
    D.storageTypes.map((t) => [
      t.id,
      materials.filter((m) => m.storage === t.id),
    ]),
  );
  const warehouses = Object.fromEntries(
    D.storageTypes.map((t) => [
      t.id,
      buildings.find((b) => b.storage === t.id),
    ]),
  );
  const dedicatedStores = Object.fromEntries(
    materials.map((m) => [m.id, buildings.find((b) => b.storageFor === m.id)]),
  );
  const durableYears = {
    automobiles: 12,
    electric_vehicles: 12,
    computers: 5,
    smartphones: 3,
    electronics: 6,
    appliances: 10,
    jewelry: 25,
    machinery: 15,
    batteries: 5,
    servers: 6,
    supercomputers: 8,
    transport_vehicles: 15,
    diamond_tools: 3,
    textiles: 3,
  };
  // Annual professional demand per inhabitant; nuclear material is not household consumption.
  const professionalUse = {
    machinery: 0.00008,
    batteries: 0.004,
    servers: 0.0001,
    supercomputers: 0.00000001,
    transport_vehicles: 0.00004,
    diamond_tools: 0.001,
    plutonium: 0.000000002,
  };
  const DISCOVERED_DEPOSIT_SCALE = 100;
  const foods = materials.filter((m) => D.foodProfiles[m.id]);
  const foodBasket = foods.reduce((n, m) => n + m.household * D.foodProfiles[m.id].rations, 0);
  function initializeNutrition(c, s) {
    if (c.nutrition?.version === 1) return;
    c.nutrition = {
      version: 1, hunger: 0, coverage: 1, quality: 50, deficitMonths: 0,
      aidEnabled: false, aidBudget: 0, protectedDays: 30,
      need: population(c) * daysInMonth(s.date), days: daysInMonth(s.date),
      aidSpent: 0, aidRations: 0, aidStockValue: 0, spoilageRations: 0,
      shortfall: 0, unaffordable: 0, unavailable: 0,
      measured: false, closedTick: -1, hungerChange: 0, hungerDeaths: 0,
    };
  }
  const eatenRations = (c) => foods.reduce((n, m) =>
    n + (c.householdConsumed[m.id] || 0) * D.foodProfiles[m.id].rations, 0);
  const storedRations = (c, owner) => foods.reduce((n, m) =>
    n + (owner ? stocks(c, owner)[m.id] : c.publicStocks[m.id] + c.privateStocks[m.id]) * D.foodProfiles[m.id].rations, 0);
  function setFoodPolicy(s, input) {
    const c = player(s);
    const budget = needNumber(input.aidBudget, 0, 1e6);
    const days = needNumber(input.protectedDays, 0, 365);
    Object.assign(c.nutrition, { aidEnabled: input.aidEnabled === true, aidBudget: budget, protectedDays: days });
  }
  function publicFoodAid(s, c) {
    const n = c.nutrition;
    if (!n.aidEnabled || n.aidBudget <= 0) return;
    // Public stocks are already paid for. Only distribution is a cash expense;
    // private food requires a real purchase. Neither path borrows money.
    const offers = foods.flatMap((m) => owners.map((owner) => ({
      m, owner, price: s.market.resourcePrices[m.id],
      cost: s.market.resourcePrices[m.id] * (owner === "public" ? 0.02 : 1.02),
    }))).sort((a, b) => a.cost / D.foodProfiles[a.m.id].rations - b.cost / D.foodProfiles[b.m.id].rations);
    for (const { m, owner, price, cost } of offers) {
      const ration = D.foodProfiles[m.id].rations;
      const q = Math.max(0, Math.min(
        (n.need - eatenRations(c)) / ration,
        stocks(c, owner)[m.id],
        Math.min(Math.max(0, c.reserves), Math.max(0, n.aidBudget - n.aidSpent)) / Math.max(1e-15, cost),
      ));
      if (q <= 0) continue;
      stocks(c, owner)[m.id] -= q;
      c.materialConsumption[m.id] += q;
      c.householdConsumed[m.id] += q;
      transfer(s, c, "public", "private", q * cost, "Ayuda alimentaria");
      if (owner === "private") {
        c.sectors.agriculture.revenue += q * price;
        c.sectors.agriculture.profit += q * price;
      } else n.aidStockValue += q * price;
      c.sectors.services.revenue += q * price * 0.02;
      c.sectors.services.profit += q * price * 0.02;
      c.finance.spending += q * cost;
      n.aidSpent += q * cost;
      n.aidRations += q * ration;
    }
  }
  function consumeFood(s, c, remaining) {
    const n = c.nutrition;
    const substitutes = [...foods].sort((a, b) =>
      s.market.resourcePrices[a.id] / D.foodProfiles[a.id].rations - s.market.resourcePrices[b.id] / D.foodProfiles[b.id].rations);
    const unitPrice = (m) => s.market.resourcePrices[m.id] * (1 + c.taxes.vat / 100);
    const minimumBill = (missing, selected, quantity = 0) => {
      let bill = 0;
      for (const m of substitutes) {
        const q = Math.min(Math.max(0, missing) / D.foodProfiles[m.id].rations,
          Math.max(0, c.publicStocks[m.id] + c.privateStocks[m.id] - (m.id === selected ? quantity : 0)));
        bill += q * unitPrice(m);
        missing -= q * D.foodProfiles[m.id].rations;
      }
      return missing > 0.00001 ? Infinity : bill;
    };
    // Variety may use only cash left after reserving the cheapest complete basket.
    // Poor households must not spend their staple-food money on costly preferences.
    for (const m of foods) {
      const missing = Math.max(0, n.need - eatenRations(c));
      let q = Math.max(0, Math.min(c.householdDemand[m.id] - c.householdConsumed[m.id],
        missing / D.foodProfiles[m.id].rations, c.publicStocks[m.id] + c.privateStocks[m.id]));
      const canBuy = (amount) => amount * unitPrice(m) +
        minimumBill(missing - amount * D.foodProfiles[m.id].rations, m.id, amount) <= c.finance.householdCash + 1e-15;
      if (!canBuy(0)) continue;
      if (!canBuy(q)) {
        let lo = 0, hi = q;
        for (let i = 0; i < 16; i++) { const mid = (lo + hi) / 2; if (canBuy(mid)) lo = mid; else hi = mid; }
        q = lo;
      }
      purchaseDomestic(s, c, m, q);
    }
    for (const m of substitutes) purchaseDomestic(s, c, m,
      Math.max(0, n.need - eatenRations(c)) / D.foodProfiles[m.id].rations);
    if (remaining) publicFoodAid(s, c);
    const missing = Math.max(0, n.need - eatenRations(c));
    for (const m of foods) {
      const demand = c.householdConsumed[m.id] + missing * m.household / foodBasket;
      c.needs[m.id] = Math.max(0, c.needs[m.id] + demand - c.householdDemand[m.id]);
      c.householdDemand[m.id] = demand;
      c.shortages[m.id] = Math.max(0, demand - c.householdConsumed[m.id]);
    }
    if (!remaining || n.closedTick === s.tick) return;
    const eaten = eatenRations(c), groups = {};
    let quality = 0;
    for (const m of foods) {
      const f = D.foodProfiles[m.id], q = c.householdConsumed[m.id] * f.rations;
      groups[f.group] = (groups[f.group] || 0) + q;
      quality += q * f.quality;
    }
    n.coverage = n.need > 0 ? clamp(eaten / n.need, 0, 1) : 1;
    const diversity = Object.values(groups).filter((q) => q >= eaten * 0.05 && q > 0).length;
    n.quality = eaten > 0 ? clamp(quality / eaten + Math.max(0, diversity - 1) * 12, 0, 100) : 0;
    n.shortfall = missing;
    n.unaffordable = Math.min(missing, storedRations(c));
    n.unavailable = Math.max(0, missing - n.unaffordable);
    const oldHunger = n.hunger, target = (1 - n.coverage) * 100;
    n.hunger = clamp(oldHunger + (target > oldHunger
      ? Math.min(target - oldHunger, (1 - n.coverage) * 20)
      : -Math.min(oldHunger - target, 12 * n.coverage)), 0, 100);
    n.hungerChange = n.hunger - oldHunger;
    n.deficitMonths = n.coverage < 0.65 ? n.deficitMonths + 1 : Math.max(0, n.deficitMonths - 1);
    n.spoilageRations = 0;
    for (const m of foods) for (const owner of owners) {
      const loss = stocks(c, owner)[m.id] * D.foodProfiles[m.id].spoilage;
      stocks(c, owner)[m.id] -= loss;
      c.monthlyResourceLedger.losses[m.id] += loss;
      n.spoilageRations += loss * D.foodProfiles[m.id].rations;
    }
    n.measured = true;
    n.closedTick = s.tick;
    if (c.id === s.playerCountryId && oldHunger < 40 && n.hunger >= 40)
      note(s, c, "Hambre elevada: revisá Alimentación y bienestar, habilitá importaciones o financiá ayuda alimentaria.");
  }
  function wellbeingReport(c) {
    const n = c.nutrition, span = c.workPolicy.retire - c.workPolicy.start;
    const pension = c.pensionPolicy;
    const pensionRatio = pension?.referenceUsd > 0
      ? (pension.paidPerRetireeUsd || 0) / pension.referenceUsd : 1;
    const duration = span < 38 ? Math.min(8, (38 - span) * 0.4) : -Math.min(18, Math.max(0, span - 47) * 0.6);
    const items = [
      ["base", "Bienestar básico", 36],
      ["food", "Cobertura alimentaria", (n.coverage - 1) * 32],
      ["diet", "Calidad de la dieta", n.quality / 100 * 5 * n.coverage],
      ["goods", "Acceso a otros bienes", c.consumptionCoverage * 20],
      ["housing", "Vivienda adecuada", c.housing * 0.2],
      ["unemployment", "Desocupación", -c.unemployment * 0.16],
      ["energy", "Abastecimiento eléctrico", c.energy.served * 8],
      ["infrastructure", "Infraestructura", c.infrastructure * 0.06],
      ["housingQuality", "Calidad de viviendas", c.housingStock.new / Math.max(0.000001, sum(c.housingStock)) * 3 + techBonus(c, "infrastructure", "quality") * 4],
      ["waste", "Residuos acumulados", -Math.min(25, (c.wasteBurden || 0) * 12)],
      ["woodSmoke", "Emisiones por quema de madera", -Math.min(3, (c.woodBurned || 0) / Math.max(1, population(c)) * 0.1)],
      ["tax", "Carga de IVA y ganancias", -Math.min(18, c.taxes.vat * 0.22 + c.taxes.income * 0.1)],
      ["career", "Duración de la vida laboral", duration],
      ["earlyWork", "Ingreso laboral temprano", -Math.max(0, 18 - c.workPolicy.start) * 1.5],
      ["lateRetirement", "Retiro tardío", -Math.max(0, c.workPolicy.retire - 67) * 0.5],
      ["durables", "Bienes duraderos en uso", ((c.goodsBenefits?.happiness || 1) - 1) * 40],
      ["pensions", "Cobertura de pensiones", clamp((pensionRatio - 1) * (c.laborSnapshot?.retired || 0) / Math.max(1, population(c)) * 45, -15, 8)],
      ["migrationPolicy", "Controles migratorios", (populationPolicyLevels[c.demographicPolicy?.entry] || populationPolicyLevels.neutral).happiness * 0.4 + (populationPolicyLevels[c.demographicPolicy?.exit] || populationPolicyLevels.neutral).happiness],
      ["birthPolicy", "Política de natalidad", (populationPolicyLevels[c.demographicPolicy?.birth] || populationPolicyLevels.neutral).happiness * 0.4],
      ["foodSecurity", "Reserva alimentaria accesible", Math.min(3, Math.max(0, (storedRations(c) / Math.max(1, population(c)) - 30) / 30))],
      ["hunger", "Hambre acumulada", -n.hunger * 0.4],
    ].map(([id, label, points]) => ({ id, label, points }));
    const raw = items.reduce((sum, x) => sum + x.points, 0);
    const cap = 98 - n.hunger * 0.65;
    const target = clamp(raw, 0, cap);
    items.push({ id: "limit", label: "Ajuste por límites y hambre", points: target - raw });
    return { items, target, cap, span, monthlyChange: (target - c.happiness) * 0.08 };
  }
  function nutritionReport(s, c = s.countries[s.playerCountryId]) {
    const n = c.nutrition, total = storedRations(c), publicTotal = storedRations(c, "public");
    const unitCost = Math.min(...foods.map((m) => s.market.resourcePrices[m.id] / D.foodProfiles[m.id].rations));
    return { ...n, stockDays: total / Math.max(1, population(c)),
      publicDays: publicTotal / Math.max(1, population(c)),
      privateDays: (total - publicTotal) / Math.max(1, population(c)),
      estimatedPurchaseCost: n.shortfall * unitCost * 1.02,
      productivity: 1 - n.hunger * 0.0025,
      wellbeing: wellbeingReport(c),
    };
  }
  function useRate(m) {
    return m.household || professionalUse[m.id] || 0;
  }
  function finalGoodsBenefits(c) {
    const coverage = (ids) =>
      ids.reduce((sum, id) => {
        const m = D.getMaterial(id),
          target = useRate(m) * population(c) * (durableYears[id] || 1);
        return (
          sum +
          clamp((c.durableOwnership?.[id] || 0) / Math.max(1e-12, target), 0, 1)
        );
      }, 0) / ids.length;
    return {
      happiness:
        1 +
        0.15 *
          coverage([
            "automobiles",
            "appliances",
            "smartphones",
            "textiles",
            "jewelry",
          ]),
      production:
        1 +
        0.25 *
          coverage([
            "machinery",
            "computers",
            "transport_vehicles",
            "diamond_tools",
          ]),
      construction: 1 + 0.35 * coverage(["machinery", "transport_vehicles"]),
      research: 1 + 0.35 * coverage(["computers", "servers", "supercomputers"]),
    };
  }
  const tradeDependencyPool = [
    "grains",
    "timber",
    "crude_oil",
    "iron_ore",
    "copper",
    "minerals",
  ];
  const populationPolicyLevels = {
    promote: { birth: 1.25, entry: 1.35, exit: 1.3, happiness: 1, cost: 2 },
    neutral: { birth: 1, entry: 1, exit: 1, happiness: 0, cost: 0 },
    restrict: { birth: 0.75, entry: 0.55, exit: 0.55, happiness: -2, cost: 1 },
    quota: { birth: 0.35, entry: 0.2, exit: 0.2, happiness: -5, cost: 3 },
    ban: { birth: 0, entry: 0, exit: 0, happiness: -10, cost: 5 },
  };
  function continent(c) {
    const region = c.region || "";
    if (/América|Andina|Caribe/i.test(region)) return "America";
    if (/[ÁA]frica/i.test(region)) return "Africa";
    if (["AUS", "NZL", "PNG", "FJI", "VUT", "SLB", "WSM", "TON", "NRU", "KIR", "TUV"].includes(c.id) || /Pacífico/i.test(region)) return "Oceania";
    if (/Europa/i.test(region) || ["MLT", "CYP", "TUR", "RUS"].includes(c.id)) return "Europe";
    return "Asia";
  }
  for (const t of D.technologies)
    (techGroups[t.sector + "|" + t.effect] ||= []).push(t);
  const map = (v) =>
    Object.fromEntries(
      materials.map((m) => [m.id, typeof v === "function" ? v(m) : v]),
    );
  const finite = (v, f = 0) => (Number.isFinite(v) ? v : f);
  const DEPOSIT_EPSILON = 0.000001;
  const needNumber = (v, min = 0, max = 1e18) => {
    v = Number(v);
    if (!Number.isFinite(v) || v < min || v > max)
      throw Error("El valor está fuera del rango permitido.");
    return v;
  };
  const player = (s) => {
    if (s.gameOver) throw Error("La partida terminó.");
    return s.countries[s.playerCountryId];
  };
  const random = H.random;
  function note(s, c, text) {
    H.addActivity(s, "management", text, c.id);
  }
  function scalarTech(c, id) {
    return c.research.levels[id] || 0;
  }
  function dependencyMaterials(countryId) {
    const score = (text) =>
      [...text].reduce((n, char) => (n * 33 + char.charCodeAt(0)) >>> 0, 5381);
    const count = 2 + (score(countryId) % 2);
    return tradeDependencyPool
      .slice()
      .sort(
        (a, b) =>
          score(`${countryId}:${a}`) - score(`${countryId}:${b}`) ||
          a.localeCompare(b),
      )
      .slice(0, count);
  }
  function depositRemaining(c, id, site) {
    const dep = c.naturalDeposits?.[id];
    if (!dep) return 0;
    return site
      ? Math.max(0, finite(dep[site]))
      : Math.max(0, finite(dep.land)) + Math.max(0, finite(dep.sea));
  }
  function syncDepositExplorations(c, id) {
    const dep = c.naturalDeposits?.[id];
    if (!dep) return false;
    for (const site of ["land", "sea"]) {
      dep[site] = Math.max(0, finite(dep[site]));
      if (dep[site] <= DEPOSIT_EPSILON) dep[site] = 0;
    }
    let exhausted = false;
    for (const ex of c.research?.explorations || []) {
      const site = ex.offshore ? "sea" : "land";
      if (
        ex.resource === id &&
        ex.status === "Depósito descubierto" &&
        depositRemaining(c, id, site) === 0
      ) {
        ex.status = "Agotado";
        exhausted = true;
      }
    }
    return exhausted;
  }
  function recipe(c, m) {
    return Object.entries(m.inputs).map(([id, q]) => [
      id,
      q * (1 - techBonus(c, m.sector, "cost")),
    ]);
  }
  function feedNeed(c) {
    return owners.reduce(
      (n, owner) =>
        n +
        Object.entries({
          cattle: 1,
          pigs: 0.3,
          poultry: 0.01,
          sheep: 0.15,
        }).reduce((v, [id, f]) => v + c.herds[owner][id] * f * 0.03, 0),
      0,
    );
  }
  function techBonus(c, sid, effect) {
    return Math.min(
      0.4,
      (techGroups[sid + "|" + effect] || []).reduce(
        (n, t) => n + scalarTech(c, t.id) * t.improvement * 0.15,
        0,
      ),
    );
  }
  function grant(c, id) {
    if (!id) return;
    const t = D.getTechnology(id);
    if (!t) return;
    for (const dep of t.requires) grant(c, dep);
    c.research.levels[id] = Math.max(1, c.research.levels[id] || 0);
  }
  function population(c) {
    return c.population * 1e6;
  }
  function debtTotal(c) {
    return (
      Math.max(0, c.finance.baseDebt) +
      c.loans.reduce(
        (n, l) => n + Math.max(0, l.outstanding) + Math.max(0, l.arrears || 0),
        0,
      )
    );
  }
  function syncDebt(c) {
    c.finance.nominalDebt = debtTotal(c);
    c.debt = (c.finance.nominalDebt / Math.max(c.gdp, 1e-9)) * 100;
  }
  function book(s, c, kind, amount, account = "public", details = "") {
    if (!Number.isFinite(amount)) throw Error("Movimiento monetario inválido.");
    if (Object.is(amount, -0)) amount = 0;
    if (account === "public") c.reserves += amount;
    else if (account === "private") c.finance.privateCash += amount;
    else c.finance.householdCash += amount;
    const entry = {
      id: ++c.finance.serial,
      tick: s.tick,
      kind,
      amount,
      account,
      details,
    };
    c.finance.ledger.push(entry);
    if (c.finance.ledger.length > 160) c.finance.ledger.shift();
    if (account === "public") {
      c.finance.pendingPublic += amount;
      c.finance.tickFlows ||= {};
      c.finance.tickFlows[kind] = (c.finance.tickFlows[kind] || 0) + amount;
    }
    return entry;
  }
  function transfer(s, c, from, to, amount, kind) {
    if (amount <= 0) return;
    book(s, c, kind, -amount, from);
    book(s, c, kind, amount, to);
  }
  function cash(c, owner) {
    return owner === "public"
      ? c.reserves
      : owner === "private"
        ? c.finance.privateCash
        : c.finance.householdCash;
  }
  function affordable(c, owner, cost) {
    return cost <= 0 ? 1 : clamp(Math.max(0, cash(c, owner)) / cost, 0, 1);
  }
  function initCountry(c, legacy) {
    if (c.economyVersion === 6) return;
    const base = L.getCountryDefinition(c.id),
      facts = D.facts.countries[c.id] || {},
      p = population(c),
      g = Math.max(c.gdp, 1e-6),
      pc = (g * 1e9) / p;
    c.economyVersion = 6;
    c.dataSources = facts;
    c.initialGdp = g;
    c.realGdp = g;
    c.gdpDeflator = 1;
    c.initialPopulation = c.population;
    c.initialEnergyDemand = c.electricityDemandTWh;
    c.finance = {
      baseDebt: Math.max(
        0,
        (c.debt * g) / 100 -
          sum(Object.fromEntries(c.loans.map((l) => [l.id, l.outstanding]))),
      ),
      nominalDebt: 0,
      privateCash: g * 0.13,
      householdCash: g * 0.08,
      ledger: [],
      serial: 0,
      pendingPublic: 0,
      monthly: {},
      automaticCredit: true,
      creditLimitShare: 205,
    };
    c.research = {
      levels: {},
      project: null,
      explorations: [],
      nextId: 1,
      points: 0,
      history: [],
    };
    for (const t of D.technologies)
      if (
        t.skill <= c.education - 8 ||
        [
          "housing",
          "civil",
          "farming",
          "primary",
          "thermal",
          "livestock",
          "waste_collection",
          "mining",
        ].includes(t.id)
      )
        grant(c, t.id);
    c.workPolicy = { start: 18, retire: 65 };
    // Existing industrial know-how is not the country's average schooling score.
    if (pc > 25000)
      for (const t of D.technologies.filter((t) => t.skill <= 80))
        grant(c, t.id);
    if ("USA CHN KOR JPN DEU NLD ISR SGP FRA GBR".split(" ").includes(c.id))
      grant(c, "advanced_chips");
    if ("USA CHN KOR VNM IND JPN".split(" ").includes(c.id))
      grant(c, "smartphones");
    if ("USA CHN JPN DEU FRA GBR KOR CAN".split(" ").includes(c.id))
      grant(c, "supercomputing");
    if (
      "USA RUS CHN FRA GBR IND PAK JPN KOR CAN UKR ARG BRA ZAF"
        .split(" ")
        .includes(c.id)
    )
      grant(c, "fission");
    c.ageCohorts = Array.from(
      { length: 101 },
      (_, age) =>
        p *
        (age < 18
          ? c.demographics.children / 100 / 18
          : age < 65
            ? c.demographics.workers / 100 / 47
            : c.demographics.retired / 100 / 36),
    );
    c.lifeExpectancy =
      facts.lifeExpectancy?.value || clamp(48 + c.health * 0.36, 45, 86);
    c.initialLifeExpectancy = c.lifeExpectancy;
    const area =
        c.id === "NRU" ? 21 : facts.areaKm2?.value || Math.max(21, p / 80),
      total = area * 100;
    const residential = Math.min(total * 0.3, p / 500),
      agri = Math.min(
        facts.agricultureKm2?.value * 100 || total * 0.25,
        total - residential,
      );
    c.land = {
      areaKm2: area,
      totalHa: total,
      residentialHa: residential,
      agricultureHa: agri,
      industrialHa: Math.min(total * 0.02, (total - residential - agri) * 0.1),
      restrictedHa: 0,
      irrigatedHa: (agri * (facts.irrigatedPercent?.value || 4)) / 100,
    };
    c.land.restrictedHa = Math.max(
      0,
      (total - residential - agri - c.land.industrialHa) * 0.3,
    );
    c.land.initialAgricultureHa = agri;
    c.land.legacyOverCapacity = p > area * 60000;
    c.infrastructureAssets = {
      streets: p / 120,
      roads: area * 0.08,
      highways: area * 0.003,
      rail: facts.railKm?.value || area * 0.007,
      subway: p / 80000,
      bullet_train: 0,
      airport: Math.max(1, Math.round(p / 1500000)),
      port: D.landlocked.includes(c.id)
        ? 0
        : Math.max(1, Math.round(p / 2500000)),
    };
    c.initialInfrastructure = { ...c.infrastructureAssets };
    c.initialHealth = c.health;
    c.privateBuildings = {};
    for (const b of buildings) {
      c.buildings[b.id] = finite(c.buildings[b.id]);
      c.privateBuildings[b.id] = 0;
    }
    c.publicStocks = map((m) => (legacy ? finite(c.materialStocks[m.id]) : 0));
    c.privateStocks = map(0);
    c.materialStocks = c.publicStocks;
    c.materialProduction = map(0);
    c.materialConsumption = map(0);
    c.materialCapacity = map(0);
    c.privateProduction = map(0);
    c.publicProduction = map(0);
    c.productionTargets = map(1);
    c.stockMinimum = map(0);
    c.importBans = map(false);
    c.importsBanned = false;
    c.storageBase = { public: {}, private: {} };
    c.storageLease = { public: {}, private: {} };
    c.naturalDeposits = {};
    for (const m of materials) {
      if (m.waste || ["milk", "meat", "raw_leather", "wool"].includes(m.id))
        continue;
      let scale;
      if (m.id === "grains") scale = agri / 1000;
      else if (m.id === "timber") scale = Math.max(0.02, (total * 0.03) / 1000);
      else if (m.household)
        scale =
          ((p * m.household) / 12 / Math.max(1, m.baseOutput)) *
          clamp(0.45 + c.education / 110, 0.5, 1.3);
      else scale = (g * 0.000018) / Math.max(1e-9, m.value * m.baseOutput);
      if (m.natural) {
        const known = D.knownFields[m.id];
        const geology = known
          ? known.split(" ").includes(c.id)
            ? 1
            : 0
          : clamp(c.deposits[m.id] || 0, 0, 2);
        scale *= geology;
        if (geology > 0)
          c.naturalDeposits[m.id] = {
            land: scale * m.baseOutput * 480 * DISCOVERED_DEPOSIT_SCALE,
            sea:
              !D.landlocked.includes(c.id) && m.id === "crude_oil"
                ? scale * m.baseOutput * 360 * DISCOVERED_DEPOSIT_SCALE
                : 0,
            potential: geology,
            studies: 0,
          };
      }
      if (!scalarTech(c, m.technology)) scale = 0;
      if (m.id === "plutonium") scale = 0;
      const pub =
        scale *
        (["energy", "health", "education", "security"].includes(m.sector)
          ? 0.35
          : 0.12);
      c.buildings[m.unlock] += pub;
      c.privateBuildings[m.unlock] += scale - pub;
      if (scale > 0) grant(c, m.technology);
    }
    for (const [id, ratio] of [
      ["primary_school", 0.12 / 600],
      ["secondary_school", 0.1 / 500],
      ["technical_school", 0.025 / 1000],
      ["university", 0.025 / 3000],
      ["research_lab", 0.00000006],
      ["clinics", 0.00002],
      ["hospital", 0.000001],
      ["police_network", 0.00001],
    ]) {
      const n = p * ratio;
      c.buildings[id] += n * 0.8;
      c.privateBuildings[id] += n * 0.2;
      if (n > 0) grant(c, D.getBuilding(id).technology);
    }
    for (const [id, type, heads] of [
      ["cattle_ranch", "cattle", 2000],
      ["pig_farm", "pigs", 3000],
      ["poultry_farm", "poultry", 40000],
      ["sheep_ranch", "sheep", 3000],
    ]) {
      const n = (agri * (type === "poultry" ? 4 : 0.22)) / heads;
      c.buildings[id] += n * 0.1;
      c.privateBuildings[id] += n * 0.9;
    }
    const coldChain =
      ((((p * 0.045) / 12) * clamp(0.45 + pc / 35000, 0.45, 1.8)) / 100) * 1.2;
    c.buildings.slaughterhouse += coldChain * 0.1;
    c.privateBuildings.slaughterhouse += coldChain * 0.9;
    c.initialHealthFacilities =
      c.buildings.clinics +
      c.privateBuildings.clinics +
      (c.buildings.hospital + c.privateBuildings.hospital) * 10;
    for (const [id, n] of Object.entries(c.infrastructureAssets)) {
      const b = D.getBuilding(id);
      if (b) {
        c.buildings[id] += (n / (b.quantity || 1)) * 0.8;
        c.privateBuildings[id] += (n / (b.quantity || 1)) * 0.2;
      }
    }
    c.herds = { public: {}, private: {} };
    for (const owner of owners)
      for (const [id, type, heads] of [
        ["cattle_ranch", "cattle", 2000],
        ["pig_farm", "pigs", 3000],
        ["poultry_farm", "poultry", 40000],
        ["sheep_ranch", "sheep", 3000],
      ])
        c.herds[owner][type] =
          (owner === "public" ? c.buildings[id] : c.privateBuildings[id]) *
          heads;
    const demand = c.electricityDemandTWh;
    c.buildings.fossil_plant += (demand * 0.45) / 2;
    c.privateBuildings.fossil_plant += (demand * 0.25) / 2;
    grant(c, "thermal");
    c.buildings.wind_farm += (demand * 0.1) / 0.3;
    c.privateBuildings.solar_farm += (demand * 0.2) / 0.2;
    grant(c, "wind");
    grant(c, "solar");
    c.educationPlan = {};
    for (const lev of D.educationLevels)
      c.educationPlan[lev.id] = {
        budget: g * 0.00015,
        staff: Math.max(1, p * 0.0015),
        salary: Math.max(50, (pc * 0.5) / 12),
        progress: 0,
        graduates: 0,
      };
    c.educationBranches = Object.fromEntries(
      D.educationBranches.map((b) => [
        b.id,
        {
          budget: g * 0.00003,
          staff: Math.max(1, p * 0.00015),
          salary: Math.max(50, (pc * 0.5) / 12),
          progress: 0,
          graduates: 0,
          skill: c.education,
        },
      ]),
    );
    c.sectors = {};
    const laborForce = ((p * c.demographics.workers) / 100) * 0.72,
      employed = labourSafe(laborForce * (1 - c.unemployment / 100));
    for (const sid of sectors) {
      const weight = c.labor[sid] / 100,
        n = employed * weight,
        publicShare = ["education", "health", "security"].includes(sid)
          ? 0.8
          : 0.18,
        wage = Math.max(25, (pc * 0.45) / 12);
      c.sectors[sid] = {
        budget: (((g * c.spendingTarget) / 100 / 12) * c.budget[sid]) / 100,
        requested: n * publicShare,
        publicWorkers: n * publicShare,
        privateWorkers: n * (1 - publicShare),
        privateJobs: n * (1 - publicShare),
        salary: wage,
        privateSalary: wage * 0.97,
        efficiencyPublic: clamp(c.education / 100, 0.35, 0.95),
        efficiencyPrivate: clamp(c.education / 100 + 0.03, 0.35, 0.98),
        experiencePublic: 0,
        experiencePrivate: 0,
        profit: 0,
        revenue: 0,
        subsidyCap: 0,
        executed: 0,
        initialJobs: Math.max(1, n),
        qualified: c.education,
        payrollCoverage: 1,
      };
    }
    c.qualifiedShare = clamp(0.15 + c.education / 130, 0.2, 0.95);
    for (const m of materials) {
      const capP = (c.buildings[m.unlock] || 0) * m.baseOutput,
        capR = (c.privateBuildings[m.unlock] || 0) * m.baseOutput;
      let stockP = capP * 2,
        stockR = capR * 2;
      if (m.waste) {
        stockP = p * 0.008;
        stockR = 0;
      }
      if (!legacy) c.publicStocks[m.id] = stockP;
      c.privateStocks[m.id] = stockR;
    }
    // A census of warehouse equivalents provides the initial stock's physical space.
    for (const owner of owners)
      for (const st of D.storageTypes) {
        const volume = materials
          .filter((m) => m.storage === st.id)
          .reduce(
            (n, m) =>
              n +
              (owner === "public"
                ? c.publicStocks[m.id]
                : c.privateStocks[m.id]) *
                volumePerUnit(m),
            0,
          );
        c.storageBase[owner][st.id] = Math.max(
          st.capacity * 0.002,
          volume * 1.5,
        );
      }
    c.energy = {
      generated: 0,
      demand: 0,
      served: 1,
      stored: 0,
      capacity: 0,
      curtailed: 0,
    };
    c.needs = map(0);
    c.shortages = map(0);
    c.householdDemand = map(0);
    c.householdConsumed = map(0);
    c.resourceImports = map(0);
    c.resourceExports = map(0);
    c.outputReasons = map("");
    c.publicUtilization = map(0);
    c.privateUtilization = map(0);
    c.consumptionCoverage = 1;
    c.durableOwnership = map((m) =>
      durableYears[m.id]
        ? m.household *
          p *
          clamp(0.45 + pc / 35000, 0.45, 1.8) *
          durableYears[m.id]
        : 0,
    );
    c.monthlyResourceLedger = null;
    c.privateProjects = [];
    c.nextPrivateId = 1;
    c.gdpValueAdded = 0;
    c.initialValueAdded = null;
    c.migrationAttraction = 0;
    c.tourismPotential = 0;
    c.uncollectedWaste = map(0);
    c.nationalized = {};
    c.nationalizedResources = map(false);
    c.blockedRawMaterials = [];
    c.constructionWorkers = 0;
    syncDebt(c);
    updateCapacity(c);
    syncDemographics(c);
    for (const project of c.projects) {
      project.v6 = true;
      project.factor = project.factor || 1;
      project.landReserved = true;
      project.costRemaining = finite(
        project.costRemaining,
        Math.max(0, (project.totalCost || 0) - (project.spent || 0)),
      );
    }
  }
  function labourSafe(v) {
    return Math.max(0, finite(v));
  }
  function volumePerUnit(m) {
    return m.unit === "t"
      ? 1
      : [
            "automobiles",
            "electric_vehicles",
            "transport_vehicles",
            "machinery",
          ].includes(m.id)
        ? 2
        : ["chips", "semiconductors", "cells"].includes(m.id)
          ? 0.00002
          : m.id === "supercomputers"
            ? 10
            : 0.02;
  }
  function legacyStorageCapacity(c, owner, type) {
    const b = warehouses[type];
    return (
      c.storageBase[owner][type] +
      (c.storageLease?.[owner]?.[type] || 0) +
      (b
        ? (owner === "public" ? c.buildings[b.id] : c.privateBuildings[b.id]) *
          b.storageAmount
        : 0)
    );
  }
  function resourceStorageCapacity(c, owner, m) {
    const b = dedicatedStores[m.id];
    return Math.max(0, (c.resourceStorageBase?.[owner]?.[m.id] || 0) +
      (owner === "public" ? c.buildings[b.id] || 0 : c.privateBuildings[b.id] || 0) * b.storageAmount);
  }
  function storageCapacity(c, owner, type) {
    if (!c.resourceStorageBase) return legacyStorageCapacity(c, owner, type);
    return storageFamilies[type].reduce((n,m)=>n+resourceStorageCapacity(c,owner,m),0);
  }
  function storageUsed(c, owner, type) {
    return storageFamilies[type].reduce(
      (a, m) => a + stocks(c, owner)[m.id] * volumePerUnit(m),
      0,
    );
  }
  function stocks(c, owner) {
    return owner === "public" ? c.publicStocks : c.privateStocks;
  }
  function freeStock(c, owner, m) {
    if (c.resourceStorageBase)
      return Math.max(0, resourceStorageCapacity(c, owner, m) /
        volumePerUnit(m) - stocks(c, owner)[m.id]);
    // Reserve room across the production chain: intermediates must not fill all
    // shared space before the final products get their turn to be manufactured.
    const family = storageFamilies[m.storage],
      bs = owner === "public" ? c.buildings : c.privateBuildings;
    const weight = (x) =>
      Math.max(
        0.01,
        stocks(c, owner)[x.id] * volumePerUnit(x),
        (c.needs?.[x.id] || 0) * volumePerUnit(x) * 2,
        (bs[x.unlock] || 0) * x.baseOutput * volumePerUnit(x) * 0.5,
        (c.stockMinimum?.[x.id] || 0) * volumePerUnit(x),
      );
    const share = weight(m) / family.reduce((n, x) => n + weight(x), 0),
      quota = storageCapacity(c, owner, m.storage) * share;
    return (
      Math.max(
        0,
        Math.min(
          storageCapacity(c, owner, m.storage) -
            storageUsed(c, owner, m.storage),
          quota - stocks(c, owner)[m.id] * volumePerUnit(m),
        ),
      ) / volumePerUnit(m)
    );
  }
  function spreadLegacySpace(c, owner, type, capacity) {
    const family = storageFamilies[type];
    if (!family?.length || capacity <= 0) return;
    const weights = family.map((m) => Math.max(1,
      (c.needs?.[m.id] || 0) * volumePerUnit(m),
      stocks(c, owner)[m.id] * volumePerUnit(m)));
    const total = weights.reduce((n,v)=>n+v,0);
    family.forEach((m,i)=>{c.resourceStorageBase[owner][m.id] += capacity * weights[i] / total;});
  }
  function migrateResourceStorage(c) {
    const old = {public:{},private:{}};
    for (const owner of owners) for (const t of D.storageTypes)
      old[owner][t.id] = legacyStorageCapacity(c,owner,t.id);
    c.resourceStorageBase = {public:map(0),private:map(0)};
    c.resourceStorageOverflow = {public:{},private:{}};
    for (const owner of owners) for (const t of D.storageTypes) {
      const family = storageFamilies[t.id];
      const occupied = family.reduce((n,m)=>n+stocks(c,owner)[m.id]*volumePerUnit(m),0);
      const preserved = Math.min(occupied, old[owner][t.id]);
      c.resourceStorageOverflow[owner][t.id] = Math.max(0, occupied - old[owner][t.id]);
      for (const m of family)
        c.resourceStorageBase[owner][m.id] = occupied > 0
          ? stocks(c,owner)[m.id]*volumePerUnit(m) * preserved / occupied : 0;
      spreadLegacySpace(c,owner,t.id,Math.max(0,old[owner][t.id]-preserved));
    }
    updateCapacity(c);
  }
  function updateCapacity(c) {
    for (const m of materials)
      c.materialCapacity[m.id] =
        c.publicStocks[m.id] + freeStock(c, "public", m);
    c.materialStocks = c.publicStocks;
  }
  function initialize(s, legacy = false) {
    // Older saves have no admin flag; it is opt-in and belongs to this save.
    s.adminMode = s.adminMode === true;
    // v7.8: deposits are intentionally much larger. This migration applies once
    // to existing remaining reserves and to the exploration result shown to player.
    if (!s.discoveredDepositsV78) {
      for (const c of Object.values(s.countries || {})) {
        for (const dep of Object.values(c.naturalDeposits || {})) {
          dep.land = Math.max(0, finite(dep.land)) * DISCOVERED_DEPOSIT_SCALE;
          dep.sea = Math.max(0, finite(dep.sea)) * DISCOVERED_DEPOSIT_SCALE;
        }
        for (const ex of c.research?.explorations || [])
          if (ex.status === "Depósito descubierto")
            ex.discovered =
              Math.max(0, finite(ex.discovered)) * DISCOVERED_DEPOSIT_SCALE;
      }
      s.discoveredDepositsV78 = true;
    }
    if (!s.finalPricesV77) {
      for (const m of materials.filter((m) => m.tier === "final")) {
        for (const key of ["resourcePrices", "previousResourcePrices"])
          if (Number.isFinite(s.market?.[key]?.[m.id]))
            s.market[key][m.id] *= 10;
      }
      s.finalPricesV77 = true;
    }
    s.version = 6;
    s.date.day = Math.max(1, Math.min(31, Math.floor(finite(s.date.day, 1))));
    s.dayTick = Math.max(0, Math.floor(finite(s.dayTick, 0)));
    s.dailyStage ||= "Inicio del mes";
    s.agreements = s.agreements || [];
    s.nextAgreementId = s.nextAgreementId || 1;
    for (const a of s.agreements) {
      const oldRemaining = Math.max(0, Math.floor(finite(a.remaining, 0)));
      a.remaining = oldRemaining;
      a.duration = Math.max(
        1,
        Math.min(
          120,
          Math.floor(finite(a.duration, oldRemaining > 0 ? oldRemaining : 24)),
        ),
      );
      a.closed = a.closed === true || a.status === "Cancelado";
      if (a.remaining <= 0) a.active = false;
      if (!a.active && !a.closed && a.remaining <= 0) a.status = "Finalizado";
    }
    s.financeWorld = s.financeWorld || { bank: 0, migrants: 0 };
    for (const c of Object.values(s.countries)) {
      initCountry(c, legacy);
      initializeNutrition(c, s);
      if (!c.pensionPolicy) {
        const rate = (c.gdp * 1e9 / Math.max(1, population(c))) * 0.2 / 12;
        c.pensionPolicy = { monthlyUsd: rate, referenceUsd: rate, paidPerRetireeUsd: rate, requested: 0, paid: 0, measured: false };
      }
      c.demographicPolicy ||= { birth: "neutral", entry: "neutral", exit: "neutral" };
      for (const key of ["birth", "entry", "exit"])
        if (!populationPolicyLevels[c.demographicPolicy[key]]) c.demographicPolicy[key] = "neutral";
      c.demographicRequests ||= { exit: 0, entry: 0, accepted: 0, departed: 0, rejected: 0, waiting: 0 };
      c.autoTradeReport ||= {};
      c.resourceStaffLimits ||= {};
      if (!c.tradePolicies) {
        c.tradePolicies = map((m) => ({
          sell: !m.waste,
          autoImport: false,
          importBelow: 0,
        }));
        for (const a of s.agreements.filter(
          (a) => [a.from, a.to].includes(c.id) && c.id === s.playerCountryId,
        )) {
          a.active = false;
          a.closed = true;
          a.status = "Cerrado: migración al mercado automático";
        }
      }
      c.goodsBenefits ||= finalGoodsBenefits(c);
      normalizeResearchQueue(c);
      // JSON saves break object aliases; keep the public inventory view current.
      c.materialStocks = c.publicStocks;
      c.nationalizedResources ||= map(false);
      for (const sid of sectors)
        if (c.nationalized?.[sid])
          for (const m of materials.filter((m) => m.sector === sid))
            c.nationalizedResources[m.id] = true;
      c.blockedRawMaterials =
        c.id === s.playerCountryId ? [] : dependencyMaterials(c.id);
      for (const sec of Object.values(c.sectors))
        sec.payrollCoverage = clamp(finite(sec.payrollCoverage, 1), 0, 1);
      for (const m of materials) {
        if (!m.natural) continue;
        const becameExhausted = syncDepositExplorations(c, m.id);
        if (c.naturalDeposits[m.id] && depositRemaining(c, m.id) === 0)
          c.outputReasons[m.id] = "Depósito agotado";
        if (becameExhausted && c.id === s.playerCountryId)
          note(s, c, `El depósito de ${m.label.toLowerCase()} está agotado.`);
      }
      const p = (c.housingProgram ||= {});
      p.buildBudget = Math.max(0, finite(p.buildBudget, 0));
      p.repairBudget = Math.max(0, finite(p.repairBudget, 0));
      p.buildWorkers = Math.max(0, finite(p.buildWorkers, 0));
      p.repairWorkers = Math.max(0, finite(p.repairWorkers, 0));
      p.lastBuildUnits = Math.max(0, finite(p.lastBuildUnits, 0));
      p.lastRepairUnits = Math.max(0, finite(p.lastRepairUnits, 0));
      p.lastBuildStatus = p.lastBuildStatus || "Sin programa activo";
      p.lastRepairStatus = p.lastRepairStatus || "Sin programa activo";
    }
    if (!s.v6Seeded) {
      seedSupplyChains(s, legacy);
      if (!legacy) for (const c of Object.values(s.countries))
        for (const id of c.blockedRawMaterials || []) {
          c.publicStocks[id] = Math.min(c.publicStocks[id], (c.needs[id] || 0) * 0.1);
          c.privateStocks[id] = Math.min(c.privateStocks[id], (c.needs[id] || 0) * 0.2);
        }
      s.v6Seeded = true;
    }
    if (!s.resourceStoresV711) {
      for (const c of Object.values(s.countries)) {
        for (const m of materials) {
          c.buildings[`store_${m.id}`] ||= 0;
          c.privateBuildings[`store_${m.id}`] ||= 0;
        }
        migrateResourceStorage(c);
      }
      s.resourceStoresV711 = true;
    }
    return s;
  }
  function seedSupplyChains(s, legacy) {
    for (const c of Object.values(s.countries)) {
      // Capacity equivalents are scenario estimates, including pre-existing industry.
      const fuel = D.getMaterial("fuel"),
        fuelNeed = ((c.electricityDemandTWh * 1e6) / 12) * 0.7 * 0.18;
      grant(c, "refining");
      c.privateBuildings[fuel.unlock] = Math.max(
        c.privateBuildings[fuel.unlock],
        (fuelNeed / fuel.baseOutput) * 1.1,
      );
      const requirements = map(
        (m) => ((m.household * population(c)) / 12) * 1.5,
      );
      requirements.fuel += fuelNeed;
      for (let pass = 0; pass < 3; pass++)
        for (const m of materials) {
          const goal = Math.max(
            requirements[m.id],
            (c.buildings[m.unlock] + c.privateBuildings[m.unlock]) *
              m.baseOutput *
              0.8,
          );
          for (const [id, n] of Object.entries(m.inputs))
            requirements[id] = Math.max(requirements[id], goal * n * 1.5);
        }
      for (const m of materials) {
        if (m.waste) continue;
        const wanted = requirements[m.id];
        c.privateStocks[m.id] = Math.max(c.privateStocks[m.id], wanted * 3);
        if (!legacy)
          c.publicStocks[m.id] = Math.max(c.publicStocks[m.id], wanted * 0.3);
        c.needs[m.id] = wanted;
        if (
          scalarTech(c, m.technology) &&
          !m.natural &&
          !["milk", "meat", "raw_leather", "wool"].includes(m.id)
        )
          c.privateBuildings[m.unlock] = Math.max(
            c.privateBuildings[m.unlock],
            (wanted / Math.max(1e-9, m.baseOutput)) * 0.9,
          );
      }
      for (const owner of owners)
        for (const type of D.storageTypes) {
          const volume = materials
            .filter((m) => m.storage === type.id)
            .reduce((n, m) => n + stocks(c, owner)[m.id] * volumePerUnit(m), 0);
          c.storageBase[owner][type.id] = Math.max(
            c.storageBase[owner][type.id],
            volume * 1.25,
          );
        }
      updateCapacity(c);
    }
    // Calibrate natural extraction to world input requirements, preserving geographic specialization.
    const cs = Object.values(s.countries);
    for (const m of materials.filter((m) => m.natural)) {
      const need = cs.reduce((n, c) => n + c.needs[m.id], 0) * 1.15;
      const producers = cs.filter((c) => c.naturalDeposits[m.id]);
      const total = producers.reduce(
        (n, c) =>
          n +
          Math.max(0.001, c.buildings[m.unlock] + c.privateBuildings[m.unlock]),
        0,
      );
      for (const c of producers) {
        const weight =
            Math.max(
              0.001,
              c.buildings[m.unlock] + c.privateBuildings[m.unlock],
            ) / Math.max(0.001, total),
          target = need * weight,
          facility = target / m.baseOutput;
        grant(c, m.technology);
        c.buildings[m.unlock] = Math.max(
          c.buildings[m.unlock],
          facility * 0.15,
        );
        c.privateBuildings[m.unlock] = Math.max(
          c.privateBuildings[m.unlock],
          facility * 0.85,
        );
        c.naturalDeposits[m.id].land = Math.max(
          c.naturalDeposits[m.id].land,
          target * 600,
        );
        c.privateStocks[m.id] = Math.max(c.privateStocks[m.id], target * 3);
      }
    }
    calibrateInitialIndustry(cs, legacy);
    for (const c of cs) {
      const generated = population(c) * 0.026;
      c.buildings.waste_treatment = Math.max(
        c.buildings.waste_treatment,
        (generated / 20000) * 0.9,
      );
      c.buildings.recycling_plant = Math.max(
        c.buildings.recycling_plant,
        ((population(c) * 0.009) / 12000) * 0.8,
      );
      for (const owner of owners)
        for (const type of D.storageTypes)
          c.storageBase[owner][type.id] = Math.max(
            c.storageBase[owner][type.id],
            storageUsed(c, owner, type.id) * 1.25,
          );
      updateCapacity(c);
    }
  }
  function calibrateInitialIndustry(cs, legacy) {
    const ordered = [],
      seen = new Set();
    const visit = (m) => {
      if (seen.has(m.id)) return;
      seen.add(m.id);
      Object.keys(m.inputs).forEach((id) => visit(D.getMaterial(id)));
      ordered.push(m);
    };
    materials.forEach(visit);
    const wanted = map((m) =>
      cs.reduce(
        (n, c) =>
          n +
          ((m.household * population(c)) / 12) *
            clamp(0.45 + (c.gdp * 1e9) / population(c) / 35000, 0.45, 1.8),
        0,
      ),
    );
    wanted.fuel += cs.reduce(
      (n, c) => n + ((c.electricityDemandTWh * 1e6) / 12) * 0.7 * 0.18,
      0,
    );
    wanted.feed += cs.reduce((n, c) => n + feedNeed(c) * 0.65, 0);
    for (const m of ordered.reverse()) {
      const producers = cs.filter(
        (c) =>
          scalarTech(c, m.technology) &&
          (!m.natural || c.naturalDeposits[m.id]) &&
          (c.privateBuildings[m.unlock] || 0) > 0,
      );
      const publicOutput = cs.reduce(
          (n, c) => n + production(c, "public", m),
          0,
        ),
        privateOutput = producers.reduce(
          (n, c) => n + production(c, "private", m),
          0,
        );
      const goal = Math.max(wanted[m.id] * 1.15, publicOutput * 1.3);
      if (
        !m.waste &&
        !["grains", "timber", "milk", "meat", "raw_leather", "wool"].includes(
          m.id,
        ) &&
        privateOutput > 0
      ) {
        const ratio = Math.max(0.05, (goal - publicOutput) / privateOutput);
        for (const c of producers) {
          c.privateBuildings[m.unlock] *= ratio;
          const output = production(c, "private", m);
          c.privateStocks[m.id] = Math.max(c.privateStocks[m.id], output * 2);
          if (m.natural)
            c.naturalDeposits[m.id].land = Math.max(
              c.naturalDeposits[m.id].land,
              output * 600,
            );
        }
      }
      for (const [id, q] of Object.entries(m.inputs)) wanted[id] += goal * q;
    }
  }
  function syncDemographics(c) {
    const ages = c.ageCohorts,
      total = sum(ages);
    c.population = total / 1e6;
    const count = (a, b) => ages.slice(a, b).reduce((x, y) => x + y, 0);
    const children = count(0, 18),
      retired = count(c.workPolicy.retire, 101),
      eligible = count(c.workPolicy.start, c.workPolicy.retire),
      force = eligible * 0.72;
    let employed = sectors.reduce(
      (n, id) => n + c.sectors[id].publicWorkers + c.sectors[id].privateWorkers,
      0,
    );
    if (employed > force) {
      const f = force / Math.max(1, employed);
      for (const sector of Object.values(c.sectors)) {
        sector.publicWorkers *= f;
        sector.privateWorkers *= f;
      }
      employed = force;
    }
    c.constructionWorkers = Math.min(
      c.constructionWorkers || 0,
      Math.max(0, force - employed),
    );
    employed += c.constructionWorkers;
    c.demographics = {
      children: (children / Math.max(1, total)) * 100,
      workers: (count(18, 65) / Math.max(1, total)) * 100,
      retired: (count(65, 101) / Math.max(1, total)) * 100,
    };
    c.unemployment = clamp(
      ((force - employed) / Math.max(1, force)) * 100,
      0,
      100,
    );
    c.laborSnapshot = {
      total: total / 1e6,
      children: children / 1e6,
      retired: retired / 1e6,
      workingAge: eligible / 1e6,
      laborForce: force / 1e6,
      employed: employed / 1e6,
      unemployed: Math.max(0, force - employed) / 1e6,
      inactive: (eligible * 0.28) / 1e6,
      dependency:
        ((count(0, c.workPolicy.start) + retired) / Math.max(1, eligible)) *
        100,
    };
  }
  function working(s, c) {
    c.constructionWorkers = 0;
    c.electricityDemandTWh =
      c.initialEnergyDemand *
      (c.population / c.initialPopulation) *
      clamp((c.realGdp / c.initialGdp) ** 0.2, 0.5, 3);
    syncDemographics(c);
    let free = c.laborSnapshot.unemployed * 1e6;
    const pool = c.laborSnapshot.laborForce * 1e6;
    for (const sec of Object.values(c.sectors)) {
      sec.newFromUnemployment = 0;
      sec.transfers = 0;
      const cap = sec.requested;
      if (sec.publicWorkers > cap) {
        const lost = sec.publicWorkers - cap;
        sec.publicWorkers = cap;
        free += lost;
      }
    }
    const ranked = sectors
      .slice()
      .sort((a, b) => c.sectors[b].salary - c.sectors[a].salary);
    for (const sid of ranked) {
      const sec = c.sectors[sid],
        tSkill = ["education", "health"].includes(sid)
          ? 65
          : sid === "industry"
            ? 55
            : 30;
      const qualified = clamp(c.education / tSkill, 0.05, 1);
      const target = Math.min(sec.requested, pool * qualified);
      let vacant = Math.max(0, target - sec.publicWorkers);
      let hire = Math.min(vacant, free * qualified, pool * 0.006);
      sec.publicWorkers += hire;
      free -= hire;
      sec.newFromUnemployment = hire;
      vacant -= hire;
      if (vacant > 0)
        for (const other of Object.values(c.sectors)) {
          if (sec.salary <= other.privateSalary * 1.05) continue;
          const move = Math.min(
            vacant,
            other.privateWorkers *
              0.008 *
              clamp(sec.salary / Math.max(1, other.privateSalary) - 1, 0, 3) *
              qualified,
          );
          other.privateWorkers -= move;
          sec.publicWorkers += move;
          vacant -= move;
          sec.transfers += move;
        }
    }
    for (const sid of sectors) {
      const sec = c.sectors[sid];
      // Higher-paying private vacancies can attract public employees as well.
      let vacancies = Math.max(0, sec.privateJobs - sec.privateWorkers);
      for (const other of Object.values(c.sectors)) {
        if (sec.privateSalary <= other.salary * 1.05 || vacancies <= 0)
          continue;
        const moved = Math.min(
          vacancies,
          other.publicWorkers *
            0.005 *
            clamp(sec.privateSalary / Math.max(1, other.salary) - 1, 0, 3),
        );
        other.publicWorkers -= moved;
        sec.privateWorkers += moved;
        vacancies -= moved;
      }
      if (sec.privateWorkers > sec.privateJobs) {
        const lost = (sec.privateWorkers - sec.privateJobs) * 0.12;
        sec.privateWorkers -= lost;
        free += lost;
      }
      const n = Math.min(
        Math.max(0, sec.privateJobs - sec.privateWorkers) * 0.12,
        free * 0.15,
      );
      sec.privateWorkers += n;
      free -= n;
      sec.privateSalary +=
        (Math.max(sec.privateSalary, sec.salary * 0.9) - sec.privateSalary) *
        0.01;
      sec.executed = 0;
      sec.revenue = 0;
      sec.profit = 0;
      sec.inputRevenue = 0;
      sec.inputExpense = 0;
    }
    syncDemographics(c);
  }
  function automaticFunding(s, c, amount, reason) {
    const short = Math.max(0, amount - c.reserves);
    if (!short) return 0;
    const limit = Math.max(
      0,
      (c.gdp * c.finance.creditLimitShare) / 100 - debtTotal(c),
    );
    const credit = Math.min(short, limit);
    if (c.finance.automaticCredit && credit > 0) {
      c.finance.baseDebt += credit;
      book(s, c, "Crédito automático", credit, "public", reason);
      s.financeWorld.bank -= credit;
      syncDebt(c);
      return credit;
    }
    return 0;
  }
  function wages(s, c) {
    const last = c.finance.lastPayroll || c.gdp * 0.04;
    c.finance.payroll = 0;
    c.finance.taxes = 0;
    c.finance.spending = 0;
    c.finance.interest = 0;
    c.finance.taxBases = {
      vat: 0,
      income: 0,
      inheritance: 0,
      imports: 0,
      exports: 0,
    };
    for (const sid of sectors) {
      const sec = c.sectors[sid];
      for (const owner of owners) {
        const workers =
          owner === "public" ? sec.publicWorkers : sec.privateWorkers;
        let amount =
          (workers * (owner === "public" ? sec.salary : sec.privateSalary)) /
          1e9;
        const expected = amount;
        if (owner === "public")
          automaticFunding(s, c, amount, "Nómina pública");
        amount *= affordable(c, owner, amount);
        transfer(s, c, owner, "household", amount, "Salarios");
        if (owner === "public") {
          sec.executed += amount;
          sec.payrollCoverage = expected > 0 ? amount / expected : 1;
          c.finance.spending += amount;
        } else sec.profit -= amount;
        c.finance.payroll += amount;
      }
    }
    const income =
      ((c.finance.payroll * c.taxes.income) / 100) * c.taxEfficiency;
    transfer(
      s,
      c,
      "household",
      "public",
      income,
      "Impuesto a las ganancias salariales",
    );
    c.finance.taxes += income;
    c.finance.taxBases.income += c.finance.payroll * c.taxEfficiency;
    const pensions = c.laborSnapshot.retired * 1e6 * c.pensionPolicy.monthlyUsd / 1e9;
    automaticFunding(s, c, pensions, "Pensiones");
    const paid = Math.min(pensions, Math.max(0, c.reserves));
    transfer(s, c, "public", "household", paid, "Pensiones");
    c.finance.spending += paid;
    c.finance.pensions = paid;
    c.pensionPolicy.requested = pensions;
    c.pensionPolicy.paid = paid;
    c.pensionPolicy.paidPerRetireeUsd = c.laborSnapshot.retired > 0
      ? paid * 1e9 / (c.laborSnapshot.retired * 1e6) : c.pensionPolicy.monthlyUsd;
    c.pensionPolicy.measured = true;
    const policyIntensity = ["birth", "entry", "exit"].reduce((n, key) =>
      n + (populationPolicyLevels[c.demographicPolicy[key]]?.cost || 0), 0);
    const policyCost = c.gdp * policyIntensity * 0.000003 / 12;
    automaticFunding(s, c, policyCost, "Administración demográfica");
    const policyPaid = Math.min(policyCost, Math.max(0, c.reserves));
    if (policyPaid) {
      book(s, c, "Administración demográfica", -policyPaid, "public", "Natalidad y fronteras");
      s.financeWorld.bank += policyPaid;
      c.finance.spending += policyPaid;
    }
    c.demographicPolicy.cost = policyPaid;
    c.demographicPolicy.efficacy = policyCost > 0 ? policyPaid / policyCost : 1;
    c.finance.lastPayroll = c.finance.payroll;
    c.incomePulse = last > 0 ? clamp(c.finance.payroll / last, 0.5, 1.5) : 1;
  }
  function efficiency(c, sid, owner) {
    const sec = c.sectors[sid],
      base = owner === "public" ? sec.efficiencyPublic : sec.efficiencyPrivate;
    return (1 - (c.nutrition?.hunger || 0) * 0.0025) * clamp(
      0.65 +
        base * 0.5 +
        techBonus(c, sid, "output") +
        techBonus(c, sid, "quality"),
      0.5,
      1.6,
    );
  }
  // Preflight the entire recipe: checking each input against the same cash would
  // otherwise allow the last ingredients to be created without payment.
  function inputScale(s, c, owner, entries, sid) {
    const other = owner === "public" ? "private" : "public";
    let scale = 1;
    for (const [id, q] of entries)
      if (q > 0)
        scale = Math.min(
          scale,
          (stocks(c, owner)[id] + stocks(c, other)[id]) / q,
        );
    let cost = 0,
      disposal = 0;
    for (const [id, q] of entries) {
      const missing = Math.max(0, q * scale - stocks(c, owner)[id]),
        price = s.market.resourcePrices[id];
      if (price > 0) cost += missing * price;
      else disposal -= missing * price;
    }
    let budget = Math.max(0, cash(c, owner));
    if (owner === "public") {
      const credit = c.finance.automaticCredit
        ? Math.max(0, (c.gdp * c.finance.creditLimitShare) / 100 - debtTotal(c))
        : 0;
      budget = Math.max(0, c.reserves + credit);
    }
    return clamp(
      scale *
        Math.min(
          cost > 0 ? budget / cost : 1,
          disposal > 0 ? Math.max(0, cash(c, other)) / disposal : 1,
          1,
        ),
      0,
      1,
    );
  }
  function spendInput(
    s,
    c,
    owner,
    id,
    quantity,
    sid = D.getMaterial(id).sector,
  ) {
    if (quantity <= 0) return 0;
    const stock = stocks(c, owner);
    const inputSector = D.getMaterial(id).sector,
      unitPrice = s.market.resourcePrices[id];
    const accountInput = (quantity, supplier) => {
      const value = quantity * unitPrice;
      if (supplier === "private") {
        c.sectors[inputSector].profit += value;
        c.sectors[inputSector].revenue += Math.max(0, value);
        c.sectors[inputSector].inputRevenue += value;
      }
      if (owner === "private") {
        c.sectors[sid].profit -= value;
        c.sectors[sid].inputExpense += value;
      }
    };
    let own = Math.min(quantity, stock[id]);
    stock[id] -= own;
    c.materialConsumption[id] += own;
    accountInput(own, owner);
    let missing = quantity - own;
    if (missing > 1e-8) {
      const other = owner === "public" ? "private" : "public",
        m = D.getMaterial(id);
      const price = s.market.resourcePrices[id];
      const payer = price < 0 ? other : owner;
      if (owner === "public" && price > 0)
        automaticFunding(s, c, missing * price, "Insumos productivos públicos");
      const n = Math.min(
        missing,
        stocks(c, other)[id],
        Math.max(0, cash(c, payer)) / Math.max(1e-15, Math.abs(price)),
      );
      if (n > 0) {
        stocks(c, other)[id] -= n;
        transfer(
          s,
          c,
          payer,
          price < 0 ? owner : other,
          n * Math.abs(price),
          price < 0 ? "Tratamiento nacional de residuos" : "Insumos nacionales",
        );
        if (owner === "public" && price > 0)
          c.sectors[sid].executed += n * price;
        c.materialConsumption[id] += n;
        accountInput(n, other);
      }
      return own + n;
    }
    return own;
  }
  function availableInput(s, c, owner, id) {
    return (
      stocks(c, owner)[id] +
      Math.min(
        stocks(c, owner === "public" ? "private" : "public")[id],
        Math.max(
          0,
          cash(
            c,
            s.market.resourcePrices[id] < 0
              ? owner === "public"
                ? "private"
                : "public"
              : owner,
          ),
        ) / Math.max(1e-15, Math.abs(s.market.resourcePrices[id])),
      )
    );
  }
  function production(c, owner, m) {
    if (
      c.blockedRawMaterials?.includes(m.id) ||
      (owner === "private" && c.nationalizedResources?.[m.id])
    )
      return 0;
    const assets = owner === "public" ? c.buildings : c.privateBuildings;
    const count =
        (assets[m.unlock] || 0) +
        (m.id === "crude_oil" ? (assets.offshore_platform || 0) * 2 : 0),
      sec = c.sectors[m.sector];
    let filled =
      owner === "public"
        ? sec.publicWorkers / Math.max(1, sec.requested)
        : sec.privateWorkers / Math.max(1, sec.privateJobs);
    if (owner === "public") {
      filled *= sec.payrollCoverage ?? 1;
      const staff = resourceStaffing(c, m);
      filled *= staff.expected > 0 ? staff.assigned / staff.expected : 0;
    }
    const tech = scalarTech(c, m.technology);
    return !tech
      ? 0
      : count *
          m.baseOutput *
          clamp(filled, 0, 1) *
          efficiency(c, m.sector, owner) *
          (c.goodsBenefits?.production || 1) *
          (1 + (tech - 1) * 0.08) *
          (owner === "public" ? c.productionTargets[m.id] : 1);
  }
  const staffingCache = new WeakMap();
  function resourceStaffing(c, m) {
    const sec = c.sectors[m.sector];
    let cache = staffingCache.get(c);
    if (!cache) { cache = {}; staffingCache.set(c, cache); }
    let entry = cache[m.sector];
    if (!entry || entry.workers !== sec.publicWorkers ||
        entry.salary !== sec.salary || entry.version !== (c.staffingVersion || 0)) {
      const peers = materials.filter((x) => x.sector === m.sector &&
        (c.buildings[x.unlock] || 0) > 0 && !c.blockedRawMaterials?.includes(x.id));
      const weights = peers.map((x) => (c.buildings[x.unlock] || 0) *
        Math.max(1, D.getBuilding(x.unlock)?.laborNeed || 1) /
        Math.max(1, materials.filter((y) => y.sector === x.sector && y.unlock === x.unlock).length));
      const total = weights.reduce((n, x) => n + x, 0);
      const byId = {};
      peers.forEach((x, index) => {
        const expected = total > 0 ? sec.publicWorkers * weights[index] / total : 0;
        const operatingMax = Math.max(expected, (c.buildings[x.unlock] || 0) *
          Math.max(1, D.getBuilding(x.unlock)?.laborNeed || 1) * 1000);
        const requested = c.resourceStaffLimits?.[x.id] ?? operatingMax;
        byId[x.id] = { expected, operatingMax, requested,
          assigned: Math.min(expected, operatingMax, requested), salary: sec.salary };
      });
      entry = { workers: sec.publicWorkers, salary: sec.salary,
        version: c.staffingVersion || 0, byId };
      cache[m.sector] = entry;
    }
    return entry.byId[m.id] || { expected: 0, operatingMax: 0,
      requested: c.resourceStaffLimits?.[m.id] || 0, assigned: 0, salary: sec.salary };
  }
  function runEnergy(s, c) {
    c.woodBurned = 0;
    const demand =
      Math.max(0.00001, (c.electricityDemandTWh * 1e6) / 12) *
      (1 + Math.max(-0.5, c.growth / 1200)) *
      (1 - techBonus(c, "energy", "cost"));
    const capacity =
      (c.buildings.power_grid + c.privateBuildings.power_grid) *
      1000 *
      scalarTech(c, "energy_storage");
    let generated = 0,
      potential = 0;
    const plants = buildings
      .filter((b) => b.energyOutput)
      .sort(
        (a, b) =>
          Number(["fossil", "nuclear", "biomass", "wood"].includes(a.energyKind)) -
          Number(["fossil", "nuclear", "biomass", "wood"].includes(b.energyKind)),
      );
    for (const b of plants)
      for (const owner of owners) {
        const count =
          owner === "public" ? c.buildings[b.id] : c.privateBuildings[b.id];
        if (!count) continue;
        const sec = c.sectors.energy;
        let fill =
          owner === "public"
            ? sec.publicWorkers / Math.max(1, sec.requested)
            : sec.privateWorkers / Math.max(1, sec.privateJobs);
        if (owner === "public") fill *= sec.payrollCoverage ?? 1;
        let n =
          ((count * b.energyOutput * 1e6) / 12) *
          clamp(fill, 0, 1) *
          (1 + Math.max(0, scalarTech(c, b.technology) - 1) * 0.08);
        const kind = b.energyKind;
        if (["solar", "wind"].includes(kind))
          n *= clamp(
            0.85 + Math.sin((s.tick + c.center[0]) / 5) * 0.2,
            0.55,
            1.15,
          );
        if (kind === "hydro")
          n *= clamp(1 + H.activeEventEffects(c, s).food, 0.2, 1.1);
        potential += n;
        n = Math.min(
          n,
          Math.max(0, demand + capacity - c.energy.stored - generated),
        );
        const input =
            kind === "nuclear"
              ? "uranium"
              : kind === "fossil"
                ? "fuel"
                : kind === "biomass"
                  ? "organic_waste"
                  : kind === "wood"
                    ? "timber"
                  : null,
          ratio =
            kind === "nuclear" ? 0.000003 : kind === "fossil" ? 0.18 : kind === "wood" ? 0.9 : 1.5;
        if (input) {
          if (kind === "biomass") {
            const organic = Math.min(
              n * ratio,
              availableInput(s, c, owner, "organic_waste"),
            );
            const used = spendInput(
              s,
              c,
              owner,
              "organic_waste",
              organic,
              "energy",
            );
            const remaining = Math.max(0, n - used / ratio);
            const agricultural =
              remaining *
              ratio *
              inputScale(
                s,
                c,
                owner,
                [["biomass", remaining * ratio]],
                "energy",
              );
            n =
              (used +
                spendInput(s, c, owner, "biomass", agricultural, "energy")) /
              ratio;
          } else {
            n *= inputScale(s, c, owner, [[input, n * ratio]], "energy");
            n = spendInput(s, c, owner, input, n * ratio, "energy") / ratio;
            if (kind === "wood") c.woodBurned += n * ratio;
          }
        }
        generated += n;
      }
    let stock = c.energy.stored;
    const from = Math.min(Math.max(0, demand - generated), stock);
    stock -= from;
    const store = Math.min(
      Math.max(0, generated - demand),
      Math.max(0, capacity - stock),
    );
    stock += store;
    c.energy = {
      generated,
      demand,
      served: clamp((generated + from) / demand, 0, 1),
      stored: stock,
      capacity,
      curtailed: Math.max(0, potential - generated),
      potential,
    };
    c.electricityGenerationTWh = (generated * 12) / 1e6;
  }
  function produce(s, c) {
    c.materialProduction = map(0);
    c.materialConsumption = map(0);
    c.publicProduction = map(0);
    c.privateProduction = map(0);
    c.outputReasons = map("");
    c.resourceImports = map(0);
    c.resourceExports = map(0);
    c.productionCosts = map(0);
    c.gdpValueAdded = 0;
    c.grossImports = 0;
    c.grossExports = 0;
    c.tradeBalance = 0;
    c.monthlyResourceLedger = {
      opening: map(
        (m) =>
          c.publicStocks[m.id] +
          c.privateStocks[m.id] +
          (c.uncollectedWaste?.[m.id] || 0),
      ),
      losses: map(0),
    };
    runEnergy(s, c);
    const ordered = [];
    const visit = (m) => {
      if (ordered.includes(m)) return;
      for (const id of Object.keys(m.inputs || {})) visit(D.getMaterial(id));
      ordered.push(m);
    };
    materials.forEach(visit);
    for (const m of ordered) {
      if (m.waste || ["milk", "meat", "raw_leather", "wool"].includes(m.id))
        continue;
      if (c.blockedRawMaterials?.includes(m.id)) {
        c.outputReasons[m.id] =
          "Materia prima no disponible: requiere importación";
        continue;
      }
      for (const owner of owners) {
        let output = production(c, owner, m),
          potential = output;
        const st = stocks(c, owner);
        if (m.id === "grains")
          output =
            Math.min(
              output,
              ((c.land.agricultureHa * 4) / 12) *
                (owner === "public" ? 0.12 : 0.88),
            ) *
            (1 +
              (c.land.irrigatedHa / Math.max(1, c.land.agricultureHa)) * 0.25);
        output *= Math.max(0.05, c.energy.served);
        if (m.natural) {
          const dep = c.naturalDeposits[m.id];
          const assets = owner === "public" ? c.buildings : c.privateBuildings;
          output = Math.min(
            output,
            dep
              ? m.id === "crude_oil"
                ? Math.min(dep.land, (assets.oil_well || 0) * m.baseOutput) +
                  Math.min(
                    dep.sea,
                    (assets.offshore_platform || 0) * m.baseOutput * 2,
                  )
                : depositRemaining(c, m.id, "land")
              : 0,
          );
        }
        if (m.sector === "agriculture")
          output *= clamp(1 + H.activeEventEffects(c, s).food, 0.1, 1.5);
        for (const [id, ratio] of recipe(c, m)) {
          const available = c.publicStocks[id] + c.privateStocks[id];
          output = Math.min(output, available / ratio);
          if (available < potential * ratio)
            c.outputReasons[m.id] =
              `Faltan ${D.getMaterial(id).label.toLowerCase()}`;
        }
        output = Math.max(0, Math.min(output, freeStock(c, owner, m)));
        output *= inputScale(
          s,
          c,
          owner,
          recipe(c, m).map(([id, q]) => [id, q * output]),
          m.sector,
        );
        if (!scalarTech(c, m.technology))
          c.outputReasons[m.id] = "Tecnología pendiente";
        else if (
          !(
            (owner === "public" ? c.buildings : c.privateBuildings)[m.unlock] >
            0
          )
        )
          c.outputReasons[m.id] = "Falta instalación";
        else if (output < potential * 0.1 && !c.outputReasons[m.id])
          c.outputReasons[m.id] = "Personal, energía o depósito insuficiente";
        let inputsCost = 0;
        for (const [id, ratio] of recipe(c, m)) {
          const consumed = spendInput(
            s,
            c,
            owner,
            id,
            output * ratio,
            m.sector,
          );
          inputsCost += consumed * s.market.resourcePrices[id];
        }
        st[m.id] += output;
        c.materialProduction[m.id] += output;
        (owner === "public" ? c.publicProduction : c.privateProduction)[m.id] =
          output;
        (owner === "public" ? c.publicUtilization : c.privateUtilization)[
          m.id
        ] = potential ? output / potential : 0;
        c.gdpValueAdded += Math.max(
          0,
          output * m.value -
            recipe(c, m).reduce(
              (n, [id, q]) => n + q * output * D.getMaterial(id).value,
              0,
            ),
        );
        c.productionCosts[m.id] = Math.max(
          c.productionCosts[m.id],
          inputsCost / Math.max(1e-15, output),
        );
        if (m.natural && output > 0) {
          const dep = c.naturalDeposits[m.id];
          const assets = owner === "public" ? c.buildings : c.privateBuildings;
          const land = Math.min(
            dep.land,
            output,
            m.id === "crude_oil"
              ? (assets.oil_well || 0) * m.baseOutput
              : Infinity,
          );
          dep.land -= land;
          dep.sea = Math.max(0, dep.sea - (output - land));
          if (syncDepositExplorations(c, m.id) && c.id === s.playerCountryId)
            note(s, c, `El depósito de ${m.label.toLowerCase()} se agotó.`);
        }
      }
      if (c.nationalizedResources?.[m.id]) {
        if (c.publicProduction[m.id] > DEPOSIT_EPSILON)
          c.outputReasons[m.id] = "";
        else if (!scalarTech(c, m.technology))
          c.outputReasons[m.id] = "Tecnología pendiente";
        else if (!(c.buildings[m.unlock] > 0))
          c.outputReasons[m.id] = "Falta instalación pública";
        else
          c.outputReasons[m.id] =
            "Funcionarios pagos, energía, insumos o capacidad insuficientes";
      }
      if (m.natural) {
        const remaining = depositRemaining(c, m.id),
          installations =
            (c.buildings[m.unlock] || 0) + (c.privateBuildings[m.unlock] || 0),
          totalOutput = c.publicProduction[m.id] + c.privateProduction[m.id];
        if (!c.naturalDeposits[m.id])
          c.outputReasons[m.id] = "Depósito no descubierto";
        else if (remaining === 0) c.outputReasons[m.id] = "Depósito agotado";
        else if (!scalarTech(c, m.technology))
          c.outputReasons[m.id] = "Tecnología pendiente";
        else if (installations <= 0)
          c.outputReasons[m.id] = "Falta instalación";
        else if (totalOutput > DEPOSIT_EPSILON) c.outputReasons[m.id] = "";
        else if (
          freeStock(c, "public", m) + freeStock(c, "private", m) <=
          DEPOSIT_EPSILON
        )
          c.outputReasons[m.id] = "Almacenamiento compatible lleno";
        else
          c.outputReasons[m.id] = "Personal, energía o capacidad insuficiente";
      }
    }
    husbandry(s, c);
    Object.assign(c.nutrition, {
      need: population(c) * daysInMonth(s.date), days: daysInMonth(s.date),
      aidSpent: 0, aidRations: 0, aidStockValue: 0,
    });
    for (const m of materials) {
      c.householdDemand[m.id] =
        ((useRate(m) * population(c)) / 12) *
        clamp(0.45 + (c.realGdp * 1e9) / population(c) / 35000, 0.45, 1.8) *
        clamp(1 + H.activeEventEffects(c, s).demand, 0.3, 1.4);
      if (D.foodProfiles[m.id])
        c.householdDemand[m.id] = c.nutrition.need * m.household / foodBasket;
      if (durableYears[m.id]) {
        const flow = c.householdDemand[m.id],
          held = c.durableOwnership[m.id],
          wear = held / (durableYears[m.id] * 12),
          target = flow * 12 * durableYears[m.id];
        c.durableOwnership[m.id] = Math.max(0, held - wear);
        c.householdDemand[m.id] = clamp(
          wear + (target - held) / 48,
          0,
          flow * 2,
        );
      }
      c.householdConsumed[m.id] = 0;
      c.needs[m.id] = c.householdDemand[m.id];
    }
    for (const m of materials) {
      const target = Math.min(
        production(c, "public", m) + production(c, "private", m),
        freeStock(c, "public", m) +
          freeStock(c, "private", m) +
          c.householdDemand[m.id] +
          c.materialConsumption[m.id],
      );
      for (const [id, ratio] of recipe(c, m)) c.needs[id] += target * ratio;
    }
    c.needs.feed += feedNeed(c) * 0.65;
    c.needs.fuel += c.energy.demand * 0.7 * 0.18;
    c.needs.uranium +=
      (c.buildings.nuclear_plant + c.privateBuildings.nuclear_plant) *
      1e6 *
      0.000003;
    for (const project of c.projects.filter((p) => p.progress < 100))
      for (const [id, n] of Object.entries(project.requirements))
        c.needs[id] += n / Math.max(1, D.getBuilding(project.typeId).months);
  }
  function husbandry(s, c) {
    for (const owner of owners) {
      const st = stocks(c, owner),
        herd = c.herds[owner];
      const sec = c.sectors.agriculture,
        assets = owner === "public" ? c.buildings : c.privateBuildings;
      let fill =
        owner === "public"
          ? sec.publicWorkers / Math.max(1, sec.requested)
          : sec.privateWorkers / Math.max(1, sec.privateJobs);
      if (owner === "public") fill *= sec.payrollCoverage ?? 1;
      let processing =
        (assets.slaughterhouse || 0) *
        100 *
        clamp(fill, 0, 1) *
        efficiency(c, "agriculture", owner) *
        Math.max(0.05, c.energy.served);
      for (const [type, factor] of [
        ["cattle", 1],
        ["pigs", 0.3],
        ["poultry", 0.01],
        ["sheep", 0.15],
      ]) {
        const n = herd[type],
          need = n * factor * 0.03,
          available =
            need * inputScale(s, c, owner, [["feed", need]], "agriculture"),
          fed = need ? clamp(available / need + 0.35, 0, 1) : 1;
        spendInput(
          s,
          c,
          owner,
          "feed",
          Math.min(available, need),
          "agriculture",
        );
        const rates = {
          cattle: [0.018, 0.002, 0.016],
          pigs: [0.16, 0.012, 0.14],
          poultry: [0.55, 0.035, 0.5],
          sheep: [0.04, 0.003, 0.035],
        }[type];
        const births = n * rates[0] * fed,
          deaths =
            n *
            (rates[1] + (1 - fed) * 0.025) *
            (1 - techBonus(c, "agriculture", "resilience")),
          capacity =
            c.land.agricultureHa *
            (type === "poultry" ? 10 : type === "pigs" ? 2 : 1);
        herd[type] = Math.min(
          Math.max(0, n + births - deaths),
          Math.max(n * 0.99, capacity),
        );
        const slaughter = Math.min(
          herd[type] * rates[2],
          processing / Math.max(0.0001, factor * 0.25),
          freeStock(c, owner, D.getMaterial("meat")) /
            Math.max(0.0001, factor * 0.25),
        );
        processing -= slaughter * factor * 0.25;
        herd[type] -= slaughter;
        const add = (id, quantity) => {
          if (owner === "private" && c.nationalizedResources?.[id]) return;
          const m = D.getMaterial(id),
            actual = Math.min(quantity, freeStock(c, owner, m));
          st[id] += actual;
          c.materialProduction[id] += actual;
          (owner === "public" ? c.publicProduction : c.privateProduction)[id] +=
            actual;
          c.gdpValueAdded += actual * m.value;
        };
        add("meat", slaughter * factor * 0.25);
        add("raw_leather", slaughter * factor * 0.015);
        if (type === "cattle") add("milk", n * 0.08 * fed);
        if (type === "sheep") add("wool", n * 0.0003 * fed);
      }
    }
  }
  function purchaseDomestic(s, c, m, request) {
    let served = 0;
    for (const owner of ["private", "public"]) {
      const consumer = professionalUse[m.id] ? "private" : "household",
        price = s.market.resourcePrices[m.id],
        tax = (price * c.taxes.vat) / 100,
        available = stocks(c, owner)[m.id],
        q = Math.min(
          request - served,
          available,
          Math.max(
            0,
            consumer === "private"
              ? c.finance.privateCash
              : c.finance.householdCash,
          ) / Math.max(1e-15, price + tax),
        );
      if (q <= 0) continue;
      stocks(c, owner)[m.id] -= q;
      transfer(s, c, consumer, owner, q * price, "Consumo nacional");
      transfer(s, c, consumer, "public", q * tax, "IVA");
      c.finance.taxes += q * tax;
      c.finance.taxBases.vat += q * price;
      c.materialConsumption[m.id] += q;
      c.householdConsumed[m.id] += q;
      if (durableYears[m.id]) c.durableOwnership[m.id] += q;
      if (owner === "private" && consumer !== "private") {
        c.sectors[m.sector].revenue += q * price;
        c.sectors[m.sector].profit += q * price;
      }
      served += q;
    }
    return served;
  }
  function consume(s, c, remaining = false) {
    consumeFood(s, c, remaining);
    for (const m of materials
      .filter((m) => useRate(m) > 0 && !D.foodProfiles[m.id])
      .sort(
        (a, b) =>
          (a.sector === "agriculture" ? -1 : 1) -
          (b.sector === "agriculture" ? -1 : 1),
      )) {
      const want = Math.max(
        0,
        c.householdDemand[m.id] - c.householdConsumed[m.id],
      );
      purchaseDomestic(s, c, m, want);
    }
    if (remaining) {
      let wanted = 0,
        got = 0;
      for (const m of materials.filter((m) => m.household > 0 && !D.foodProfiles[m.id])) {
        const essential = m.sector === "agriculture" ? 3 : 1;
        const demand = c.householdDemand[m.id];
        wanted += essential;
        got +=
          essential *
          (demand ? Math.min(1, c.householdConsumed[m.id] / demand) : 1);
        c.shortages[m.id] = Math.max(0, demand - c.householdConsumed[m.id]);
      }
      c.consumptionCoverage = wanted ? got / wanted : 1;
    }
    c.goodsBenefits = finalGoodsBenefits(c);
  }
  function exportable(c, owner, m) {
    const total = c.publicStocks[m.id] + c.privateStocks[m.id],
      foodReserve = D.foodProfiles[m.id] && c.nutrition
        ? total * Math.min(1, population(c) * c.nutrition.protectedDays / Math.max(1, storedRations(c)))
        : 0,
      protectedStock = Math.max(c.stockMinimum[m.id], c.needs[m.id] || 0, foodReserve);
    return Math.max(
      0,
      stocks(c, owner)[m.id] -
        Math.max(
          total ? (protectedStock * stocks(c, owner)[m.id]) / total : 0,
          owner === "public" && c.tradePolicies?.[m.id]?.autoImport
            ? c.tradePolicies[m.id].importBelow
            : 0,
        ),
    );
  }
  function transportCapacity(c) {
    return (
      (c.infrastructureAssets.port * 300000 +
        c.infrastructureAssets.airport * 2000 +
        c.infrastructureAssets.rail * 40 +
        c.infrastructureAssets.roads * 20 +
        population(c) * 0.1) *
      (1 +
        scalarTech(c, "intermodal") * 0.08 +
        techBonus(c, "services", "logistics") +
        techBonus(c, "infrastructure", "logistics"))
    );
  }
  function wasteReceptionCapacity(c, m) {
    if (!m.waste) return 0;
    const total = (m.id === "recyclables" ? 0 :
      (c.buildings.waste_treatment + c.privateBuildings.waste_treatment) * 20000)
      + (m.id === "organic_waste" ? (c.buildings.biomass_plant + c.privateBuildings.biomass_plant) * 20000
        + (c.buildings.compost_plant + c.privateBuildings.compost_plant) * 9000 : 0)
      + (m.id === "recyclables" ? (c.buildings.recycling_plant + c.privateBuildings.recycling_plant) * 12000 : 0);
    return Math.max(0, total - c.publicStocks[m.id] - c.privateStocks[m.id]);
  }
  function exchange(
    s,
    from,
    to,
    m,
    requested,
    ownerFrom = "private",
    ownerTo = "private",
    agreement = null,
    automatic = false,
  ) {
    if (from.id === to.id || to.importsBanned || to.importBans[m.id]) return 0;
    const price = s.market.resourcePrices[m.id],
      duty = (agreement ? agreement.tariff : to.taxes.imports) / 100,
      exportDuty = from.taxes.exports / 100,
      freight = Math.abs(price) * (from.region === to.region ? 0.01 : 0.035);
    let q = Math.min(
      requested,
      exportable(from, ownerFrom, m),
      freeStock(to, ownerTo, m),
      Math.max(0, transportCapacity(from) - (from.transported || 0)) /
        volumePerUnit(m),
      Math.max(0, transportCapacity(to) - (to.transported || 0)) /
        volumePerUnit(m),
    );
    if (m.waste) {
      q = Math.min(q, wasteReceptionCapacity(to, m));
    }
    if (price >= 0)
      q = Math.min(
        q,
        Math.max(0, cash(to, ownerTo)) /
          Math.max(1e-15, price * (1 + duty) + freight),
      );
    else
      q = Math.min(
        q,
        Math.max(0, cash(from, ownerFrom)) / Math.max(1e-15, -price + freight),
      );
    if (q <= 1e-9) return 0;
    stocks(from, ownerFrom)[m.id] -= q;
    stocks(to, ownerTo)[m.id] += q;
    const value = q * price;
    book(s, from, "Exportación", value, ownerFrom, m.label);
    book(s, to, "Importación", -value, ownerTo, m.label);
    const importTax = Math.max(0, value * duty),
      exportTax = Math.max(0, value * exportDuty);
    if (ownerTo !== "public")
      transfer(s, to, ownerTo, "public", importTax, "Arancel");
    if (ownerFrom !== "public")
      transfer(
        s,
        from,
        ownerFrom,
        "public",
        exportTax,
        "Derecho de exportación",
      );
    if (ownerTo === "private" && to.finance.taxBases)
      to.finance.taxBases.imports += Math.max(0, value);
    if (ownerFrom === "private" && from.finance.taxBases)
      from.finance.taxBases.exports += Math.max(0, value);
    to.finance.taxes += ownerTo === "private" ? importTax : 0;
    from.finance.taxes += ownerFrom === "private" ? exportTax : 0;
    const payer = price < 0 ? from : to,
      who = price < 0 ? ownerFrom : ownerTo;
    book(s, payer, "Flete internacional", -q * freight, who, m.label);
    s.financeWorld.bank += q * freight;
    from.resourceExports[m.id] += q;
    to.resourceImports[m.id] += q;
    from.grossExports += value;
    to.grossImports += value;
    from.tradeBalance += value;
    to.tradeBalance -= value;
    from.transported = (from.transported || 0) + q * volumePerUnit(m);
    to.transported = (to.transported || 0) + q * volumePerUnit(m);
    if (ownerFrom === "private") {
      from.sectors[m.sector].revenue += Math.max(0, value);
      from.sectors[m.sector].profit += value - exportTax;
    }
    s.market.trades.push({
      commodity: m.id,
      from: from.id,
      to: to.id,
      quantity: q,
      value,
      agreement: agreement?.id || null,
      automatic, ownerFrom, ownerTo,
    });
    if (automatic && from.id === s.playerCountryId && from.autoTradeReport?.[m.id]) {
      const report = from.autoTradeReport[m.id];
      report[ownerFrom === "public" ? "soldPublic" : "soldPrivate"] += q;
      report[ownerFrom === "public" ? "receivedPublic" : "receivedPrivate"] += value;
      report.tax += ownerFrom === "private" ? exportTax : 0;
      report.buyer = to.id;
    }
    return q;
  }
  function trade(s) {
    const countries = Object.values(s.countries).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    s.market.trades = [];
    for (const c of countries) c.transported = 0;
    const userCountry = s.countries[s.playerCountryId];
    userCountry.autoTradeReport = map((m) => ({
      offeredPublic: userCountry.tradePolicies?.[m.id]?.sell === false ? 0 : exportable(userCountry, "public", m),
      offeredPrivate: userCountry.tradePolicies?.[m.id]?.sell === false ? 0 : exportable(userCountry, "private", m),
      soldPublic: 0, soldPrivate: 0, receivedPublic: 0, receivedPrivate: 0,
      tax: 0, buyer: null, tick: s.tick,
    }));
    for (const a of s.agreements.filter((a) => a.active && a.remaining > 0)) {
      a.lastQuantity = 0;
      const from = s.countries[a.from],
        to = s.countries[a.to],
        m = D.getMaterial(a.resource);
      if (to.importsBanned || to.importBans[m.id]) {
        a.status = "Suspendido por prohibición";
        a.remaining--;
        if (!a.remaining) a.active = false;
        continue;
      }
      const need = m.waste
        ? a.quantity
        : Math.max(
            0,
            to.needs[m.id] * 2 - to.publicStocks[m.id] - to.privateStocks[m.id],
          );
      a.lastQuantity = exchange(
        s,
        from,
        to,
        m,
        Math.min(a.quantity, need),
        a.owner || "public",
        "private",
        a,
        true,
      );
      a.status = a.lastQuantity
        ? "Operativo"
        : "Sin excedente, demanda, fondos o capacidad";
      a.remaining--;
      if (!a.remaining) {
        a.active = false;
        a.status = "Finalizado";
      }
    }
    for (const m of materials) {
      const sellers = countries
        .flatMap((c) =>
          owners.map((owner) => ({
            c,
            owner,
            stock:
              c.tradePolicies?.[m.id]?.sell === false
                ? 0
                : exportable(c, owner, m),
          })),
        )
        .filter((x) => x.stock > 1e-6);
      const buyers = countries
        .filter((c) => !c.importsBanned && !c.importBans[m.id])
        .flatMap((c) => [
          {
            c,
            owner: "private",
            need: m.waste ? wasteReceptionCapacity(c, m) : Math.max(
              0, c.needs[m.id] * 1.4 -
                c.publicStocks[m.id] -
                c.privateStocks[m.id],
            ),
          },
          {
            c,
            owner: "public",
            need: c.tradePolicies?.[m.id]?.autoImport
              ? Math.max(
                  0,
                  c.tradePolicies[m.id].importBelow - c.publicStocks[m.id],
                )
              : 0,
          },
        ])
        .filter((x) => x.need > 1e-6)
        .sort((a, b) => b.need / population(b.c) - a.need / population(a.c));
      for (const buyer of buyers) {
        sellers.sort((a, b) => {
          const score = (x) =>
            efficiency(x.c, m.sector, x.owner) * 20 +
            (buyer.c.relations[x.c.id] || 50) +
            (x.c.region === buyer.c.region ? 10 : 0);
          return score(b) - score(a) || a.c.id.localeCompare(b.c.id);
        });
        for (const seller of sellers) {
          if (buyer.need <= 1e-6) break;
          if (seller.c.id === buyer.c.id || seller.stock <= 1e-6) continue;
          const sold = exchange(
            s,
            seller.c,
            buyer.c,
            m,
            Math.min(buyer.need, seller.stock),
            seller.owner,
            buyer.owner,
            null,
            true,
          );
          buyer.need -= sold;
          seller.stock -= sold;
        }
      }
    }
  }
  function waste(s, c) {
    c.uncollectedWaste ||= map(0);
    c.composted = 0;
    for (const [id, weight] of [
      ["organic_waste", 0.014],
      ["recyclables", 0.009],
      ["waste", 0.012],
      ["biomass", 0.001],
    ]) {
      const generated =
          (id === "biomass" ? c.land.agricultureHa : population(c)) * weight,
        m = D.getMaterial(id),
        collect = Math.min(
          generated + c.uncollectedWaste[id],
          freeStock(c, "public", m),
        );
      c.uncollectedWaste[id] += generated - collect;
      c.publicStocks[id] += collect;
      c.materialProduction[id] += generated;
      c.publicProduction[id] += generated;
    }
    const staffing = clamp(
        c.sectors.services.publicWorkers /
          Math.max(1, c.sectors.services.requested),
        0,
        1,
      ),
      boost = 1 + techBonus(c, "services", "waste");
    for (const owner of owners) {
      const st = stocks(c, owner),
        bs = owner === "public" ? c.buildings : c.privateBuildings,
        treat = bs.waste_treatment * 20000 * staffing * boost;
      const compostMax = Math.min(st.organic_waste / 3,
        bs.compost_plant * 3000 * staffing * boost * clamp(c.energy.served, 0, 1),
        freeStock(c, owner, D.getMaterial("biomass")));
      const compostCost = compostMax * 0.00000001;
      const composted = Math.min(compostMax,
        Math.max(0, cash(c, owner)) / Math.max(1e-15, compostCost / Math.max(1, compostMax)));
      if (composted > 0) {
        st.organic_waste -= composted * 3;
        st.biomass += composted;
        c.composted += composted;
        c.materialConsumption.organic_waste += composted * 3;
        c.materialProduction.biomass += composted;
        (owner === "public" ? c.publicProduction : c.privateProduction).biomass += composted;
        const paid = composted * 0.00000001;
        book(s, c, "Operación de compostaje", -paid, owner, "Residuos orgánicos");
        s.financeWorld.bank += paid;
        if (owner === "public") c.finance.spending += paid;
      }
      for (const id of ["waste", "organic_waste"]) {
        let n = Math.min(st[id], treat / 2);
        st[id] -= n;
        c.materialConsumption[id] += n;
        if (owner === "public") {
          const uncollected = Math.min(
            c.uncollectedWaste[id],
            Math.max(0, treat / 2 - n),
          );
          c.uncollectedWaste[id] -= uncollected;
          c.materialConsumption[id] += uncollected;
        }
      }
      const recycled = Math.min(
        st.recyclables,
        bs.recycling_plant * 12000 * staffing * boost,
      );
      st.recyclables -= recycled;
      c.materialConsumption.recyclables += recycled;
      const recovered = Math.min(
        c.blockedRawMaterials?.includes("minerals") ? 0 : recycled * 0.4,
        freeStock(c, owner, D.getMaterial("minerals")),
      );
      st.minerals += recovered;
      c.materialProduction.minerals += recovered;
      (owner === "public"
        ? c.publicProduction
        : c.privateProduction
      ).minerals += recovered;
    }
    c.wasteBurden =
      (c.publicStocks.waste +
        c.privateStocks.waste +
        c.publicStocks.organic_waste +
        c.privateStocks.organic_waste +
        sum(c.uncollectedWaste) * 3) /
      Math.max(1, population(c));
    for (const m of materials)
      for (const owner of owners) {
        const st = stocks(c, owner);
        const loss =
          m.storage === "cold"
            ? st[m.id] * 0.012 * (1 - techBonus(c, "agriculture", "cost"))
            : m.id === "wool"
              ? st[m.id] * 0.001
              : 0;
        st[m.id] -= loss;
        c.monthlyResourceLedger.losses[m.id] += loss;
      }
  }
  function availableLand(c) {
    const l = c.land;
    return Math.max(
      0,
      l.totalHa -
        l.residentialHa -
        l.agricultureHa -
        l.industrialHa -
        l.restrictedHa,
    );
  }
  function constructionWorkforce(c) {
    return Math.max(
      0,
      c.laborSnapshot.unemployed * 1e6 + (c.constructionWorkers || 0),
    );
  }
  function constructionPreview(s, id, factor = 1) {
    const c = s.countries[s.playerCountryId],
      b = D.getBuilding(id);
    if (!b) throw Error("Construcción no válida.");
    if (b.storage && !b.storageFor)
      throw Error("Ese almacén antiguo fue distribuido entre recursos. Construí el almacén específico desde la ficha del recurso.");
    factor = needNumber(factor, 1, 999);
    if (!Number.isInteger(factor)) throw Error("Construí módulos enteros.");
    const land = (b.landHa || b.agricultureHa || 0) * factor;
    let blocked = "";
    if (!scalarTech(c, b.technology))
      blocked = "Investigar " + D.getTechnology(b.technology).label;
    if (b.coastal && D.landlocked.includes(c.id))
      blocked = "El país no tiene acceso marítimo";
    if (b.deposit) {
      const dep = c.naturalDeposits[b.deposit];
      const site = b.offshore ? "sea" : "land";
      if (!dep)
        blocked = `Hace falta descubrir un depósito ${b.offshore ? "marítimo" : "terrestre"}`;
      else if (depositRemaining(c, b.deposit, site) === 0)
        blocked = `El depósito ${b.offshore ? "marítimo" : "terrestre"} está agotado`;
    }
    if (b.energyKind === "hydro" && c.land.areaKm2 < 100)
      blocked = "Sin emplazamiento hidroeléctrico apto";
    if (
      b.energyKind === "geothermal" &&
      ![
        "ISL",
        "IDN",
        "JPN",
        "NZL",
        "KEN",
        "ITA",
        "USA",
        "MEX",
        "PHL",
        "CHL",
        "ECU",
        "TUR",
      ].includes(c.id)
    )
      blocked = "Potencial geotérmico no habilitado";
    if (
      b.housingUnits &&
      (sum(c.housingStock) + b.housingUnits * factor) * 3.2 * 1e6 >
        c.land.areaKm2 * 60000
    )
      blocked = "La densidad residencial excedería el techo del escenario";
    const convertible = b.housingUnits
      ? Math.min(c.land.agricultureHa, Math.max(0, land - availableLand(c)))
      : 0;
    if (land > availableLand(c) + convertible + 1e-8)
      blocked = "No hay suelo disponible; considerá densificar";
    if (
      b.irrigatedHa &&
      c.land.irrigatedHa + b.irrigatedHa * factor > c.land.agricultureHa
    )
      blocked = "No hay suficientes hectáreas agrícolas sin riego";
    const requests = Object.fromEntries(
      Object.entries(b.requirements).map(([id, n]) => [id, n * factor]),
    );
    const materialCost = Object.entries(requests).reduce(
      (n, [id, q]) => n + q * Math.max(0, s.market.resourcePrices[id]),
      0,
    );
    const materialQuote = Object.entries(requests).map(([resource, required]) => {
      const stock = c.publicStocks[resource] || 0;
      const committed = c.projects.filter((p) => p.progress < 100).reduce((n, p) =>
        n + (p.requirements?.[resource] || 0) * (1 - p.progress / 100), 0);
      const free = Math.max(0, stock - committed);
      const missing = Math.max(0, required - free);
      const price = Math.max(0, s.market.resourcePrices[resource]);
      return { id: resource, required, stock, committed, free, missing,
        purchaseCost: missing * price, ownValue: Math.min(required, free) * price };
    });
    const purchaseCost = materialQuote.reduce((n, x) => n + x.purchaseCost, 0);
    const ownMaterialValue = materialQuote.reduce((n, x) => n + x.ownValue, 0);
    const laborNeed = b.laborNeed * 1000 * factor,
      salary = c.sectors.infrastructure.salary,
      wageIndex = clamp(salary / 1000, 0.1, 10),
      skillMatch =
        clamp(c.education / Math.max(1, b.skillNeed), 0.2, 1) *
        (c.goodsBenefits?.construction || 1),
      laborAvailability = clamp(
        (c.laborSnapshot.unemployed * 1e6) / Math.max(1, laborNeed),
        0.1,
        1,
      );
    const concurrent = c.projects.filter((p) => p.progress < 100).length + 1,
      allocatedWorkers = constructionWorkforce(c) / concurrent,
      workMonths = (laborNeed * b.months) / skillMatch,
      estimatedMonths =
        allocatedWorkers > 0 ? workMonths / allocatedWorkers : null;
    const laborCost = (workMonths * salary) / 1e9;
    return {
      id,
      factor,
      baseCost: b.fixedCost * factor,
      laborCost,
      totalCost: b.fixedCost * factor + laborCost + materialCost,
      materialCost,
      materialQuote,
      purchaseCost,
      ownMaterialValue,
      treasuryEstimate: b.fixedCost * factor + laborCost + purchaseCost,
      landHa: land,
      convertAgricultureHa: convertible,
      requirements: requests,
      laborNeed,
      salary,
      skillMatch: skillMatch * 100,
      laborAvailability: laborAvailability * 100,
      wageIndex,
      estimatedMonths,
      allocatedWorkers,
      speed: estimatedMonths ? 100 / estimatedMonths : 0,
      energyShare: b.energyOutput
        ? ((b.energyOutput * factor) /
            Math.max(0.00001, c.electricityDemandTWh)) *
          100
        : null,
      unlocks: materials.filter((m) => m.unlock === id).map((m) => m.id),
      productionImpact: materials.filter((m) => m.unlock === id).map((m) => ({
        id: m.id, monthly: m.baseOutput * factor,
        inputs: Object.fromEntries(recipe(c, m).map(([key, value]) => [key, value * m.baseOutput * factor])),
        operators: b.laborNeed * 1000 * factor /
          Math.max(1, materials.filter((x) => x.unlock === id).length),
      })),
      blocked,
      quantity: (b.quantity || 1) * factor,
      unit: b.unit || "instalaciones",
      maintenance: b.fixedCost * factor * 0.002,
    };
  }
  function queueConstruction(s, id, factor = 1, acceptConversion = false) {
    const c = player(s),
      b = D.getBuilding(id),
      p = constructionPreview(s, id, factor);
    if (p.blocked) throw Error(p.blocked);
    if (p.convertAgricultureHa > 0 && !acceptConversion)
      throw Error(
        `Esta obra convierte ${p.convertAgricultureHa.toFixed(2)} ha agrícolas. Confirmá la conversión.`,
      );
    if (p.convertAgricultureHa) {
      const share = c.land.irrigatedHa / Math.max(1, c.land.agricultureHa);
      c.land.agricultureHa -= p.convertAgricultureHa;
      c.land.irrigatedHa -= p.convertAgricultureHa * share;
    }
    if (b.housingUnits) c.land.residentialHa += p.landHa;
    else if (b.agricultureHa) c.land.agricultureHa += p.landHa;
    else c.land.industrialHa += p.landHa;
    const project = {
      id: `project-${c.nextProjectId++}`,
      typeId: id,
      sector: b.sector,
      startedAt: L.monthLabel(s.date),
      progress: 0,
      monthsActive: 0,
      baseCost: p.baseCost,
      totalCost: p.totalCost,
      spent: 0,
      laborSpent: 0,
      requirements: p.requirements,
      consumed: map(0),
      blockedBy: [],
      completedAt: null,
      v6: true,
      factor,
      landReserved: true,
      laborNeed: p.laborNeed,
    };
    c.projects.push(project);
    if (s.adminMode) {
      finishConstruction(s, c, project, b);
      const completed = c.projects.filter((item) => item.progress === 100).slice(-40);
      c.projects = c.projects.filter((item) => item.progress < 100 || completed.includes(item));
      note(s, c, `${b.label}: construcción inmediata en modo admin, sin costo ni materiales (${p.quantity} ${p.unit}).`);
    } else note(s, c, `${b.label}: obra iniciada (${p.quantity} ${p.unit}).`);
    return project;
  }
  function finishConstruction(s, c, p, b) {
    const factor = p.factor || 1;
    p.progress = 100;
    p.completedAt = L.monthLabel(s.date);
    c.buildings[b.id] += factor;
    c.staffingVersion = (c.staffingVersion || 0) + 1;
    if (b.storage && !b.storageFor)
      spreadLegacySpace(c, "public", b.storage, b.storageAmount * factor);
    if (b.housingUnits) c.housingStock.new += b.housingUnits * factor;
    if (b.housingRepairUnits) {
      const repaired = Math.min(c.housingStock.repair, b.housingRepairUnits * factor);
      c.housingStock.repair -= repaired;
      c.housingStock.normal += repaired;
    }
    if (b.irrigatedHa) c.land.irrigatedHa += b.irrigatedHa * factor;
    if (c.infrastructureAssets[b.id] !== undefined)
      c.infrastructureAssets[b.id] += (b.quantity || 1) * factor;
    if (b.livestock) c.herds.public[b.livestock] += b.heads * factor;
    c.sectors[b.sector].requested += Math.max(2, b.laborNeed * 200 * factor);
    updateCapacity(c);
    note(s, c, `${b.label} terminada; la capacidad entra en operación el próximo mes.`);
  }
  function projects(s, c) {
    let free = constructionWorkforce(c);
    const active = c.projects.filter((p) => p.progress < 100),
      allocation = free / Math.max(1, active.length);
    c.constructionWorkers = 0;
    for (const p of c.projects) {
      if (p.progress >= 100) continue;
      const b = D.getBuilding(p.typeId),
        factor = p.factor || 1,
        need = p.laborNeed || b.laborNeed * 1000 * factor;
      const skill =
          clamp(c.education / b.skillNeed, 0.2, 1) *
          (c.goodsBenefits?.construction || 1),
        remainingWork = (need * b.months * (1 - p.progress / 100)) / skill,
        hired = Math.min(allocation, remainingWork, free);
      free -= hired;
      c.constructionWorkers += hired;
      p.workers = hired;
      const laborRatio = hired / Math.max(1, need),
        desired = Math.min(
          100 - p.progress,
          (100 / b.months) * skill * laborRatio,
        );
      let f = 1;
      p.blockedBy = [];
      for (const [id, n] of Object.entries(p.requirements)) {
        const needed = (n * desired) / 100;
        f = Math.min(f, needed ? c.publicStocks[id] / needed : 1);
        if (needed > c.publicStocks[id]) p.blockedBy.push(id);
      }
      const pay =
        ((p.baseCost || 0) * desired) / 100 +
        (hired * c.sectors.infrastructure.salary) / 1e9;
      f = Math.min(f, affordable(c, "public", pay));
      if (!hired) p.blockedBy.push("trabajadores");
      if (pay > Math.max(0, c.reserves)) p.blockedBy.push("tesoro");
      const progress = desired * clamp(f, 0, 1);
      if (progress <= 0) {
        c.constructionWorkers -= hired;
        free += hired;
        p.workers = 0;
        continue;
      }
      c.constructionWorkers -= hired * (1 - f);
      free += hired * (1 - f);
      p.workers = hired * f;
      const cost = ((p.baseCost || 0) * progress) / 100,
        wage = ((hired * c.sectors.infrastructure.salary) / 1e9) * f;
      transfer(
        s,
        c,
        "public",
        "private",
        cost,
        "Obra: servicios de construcción",
      );
      transfer(s, c, "public", "household", wage, "Salarios de obra");
      c.finance.spending += cost + wage;
      c.sectors[b.sector].executed += cost + wage;
      p.spent += cost + wage;
      p.laborSpent += wage;
      for (const [id, n] of Object.entries(p.requirements)) {
        const used = (n * progress) / 100;
        c.publicStocks[id] -= used;
        p.consumed[id] = (p.consumed[id] || 0) + used;
        c.materialConsumption[id] += used;
      }
      p.progress = Math.min(100, p.progress + progress);
      p.monthsActive++;
      if (p.progress >= 99.999999) {
        finishConstruction(s, c, p, b);
      }
    }
    syncDemographics(c);
    const completed = c.projects.filter((p) => p.progress === 100).slice(-40);
    c.projects = c.projects.filter(
      (p) => p.progress < 100 || completed.includes(p),
    );
    return free;
  }
  function passiveHousing(s, c, freeWorkers) {
    const program = c.housingProgram,
      sector = c.sectors.infrastructure;
    let free = Math.max(0, freeWorkers || 0);
    const run = (buildingId, budgetCap, requested, mode) => {
      const b = D.getBuilding(buildingId),
        statusKey = mode === "build" ? "lastBuildStatus" : "lastRepairStatus",
        outputKey = mode === "build" ? "lastBuildUnits" : "lastRepairUnits";
      program[outputKey] = 0;
      if (budgetCap <= 0 || requested <= 0) {
        program[statusKey] = "Sin presupuesto o cuadrilla asignada";
        return;
      }
      if (!free) {
        program[statusKey] = "Sin desocupados disponibles";
        return;
      }
      const workers = Math.min(requested, free),
        skill =
          clamp(c.education / b.skillNeed, 0.2, 1) *
          (c.goodsBenefits?.construction || 1);
      let factor =
        (workers / Math.max(1, b.laborNeed * 1000)) * (skill / b.months);
      if (mode === "build") {
        const densityRoom =
          (c.land.areaKm2 * 60000) / 1e6 / 3.2 - sum(c.housingStock);
        factor = Math.min(
          factor,
          Math.max(0, densityRoom) / Math.max(1e-12, b.housingUnits),
          Math.max(0, availableLand(c)) / Math.max(1e-12, b.landHa),
        );
      } else
        factor = Math.min(
          factor,
          c.housingStock.repair / Math.max(1e-12, b.housingRepairUnits),
        );
      if (factor <= 1e-12) {
        program[statusKey] =
          mode === "build"
            ? "Sin suelo residencial libre o capacidad demográfica"
            : "No hay viviendas pendientes de refacción";
        return;
      }
      const wage = (workers * sector.salary) / 1e9,
        base = b.fixedCost * factor,
        fullCost = wage + base;
      let share = Math.min(
        1,
        budgetCap / Math.max(1e-12, fullCost),
        Math.max(0, c.reserves) / Math.max(1e-12, fullCost),
      );
      for (const [id, amount] of Object.entries(b.requirements))
        share = Math.min(
          share,
          (c.publicStocks[id] || 0) / Math.max(1e-12, amount * factor),
        );
      if (share <= 1e-12) {
        const missing = Object.entries(b.requirements)
          .filter(([id, amount]) => (c.publicStocks[id] || 0) < amount * factor)
          .map(([id]) => D.getMaterial(id)?.label || id);
        program[statusKey] = missing.length
          ? "Faltan materiales: " + missing.join(", ")
          : "Tesoro insuficiente";
        return;
      }
      const executedFactor = factor * share,
        executedWorkers = workers * share,
        executedWage = wage * share,
        executedBase = base * share;
      free -= executedWorkers;
      c.constructionWorkers += executedWorkers;
      transfer(
        s,
        c,
        "public",
        "private",
        executedBase,
        mode === "build"
          ? "Programa pasivo de vivienda"
          : "Programa pasivo de refacción",
      );
      transfer(s, c, "public", "household", executedWage, "Salarios de obra");
      sector.executed += executedBase + executedWage;
      c.finance.spending += executedBase + executedWage;
      for (const [id, amount] of Object.entries(b.requirements)) {
        const used = amount * executedFactor;
        c.publicStocks[id] -= used;
        c.materialConsumption[id] += used;
      }
      if (mode === "build") {
        c.housingStock.new += b.housingUnits * executedFactor;
        c.land.residentialHa += b.landHa * executedFactor;
        c.buildings.housing += executedFactor;
        program[outputKey] = b.housingUnits * executedFactor * 1e6;
      } else {
        const repaired = Math.min(
          c.housingStock.repair,
          b.housingRepairUnits * executedFactor,
        );
        c.housingStock.repair -= repaired;
        c.housingStock.normal += repaired;
        program[outputKey] = repaired * 1e6;
      }
      program[statusKey] =
        share < 0.999
          ? "Avance parcial por caja, tope del programa o materiales"
          : "Programa ejecutado";
    };
    run("housing", program.buildBudget, program.buildWorkers, "build");
    run(
      "housing_maintenance",
      program.repairBudget,
      program.repairWorkers,
      "repair",
    );
    syncDemographics(c);
    return free;
  }
  function education(s, c) {
    c.educationGraduates = 0;
    const sec = c.sectors.education;
    let remaining = sec.publicWorkers;
    const programs = [
      ...D.educationLevels.map((d) => ({
        d,
        p: c.educationPlan[d.id],
        b: buildings.find((b) => b.educationLevel === d.id),
      })),
      ...D.educationBranches.map((d) => ({
        d: { ...d, months: 24, skill: 65 },
        p: c.educationBranches[d.id],
        b: null,
      })),
    ];
    // This is a subdivision of the ministry's existing personnel, never additional workers.
    for (const { d, p, b } of programs) {
      const seats = b ? c.buildings[b.id] * b.seats : population(c) * 0.005;
      const actual = Math.min(
        p.staff,
        remaining,
        seats / 25,
        (p.budget * 1e9) / Math.max(1, p.salary),
      );
      remaining -= actual;
      p.actualStaff = actual;
      const salaryShare = (actual * sec.salary) / 1e9,
        operating = Math.max(0, p.budget - salaryShare),
        cost = Math.min(operating, Math.max(0, c.reserves));
      transfer(
        s,
        c,
        "public",
        "private",
        cost,
        "Material educativo e investigación",
      );
      sec.executed += cost;
      c.finance.spending += cost;
      p.executed = salaryShare + cost;
      const target = Math.min(seats, actual * 25),
        funded = clamp(p.executed / Math.max(1e-12, p.budget), 0, 1),
        quality =
          clamp(c.education / d.skill, 0.2, 1) *
          (1 + techBonus(c, "education", "education"));
      if (!p.cohorts)
        p.cohorts = Array(d.months).fill((target / d.months) * 0.8);
      const graduates = p.cohorts.shift() * funded * quality;
      p.cohorts.push((target / d.months) * funded);
      p.graduates = graduates;
      p.enrolled = sum(p.cohorts);
      p.skill = clamp(
        finite(p.skill, c.education) +
          (graduates / Math.max(1, population(c))) * 0.5,
        15,
        100,
      );
      c.educationGraduates += graduates;
    }
    c.researchScientists = Math.min(
      c.educationBranches.science.actualStaff,
      sec.publicWorkers * 0.12,
    );
    c.education = clamp(
      c.education +
        (c.educationGraduates / Math.max(1, population(c))) * 4 -
        (c.workPolicy.start < 18 ? (18 - c.workPolicy.start) * 0.006 : 0),
      15,
      100,
    );
  }
  function normalizeResearchQueue(c) {
    const r = c.research;
    if (!r.queue) {
      r.queue = [];
      if (r.project) r.queue.push({ ...r.project, kind: "research" });
      for (const ex of r.explorations.filter((x) => x.status === "En curso"))
        r.queue.push({ kind: "explore", explorationId: ex.id });
    }
    r.nextQueueId ||= 1;
    for (const item of r.queue)
      if (!item.queueId) item.queueId = r.nextQueueId++;
    r.project = r.queue[0]?.kind === "research" ? r.queue[0] : null;
    for (const ex of r.explorations) {
      if (!["En curso", "En espera"].includes(ex.status)) continue;
      ex.status =
        r.queue[0]?.kind === "explore" && r.queue[0].explorationId === ex.id
          ? "En curso"
          : "En espera";
    }
    return r.queue;
  }
  function researchQueuePreview(c, item = c.research.queue?.[0]) {
    if (!item) return null;
    const ex =
        item.kind === "explore"
          ? c.research.explorations.find((x) => x.id === item.explorationId)
          : null,
      task = ex || item,
      t = ex ? null : D.getTechnology(item.technology),
      months = ex ? (ex.offshore ? 18 : 12) : t.months,
      skill = ex ? (ex.offshore ? 65 : 40) : t.skill,
      referenceScientists = Math.max(
        1,
        population(c) * (ex ? 0.00001 : 0.00002),
      ),
      referenceBudget = Math.max(
        1e-12,
        c.gdp * (ex ? 0.00001 : 0.00002 * item.level),
      ),
      budget = Math.min(task.budget, referenceBudget, Math.max(0, c.reserves));
    const prerequisites = ex
      ? [ex.offshore ? "offshore_exploration" : "prospecting"]
      : t.requires;
    const reasons = [];
    if (!c.buildings.research_lab) reasons.push("Sin laboratorio público");
    if (!(c.researchScientists > 0)) reasons.push("Sin científicos asignados");
    if (!(c.education > 0)) reasons.push("Sin formación disponible");
    if (prerequisites.some((id) => !scalarTech(c, id)))
      reasons.push("Faltan tecnologías previas");
    if (!ex && scalarTech(c, t.id) < item.level - 1)
      reasons.push("Falta completar el nivel anterior");
    if (!(budget > 0)) reasons.push("Sin fondos disponibles");
    const capacity =
        clamp((c.researchScientists || 0) / referenceScientists, 0, 1) *
        clamp(c.buildings.research_lab / 0.1, 0, 1) *
        clamp(c.education / skill, 0, 1),
      rate = reasons.length
        ? 0
        : (100 / months) * capacity * (c.goodsBenefits?.research || 1),
      remaining = Math.max(0, 100 - task.progress),
      progress = Math.min(remaining, rate),
      cost = rate > 0 ? budget * Math.min(1, remaining / rate) : 0;
    return {
      progress,
      rate,
      cost,
      remainingMonths: rate > 0 ? Math.ceil(remaining / rate) : null,
      referenceScientists,
      referenceBudget,
      months,
      reasons,
      currentProgress: task.progress,
      label: ex
        ? `Exploración de ${D.getMaterial(ex.resource).label}${ex.offshore ? " (marítima)" : " (terrestre)"}`
        : `${t.label} · nivel ${item.level}`,
    };
  }
  function cancelResearchQueue(s, id) {
    const c = player(s),
      queue = normalizeResearchQueue(c),
      index = queue.findIndex((x) => x.queueId === Number(id));
    if (index < 0) throw Error("Proyecto no encontrado en la cola.");
    const [item] = queue.splice(index, 1);
    if (item.kind === "explore") {
      const ex = c.research.explorations.find(
        (x) => x.id === item.explorationId,
      );
      if (ex) ex.status = "Cancelada";
    }
    normalizeResearchQueue(c);
    return item;
  }
  function research(s, c) {
    const queue = normalizeResearchQueue(c),
      head = queue[0];
    if (!head) return;
    if (
      head.kind === "research" &&
      scalarTech(c, head.technology) >= head.level
    ) {
      queue.shift();
      note(
        s,
        c,
        `${D.getTechnology(head.technology).label}: el nivel en cola ya está disponible; se retira sin gasto.`,
      );
      normalizeResearchQueue(c);
      return;
    }
    const preview = researchQueuePreview(c, head);
    head.blockedBy = preview.reasons;
    if (!preview.progress) return;
    const active =
      head.kind === "explore"
        ? [c.research.explorations.find((x) => x.id === head.explorationId)]
        : [];
    const project = c.research.project;
    if (project) {
      const t = D.getTechnology(project.technology);
      const cost = preview.cost;
      transfer(s, c, "public", "private", cost, "Investigación: " + t.label);
      c.sectors.education.executed += cost;
      c.finance.spending += cost;
      project.progress = Math.min(100, project.progress + preview.progress);
      if (project.progress >= 100) {
        c.research.levels[t.id] = project.level;
        c.research.history.unshift({
          label: t.label,
          level: project.level,
          tick: s.tick,
        });
        c.research.project = null;
        queue.shift();
        note(s, c, `${t.label}: nivel ${project.level} completado.`);
      }
    }
    for (const ex of active) {
      const paid = preview.cost;
      transfer(s, c, "public", "private", paid, "Exploración geológica");
      c.finance.spending += paid;
      c.sectors.education.executed += paid;
      ex.progress = Math.min(100, ex.progress + preview.progress);
      if (ex.progress >= 100) {
        ex.progress = 100;
        queue.shift();
        const known = D.knownFields[ex.resource],
          potential = known
            ? known.split(" ").includes(c.id)
              ? 1
              : c.land.areaKm2 > 50000
                ? 0.08
                : 0.01
            : clamp(c.deposits[ex.resource] || 0, 0, 1);
        const chance = Math.min(
          0.35,
          0.04 + potential * 0.13 + scalarTech(c, "prospecting") * 0.02,
        );
        ex.probability = chance;
        if (ex.roll < chance && potential > 0.04) {
          const m = D.getMaterial(ex.resource),
            size =
              m.baseOutput *
              (24 + ex.sizeRoll * 120) *
              DISCOVERED_DEPOSIT_SCALE;
          c.naturalDeposits[m.id] ||= {
            land: 0,
            sea: 0,
            potential,
            studies: 0,
          };
          c.naturalDeposits[m.id][ex.offshore ? "sea" : "land"] += size;
          c.naturalDeposits[m.id].studies++;
          ex.status = "Depósito descubierto";
          ex.discovered = size;
        } else ex.status = "Sin hallazgo";
        note(
          s,
          c,
          `Exploración de ${D.getMaterial(ex.resource).label}: ${ex.status.toLowerCase()}.`,
        );
      }
    }
    normalizeResearchQueue(c);
  }
  function closeFinance(s, c) {
    let principal = 0,
      interest = 0;
    for (const loan of c.loans) {
      const due = loan.outstanding / Math.max(1, loan.remainingMonths),
        i = (loan.outstanding * loan.annualRate) / 1200 + (loan.arrears || 0);
      automaticFunding(s, c, due + i, "Servicio de deuda");
      const payInterest = Math.min(i, Math.max(0, c.reserves));
      book(s, c, "Intereses", -payInterest);
      s.financeWorld.bank += payInterest;
      interest += payInterest;
      loan.arrears = Math.max(0, i - payInterest);
      const paid = Math.min(due, Math.max(0, c.reserves));
      book(s, c, "Amortización de préstamo", -paid);
      s.financeWorld.bank += paid;
      loan.outstanding = Math.max(0, loan.outstanding - paid);
      if (paid >= due - 1e-12)
        loan.remainingMonths = Math.max(0, loan.remainingMonths - 1);
      loan.lastPayment = paid + payInterest;
      principal += paid;
    }
    c.loans = c.loans.filter((l) => l.outstanding > 1e-12 || l.arrears > 1e-12);
    const generalInterest = (c.finance.baseDebt * 0.04) / 12;
    automaticFunding(s, c, generalInterest, "Intereses de deuda general");
    const paidGeneralInterest = Math.min(
      generalInterest,
      Math.max(0, c.reserves),
    );
    book(s, c, "Intereses", -paidGeneralInterest);
    s.financeWorld.bank += paidGeneralInterest;
    interest += paidGeneralInterest;
    c.finance.accruedInterest = generalInterest - paidGeneralInterest;
    c.finance.baseDebt += c.finance.accruedInterest;
    c.debtServiceMonthly = c.loans.reduce(
      (n, l) =>
        n +
        l.outstanding / Math.max(1, l.remainingMonths) +
        (l.outstanding * l.annualRate) / 1200 +
        (l.arrears || 0),
      0,
    );
    // Residual services have real providers. Nationalization must transfer this
    // income too, instead of paying a private sector which no longer exists.
    const budget = Math.min(
        c.finance.householdCash * 0.14,
        c.finance.payroll * 0.9 + (c.finance.pensions || 0) * 0.8,
      ),
      paid = Math.max(0, budget);
    const serviceSectors = sectors;
    const serviceWorkers = serviceSectors.reduce(
      (n, id) => n + c.sectors[id].privateWorkers,
      0,
    );
    const publicServiceWorkers = serviceSectors.reduce(
      (n, id) => n + c.sectors[id].publicWorkers,
      0,
    );
    const privatePaid =
      (paid * serviceWorkers) /
      Math.max(1, serviceWorkers + publicServiceWorkers);
    const publicPaid = publicServiceWorkers > 0 ? paid - privatePaid : 0;
    transfer(
      s,
      c,
      "household",
      "private",
      privatePaid,
      "Bienes y servicios generales privados",
    );
    transfer(
      s,
      c,
      "household",
      "public",
      publicPaid,
      "Bienes y servicios generales públicos",
    );
    const vat = ((privatePaid * c.taxes.vat) / 100) * c.taxEfficiency;
    transfer(s, c, "private", "public", vat, "IVA servicios");
    c.finance.taxes += vat;
    c.finance.taxBases.vat += privatePaid * c.taxEfficiency;
    for (const id of serviceSectors) {
      const revenue =
        ((privatePaid - vat) * c.sectors[id].privateWorkers) /
        Math.max(1, serviceWorkers);
      c.sectors[id].revenue += revenue;
      c.sectors[id].profit += revenue;
    }
    const profitTax =
        ((Math.max(
          0,
          sectors.reduce((n, id) => n + Math.max(0, c.sectors[id].profit), 0),
        ) *
          c.taxes.income) /
          100) *
        c.taxEfficiency,
      inheritance = Math.min(
        c.finance.householdCash,
        (((c.finance.householdCash * c.mortality) / 12000) *
          c.taxes.inheritance) /
          100,
      );
    const taxed = Math.min(profitTax, Math.max(0, c.finance.privateCash));
    transfer(s, c, "private", "public", taxed, "Ganancias empresariales");
    transfer(s, c, "household", "public", inheritance, "Herencias");
    c.finance.taxes += taxed + inheritance;
    c.finance.taxBases.income +=
      c.taxes.income > 0
        ? taxed / (c.taxes.income / 100)
        : Math.max(
            0,
            sectors.reduce((n, id) => n + Math.max(0, c.sectors[id].profit), 0),
          ) * c.taxEfficiency;
    c.finance.taxBases.inheritance =
      (c.finance.householdCash * c.mortality) / 12000;
    const flows = c.finance.tickFlows || {},
      financing = [
        "Crédito automático",
        "Préstamo recibido",
        "Amortización de préstamo",
        "Amortización anticipada",
        "Amortización de deuda general",
      ];
    let income = 0,
      spending = 0;
    for (const [kind, value] of Object.entries(flows)) {
      if (financing.includes(kind)) continue;
      if (value > 0) income += value;
      else if (kind !== "Intereses") spending -= value;
    }
    c.fiscalCashFlowMonthly = income - spending - interest;
    c.fiscalBalance = (c.fiscalCashFlowMonthly * 1200) / Math.max(1e-12, c.gdp);
    c.revenueRate = (c.finance.taxes * 1200) / c.gdp;
    c.spendingTarget = (c.finance.spending * 1200) / c.gdp;
    const pct = (value) => (value * 1200) / c.gdp;
    c.taxRevenueBreakdown = {
      vat: pct((flows.IVA || 0) + (flows["IVA servicios"] || 0)),
      income: pct(
        (flows["Impuesto a las ganancias salariales"] || 0) +
          (flows["Ganancias empresariales"] || 0),
      ),
      inheritance: pct(flows.Herencias || 0),
      imports: pct(flows.Arancel || 0),
      exports: pct(flows["Derecho de exportación"] || 0),
      other: 0,
      total: c.revenueRate,
    };
    const payment = Math.min(
      Math.max(0, c.fiscalCashFlowMonthly),
      Math.max(0, c.reserves),
      c.finance.baseDebt,
    );
    c.finance.baseDebt -= payment;
    book(s, c, "Amortización de deuda general", -payment);
    s.financeWorld.bank += payment;
    principal += payment;
    c.debtPaymentFromSurplus = payment;
    c.tradeReserveFlowMonthly = 0;
    c.reserveChangeMonthly = c.reserves - c.finance.openingReserves;
    c.finance.monthly = {
      accruedInterest: c.finance.accruedInterest || 0,
      opening: c.finance.openingReserves,
      closing: c.reserves,
      change: c.reserveChangeMonthly,
      income,
      spending,
      interest,
      principal,
      flow: c.finance.pendingPublic,
      flows: { ...c.finance.tickFlows },
    };
    syncDebt(c);
    for (const [sid, sec] of Object.entries(c.sectors)) {
      const branch = {
        agriculture: "agriculture",
        industry: "technical",
        health: "medicine",
        services: "tourism",
        energy: "science",
        security: "economics",
        infrastructure: "technical",
        education: "general",
      }[sid];
      const target = clamp(
        c.education * 0.007 +
          (c.educationBranches[branch].skill || c.education) * 0.003 +
          techBonus(c, sid, "output") * 0.2,
        0,
        1,
      );
      sec.efficiencyPublic = clamp(
        sec.efficiencyPublic +
          (target - sec.efficiencyPublic) * 0.01 +
          (sec.publicWorkers > 0 ? 0.00015 : 0),
        0.15,
        1,
      );
      sec.efficiencyPrivate = clamp(
        sec.efficiencyPrivate +
          (target - sec.efficiencyPrivate) * 0.01 +
          (sec.revenue > 0 ? 0.0002 : 0),
        0.15,
        1,
      );
      sec.experiencePublic += sec.publicWorkers > 0 ? 0.01 : 0;
      sec.experiencePrivate += sec.revenue > 0 ? 0.01 : 0;
    }
    const base = L.getCountryDefinition(c.id),
      baseEmployed =
        ((base.population * base.demographics.workers) / 100) *
        0.72 *
        (1 - base.unemployment / 100);
    const efficiencyIndex =
      sectors.reduce(
        (n, id) =>
          n +
          (c.sectors[id].efficiencyPublic + c.sectors[id].efficiencyPrivate) /
            2,
        0,
      ) / sectors.length;
    const serviceOutput =
      c.initialGdp *
      0.7 *
      clamp(c.laborSnapshot.employed / Math.max(1e-9, baseEmployed), 0.2, 5) **
        0.7 *
      clamp(efficiencyIndex / Math.max(0.35, base.education / 100), 0.4, 2);
    if (c.initialValueAdded === null)
      c.initialValueAdded = Math.max(1e-10, c.gdpValueAdded);
    c.lastValueAdded =
      (c.lastValueAdded ?? c.gdpValueAdded) * 0.85 + c.gdpValueAdded * 0.15;
    const targetReal =
      serviceOutput +
      c.initialGdp *
        0.3 *
        clamp(c.lastValueAdded / c.initialValueAdded, 0.15, 8);
    c.growth = clamp(
      (targetReal / Math.max(1e-10, c.realGdp) - 1) * 30 +
        (s.globalGrowthShock || 0) +
        c.cycleShock +
        H.activeEventEffects(c, s).growth *
          (1 - techBonus(c, "security", "resilience")) +
        (c.consumptionCoverage - 0.8) * 1.5 +
        (c.energy.served - 0.8) * 1.5,
      -12,
      12,
    );
    const old = c.gdp;
    c.realGdp *= 1 + c.growth / 1200;
    c.inflation = clamp(
      c.inflation * 0.98 + (1 - c.consumptionCoverage) * 0.15,
      0,
      100,
    );
    c.gdpDeflator *= 1 + c.inflation / 1200;
    c.gdp = Math.max(0.0001, c.realGdp * c.gdpDeflator);
    c.lastGdpDelta = c.gdp - old;
    syncDebt(c);
  }
  function privateDevelopment(s, c) {
    let availableWorkers = c.laborSnapshot.unemployed * 1e6;
    for (const project of c.privateProjects) {
      const hired = Math.min(availableWorkers, project.jobs || 100);
      availableWorkers -= hired;
      c.constructionWorkers += hired;
      project.months -=
        (hired / Math.max(1, project.jobs || 100)) *
        clamp(c.education / 50, 0.2, 1);
      if (project.months <= 0) {
        const b = D.getBuilding(project.building);
        if (project.owner === "public") {
          c.buildings[project.building] += project.factor;
          c.staffingVersion = (c.staffingVersion || 0) + 1;
          c.sectors[project.sector].requested += project.jobs;
        } else {
          c.privateBuildings[project.building] += project.factor;
          c.sectors[project.sector].privateJobs += project.jobs;
        }
        if (b.storage && !b.storageFor && c.resourceStorageBase)
          spreadLegacySpace(c, project.owner, b.storage, b.storageAmount * project.factor);
        if (b.housingUnits)
          c.housingStock.new += b.housingUnits * project.factor;
        if (b.livestock)
          c.herds[project.owner === "public" ? "public" : "private"][
            b.livestock
          ] += b.heads * project.factor;
        if (b.irrigatedHa) c.land.irrigatedHa += b.irrigatedHa * project.factor;
        if (c.infrastructureAssets[b.id] !== undefined)
          c.infrastructureAssets[b.id] += (b.quantity || 1) * project.factor;
      }
    }
    syncDemographics(c);
    c.privateProjects = c.privateProjects.filter((p) => p.months > 0);
    if (s.tick % 3 !== 0) return;
    for (const sid of sectors) {
      const sec = c.sectors[sid];
      if (
        sec.privateWorkers < sec.privateJobs * 0.6 ||
        (sec.profit < 0 && c.finance.privateCash < c.gdp * 0.025)
      ) {
        sec.privateJobs *= 0.99;
        for (const b of buildings.filter(
          (b) => b.sector === sid && !b.storage && !b.housingUnits,
        ))
          c.privateBuildings[b.id] *= 0.998;
        continue;
      }
      const choices = materials
        .filter(
          (m) =>
            m.sector === sid &&
            !m.waste &&
            scalarTech(c, m.technology) &&
            !c.nationalizedResources?.[m.id] &&
            !c.blockedRawMaterials?.includes(m.id) &&
            !m.natural,
        )
        .sort(
          (a, b) =>
            (c.shortages[b.id] +
              Math.max(0, s.market.resourcePrices[b.id] / b.value - 1) *
                c.privateProduction[b.id]) *
              Math.abs(b.value) -
            (c.shortages[a.id] +
              Math.max(0, s.market.resourcePrices[a.id] / a.value - 1) *
                c.privateProduction[a.id]) *
              Math.abs(a.value),
        );
      const m = choices[0];
      const serviceChoice = {
        infrastructure: c.housing < 96 ? "housing" : null,
        health: "clinics",
        education: "technical_school",
        services: "tourism_district",
        energy: c.energy.served < 0.95 ? "wind_farm" : null,
      }[sid];
      const fullStore = materials.find((m) =>
        stocks(c,"private")[m.id] * volumePerUnit(m) >
        resourceStorageCapacity(c,"private",m) * 0.92 &&
        scalarTech(c, D.getBuilding(`store_${m.id}`).technology));
      let b =
        sid === "services" && fullStore
          ? D.getBuilding(`store_${fullStore.id}`)
          : D.getBuilding(serviceChoice) || D.getBuilding(m?.unlock);
      if (
        !b ||
        !scalarTech(c, b.technology) ||
        materials.some(
          (material) =>
            material.unlock === b.id && c.nationalizedResources?.[material.id],
        ) ||
        sec.profit <= 0 ||
        c.privateProjects.length >= 8 ||
        c.taxes.income > 45
      )
        continue;
      // Grow by whole physical modules, scaled to need and actual investment
      // capacity: China must not get the same single-module cap as Nauru.
      let wanted = 1;
      if (b.energyOutput)
        wanted = Math.max(
          1,
          (c.energy.demand * (1 - c.energy.served) * 12) / 1e6 / b.energyOutput,
        );
      else if (b.housingUnits)
        wanted = Math.max(
          1,
          (c.population / 3.2 - sum(c.housingStock)) / b.housingUnits,
        );
      else if (b.storageFor)
        wanted = Math.max(
          1,
          (stocks(c,"private")[b.storageFor] * volumePerUnit(D.getMaterial(b.storageFor)) * 0.15) / b.storageAmount,
        );
      else if (m && b.id === m.unlock)
        wanted = Math.max(
          1,
          (c.shortages[m.id] +
            c.privateProduction[m.id] *
              Math.max(0, s.market.resourcePrices[m.id] / m.value - 1) *
              0.05) /
            Math.max(1, m.baseOutput),
        );
      let possible = Math.min(
        wanted,
        (c.finance.privateCash * 0.15) / Math.max(1e-9, b.fixedCost),
      );
      if (b.landHa) possible = Math.min(possible, availableLand(c) / b.landHa);
      for (const [id, q] of Object.entries(b.requirements))
        if (q > 0) possible = Math.min(possible, c.privateStocks[id] / q);
      const factor = Math.floor(Math.min(10000, possible));
      if (factor < 1) continue;
      const cost = b.fixedCost * factor;
      if (
        cost > c.finance.privateCash * 0.15 ||
        (b.housingUnits &&
          (sum(c.housingStock) + b.housingUnits * factor) * 3.2 * 1e6 >
            c.land.areaKm2 * 60000) ||
        availableLand(c) < (b.landHa || 0) * factor
      )
        continue;
      const inputEntries = Object.entries(b.requirements).map(([id, q]) => [
        id,
        q * factor,
      ]);
      if (inputEntries.some(([id, q]) => c.privateStocks[id] < q)) continue;
      for (const [id, q] of inputEntries) {
        c.privateStocks[id] -= q;
        c.materialConsumption[id] += q;
      }
      transfer(s, c, "private", "household", cost, "Inversión privada");
      if (b.housingUnits) c.land.residentialHa += (b.landHa || 0) * factor;
      else c.land.industrialHa += (b.landHa || 0) * factor;
      c.privateProjects.push({
        id: c.nextPrivateId++,
        building: b.id,
        sector: sid,
        factor,
        months: b.months,
        jobs: 100 * factor,
      });
    }
    if (s.tick % 12 === 0 && c.finance.privateCash > c.gdp * 0.03) {
      const t = D.technologies.find(
        (t) =>
          !scalarTech(c, t.id) &&
          t.skill <= c.education &&
          t.requires.every((id) => scalarTech(c, id)),
      );
      if (t) {
        const cost = c.gdp * 0.0001;
        transfer(s, c, "private", "household", cost, "Investigación privada");
        grant(c, t.id);
      }
    }
  }
  function wellbeing(c) {
    const stock = c.housingStock,
      maintenance = clamp(
        c.sectors.infrastructure.publicWorkers /
          Math.max(1, c.sectors.infrastructure.requested),
        0,
        1,
      ),
      ageing = stock.new / 60,
      wear =
        stock.normal *
        0.0005 *
        (1 - maintenance * 0.5 - techBonus(c, "infrastructure", "quality"));
    stock.new -= ageing;
    stock.normal += ageing - wear;
    stock.repair += wear;
    c.housing = clamp(
      (((stock.new + stock.normal) * 3.2) / Math.max(0.000001, c.population)) *
        100,
      0,
      100,
    );
    const network =
      Object.entries(c.infrastructureAssets).reduce(
        (n, [id, value]) =>
          n + clamp(value / Math.max(1, c.initialInfrastructure[id]), 0, 2),
        0,
      ) / Object.keys(c.infrastructureAssets).length;
    c.infrastructure = clamp(
      c.infrastructure + (network * maintenance * 80 - c.infrastructure) * 0.01,
      5,
      100,
    );
    const target = wellbeingReport(c).target;
    c.happiness += (target - c.happiness) * 0.08;
    const hospitals =
        c.buildings.clinics +
        c.privateBuildings.clinics +
        (c.buildings.hospital + c.privateBuildings.hospital) * 10,
      staff = clamp(
        (c.sectors.health.publicWorkers + c.sectors.health.privateWorkers) /
          Math.max(1, c.sectors.health.initialJobs),
        0,
        1.5,
      );
    const healthTarget = clamp(
      c.initialHealth *
        clamp(
          hospitals / Math.max(0.001, c.initialHealthFacilities),
          0.2,
          1.5,
        ) *
        staff *
        (1 + techBonus(c, "health", "health")) -
        c.wasteBurden * 4 - c.nutrition.hunger * 0.25 +
        (c.nutrition.quality - 50) * 0.04 * c.nutrition.coverage -
        Math.max(0, c.workPolicy.retire - 67) * 0.3,
      15,
      98,
    );
    c.health = clamp(
      c.health +
        (healthTarget - c.health) * 0.015 +
        (c.consumptionCoverage - 0.8) * 0.12,
      15,
      100,
    );
    c.lifeExpectancy = clamp(
      c.initialLifeExpectancy +
        (c.health - c.initialHealth) * 0.12 +
        (c.happiness - 50) * 0.015 -
        c.wasteBurden * 0.1 - c.nutrition.hunger * 0.03,
      35,
      98,
    );
    c.popularity = clamp(
      c.popularity + (c.happiness - c.popularity) * 0.02,
      0,
      100,
    );
    c.stability = clamp(c.stability + (c.happiness - 55) * 0.008, 0, 100);
    const touristCapacity =
      c.infrastructureAssets.airport * 0.3 +
      c.infrastructureAssets.port * 0.05 +
      (c.buildings.tourism_district + c.privateBuildings.tourism_district) *
        0.01;
    c.tourism = Math.max(
      0,
      Math.min(
        touristCapacity,
        c.population *
          0.6 *
          (c.happiness / 80) *
          (1 + techBonus(c, "services", "services")) *
          (0.5 + c.infrastructure / 100),
      ),
    );
    c.tourismCapacity = touristCapacity;
    c.taxEfficiency = clamp(
      c.taxEfficiency +
        (clamp(0.65 + techBonus(c, "security", "tax"), 0.4, 0.98) -
          c.taxEfficiency) *
          0.002,
      0.3,
      0.99,
    );
    if (c.popularity < 18) c.lowPopularityMonths++;
    else c.lowPopularityMonths = Math.max(0, c.lowPopularityMonths - 1);
  }
  function demographics(s) {
    const cs = Object.values(s.countries).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    for (const c of cs) {
      const old = population(c),
        a = c.ageCohorts,
        newA = Array(101).fill(0);
      let deaths = 0,
        enter = 0,
        retire = 0;
      const shock =
        H.activeEventEffects(c, s).mortality *
        (1 - techBonus(c, "health", "health"));
      c.nutrition.hungerDeaths = 0;
      for (let age = 0; age <= 100; age++) {
        const hungerRisk = Math.max(0, c.nutrition.hunger - 60) / 40 * 0.0015 *
          Math.min(1, c.nutrition.deficitMonths / 6) * (age < 5 || age >= 65 ? 1.5 : 1);
        const risk = clamp(
            ((age < 5
              ? 0.003
              : age < 50
                ? 0.0002
                : 0.0002 * Math.exp((age - 50) / 9)) *
              Math.exp((75 - c.lifeExpectancy) / 15)) /
              12 +
              shock / 12000 + hungerRisk,
            0,
            0.3,
          ),
          dead = a[age] * risk,
          alive = a[age] - dead;
        deaths += dead;
        c.nutrition.hungerDeaths += a[age] * Math.min(risk, hungerRisk);
        const next = age === 100 ? 0 : alive / 12;
        newA[age] += alive - next;
        if (age < 100) newA[age + 1] += next;
        if (age === c.workPolicy.start - 1) enter = next;
        if (age === c.workPolicy.retire - 1) retire = next;
      }
      const cap = c.land.areaKm2 * 60000;
      const birthRule = populationPolicyLevels[c.demographicPolicy.birth];
      const birthMultiplier = 1 + (birthRule.birth - 1) * (c.demographicPolicy.efficacy ?? 1);
      const births = Math.min(
        (old * c.birthRate * birthMultiplier) / 12000,
        Math.max(0, cap - sum(newA)),
      );
      newA[0] += births;
      c.ageCohorts = newA;
      c.demographicFlows = {
        births: births / 1e6,
        deaths: (deaths + (c.disasterDeaths || 0)) / 1e6,
        migration: 0,
        enteringWorkAge: enter / 1e6,
        retiring: retire / 1e6,
      };
      c.demographicRequests = { exit: 0, entry: 0, accepted: 0, departed: 0, rejected: 0, waiting: 0 };
      syncDemographics(c);
    }
    const receivers = cs
      .map((c) => ({
        c,
        score: c.happiness + c.lifeExpectancy * 0.3 - c.unemployment * 0.5
          + c.housing * 0.08 + (c.nutrition?.coverage || 0) * 8
          + c.infrastructure * 0.03 - (c.nutrition?.hunger || 0) * 0.2,
        free: Math.min(
          Math.max(
            0,
            (c.housingStock.new + c.housingStock.normal) * 3.2 * 1e6 -
              population(c),
          ),
          Math.max(0, c.land.areaKm2 * 60000 - population(c)),
          population(c) * 0.003,
        ),
      }))
      .filter((x) => x.free > 0)
      .sort((a, b) => b.score - a.score || a.c.id.localeCompare(b.c.id));
    for (const c of cs) {
      const desired =
        population(c) *
        clamp(
          (55 - c.happiness) / 100000 + c.unemployment / 200000
            + (c.nutrition?.hunger || 0) / 200000
            + Math.max(0, 85 - c.housing) / 200000 +
            H.activeEventEffects(c, s).migrationPush / 12000,
          0,
          0.002,
        );
      c.demographicRequests.exit = desired;
      const exitRule = populationPolicyLevels[c.demographicPolicy.exit];
      let leaving = desired * (1 + (exitRule.exit - 1) * (c.demographicPolicy.efficacy ?? 1));
      const destinations = receivers.filter((r) => r.c.id !== c.id)
        .sort((a, b) => (continent(a.c) === continent(c) ? -1 : 1)
          - (continent(b.c) === continent(c) ? -1 : 1)
          || b.score - a.score || a.c.id.localeCompare(b.c.id));
      let remote = desired * 0.12;
      for (const r of destinations) {
        if (leaving <= 1e-9) break;
        if (
          r.score < c.happiness + c.lifeExpectancy * 0.3 + 5
        )
          continue;
        const sameContinent = continent(c) === continent(r.c);
        const request = Math.min(leaving, sameContinent ? leaving : remote);
        r.c.demographicRequests.entry += request;
        const entryRule = populationPolicyLevels[r.c.demographicPolicy.entry];
        const entryFactor = 1 + (entryRule.entry - 1) * (r.c.demographicPolicy.efficacy ?? 1);
        const available = c.ageCohorts.reduce((a, b) => a + b, 0);
        const n = Math.min(request * entryFactor, r.free, available * 0.01);
        if (!n) continue;
        for (let age = 0; age <= 100; age++) {
          const share = (c.ageCohorts[age] / available) * n;
          c.ageCohorts[age] -= share;
          r.c.ageCohorts[age] += share;
        }
        leaving -= n;
        if (!sameContinent) remote -= n;
        r.free -= n;
        r.c.demographicRequests.accepted += n;
        c.demographicRequests.departed += n;
        c.demographicFlows.migration -= n / 1e6;
        r.c.demographicFlows.migration += n / 1e6;
      }
      c.demographicRequests.waiting = Math.max(0, desired - c.demographicRequests.departed);
    }
    for (const c of cs) {
      c.demographicRequests.rejected = Math.max(0, c.demographicRequests.entry - c.demographicRequests.accepted);
      syncDemographics(c);
      c.migration =
        (c.demographicFlows.migration / Math.max(0.000001, c.population)) *
        12000;
    }
  }
  function prices(s) {
    s.market.previousResourcePrices = { ...s.market.resourcePrices };
    for (const m of materials) {
      if (m.waste) {
        const cs = Object.values(s.countries),
          inventory = cs.reduce(
            (n, c) =>
              n +
              c.publicStocks[m.id] +
              c.privateStocks[m.id] +
              c.uncollectedWaste[m.id],
            0,
          ),
          use = cs.reduce((n, c) => n + c.materialConsumption[m.id], 0);
        const pressure = inventory / Math.max(1, inventory + use),
          target =
            Math.abs(m.value) *
            (m.value < 0 ? 0.5 + pressure * 2 : 1.8 - pressure * 1.2);
        s.market.resourcePrices[m.id] =
          Math.sign(m.value) *
          clamp(
            Math.abs(s.market.resourcePrices[m.id]) * 0.94 + target * 0.06,
            Math.abs(m.value) * 0.4,
            Math.abs(m.value) * 3,
          );
        continue;
      }
      let output = 0,
        demand = 0;
      for (const c of Object.values(s.countries)) {
        output += c.materialProduction[m.id];
        demand += c.needs[m.id];
      }
      const ratio = (demand - output) / Math.max(1, demand + output),
        move = clamp(ratio * 0.035 + (random(s) - 0.5) * 0.012, -0.04, 0.04);
      s.market.resourcePrices[m.id] = clamp(
        s.market.resourcePrices[m.id] * (1 + move),
        m.value * 0.4,
        m.value * 3,
      );
    }
    for (const c of Object.values(s.countries)) {
      c.sectorSupply = { food: 0, energy: 0, manufactures: 0, technology: 0 };
      c.sectorDemand = { ...c.sectorSupply };
      for (const m of materials) {
        const key =
          m.sector === "agriculture"
            ? "food"
            : m.sector === "energy"
              ? "energy"
              : m.technology === "electronics" ||
                  m.technology === "advanced_chips"
                ? "technology"
                : "manufactures";
        c.sectorSupply[key] += c.materialProduction[m.id] * Math.abs(m.value);
        c.sectorDemand[key] += c.needs[m.id] * Math.abs(m.value);
      }
      c.sectorBalances = Object.fromEntries(
        Object.keys(c.sectorSupply).map((id) => [
          id,
          c.sectorSupply[id] - c.sectorDemand[id],
        ]),
      );
      updateCapacity(c);
    }
  }
  function daysInMonth(date) {
    return new Date(Date.UTC(date.year, date.month, 0)).getUTCDate();
  }
  function dateLabel(date) {
    return new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    })
      .format(new Date(Date.UTC(date.year, date.month - 1, date.day || 1)))
      .replace(" de ", " ");
  }
  function countrySlice(s, index, count) {
    const list = Object.values(s.countries),
      size = Math.ceil(list.length / count);
    return list.slice(index * size, (index + 1) * size);
  }
  function advanceDay(s) {
    if (s.gameOver) return s;
    initialize(s, true);
    const day = s.date.day,
      lastDay = daysInMonth(s.date);
    if (day === 1 && !s.dailyCycle) {
      s.tick++;
      s.dailyCycle = {
        populations: Object.fromEntries(
          Object.values(s.countries).map((c) => [c.id, c.population]),
        ),
      };
      H.updateWorldEvents(s);
      for (const c of Object.values(s.countries)) {
        const previous = s.dailyCycle.populations[c.id];
        if (c.population !== previous) {
          const ratio = c.population / previous;
          c.ageCohorts = c.ageCohorts.map((n) => n * ratio);
        }
        c.disasterDeaths = Math.max(0, previous - c.population) * 1e6;
        c.finance.openingReserves = c.reserves;
        c.finance.pendingPublic = 0;
        c.finance.tickFlows = {};
      }
      s.dailyStage = "Eventos y apertura contable";
    } else if (day >= 2 && day <= 5) {
      for (const c of countrySlice(s, day - 2, 4)) {
        working(s, c);
        wages(s, c);
      }
      s.dailyStage = "Empleo y salarios";
    } else if (day >= 6 && day <= 9) {
      for (const c of countrySlice(s, day - 6, 4)) produce(s, c);
      s.dailyStage = "Producción nacional";
    } else if (day >= 10 && day <= 13) {
      for (const c of countrySlice(s, day - 10, 4)) consume(s, c);
      s.dailyStage = "Consumo interno";
    } else if (day === 14) {
      trade(s);
      s.dailyStage = "Comercio mundial";
    } else if (day >= 15 && day <= 22) {
      for (const c of countrySlice(s, day - 15, 8)) {
        consume(s, c, true);
        passiveHousing(s, c, projects(s, c));
        education(s, c);
        research(s, c);
        waste(s, c);
        closeFinance(s, c);
        privateDevelopment(s, c);
        wellbeing(c);
      }
      s.dailyStage = "Obras, servicios y cierre fiscal";
    } else if (day === 23) {
      demographics(s);
      s.dailyStage = "Demografía y migraciones";
    } else if (day === 24) {
      prices(s);
      s.dailyStage = "Precios y mercado mundial";
    } else s.dailyStage = "Consolidación mensual";
    s.dayTick++;
    if (day >= lastDay) {
      H.advanceDate(s);
      s.date.day = 1;
      H.captureHistory(s);
      const h = s.history[s.history.length - 1],
        c = s.countries[s.playerCountryId];
      h.reserves = c.reserves;
      h.fiscalBalance = c.fiscalBalance;
      h.lifeExpectancy = c.lifeExpectancy;
      H.evaluateGame(s);
      s.dailyCycle = null;
      s.dailyStage = "Mes cerrado";
    } else s.date.day++;
    return s;
  }
  function advanceTick(s) {
    if (s.gameOver) return s;
    initialize(s, true);
    const startingTick = s.tick;
    do advanceDay(s);
    while (!s.gameOver && (s.dailyCycle || s.tick === startingTick));
    return s;
  }
  function createGame(...args) {
    const s = L.createGame(...args);
    initialize(s, false);
    s.market.resourcePrices = map((m) => m.value);
    s.market.previousResourcePrices = { ...s.market.resourcePrices };
    return s;
  }
  function hydrate(raw) {
    const version = raw?.version,
      s = L.hydrate(raw);
    initialize(s, true);
    if (s.gameOver?.title === "Gobierno sin respaldo") s.gameOver = null;
    if (version < 6) {
      s.market.resourcePrices = map((m) => m.value);
      s.market.previousResourcePrices = { ...s.market.resourcePrices };
      note(
        s,
        s.countries[s.playerCountryId],
        "Partida migrada a v6. Se conservan reservas, préstamos, obras y stock público; la nueva base productiva privada usa estimaciones documentadas.",
      );
    }
    validateV6(s);
    return s;
  }
  function validateV6(s) {
    for (const c of Object.values(s.countries)) {
      for (const value of [
        c.reserves,
        c.finance.privateCash,
        c.finance.householdCash,
        c.finance.baseDebt,
        c.gdp,
        c.realGdp,
        c.electricityDemandTWh,
        c.land.areaKm2,
        c.lifeExpectancy,
        c.nutrition.hunger,
        c.nutrition.coverage,
        c.nutrition.quality,
        c.nutrition.aidBudget,
        c.nutrition.protectedDays,
        c.nutrition.need,
        c.nutrition.deficitMonths,
        c.pensionPolicy.monthlyUsd,
        c.pensionPolicy.referenceUsd,
        c.demographicPolicy.cost || 0,
        c.demographicPolicy.efficacy ?? 1,
        ...Object.values(c.resourceStaffLimits || {}),
        ...Object.values(c.resourceStorageBase?.public || {}),
        ...Object.values(c.resourceStorageBase?.private || {}),
        ...c.ageCohorts,
      ])
        if (!Number.isFinite(value))
          throw Error("Guardado con datos económicos inválidos.");
      if (c.nutrition.hunger < 0 || c.nutrition.hunger > 100 ||
          c.nutrition.coverage < 0 || c.nutrition.coverage > 1 ||
          c.nutrition.aidBudget < 0 || c.nutrition.protectedDays < 0 || c.nutrition.protectedDays > 365 ||
          c.nutrition.need < 0 || c.nutrition.deficitMonths < 0)
        throw Error("Guardado con datos alimentarios inválidos.");
      if (
        c.ageCohorts.length !== 101 ||
        c.ageCohorts.some((n) => n < 0) ||
        c.finance.baseDebt < 0
      )
        throw Error("Guardado con población o deuda inválida.");
      if (c.pensionPolicy.monthlyUsd < 0 ||
        Object.values(c.resourceStaffLimits || {}).some((n) => n < 0) ||
        Object.values(c.resourceStorageBase?.public || {}).some((n) => n < -1e-6) ||
        Object.values(c.resourceStorageBase?.private || {}).some((n) => n < -1e-6))
        throw Error("Guardado con política o almacenes inválidos.");
      for (const owner of owners)
        if (
          Object.values(stocks(c, owner)).some(
            (n) => !Number.isFinite(n) || n < -0.000001,
          )
        )
          throw Error("Inventario inválido.");
      for (const sec of Object.values(c.sectors))
        for (const key of [
          "budget",
          "salary",
          "privateSalary",
          "requested",
          "publicWorkers",
          "privateWorkers",
          "privateJobs",
          "subsidyCap",
        ])
          if (!Number.isFinite(sec[key]) || sec[key] < 0)
            throw Error("Personal o presupuesto inválido.");
      for (const loan of c.loans)
        if (
          !Number.isFinite(loan.outstanding) ||
          loan.outstanding < 0 ||
          !Number.isFinite(loan.annualRate) ||
          loan.annualRate < 0 ||
          !Number.isFinite(loan.remainingMonths)
        )
          throw Error("Préstamo inválido.");
      for (const price of Object.values(s.market.resourcePrices))
        if (!Number.isFinite(price)) throw Error("Cotización inválida.");
    }
    return true;
  }
  function loanPreview(s, id) {
    const c = s.countries[s.playerCountryId],
      o = L.LOAN_OPTIONS.find((o) => o.id === id);
    if (!o) throw Error("Préstamo no válido.");
    const amount = c.gdp * o.principalShare,
      firstPayment = amount / o.months + (amount * o.annualRate) / 1200,
      projectedDebt = ((debtTotal(c) + amount) / c.gdp) * 100;
    return {
      ...o,
      amount,
      principalPayment: amount / o.months,
      firstPayment,
      projectedDebt,
      projectedPayment: c.debtServiceMonthly + firstPayment,
      risk: L.bankruptcyRisk(
        { ...c, reserves: c.reserves + amount },
        projectedDebt,
        c.debtServiceMonthly + firstPayment,
      ),
    };
  }
  function takeLoan(s, id) {
    const c = player(s);
    if (c.loans.length >= 5) throw Error("Ya hay cinco préstamos activos.");
    const p = loanPreview(s, id),
      loan = {
        id: `loan-${c.nextLoanId++}`,
        optionId: id,
        label: p.label,
        originalPrincipal: p.amount,
        outstanding: p.amount,
        annualRate: p.annualRate,
        originalMonths: p.months,
        remainingMonths: p.months,
        startedAt: L.monthLabel(s.date),
        lastPayment: 0,
        arrears: 0,
      };
    c.loans.push(loan);
    book(s, c, "Préstamo recibido", p.amount, "public", p.label);
    s.financeWorld.bank -= p.amount;
    c.debtServiceMonthly += p.firstPayment;
    syncDebt(c);
    note(s, c, `${p.label} acreditado íntegramente al Tesoro.`);
    return { loan: clone(loan), preview: p };
  }
  function repayment(s, id, amount) {
    const c = player(s),
      loan = c.loans.find((l) => l.id === id);
    if (!loan) throw Error("Préstamo no encontrado.");
    const n = Math.min(needNumber(amount), loan.outstanding);
    if (n > Math.max(0, c.reserves)) throw Error("Reservas insuficientes.");
    book(s, c, "Amortización anticipada", -n);
    s.financeWorld.bank += n;
    loan.outstanding -= n;
    c.loans = c.loans.filter(
      (l) => l.outstanding > 1e-12 || (l.arrears || 0) > 1e-12,
    );
    c.debtServiceMonthly = c.loans.reduce(
      (n, l) =>
        n +
        l.outstanding / Math.max(1, l.remainingMonths) +
        (l.outstanding * l.annualRate) / 1200 +
        (l.arrears || 0),
      0,
    );
    syncDebt(c);
    return n;
  }
  function tradePreview(s, id, direction, quantity) {
    const c = s.countries[s.playerCountryId],
      m = D.getMaterial(id);
    if (!m) throw Error("Recurso no válido.");
    quantity = needNumber(quantity, 1e-12);
    if (!["buy", "sell"].includes(direction))
      throw Error("Operación no válida.");
    const available =
      direction === "buy"
        ? Object.values(s.countries)
            .filter((x) => x.id !== c.id)
            .reduce(
              (n, x) => n + owners.reduce((a, o) => a + exportable(x, o, m), 0),
              0,
            )
        : exportable(c, "public", m);
    const q = Math.min(
      quantity,
      available,
      direction === "buy" ? freeStock(c, "public", m) : Infinity,
    );
    const unitPrice = s.market.resourcePrices[id],
      pays = direction === "buy" ? unitPrice > 0 : unitPrice < 0,
      cost = pays ? q * Math.abs(unitPrice) * 1.035 : 0,
      revenue = pays ? 0 : q * Math.abs(unitPrice);
    return {
      quantity: q,
      requested: quantity,
      unitPrice,
      cost,
      revenue,
      projectedReserves: c.reserves - cost + revenue,
      blocked:
        direction === "buy" && (c.importsBanned || c.importBans[id])
          ? "Importación prohibida"
          : q <= 0
            ? "No hay excedente o espacio"
            : "",
    };
  }
  function tradeResource(s, id, direction, quantity) {
    const c = player(s),
      m = D.getMaterial(id),
      p = tradePreview(s, id, direction, quantity ?? 1);
    if (p.blocked) throw Error(p.blocked);
    if (p.cost > Math.max(0, c.reserves) + 1e-12)
      throw Error(
        "Reservas insuficientes: reducí la cantidad o solicitá un préstamo. No se efectuó la operación.",
      );
    const before = c.reserves;
    let remaining = p.quantity,
      done = 0;
    for (const other of Object.values(s.countries).sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      if (other.id === c.id) continue;
      if (direction === "buy") {
        for (const owner of owners) {
          const n = exchange(s, other, c, m, remaining, owner, "public");
          done += n;
          remaining -= n;
        }
      } else {
        const demand = m.waste
          ? remaining
          : Math.max(
              0,
              other.needs[id] * 2 -
                other.publicStocks[id] -
                other.privateStocks[id],
            );
        const n = exchange(
          s,
          c,
          other,
          m,
          Math.min(remaining, demand),
          "public",
          "private",
        );
        done += n;
        remaining -= n;
      }
      if (remaining <= 1e-9) break;
    }
    if (!done)
      throw Error(
        "No hay contraparte con demanda, fondos y capacidad suficientes.",
      );
    updateCapacity(c);
    return {
      direction,
      quantity: done,
      unitPrice: p.unitPrice,
      grossValue: done * p.unitPrice,
      netValue: Math.abs(c.reserves - before),
      cost: before - c.reserves,
      revenue: c.reserves - before,
      taxRate: direction === "buy" ? c.taxes.imports : c.taxes.exports,
    };
  }
  function estimateTaxes(s, input) {
    const c = s.countries[s.playerCountryId],
      rates = {};
    for (const t of D.taxes)
      rates[t.id] = needNumber(input?.[t.id] ?? c.taxes[t.id], t.min, t.max);
    const payroll = sectors.reduce(
      (n, id) =>
        n +
        (c.sectors[id].publicWorkers * c.sectors[id].salary +
          c.sectors[id].privateWorkers * c.sectors[id].privateSalary) /
          1e9,
      0,
    );
    const bases = c.finance.taxBases || {
      vat:
        materials.reduce(
          (n, m) => n + ((m.household * population(c)) / 12) * m.value,
          0,
        ) +
        payroll * 0.35,
      income: payroll * c.taxEfficiency,
      inheritance: (c.finance.householdCash * c.mortality) / 12000,
      imports: 0,
      exports: 0,
    };
    const breakdown = { other: 0 };
    for (const t of D.taxes)
      breakdown[t.id] =
        ((((bases[t.id] || 0) * rates[t.id]) / 100) * 1200) / c.gdp;
    breakdown.total = sum(breakdown);
    return {
      rates,
      breakdown,
      monthly: (breakdown.total * c.gdp) / 1200,
      growthEffect: 0,
      inflationEffect: 0,
      happinessEffect: 0,
      tradeFriction: rates.imports * 0.4 + rates.exports * 0.6,
    };
  }
  function applyTaxes(s, input) {
    const c = player(s),
      p = estimateTaxes(s, input);
    c.taxes = p.rates;
    note(
      s,
      c,
      "Esquema impositivo actualizado. La recaudación depende de las operaciones efectivas.",
    );
    return s;
  }
  function setSector(s, id, input) {
    const c = player(s),
      sec = c.sectors[id];
    if (!sec) throw Error("Sector no válido.");
    const values = {};
    for (const key of ["salary", "requested"])
      if (input[key] !== undefined) values[key] = needNumber(input[key]);
    Object.assign(sec, values);
    c.staffingVersion = (c.staffingVersion || 0) + 1;
    return sec;
  }
  function setHousingProgram(s, input) {
    const c = player(s),
      p = c.housingProgram;
    for (const key of [
      "buildBudget",
      "repairBudget",
      "buildWorkers",
      "repairWorkers",
    ])
      if (input[key] !== undefined) p[key] = needNumber(input[key], 0);
    return p;
  }
  function setImportPolicy(s, id, banned) {
    const c = player(s);
    if (id === "all") c.importsBanned = !!banned;
    else if (D.getMaterial(id)) c.importBans[id] = !!banned;
    else
      for (const m of materials.filter((m) => m.tier === id || m.sector === id))
        c.importBans[m.id] = !!banned;
  }
  function setResourcePolicy(s, id, input) {
    const c = player(s);
    if (!D.getMaterial(id)) throw Error("Recurso no válido.");
    const changes = {};
    if (input.minimum !== undefined)
      changes.minimum = needNumber(input.minimum);
    if (input.target !== undefined)
      changes.target = needNumber(input.target, 0, 1);
    if (input.staffLimit !== undefined)
      changes.staffLimit = needNumber(input.staffLimit, 0, 1e12);
    if (changes.minimum !== undefined) c.stockMinimum[id] = changes.minimum;
    if (changes.target !== undefined) c.productionTargets[id] = changes.target;
    if (changes.staffLimit !== undefined) {
      c.resourceStaffLimits[id] = changes.staffLimit;
      c.staffingVersion = (c.staffingVersion || 0) + 1;
    }
  }
  function setTradePolicies(s, policies) {
    const c = player(s),
      validated = {};
    for (const [id, policy] of Object.entries(policies)) {
      if (!D.getMaterial(id)) throw Error("Recurso comercial no válido.");
      validated[id] = {
        sell: !!policy.sell,
        autoImport: !!policy.autoImport,
        importBelow: needNumber(policy.importBelow, 0, 1e15),
      };
    }
    Object.assign(c.tradePolicies, validated);
  }
  function setAges(s, start, retire) {
    const c = player(s);
    start = needNumber(start, 12, 79);
    retire = needNumber(retire, 13, 80);
    if (
      start >= retire ||
      !Number.isInteger(start) ||
      !Number.isInteger(retire)
    )
      throw Error("La edad inicial debe ser menor que la edad de retiro.");
    c.workPolicy = { start, retire };
    syncDemographics(c);
  }
  function setDemographicPolicy(s, input) {
    const c = player(s), changes = {};
    for (const key of ["birth", "entry", "exit"])
      if (input[key] !== undefined) {
        if (!populationPolicyLevels[input[key]]) throw Error("Nivel demográfico no válido.");
        changes[key] = input[key];
      }
    Object.assign(c.demographicPolicy, changes);
    return c.demographicPolicy;
  }
  function setPension(s, monthlyUsd) {
    const c = player(s);
    c.pensionPolicy.monthlyUsd = needNumber(monthlyUsd, 0, 1e9);
    return pensionPreview(c);
  }
  function pensionPreview(c) {
    const people = (c.laborSnapshot?.retired || 0) * 1e6;
    const monthly = people * c.pensionPolicy.monthlyUsd / 1e9;
    return { people, monthly, annual: monthly * 12,
      previousMonthly: c.pensionPolicy.requested || 0,
      projectedReserves: c.reserves - monthly,
      coverage: c.reserves >= monthly ? 1 : clamp(Math.max(0, c.reserves) / Math.max(monthly, 1e-12), 0, 1),
    };
  }
  function automaticExportReport(s, id) {
    const c = s.countries[s.playerCountryId], m = D.getMaterial(id);
    if (!m) throw Error("Recurso no válido.");
    const report = c.autoTradeReport[id], policy = c.tradePolicies[id];
    if (!report) return { reason:"Pendiente del próximo ciclo comercial", enabled:!!policy.sell,
      offeredPublic:0,offeredPrivate:0,soldPublic:0,soldPrivate:0,
      receivedPublic:0,receivedPrivate:0,tax:0,buyer:null,
      stockPublic:c.publicStocks[id],stockPrivate:c.privateStocks[id],
      currentExportablePublic:exportable(c,"public",m),
      currentExportablePrivate:exportable(c,"private",m) };
    let reason = "Venta realizada";
    if (!policy.sell) reason = "Venta automática desactivada";
    else if (report.soldPublic + report.soldPrivate > 0) reason = "Venta realizada";
    else if (!(report.offeredPublic + report.offeredPrivate > 1e-6))
      reason = (c.publicStocks[id] + c.privateStocks[id]) > 1e-6
        ? "Stock reservado para consumo, insumos o mínimo protegido" : "Sin stock disponible";
    else if (transportCapacity(c) - (c.transported || 0) <= 1e-6) reason = "Transporte nacional agotado";
    else if (m.waste && s.market.resourcePrices[id] < 0 &&
      Math.max(0, c.reserves) + Math.max(0, c.finance.privateCash) <= 0)
      reason = "La disposición de residuos requiere fondos del exportador";
    else {
      const candidates = Object.values(s.countries).filter((x) => x.id !== c.id &&
        !x.importsBanned && !x.importBans[id] &&
        (m.waste ? wasteReceptionCapacity(x, m) > 1e-6 :
          x.needs[id] * 1.4 > x.publicStocks[id] + x.privateStocks[id] ||
          x.tradePolicies?.[id]?.autoImport && x.tradePolicies[id].importBelow > x.publicStocks[id]));
      if (!candidates.length) reason = "No hay países con demanda elegible";
      else if (!candidates.some((x) => freeStock(x, "private", m) > 1e-6 || freeStock(x, "public", m) > 1e-6))
        reason = "Los compradores no tienen almacén libre";
      else if (s.market.resourcePrices[id] >= 0 && !candidates.some((x) => x.finance.privateCash > 0 || x.reserves > 0))
        reason = "Los compradores no tienen fondos";
      else reason = "Sin operación: revisá demanda, fondos, espacio, transporte y aranceles";
    }
    return { ...report, reason, enabled: !!policy.sell,
      stockPublic: c.publicStocks[id], stockPrivate: c.privateStocks[id],
      currentExportablePublic: exportable(c,"public",m),
      currentExportablePrivate: exportable(c,"private",m) };
  }
  function productionBuildings(m) {
    return [m.unlock, ...(m.id === "crude_oil" ? ["offshore_platform"] : [])]
      .map(D.getBuilding)
      .filter(Boolean);
  }
  function nationalizePreview(s, id, share = 1) {
    const c = s.countries[s.playerCountryId];
    const m = D.getMaterial(id);
    if (!m) throw Error("Producción no válida.");
    share = needNumber(share, 0, 1);
    const assets = productionBuildings(m),
      assetCost = assets.reduce(
        (n, b) => n + c.privateBuildings[b.id] * b.fixedCost * share,
        0,
      ),
      stockCost =
        c.privateStocks[m.id] *
        Math.max(0, s.market.resourcePrices[m.id]) *
        share,
      productive = [
        ...new Set(
          materials
            .filter((item) => item.sector === m.sector)
            .flatMap((item) => productionBuildings(item).map((b) => b.id)),
        ),
      ],
      weight = (buildingId) => {
        const b = D.getBuilding(buildingId);
        return (
          (c.privateBuildings[buildingId] || 0) * Math.max(1, b?.laborNeed || 1)
        );
      },
      totalWeight = productive.reduce(
        (n, buildingId) => n + weight(buildingId),
        0,
      ),
      targetWeight = assets.reduce((n, b) => n + weight(b.id), 0),
      workerShare = totalWeight > 0 ? (targetWeight / totalWeight) * share : 0,
      sector = c.sectors[m.sector];
    return {
      id,
      material: m,
      share,
      cost: assetCost + stockCost,
      workers: sector.privateWorkers * workerShare,
      jobs: sector.privateJobs * workerShare,
      assets: assets.map((b) => ({
        id: b.id,
        label: b.label,
        quantity: c.privateBuildings[b.id] * share,
      })),
      stock: c.privateStocks[m.id] * share,
      alreadyNationalized: !!c.nationalizedResources?.[id],
      linkedProductions: materials
        .filter(
          (item) => item.id !== id && assets.some((b) => b.id === item.unlock),
        )
        .map((item) => item.label),
    };
  }
  function nationalize(s, id, share = 1) {
    const c = player(s),
      p = nationalizePreview(s, id, share),
      m = p.material;
    if (p.alreadyNationalized && share === 1)
      throw Error("Esta producción ya está nacionalizada.");
    if (p.cost > Math.max(0, c.reserves))
      throw Error("No alcanza el Tesoro para transferir los activos.");
    transfer(
      s,
      c,
      "public",
      "private",
      p.cost,
      "Compensación por nacionalización",
    );
    for (const asset of p.assets) {
      c.privateBuildings[asset.id] -= asset.quantity;
      c.buildings[asset.id] += asset.quantity;
    }
    c.privateStocks[m.id] -= p.stock;
    c.publicStocks[m.id] += p.stock;
    for (const b of productionBuildings(m))
      if (b.livestock) {
        const type = b.livestock,
          n = c.herds.private[type] * share;
        c.herds.private[type] -= n;
        c.herds.public[type] += n;
      }
    if (share === 1) {
      c.nationalizedResources[id] = true;
      c.productionTargets[id] = 1;
      const assetIds = new Set(p.assets.map((asset) => asset.id));
      for (const project of c.privateProjects.filter((project) =>
        assetIds.has(project.building),
      ))
        project.owner = "public";
    }
    const sec = c.sectors[m.sector];
    sec.privateWorkers -= p.workers;
    sec.privateJobs -= p.jobs;
    sec.publicWorkers += p.workers;
    sec.requested += p.workers;
    // Transfer only this resource's occupied space; preserve total capacity.
    const delta = Math.min(Math.max(0, c.resourceStorageBase.private[id] || 0),
      Math.max(0, c.publicStocks[id] * volumePerUnit(m) - resourceStorageCapacity(c,"public",m)));
    c.resourceStorageBase.public[id] += delta;
    c.resourceStorageBase.private[id] -= delta;
    c.staffingVersion = (c.staffingVersion || 0) + 1;
    updateCapacity(c);
    note(
      s,
      c,
      `${m.label}: ${m.natural ? "extracción" : "producción"} nacionalizada al ${Math.round(share * 100)}%.`,
    );
    return p;
  }
  function startResearch(s, id, budget) {
    const c = player(s),
      t = D.getTechnology(id);
    if (!t) throw Error("Tecnología no válida.");
    const queue = normalizeResearchQueue(c);
    if (!s.adminMode && !c.buildings.research_lab)
      throw Error("Construí un laboratorio de investigación.");
    if (
      !t.requires.every(
        (dep) => scalarTech(c, dep) || (!s.adminMode && queue.some((x) => x.technology === dep)),
      )
    )
      throw Error("Faltan tecnologías previas.");
    if (s.adminMode) {
      const level = scalarTech(c, id) + 1;
      if (level > t.maxLevel) throw Error("Nivel máximo alcanzado.");
      c.research.levels[id] = level;
      c.research.history.unshift({ label: t.label, level, tick: s.tick });
      const pending = queue.findIndex((item) => item.kind === "research" &&
        item.technology === id && item.level === level);
      if (pending >= 0) queue.splice(pending, 1);
      normalizeResearchQueue(c);
      note(s, c, `${t.label}: nivel ${level} completado en modo admin, sin costo.`);
      return { kind: "research", technology: id, level, progress: 100, admin: true };
    }
    const level =
      Math.max(
        scalarTech(c, id),
        ...queue.filter((x) => x.technology === id).map((x) => x.level),
      ) + 1;
    if (level > t.maxLevel) throw Error("Nivel máximo alcanzado.");
    const item = {
      kind: "research",
      queueId: c.research.nextQueueId,
      technology: id,
      level,
      progress: 0,
      budget: needNumber(budget, 1e-12),
    };
    c.research.nextQueueId++;
    queue.push(item);
    normalizeResearchQueue(c);
    return item;
  }
  function explore(s, id, offshore, budget) {
    const c = player(s),
      m = D.getMaterial(id);
    if (!m?.natural) throw Error("Recurso no explorable.");
    const queue = normalizeResearchQueue(c),
      prerequisite = offshore ? "offshore_exploration" : "prospecting";
    if (
      !scalarTech(c, prerequisite) &&
      !queue.some((x) => x.technology === prerequisite)
    )
      throw Error("Hace falta investigar prospección.");
    if (offshore && (id !== "crude_oil" || D.landlocked.includes(c.id)))
      throw Error("Exploración marítima no disponible.");
    if (!c.buildings.research_lab) throw Error("Hace falta un laboratorio.");
    const ex = {
      id: c.research.nextId++,
      resource: id,
      offshore: !!offshore,
      budget: needNumber(budget, 1e-12),
      progress: 0,
      status: "En curso",
      roll: random(s),
      sizeRoll: random(s),
    };
    c.research.explorations.push(ex);
    queue.push({
      kind: "explore",
      explorationId: ex.id,
      queueId: c.research.nextQueueId++,
    });
    normalizeResearchQueue(c);
    return ex;
  }
  function removeExploration(s, id) {
    const list = player(s).research.explorations,
      index = list.findIndex((x) => x.id === Number(id));
    if (index < 0) throw Error("Exploración no válida.");
    if (!["Sin hallazgo", "Agotado", "Cancelada"].includes(list[index].status))
      throw Error(
        "Solo se pueden borrar exploraciones sin hallazgo o agotadas.",
      );
    return list.splice(index, 1)[0];
  }
  function setEducation(s, id, input) {
    const c = player(s),
      plan = id.startsWith("branch:")
        ? c.educationBranches[id.slice(7)]
        : c.educationPlan[id.replace("level:", "")];
    if (!plan) throw Error("Rama educativa no válida.");
    for (const key of ["budget", "staff", "salary"])
      if (input[key] !== undefined) plan[key] = needNumber(input[key]);
    const programs = [
        ...Object.values(c.educationPlan),
        ...Object.values(c.educationBranches),
      ],
      posts = programs.reduce((n, p) => n + p.staff, 0);
    if (posts > 0) {
      c.sectors.education.salary =
        programs.reduce((n, p) => n + p.staff * p.salary, 0) / posts;
      c.sectors.education.requested = Math.max(
        c.sectors.education.requested,
        posts,
      );
    }
    return plan;
  }
  function addAgreement(s, input) {
    const c = player(s),
      other = s.countries[input.countryId],
      m = D.getMaterial(input.resource);
    if (!other || other.id === c.id || !m)
      throw Error("Elegí país y recurso válidos.");
    const importing = input.direction === "import",
      from = importing ? other : c,
      to = importing ? c : other,
      duration = Math.floor(needNumber(input.months ?? 24, 1, 120));
    if (to.importsBanned || to.importBans[m.id])
      throw Error("El destino prohíbe importar ese recurso.");
    const a = {
      id: s.nextAgreementId++,
      from: from.id,
      to: to.id,
      resource: m.id,
      quantity: needNumber(input.quantity, 1e-12),
      tariff: needNumber(input.tariff ?? Math.min(5, to.taxes.imports), 0, 40),
      remaining: duration,
      duration,
      active: true,
      closed: false,
      owner: importing ? "private" : "public",
      lastQuantity: 0,
      status: "Firmado · excedentes a precio de mercado",
    };
    s.agreements.push(a);
    return a;
  }
  function cancelAgreement(s, id) {
    return closeAgreement(s, id);
  }
  function closeAgreement(s, id) {
    const c = player(s),
      a = s.agreements.find((a) => a.id === Number(id));
    if (!a || ![a.from, a.to].includes(c.id)) throw Error("Acuerdo no válido.");
    if (a.closed) throw Error("El acuerdo ya está cerrado.");
    a.active = false;
    a.closed = true;
    a.status = "Cerrado por el jugador";
    const other = a.from === c.id ? a.to : a.from;
    c.relations[other] = Math.max(0, c.relations[other] - 1);
    return a;
  }
  function renewAgreement(s, id) {
    const c = player(s),
      a = s.agreements.find((a) => a.id === Number(id)),
      to = a && s.countries[a.to],
      m = a && D.getMaterial(a.resource);
    if (!a || ![a.from, a.to].includes(c.id) || !to || !m)
      throw Error("Acuerdo no válido.");
    if (a.active) throw Error("El acuerdo todavía está activo.");
    if (a.closed) throw Error("Un acuerdo cerrado no se puede renovar.");
    if (to.importsBanned || to.importBans[m.id])
      throw Error("El destino prohíbe importar ese recurso.");
    a.duration = Math.floor(needNumber(a.duration || 24, 1, 120));
    a.remaining = a.duration;
    a.active = true;
    a.lastQuantity = 0;
    a.status = "Renovado · excedentes a precio de mercado";
    return a;
  }
  function rank(s, key = "gdp", direction = "desc", resource = null) {
    const rows = Object.values(s.countries).map((c) => ({
      id: c.id,
      name: c.name,
      value:
        key === "name"
          ? c.name
          : key === "perCapita"
            ? (c.gdp * 1000) / c.population
            : key === "production"
              ? c.materialProduction[resource] || 0
              : key === "efficiency"
                ? (sectors.reduce(
                    (n, id) =>
                      n +
                      (c.sectors[id].efficiencyPublic +
                        c.sectors[id].efficiencyPrivate) /
                        2,
                    0,
                  ) /
                    sectors.length) *
                  100
                : key === "employment"
                  ? 100 - c.unemployment
                  : c[key],
    }));
    const sign = direction === "asc" ? 1 : -1;
    rows.sort((a, b) => {
      const na =
          a.value === undefined ||
          a.value === null ||
          (typeof a.value === "number" && !Number.isFinite(a.value)),
        nb =
          b.value === undefined ||
          b.value === null ||
          (typeof b.value === "number" && !Number.isFinite(b.value));
      if (na || nb) return na === nb ? a.id.localeCompare(b.id) : na ? 1 : -1;
      return (
        (typeof a.value === "string"
          ? a.value.localeCompare(b.value, "es")
          : a.value - b.value) * sign || a.id.localeCompare(b.id)
      );
    });
    return rows.map((r, i) => ({ ...r, position: i + 1 }));
  }
  function resourceReport(s, id) {
    const c = s.countries[s.playerCountryId],
      m = D.getMaterial(id);
    if (!m) throw Error("Recurso no válido.");
    const totals = Object.values(s.countries).reduce(
      (r, x) => ({
        production: r.production + x.materialProduction[id],
        demand: r.demand + x.needs[id],
        consumption: r.consumption + x.materialConsumption[id],
      }),
      { production: 0, demand: 0, consumption: 0 },
    );
    return {
      material: { ...m, inputs: Object.fromEntries(recipe(c, m)) },
      publicProduction: c.publicProduction[id],
      privateProduction: c.privateProduction[id],
      capacity: production(c, "public", m) + production(c, "private", m),
      stock: c.publicStocks[id],
      privateStock: c.privateStocks[id],
      free: freeStock(c, "public", m),
      storage: { public: resourceStorageCapacity(c, "public", m) / volumePerUnit(m),
        private: resourceStorageCapacity(c, "private", m) / volumePerUnit(m),
        publicModules: c.buildings[`store_${id}`] || 0,
        privateModules: c.privateBuildings[`store_${id}`] || 0,
        module: D.getBuilding(`store_${id}`)?.storageAmount / volumePerUnit(m) },
      staff: resourceStaffing(c, m),
      automaticTrade: automaticExportReport(s, id),
      world: totals,
      ranking: rank(s, "production", "desc", id),
      exportable: exportable(c, "public", m),
      cost:
        c.productionCosts?.[id] ||
        recipe(c, m).reduce(
          (n, [id, q]) => n + q * s.market.resourcePrices[id],
          0,
        ),
      technology: scalarTech(c, m.technology),
      reason: c.outputReasons[id],
      deposits: c.naturalDeposits[id] || null,
      depositStatus: m.natural
        ? !c.naturalDeposits[id]
          ? "No descubierto"
          : depositRemaining(c, id) > 0
            ? "Activo"
            : "Agotado"
        : null,
    };
  }
  function financeSummary(s) {
    const c = s.countries[s.playerCountryId],
      monthly = c.finance.monthly || {},
      flows = monthly.flows || {};
    const groups = {
      taxes: 0,
      publicSales: 0,
      otherIncome: 0,
      payroll: 0,
      pensions: 0,
      operations: 0,
      investment: 0,
      inputs: 0,
      otherExpense: 0,
      interest: 0,
      principal: 0,
    };
    const taxKinds = new Set([
      "IVA",
      "IVA servicios",
      "Impuesto a las ganancias salariales",
      "Ganancias empresariales",
      "Herencias",
      "Arancel",
      "Derecho de exportación",
    ]);
    const financing = new Set([
      "Crédito automático",
      "Préstamo recibido",
      "Amortización de préstamo",
      "Amortización anticipada",
      "Amortización de deuda general",
    ]);
    for (const [kind, value] of Object.entries(flows)) {
      if (financing.has(kind)) {
        if (value < 0) groups.principal -= value;
        continue;
      }
      if (kind === "Intereses") {
        groups.interest += Math.max(0, -value);
        continue;
      }
      if (value >= 0) {
        if (taxKinds.has(kind)) groups.taxes += value;
        else if (
          kind === "Exportación" ||
          kind === "Bienes y servicios generales públicos"
        )
          groups.publicSales += value;
        else groups.otherIncome += value;
        continue;
      }
      const amount = -value;
      if (kind === "Salarios" || kind === "Salarios de obra")
        groups.payroll += amount;
      else if (kind === "Pensiones") groups.pensions += amount;
      else if (kind.startsWith("Obra:") || kind.startsWith("Investigación"))
        groups.investment += amount;
      else if (
        kind === "Insumos nacionales" ||
        kind === "Tratamiento nacional de residuos"
      )
        groups.inputs += amount;
      else if (
        kind === "Funcionamiento y mantenimiento" ||
        kind === "Subsidio sectorial" || kind === "Ayuda alimentaria" ||
        kind === "Administración demográfica" || kind === "Operación de compostaje"
      )
        groups.operations += amount;
      else groups.otherExpense += amount;
    }
    const income = groups.taxes + groups.publicSales + groups.otherIncome,
      operatingExpense =
        groups.payroll +
        groups.pensions +
        groups.operations +
        groups.investment +
        groups.inputs +
        groups.otherExpense,
      operatingBalance = income - operatingExpense,
      fiscalBalance = operatingBalance - groups.interest,
      drain = Math.max(0, -monthly.change || 0),
      runwayMonths = drain > 1e-9 ? Math.max(0, c.reserves) / drain : null,
      expenses = Object.entries(groups)
        .filter(
          ([key]) => !["taxes", "publicSales", "otherIncome"].includes(key),
        )
        .map(([key, value]) => ({ key, value }))
        .filter((x) => x.value > 1e-9)
        .sort((a, b) => b.value - a.value);
    return {
      ...groups,
      income,
      operatingExpense,
      operatingBalance,
      fiscalBalance,
      reserveChange: monthly.change || 0,
      runwayMonths,
      topExpenses: expenses.slice(0, 3),
      taxBases: { ...(c.finance.taxBases || {}) },
      debtPressure: income > 0 ? groups.interest / income : 0,
    };
  }
  function projectDiagnostic(s, project) {
    const c = s.countries[s.playerCountryId],
      p =
        typeof project === "string"
          ? c.projects.find((x) => x.id === project)
          : project;
    if (!p) throw Error("Obra no encontrada.");
    const b = D.getBuilding(p.typeId),
      need = p.laborNeed || b.laborNeed * 1000 * (p.factor || 1),
      availableWorkers = constructionWorkforce(c),
      skill =
        clamp(c.education / b.skillNeed, 0.2, 1) *
        (c.goodsBenefits?.construction || 1),
      hired = Math.min(
        availableWorkers /
          Math.max(1, c.projects.filter((x) => x.progress < 100).length),
        (need * b.months * (1 - p.progress / 100)) / skill,
      ),
      desired = Math.min(
        100 - p.progress,
        (100 / b.months) * skill * (hired / Math.max(1, need)),
      ),
      pay =
        ((p.baseCost || 0) * desired) / 100 +
        (hired * c.sectors.infrastructure.salary) / 1e9,
      materials = Object.entries(p.requirements)
        .map(([id, total]) => {
          const required = (total * desired) / 100,
            available = c.publicStocks[id] || 0;
          return {
            id,
            required,
            available,
            missing: Math.max(0, required - available),
          };
        })
        .filter((x) => x.missing > 1e-9),
      blockers = [];
    if (!availableWorkers) blockers.push({ type: "workers", amount: need });
    if (materials.length) blockers.push({ type: "materials", materials });
    if (pay > Math.max(0, c.reserves))
      blockers.push({
        type: "treasury",
        amount: pay,
        available: Math.max(0, c.reserves),
      });
    return {
      project: p,
      building: b,
      need,
      availableWorkers,
      hired,
      skill,
      desired,
      pay,
      materials,
      blockers,
      status: blockers.length ? "blocked" : "advancing",
    };
  }
  function sectorDiagnostic(s, id) {
    const c = s.countries[s.playerCountryId],
      sector = c.sectors[id];
    if (!sector) throw Error("Sector no válido.");
    const resources = D.materials
      .filter((m) => m.sector === id && c.outputReasons[m.id])
      .map((m) => ({ id: m.id, label: m.label, reason: c.outputReasons[m.id] }))
      .slice(0, 4);
    return {
      projects: c.projects
        .filter((p) => p.sector === id && p.progress < 100)
        .map((p) => projectDiagnostic(s, p)),
      resources,
      availableWorkers: c.laborSnapshot.unemployed * 1e6,
    };
  }
  return {
    ...L,
    SAVE_VERSION: 6,
    createGame,
    hydrate,
    advanceTick,
    advanceDay,
    dateLabel,
    daysInMonth,
    estimateTaxes,
    applyTaxes,
    loanPreview,
    takeLoan,
    repayment,
    tradePreview,
    tradeResource,
    importResource: (s, id, q) => tradeResource(s, id, "buy", q),
    sellResource: (s, id, q) => tradeResource(s, id, "sell", q),
    constructionPreview,
    constructionWorkforce,
    queueConstruction,
    setAdminMode: (s, enabled) => { s.adminMode = enabled === true; return s.adminMode; },
    setSector,
    setHousingProgram,
    setPension,
    pensionPreview,
    automaticExportReport,
    wasteReceptionCapacity,
    resourceStorageCapacity,
    setFoodPolicy,
    nutritionReport,
    wellbeingReport,
    setImportPolicy,
    setResourcePolicy,
    setTradePolicies,
    finalGoodsBenefits,
    setAges,
    setDemographicPolicy,
    populationPolicyLevels,
    resourceStaffing,
    nationalizePreview,
    nationalize,
    startResearch,
    researchQueuePreview,
    cancelResearchQueue,
    explore,
    removeExploration,
    setEducation,
    addAgreement,
    cancelAgreement,
    closeAgreement,
    renewAgreement,
    rank,
    resourceReport,
    financeSummary,
    projectDiagnostic,
    sectorDiagnostic,
    availableLand,
    storageCapacity,
    storageUsed,
    exportable,
    demographicSnapshot: (c) => c.laborSnapshot || L.demographicSnapshot(c),
    validateV6,
    initialize,
    closeFinance,
    book,
    debtTotal,
  };
});
