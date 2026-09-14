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
  const durableYears = {
    automobiles: 12,
    electric_vehicles: 12,
    computers: 5,
    smartphones: 3,
    electronics: 6,
    appliances: 10,
    jewelry: 25,
  };
  for (const t of D.technologies)
    (techGroups[t.sector + "|" + t.effect] ||= []).push(t);
  const map = (v) =>
    Object.fromEntries(
      materials.map((m) => [m.id, typeof v === "function" ? v(m) : v]),
    );
  const finite = (v, f = 0) => (Number.isFinite(v) ? v : f);
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
            land: scale * m.baseOutput * 480,
            sea:
              !D.landlocked.includes(c.id) && m.id === "crude_oil"
                ? scale * m.baseOutput * 360
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
  function storageCapacity(c, owner, type) {
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
  function updateCapacity(c) {
    for (const m of materials)
      c.materialCapacity[m.id] =
        c.publicStocks[m.id] + freeStock(c, "public", m);
    c.materialStocks = c.publicStocks;
  }
  function initialize(s, legacy = false) {
    s.version = 6;
    s.agreements = s.agreements || [];
    s.nextAgreementId = s.nextAgreementId || 1;
    s.financeWorld = s.financeWorld || { bank: 0, migrants: 0 };
    for (const c of Object.values(s.countries)) {
      initCountry(c, legacy);
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
      s.v6Seeded = true;
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
    // AI governments adjust gradually; the player's policies are never changed here.
    if (
      c.id !== s.playerCountryId &&
      s.tick % 3 === 0 &&
      c.finance.monthly.income !== undefined
    ) {
      const authorized = sectors.reduce((n, id) => n + c.sectors[id].budget, 0),
        income = c.finance.monthly.income;
      if (c.debt > 70 && c.fiscalCashFlowMonthly < 0) {
        const ratio = clamp(
          ((income - (c.finance.pensions || 0)) * 0.95) /
            Math.max(1e-12, authorized),
          0.5,
          1,
        );
        for (const sec of Object.values(c.sectors))
          sec.budget *= 1 - (1 - ratio) * 0.12;
      } else if (c.reserves > c.gdp * 0.08 && c.fiscalCashFlowMonthly > 0)
        for (const sec of Object.values(c.sectors)) sec.budget *= 1.005;
    }
    syncDemographics(c);
    let free = c.laborSnapshot.unemployed * 1e6;
    const pool = c.laborSnapshot.laborForce * 1e6;
    for (const sec of Object.values(c.sectors)) {
      sec.newFromUnemployment = 0;
      sec.transfers = 0;
      const cap = Math.min(
        sec.requested,
        (sec.budget * 1e9) / Math.max(1, sec.salary),
      );
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
      const target = Math.min(
        sec.requested,
        (sec.budget * 1e9) / Math.max(1, sec.salary),
        pool * qualified,
      );
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
        if (owner === "public") {
          amount = Math.min(amount, sec.budget);
          automaticFunding(s, c, amount, "Nómina pública");
        }
        amount *= affordable(c, owner, amount);
        transfer(s, c, owner, "household", amount, "Salarios");
        if (owner === "public") {
          sec.executed += amount;
          c.finance.spending += amount;
        } else sec.profit -= amount;
        c.finance.payroll += amount;
      }
      const operating =
          Math.max(0, sec.budget - sec.executed) *
          0.08 *
          (1 - techBonus(c, sid, "cost")),
        paid = Math.min(operating, Math.max(0, c.reserves));
      transfer(
        s,
        c,
        "public",
        "private",
        paid,
        "Funcionamiento y mantenimiento",
      );
      sec.executed += paid;
      c.finance.spending += paid;
      sec.profit += paid;
      const subsidy = Math.min(
        sec.subsidyCap,
        Math.max(0, sec.budget - sec.executed),
        Math.max(0, c.reserves),
      );
      transfer(s, c, "public", "private", subsidy, "Subsidio sectorial");
      sec.executed += subsidy;
      c.finance.spending += subsidy;
      sec.profit += subsidy;
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
    const pensions =
      (c.laborSnapshot.retired *
        1e6 *
        ((c.gdp * 1e9) / Math.max(1, population(c))) *
        0.2) /
      12 /
      1e9;
    automaticFunding(s, c, pensions, "Pensiones");
    const paid = Math.min(pensions, Math.max(0, c.reserves));
    transfer(s, c, "public", "household", paid, "Pensiones");
    c.finance.spending += paid;
    c.finance.pensions = paid;
    c.finance.lastPayroll = c.finance.payroll;
    c.incomePulse = last > 0 ? clamp(c.finance.payroll / last, 0.5, 1.5) : 1;
  }
  function efficiency(c, sid, owner) {
    const sec = c.sectors[sid],
      base = owner === "public" ? sec.efficiencyPublic : sec.efficiencyPrivate;
    return clamp(
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
      budget = Math.min(
        Math.max(0, c.sectors[sid].budget - c.sectors[sid].executed),
        Math.max(0, c.reserves + credit),
      );
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
        automaticFunding(
          s,
          c,
          Math.min(
            missing * price,
            Math.max(0, c.sectors[sid].budget - c.sectors[sid].executed),
          ),
          "Insumos productivos públicos",
        );
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
    const assets = owner === "public" ? c.buildings : c.privateBuildings;
    const count =
        (assets[m.unlock] || 0) +
        (m.id === "crude_oil" ? (assets.offshore_platform || 0) * 2 : 0),
      sec = c.sectors[m.sector];
    const filled =
      owner === "public"
        ? sec.publicWorkers / Math.max(1, sec.requested)
        : sec.privateWorkers / Math.max(1, sec.privateJobs);
    const tech = scalarTech(c, m.technology);
    return !tech
      ? 0
      : count *
          m.baseOutput *
          clamp(filled, 0, 1) *
          efficiency(c, m.sector, owner) *
          (1 + (tech - 1) * 0.08) *
          (owner === "public" ? c.productionTargets[m.id] : 1);
  }
  function runEnergy(s, c) {
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
          Number(["fossil", "nuclear", "biomass"].includes(a.energyKind)) -
          Number(["fossil", "nuclear", "biomass"].includes(b.energyKind)),
      );
    for (const b of plants)
      for (const owner of owners) {
        const count =
          owner === "public" ? c.buildings[b.id] : c.privateBuildings[b.id];
        if (!count) continue;
        const sec = c.sectors.energy,
          fill =
            owner === "public"
              ? sec.publicWorkers / Math.max(1, sec.requested)
              : sec.privateWorkers / Math.max(1, sec.privateJobs);
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
                  : null,
          ratio =
            kind === "nuclear" ? 0.000003 : kind === "fossil" ? 0.18 : 1.5;
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
                : dep.land
              : 0,
          );
        }
        output *= Math.max(0.05, c.energy.served);
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
        }
      }
    }
    husbandry(s, c);
    for (const m of materials) {
      c.householdDemand[m.id] =
        ((m.household * population(c)) / 12) *
        clamp(0.45 + (c.realGdp * 1e9) / population(c) / 35000, 0.45, 1.8) *
        clamp(1 + H.activeEventEffects(c, s).demand, 0.3, 1.4);
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
      const fill =
        owner === "public"
          ? sec.publicWorkers / Math.max(1, sec.requested)
          : sec.privateWorkers / Math.max(1, sec.privateJobs);
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
      const price = s.market.resourcePrices[m.id],
        tax = (price * c.taxes.vat) / 100,
        available = stocks(c, owner)[m.id],
        q = Math.min(
          request - served,
          available,
          Math.max(0, c.finance.householdCash) / Math.max(1e-15, price + tax),
        );
      if (q <= 0) continue;
      stocks(c, owner)[m.id] -= q;
      transfer(s, c, "household", owner, q * price, "Consumo nacional");
      transfer(s, c, "household", "public", q * tax, "IVA");
      c.finance.taxes += q * tax;
      c.finance.taxBases.vat += q * price;
      c.materialConsumption[m.id] += q;
      c.householdConsumed[m.id] += q;
      if (durableYears[m.id]) c.durableOwnership[m.id] += q;
      if (owner === "private") {
        c.sectors[m.sector].revenue += q * price;
        c.sectors[m.sector].profit += q * price;
      }
      served += q;
    }
    return served;
  }
  function consume(s, c, remaining = false) {
    for (const m of materials
      .filter((m) => m.household > 0)
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
      for (const m of materials.filter((m) => m.household > 0)) {
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
  }
  function exportable(c, owner, m) {
    const total = c.publicStocks[m.id] + c.privateStocks[m.id],
      protectedStock = Math.max(c.stockMinimum[m.id], c.needs[m.id] || 0);
    return Math.max(
      0,
      stocks(c, owner)[m.id] -
        (total ? (protectedStock * stocks(c, owner)[m.id]) / total : 0),
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
  function exchange(
    s,
    from,
    to,
    m,
    requested,
    ownerFrom = "private",
    ownerTo = "private",
    agreement = null,
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
      const treatment =
        (to.buildings.waste_treatment + to.privateBuildings.waste_treatment) *
          20000 +
        (m.id === "organic_waste"
          ? (to.buildings.biomass_plant + to.privateBuildings.biomass_plant) *
            20000
          : 0);
      q = Math.min(
        q,
        Math.max(
          0,
          treatment - (to.publicStocks[m.id] + to.privateStocks[m.id]),
        ),
      );
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
    });
    return q;
  }
  function trade(s) {
    const countries = Object.values(s.countries).sort((a, b) =>
      a.id.localeCompare(b.id),
    );
    s.market.trades = [];
    for (const c of countries) c.transported = 0;
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
      );
      a.status = a.lastQuantity
        ? "Operativo"
        : "Sin excedente, demanda, fondos o capacidad";
      a.remaining--;
      if (!a.remaining) a.active = false;
    }
    for (const m of materials) {
      if (m.waste) continue;
      const sellers = countries
        .flatMap((c) =>
          owners.map((owner) => ({ c, owner, stock: exportable(c, owner, m) })),
        )
        .filter((x) => x.stock > 1e-6);
      const buyers = countries
        .filter((c) => !c.importsBanned && !c.importBans[m.id])
        .map((c) => ({
          c,
          need: Math.max(
            0,
            c.needs[m.id] * 1.4 - c.publicStocks[m.id] - c.privateStocks[m.id],
          ),
        }))
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
          if (seller.c.id === buyer.c.id) continue;
          buyer.need -= exchange(
            s,
            seller.c,
            buyer.c,
            m,
            buyer.need,
            seller.owner,
          );
        }
      }
    }
  }
  function waste(s, c) {
    c.uncollectedWaste ||= map(0);
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
        recycled * 0.4,
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
  function constructionPreview(s, id, factor = 1) {
    const c = s.countries[s.playerCountryId],
      b = D.getBuilding(id);
    if (!b) throw Error("Construcción no válida.");
    factor = needNumber(factor, 1, 100);
    if (!Number.isInteger(factor)) throw Error("Construí módulos enteros.");
    const land = (b.landHa || b.agricultureHa || 0) * factor;
    let blocked = "";
    if (!scalarTech(c, b.technology))
      blocked = "Investigar " + D.getTechnology(b.technology).label;
    if (b.coastal && D.landlocked.includes(c.id))
      blocked = "El país no tiene acceso marítimo";
    if (b.deposit) {
      const dep = c.naturalDeposits[b.deposit];
      if (!dep || !(b.offshore ? dep.sea : dep.land))
        blocked =
          "Hace falta descubrir un depósito " +
          (b.offshore ? "marítimo" : "terrestre");
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
    const laborNeed = b.laborNeed * 1000 * factor,
      salary = c.sectors.infrastructure.salary,
      wageIndex = clamp(salary / 1000, 0.1, 10),
      skillMatch = clamp(c.education / Math.max(1, b.skillNeed), 0.2, 1),
      laborAvailability = clamp(
        (c.laborSnapshot.unemployed * 1e6) / Math.max(1, laborNeed),
        0.1,
        1,
      );
    const estimatedMonths = b.months / skillMatch;
    const laborCost = ((laborNeed * salary) / 1e9) * estimatedMonths;
    return {
      id,
      factor,
      baseCost: b.fixedCost * factor,
      laborCost,
      totalCost: b.fixedCost * factor + laborCost + materialCost,
      materialCost,
      landHa: land,
      convertAgricultureHa: convertible,
      requirements: requests,
      laborNeed,
      salary,
      skillMatch: skillMatch * 100,
      laborAvailability: laborAvailability * 100,
      wageIndex,
      estimatedMonths,
      speed: 100 / estimatedMonths,
      energyShare: b.energyOutput
        ? ((b.energyOutput * factor) /
            Math.max(0.00001, c.electricityDemandTWh)) *
          100
        : null,
      unlocks: materials.filter((m) => m.unlock === id).map((m) => m.id),
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
    if (c.projects.filter((p) => p.progress < 100).length >= 8)
      throw Error("Se admiten hasta ocho obras activas.");
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
    note(s, c, `${b.label}: obra iniciada (${p.quantity} ${p.unit}).`);
    return project;
  }
  function projects(s, c) {
    let free = c.laborSnapshot.unemployed * 1e6;
    c.constructionWorkers = 0;
    for (const p of c.projects) {
      if (p.progress >= 100) continue;
      const b = D.getBuilding(p.typeId),
        factor = p.factor || 1,
        need = p.laborNeed || b.laborNeed * 1000 * factor;
      const hired = Math.min(need, free);
      free -= hired;
      c.constructionWorkers += hired;
      p.workers = hired;
      const laborRatio = hired / Math.max(1, need),
        skill = clamp(c.education / b.skillNeed, 0.2, 1),
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
      f = Math.min(
        f,
        affordable(c, "public", pay),
        Math.max(0, c.sectors[b.sector].budget - c.sectors[b.sector].executed) /
          Math.max(1e-12, pay),
      );
      if (!hired) p.blockedBy.push("trabajadores");
      if (pay > Math.max(0, c.reserves)) p.blockedBy.push("presupuesto");
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
        p.progress = 100;
        p.completedAt = L.monthLabel(s.date);
        c.buildings[b.id] += factor;
        if (b.housingUnits) c.housingStock.new += b.housingUnits * factor;
        if (b.housingRepairUnits) {
          const repaired = Math.min(
            c.housingStock.repair,
            b.housingRepairUnits * factor,
          );
          c.housingStock.repair -= repaired;
          c.housingStock.normal += repaired;
        }
        if (b.irrigatedHa) c.land.irrigatedHa += b.irrigatedHa * factor;
        if (c.infrastructureAssets[b.id] !== undefined)
          c.infrastructureAssets[b.id] += (b.quantity || 1) * factor;
        if (b.livestock) c.herds.public[b.livestock] += b.heads * factor;
        const sec = c.sectors[b.sector];
        sec.requested += Math.max(2, b.laborNeed * 200 * factor);
        note(
          s,
          c,
          `${b.label} terminada; la capacidad entra en operación el próximo mes.`,
        );
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
        skill = clamp(c.education / b.skillNeed, 0.2, 1);
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
        fullCost = wage + base,
        remainingBudget = Math.max(0, sector.budget - sector.executed);
      let share = Math.min(
        1,
        budgetCap / Math.max(1e-12, fullCost),
        remainingBudget / Math.max(1e-12, fullCost),
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
          : remainingBudget <= 0
            ? "Sin presupuesto disponible de Infraestructura"
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
          ? "Avance parcial por caja, presupuesto o materiales"
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
        cost = Math.min(
          operating,
          Math.max(0, sec.budget - sec.executed),
          Math.max(0, c.reserves),
        );
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
  function research(s, c) {
    const scientists = c.researchScientists || 0,
      labs = c.buildings.research_lab;
    const active = c.research.explorations.filter(
        (x) => x.status === "En curso",
      ),
      division = 1 + active.length;
    const project = c.research.project;
    if (project) {
      const t = D.getTechnology(project.technology);
      const budget = Math.min(
          project.budget,
          Math.max(
            0,
            c.sectors.education.budget - c.sectors.education.executed,
          ),
          Math.max(0, c.reserves),
        ),
        cost = budget;
      transfer(s, c, "public", "private", cost, "Investigación: " + t.label);
      c.sectors.education.executed += cost;
      c.finance.spending += cost;
      const capacity =
          clamp(
            scientists / division / Math.max(1, population(c) * 0.00002),
            0,
            1,
          ) * clamp(labs / 0.1, 0, 1),
        funded = clamp(
          budget / Math.max(1e-12, c.gdp * 0.00002 * project.level),
          0,
          1,
        );
      project.progress +=
        (100 / (t.months * project.level)) *
        capacity *
        clamp(c.education / t.skill, 0.1, 1) *
        funded;
      if (project.progress >= 100) {
        c.research.levels[t.id] = project.level;
        c.research.history.unshift({
          label: t.label,
          level: project.level,
          tick: s.tick,
        });
        c.research.project = null;
        note(s, c, `${t.label}: nivel ${project.level} completado.`);
      }
    }
    for (const ex of active) {
      const monthly = ex.budget,
        paid = Math.min(
          monthly,
          Math.max(
            0,
            c.sectors.education.budget - c.sectors.education.executed,
          ),
          Math.max(0, c.reserves),
        );
      transfer(s, c, "public", "private", paid, "Exploración geológica");
      c.finance.spending += paid;
      c.sectors.education.executed += paid;
      ex.progress +=
        (100 / 12) *
        clamp(paid / Math.max(1e-12, c.gdp * 0.00001), 0, 1) *
        clamp(
          scientists / division / Math.max(1, population(c) * 0.00001),
          0,
          1,
        );
      if (ex.progress >= 100) {
        ex.progress = 100;
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
            size = m.baseOutput * (24 + ex.sizeRoll * 120);
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
    c.spendingTarget =
      (sectors.reduce((n, id) => n + c.sectors[id].budget, 0) * 1200) / c.gdp;
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
          c.sectors[project.sector].requested += project.jobs;
        } else {
          c.privateBuildings[project.building] += project.factor;
          c.sectors[project.sector].privateJobs += project.jobs;
        }
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
      if (c.nationalized?.[sid]) continue;
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
      const fullStore = D.storageTypes.find(
        (t) =>
          storageUsed(c, "private", t.id) >
          storageCapacity(c, "private", t.id) * 0.92,
      );
      let b =
        sid === "services" && fullStore
          ? buildings.find((b) => b.storage === fullStore.id)
          : D.getBuilding(serviceChoice) || D.getBuilding(m?.unlock);
      if (
        !b ||
        !scalarTech(c, b.technology) ||
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
      else if (b.storage)
        wanted = Math.max(
          1,
          (storageUsed(c, "private", b.storage) * 0.15) / b.storageAmount,
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
        c.sectors.infrastructure.executed /
          Math.max(1e-12, c.sectors.infrastructure.budget),
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
    const quality =
      (stock.new / Math.max(0.000001, sum(stock))) * 3 +
      techBonus(c, "infrastructure", "quality") * 4;
    const target = clamp(
      20 +
        c.consumptionCoverage * 28 +
        c.housing * 0.2 +
        (1 - c.unemployment / 100) * 16 +
        c.energy.served * 8 +
        c.infrastructure * 0.06 +
        quality -
        Math.min(25, c.wasteBurden * 12),
      0,
      98,
    );
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
        c.wasteBurden * 4,
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
        c.wasteBurden * 0.1,
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
      for (let age = 0; age <= 100; age++) {
        const risk = clamp(
            ((age < 5
              ? 0.003
              : age < 50
                ? 0.0002
                : 0.0002 * Math.exp((age - 50) / 9)) *
              Math.exp((75 - c.lifeExpectancy) / 15)) /
              12 +
              shock / 12000,
            0,
            0.3,
          ),
          dead = a[age] * risk,
          alive = a[age] - dead;
        deaths += dead;
        const next = age === 100 ? 0 : alive / 12;
        newA[age] += alive - next;
        if (age < 100) newA[age + 1] += next;
        if (age === 17) enter = next;
        if (age === 64) retire = next;
      }
      const cap = c.land.areaKm2 * 60000;
      const births = Math.min(
        (old * c.birthRate) / 12000,
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
      syncDemographics(c);
    }
    const receivers = cs
      .map((c) => ({
        c,
        score: c.happiness + c.lifeExpectancy * 0.3 - c.unemployment * 0.5,
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
      let leaving =
        population(c) *
        clamp(
          (55 - c.happiness) / 100000 +
            H.activeEventEffects(c, s).migrationPush / 12000,
          0,
          0.002,
        );
      for (const r of receivers) {
        if (!leaving) break;
        if (
          r.c.id === c.id ||
          r.score < c.happiness + c.lifeExpectancy * 0.3 + 5
        )
          continue;
        const amount = Math.min(leaving, r.free),
          adult = c.ageCohorts.slice(18, 65).reduce((a, b) => a + b, 0),
          n = Math.min(amount, adult * 0.01);
        if (!n) continue;
        for (let age = 18; age < 65; age++) {
          const share = (c.ageCohorts[age] / adult) * n;
          c.ageCohorts[age] -= share;
          r.c.ageCohorts[age] += share;
        }
        leaving -= n;
        r.free -= n;
        c.demographicFlows.migration -= n / 1e6;
        r.c.demographicFlows.migration += n / 1e6;
      }
    }
    for (const c of cs) {
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
  function advanceTick(s) {
    if (s.gameOver) return s;
    initialize(s, true);
    s.tick++;
    const pops = Object.fromEntries(
      Object.values(s.countries).map((c) => [c.id, c.population]),
    );
    H.updateWorldEvents(s);
    for (const c of Object.values(s.countries)) {
      if (c.population !== pops[c.id]) {
        const ratio = c.population / pops[c.id];
        c.ageCohorts = c.ageCohorts.map((n) => n * ratio);
      }
      c.disasterDeaths = Math.max(0, pops[c.id] - c.population) * 1e6;
      c.finance.openingReserves = c.reserves;
      c.finance.pendingPublic = 0;
      c.finance.tickFlows = {};
      working(s, c);
      wages(s, c);
      produce(s, c);
      consume(s, c);
    }
    trade(s);
    for (const c of Object.values(s.countries)) {
      consume(s, c, true);
      passiveHousing(s, c, projects(s, c));
      education(s, c);
      research(s, c);
      waste(s, c);
      closeFinance(s, c);
      privateDevelopment(s, c);
      wellbeing(c);
    }
    demographics(s);
    prices(s);
    H.advanceDate(s);
    H.captureHistory(s);
    const h = s.history[s.history.length - 1],
      c = s.countries[s.playerCountryId];
    h.reserves = c.reserves;
    h.fiscalBalance = c.fiscalBalance;
    h.lifeExpectancy = c.lifeExpectancy;
    H.evaluateGame(s);
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
        ...c.ageCohorts,
      ])
        if (!Number.isFinite(value))
          throw Error("Guardado con datos económicos inválidos.");
      if (
        c.ageCohorts.length !== 101 ||
        c.ageCohorts.some((n) => n < 0) ||
        c.finance.baseDebt < 0
      )
        throw Error("Guardado con población o deuda inválida.");
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
    for (const key of ["budget", "salary", "requested", "subsidyCap"])
      if (input[key] !== undefined) values[key] = needNumber(input[key]);
    Object.assign(sec, values);
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
    if (input.minimum !== undefined)
      c.stockMinimum[id] = needNumber(input.minimum);
    if (input.target !== undefined)
      c.productionTargets[id] = needNumber(input.target, 0, 1);
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
  function nationalizePreview(s, sid, share = 1) {
    const c = s.countries[s.playerCountryId];
    if (!c.sectors[sid]) throw Error("Sector no válido.");
    share = needNumber(share, 0, 1);
    const assets = buildings.filter((b) => b.sector === sid);
    const cost =
      assets.reduce(
        (n, b) => n + c.privateBuildings[b.id] * b.fixedCost * share,
        0,
      ) +
      materials
        .filter((m) => m.sector === sid)
        .reduce(
          (n, m) =>
            n +
            c.privateStocks[m.id] *
              Math.max(0, s.market.resourcePrices[m.id]) *
              share,
          0,
        );
    return { share, cost, workers: c.sectors[sid].privateWorkers * share };
  }
  function nationalize(s, sid, share = 1) {
    const c = player(s),
      p = nationalizePreview(s, sid, share);
    const space = Object.fromEntries(
      D.storageTypes.map((t) => [
        t.id,
        {
          public: storageCapacity(c, "public", t.id),
          total:
            storageCapacity(c, "public", t.id) +
            storageCapacity(c, "private", t.id),
        },
      ]),
    );
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
    for (const b of buildings.filter((b) => b.sector === sid)) {
      const n = c.privateBuildings[b.id] * share;
      c.privateBuildings[b.id] -= n;
      c.buildings[b.id] += n;
    }
    for (const m of materials.filter((m) => m.sector === sid)) {
      const n = c.privateStocks[m.id] * share;
      c.privateStocks[m.id] -= n;
      c.publicStocks[m.id] += n;
    }
    if (sid === "agriculture")
      for (const type of Object.keys(c.herds.private)) {
        const n = c.herds.private[type] * share;
        c.herds.private[type] -= n;
        c.herds.public[type] += n;
      }
    if (share === 1) {
      c.nationalized[sid] = true;
      for (const project of c.privateProjects.filter((p) => p.sector === sid))
        project.owner = "public";
    }
    const sec = c.sectors[sid];
    sec.privateWorkers -= p.workers;
    sec.privateJobs *= 1 - share;
    sec.publicWorkers += p.workers;
    sec.requested += p.workers;
    // Existing inventories retain access to leased space; no warehouse volume is invented.
    for (const t of D.storageTypes) {
      const old = space[t.id],
        target = clamp(
          old.public,
          storageUsed(c, "public", t.id),
          Math.max(0, old.total - storageUsed(c, "private", t.id)),
        ),
        delta = target - storageCapacity(c, "public", t.id);
      c.storageLease.public[t.id] = (c.storageLease.public[t.id] || 0) + delta;
      c.storageLease.private[t.id] =
        (c.storageLease.private[t.id] || 0) - delta;
    }
    updateCapacity(c);
    return p;
  }
  function startResearch(s, id, budget) {
    const c = player(s),
      t = D.getTechnology(id);
    if (!t) throw Error("Tecnología no válida.");
    if (c.research.project) throw Error("Ya hay una investigación activa.");
    if (!c.buildings.research_lab)
      throw Error("Construí un laboratorio de investigación.");
    if (!t.requires.every((dep) => scalarTech(c, dep)))
      throw Error("Faltan tecnologías previas.");
    const level = scalarTech(c, id) + 1;
    if (level > t.maxLevel) throw Error("Nivel máximo alcanzado.");
    c.research.project = {
      technology: id,
      level,
      progress: 0,
      budget: needNumber(budget, 1e-12),
    };
    return c.research.project;
  }
  function explore(s, id, offshore, budget) {
    const c = player(s),
      m = D.getMaterial(id);
    if (!m?.natural) throw Error("Recurso no explorable.");
    if (!scalarTech(c, offshore ? "offshore_exploration" : "prospecting"))
      throw Error("Hace falta investigar prospección.");
    if (offshore && (id !== "crude_oil" || D.landlocked.includes(c.id)))
      throw Error("Exploración marítima no disponible.");
    if (!c.buildings.research_lab) throw Error("Hace falta un laboratorio.");
    if (
      c.research.explorations.filter((x) => x.status === "En curso").length >= 3
    )
      throw Error("Ya hay tres campañas activas.");
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
    return ex;
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
      to = importing ? c : other;
    if (to.importsBanned || to.importBans[m.id])
      throw Error("El destino prohíbe importar ese recurso.");
    const a = {
      id: s.nextAgreementId++,
      from: from.id,
      to: to.id,
      resource: m.id,
      quantity: needNumber(input.quantity, 1e-12),
      tariff: needNumber(input.tariff ?? Math.min(5, to.taxes.imports), 0, 40),
      remaining: needNumber(input.months ?? 24, 1, 120),
      active: true,
      owner: importing ? "private" : "public",
      lastQuantity: 0,
      status: "Firmado · excedentes a precio de mercado",
    };
    s.agreements.push(a);
    return a;
  }
  function cancelAgreement(s, id) {
    const c = player(s),
      a = s.agreements.find((a) => a.id === Number(id));
    if (!a || ![a.from, a.to].includes(c.id)) throw Error("Acuerdo no válido.");
    a.active = false;
    a.status = "Cancelado";
    const other = a.from === c.id ? a.to : a.from;
    c.relations[other] = Math.max(0, c.relations[other] - 1);
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
        kind === "Subsidio sectorial"
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
      availableWorkers = Math.max(0, c.laborSnapshot.unemployed * 1e6),
      hired = Math.min(need, availableWorkers),
      skill = clamp(c.education / b.skillNeed, 0.2, 1),
      desired = Math.min(
        100 - p.progress,
        (100 / b.months) * skill * (hired / Math.max(1, need)),
      ),
      sector = c.sectors[b.sector],
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
      budgetAvailable = Math.max(0, sector.budget - sector.executed),
      blockers = [];
    if (!availableWorkers) blockers.push({ type: "workers", amount: need });
    if (materials.length) blockers.push({ type: "materials", materials });
    if (pay > Math.max(0, c.reserves))
      blockers.push({
        type: "treasury",
        amount: pay,
        available: Math.max(0, c.reserves),
      });
    if (pay > budgetAvailable)
      blockers.push({
        type: "sectorBudget",
        amount: pay,
        available: budgetAvailable,
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
      budgetAvailable,
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
      budgetAvailable: Math.max(0, sector.budget - sector.executed),
    };
  }
  return {
    ...L,
    SAVE_VERSION: 6,
    createGame,
    hydrate,
    advanceTick,
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
    queueConstruction,
    setSector,
    setHousingProgram,
    setImportPolicy,
    setResourcePolicy,
    setAges,
    nationalizePreview,
    nationalize,
    startResearch,
    explore,
    setEducation,
    addAgreement,
    cancelAgreement,
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
