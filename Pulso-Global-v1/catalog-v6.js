(function (root, factory) {
  const data = factory(
    typeof module === "object" && module.exports
      ? require("./data.js")
      : root.PULSO_DATA,
    typeof module === "object" && module.exports
      ? require("./country-facts.js")
      : root.PULSO_FACTS,
  );
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.PULSO_DATA = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function (D, FACTS) {
  "use strict";
  D.version = 6;
  D.release = "6.1.0";
  D.facts = FACTS;
  const techs = [];
  function branch(sector, items) {
    let previous = null;
    for (const item of items) {
      const [id, label, skill = 40, effect = "output"] = item;
      techs.push({
        id,
        label,
        sector,
        skill,
        requires: previous ? [previous] : [],
        months: 6 + Math.round(skill / 8),
        effect,
        improvement: effect === "cost" ? 0.06 : 0.08,
        maxLevel: 4,
      });
      previous = id;
    }
  }
  branch("infrastructure", [
    ["civil", "Ingeniería civil"],
    ["paving", "Pavimentación avanzada"],
    ["motorways", "Autopistas", 50],
    ["traffic", "Tránsito inteligente", 70, "logistics"],
  ]);
  branch("infrastructure", [
    ["railway", "Ferrocarriles", 45],
    ["electric_rail", "Electrificación ferroviaria", 60],
    ["high_speed", "Tren de alta velocidad", 85],
  ]);
  branch("infrastructure", [
    ["urban", "Urbanismo", 40],
    ["subway", "Subterráneos", 65],
    ["vertical", "Urbanización vertical", 75],
    ["resilience", "Construcción antisísmica", 75, "resilience"],
  ]);
  branch("infrastructure", [
    ["housing", "Construcción residencial"],
    ["prefab", "Viviendas prefabricadas", 50, "cost"],
    ["insulation", "Aislamiento y eficiencia", 55, "cost"],
    ["rehabilitation", "Rehabilitación habitacional", 55, "quality"],
  ]);
  branch("services", [
    ["ports", "Ingeniería portuaria", 50, "logistics"],
    ["airports", "Ingeniería aeroportuaria", 60, "logistics"],
    ["intermodal", "Logística intermodal", 65, "logistics"],
    ["customs", "Aduanas digitales", 70, "logistics"],
  ]);
  branch("energy", [
    ["thermal", "Generación fósil", 40],
    ["refining", "Refinación petrolera", 50],
    ["emissions", "Combustión y control de emisiones", 60, "cost"],
  ]);
  for (const [id, label, skill] of [
    ["hydro", "Hidroelectricidad", 55],
    ["wind", "Eólica terrestre", 50],
    ["solar", "Energía solar", 50],
    ["geothermal", "Geotermia", 65],
    ["biomass", "Biomasa", 45],
  ])
    branch("energy", [[id, label, skill]]);
  branch("energy", [
    ["nuclear_physics", "Física nuclear", 75],
    ["fission", "Fisión nuclear", 85],
    ["nuclear_safety", "Seguridad y optimización nuclear", 90, "resilience"],
  ]);
  branch("energy", [
    ["grid", "Redes eléctricas", 40, "logistics"],
    ["smart_grid", "Red eléctrica inteligente", 75, "cost"],
    ["energy_storage", "Almacenamiento energético", 80, "capacity"],
  ]);
  branch("agriculture", [
    ["farming", "Agricultura", 25],
    ["mechanization", "Mecanización agrícola", 40],
    ["irrigation", "Sistemas de riego", 40],
    ["fertilizer", "Fertilizantes", 45],
    ["precision_agro", "Agricultura de precisión", 70],
  ]);
  branch("agriculture", [
    ["seeds", "Mejoramiento de semillas", 40],
    ["pests", "Control de plagas", 45, "resilience"],
    ["soil", "Conservación de suelos", 50, "resilience"],
    ["greenhouses", "Invernaderos", 60],
  ]);
  branch("agriculture", [
    ["livestock", "Cría extensiva", 25],
    ["feed", "Alimento balanceado", 40],
    ["veterinary", "Sanidad veterinaria", 50, "resilience"],
    ["genetics", "Genética y cría intensiva", 70],
    ["traceability", "Trazabilidad sanitaria", 70, "quality"],
  ]);
  branch("agriculture", [
    ["food_processing", "Procesamiento de alimentos", 40],
    ["cold_chain", "Cadena de frío", 50, "cost"],
    ["dairy", "Industria láctea", 50],
    ["leather", "Cuero y lana", 50],
  ]);
  branch("industry", [
    ["geology", "Cartografía geológica", 40],
    ["prospecting", "Prospección terrestre", 50],
    ["offshore_exploration", "Prospección marítima", 70],
    ["deep_mining", "Minería profunda", 80],
  ]);
  branch("energy", [
    ["drilling", "Perforación terrestre", 50],
    ["offshore", "Plataformas marítimas", 75],
    ["recovery", "Recuperación avanzada de yacimientos", 85, "cost"],
  ]);
  branch("industry", [
    ["mining", "Minería", 35],
    ["mineral_refining", "Refinación de minerales", 50],
    ["automated_mining", "Extracción automatizada", 80, "cost"],
  ]);
  branch("industry", [
    ["lithium", "Extracción de litio", 55],
    ["cells", "Celdas de batería", 70],
    ["batteries", "Baterías de litio", 75],
  ]);
  branch("industry", [
    ["precious", "Oro y diamantes", 50],
    ["jewelry", "Joyería", 60, "quality"],
    ["diamond_tools", "Herramientas de diamante", 70],
  ]);
  branch("industry", [
    ["cement", "Producción de cemento", 35],
    ["steel", "Siderurgia", 45],
    ["petrochem", "Petroquímica", 55],
    ["machine_tools", "Máquinas herramienta", 60],
  ]);
  branch("industry", [
    ["vehicles", "Vehículos particulares", 60],
    ["industrial_vehicles", "Maquinaria y transporte", 65],
    ["electric_vehicles", "Vehículos eléctricos", 80],
  ]);
  branch("industry", [
    ["electronics", "Electrónica básica", 55],
    ["semiconductors", "Semiconductores", 70],
    ["advanced_chips", "Microchips avanzados", 85],
    ["supercomputing", "Supercomputadoras", 92],
  ]);
  branch("industry", [
    ["computing", "Computadoras", 65],
    ["telecom", "Telecomunicaciones", 70],
    ["smartphones", "Teléfonos de alta gama", 85],
    ["servers", "Servidores", 85],
  ]);
  branch("industry", [
    ["appliances", "Electrodomésticos", 55],
    ["automation", "Automatización industrial", 75, "cost"],
    ["robotics", "Robótica", 85, "cost"],
  ]);
  branch("education", [
    ["primary", "Educación primaria", 25, "education"],
    ["secondary", "Educación secundaria", 40, "education"],
    ["technical", "Formación técnica y agrícola", 50, "education"],
    ["university", "Universidades", 65, "education"],
    ["laboratories", "Red de laboratorios", 75, "education"],
  ]);
  for (const [id, label] of [
    ["medical_science", "Investigación médica"],
    ["economic_science", "Investigación económica"],
    ["energy_science", "Investigación energética"],
    ["industrial_science", "Investigación industrial"],
    ["tourism_science", "Investigación turística"],
    ["advanced_science", "Ciencias avanzadas"],
  ])
    branch("education", [[id, label, 75, "education"]]);
  branch("health", [
    ["sanitation", "Agua y saneamiento", 35, "health"],
    ["primary_care", "Atención primaria", 40, "health"],
    ["hospitals", "Hospitales", 55, "health"],
    ["diagnosis", "Diagnóstico y especialidades", 70, "health"],
    ["biotech", "Biotecnología", 85, "health"],
  ]);
  branch("health", [
    ["pharma", "Producción farmacéutica", 60, "health"],
    ["vaccines", "Vacunas", 75, "health"],
    ["prevention", "Medicina preventiva", 65, "health"],
    ["digital_health", "Historia clínica digital", 75, "health"],
  ]);
  branch("services", [
    ["banking", "Sistema bancario", 40, "services"],
    ["insurance", "Seguros", 50, "services"],
    ["retail", "Comercio minorista", 40, "services"],
    ["ecommerce", "Comercio electrónico", 70, "services"],
  ]);
  branch("services", [
    ["tourism", "Turismo y hotelería", 40, "services"],
    ["international_tourism", "Turismo internacional", 60, "services"],
    ["freight", "Transporte de cargas", 55, "logistics"],
  ]);
  branch("services", [
    ["waste_collection", "Recolección de residuos", 30, "waste"],
    ["separation", "Separación y reciclaje", 45, "waste"],
    ["waste_energy", "Recuperación energética", 60, "waste"],
    ["hazardous", "Tratamiento especializado", 75, "waste"],
  ]);
  branch("security", [
    ["census", "Censos y estadísticas", 35, "tax"],
    ["tax_admin", "Administración tributaria", 45, "tax"],
    ["digital_government", "Gobierno digital", 65, "tax"],
    ["budget_management", "Gestión presupuestaria", 65, "cost"],
  ]);
  branch("security", [
    ["civil_defense", "Defensa civil", 35, "resilience"],
    ["weather_warning", "Alerta meteorológica", 55, "resilience"],
    ["seismic", "Monitoreo sísmico", 65, "resilience"],
    ["emergencies", "Coordinación de emergencias", 65, "resilience"],
  ]);
  D.technologies = techs;
  D.educationLevels = [
    ["primary", "Primaria", 36, 18],
    ["secondary", "Secundaria", 36, 30],
    ["technical", "Superior técnica", 24, 55],
    ["university", "Universitaria", 48, 75],
  ].map(([id, label, months, skill]) => ({ id, label, months, skill }));
  D.educationBranches = [
    ["general", "Formación general"],
    ["technical", "Técnicos"],
    ["agriculture", "Agricultura y veterinaria"],
    ["science", "Ciencia avanzada"],
    ["medicine", "Medicina"],
    ["economics", "Economía"],
    ["tourism", "Turismo"],
  ].map(([id, label]) => ({ id, label }));
  D.storageTypes = [
    ["silo", "Silos", 50000],
    ["cold", "Cámaras alimentarias", 15000],
    ["tank_oil", "Tanques de crudo", 50000],
    ["tank_fuel", "Tanques de combustible", 50000],
    ["tank_chem", "Tanques de químicos", 20000],
    ["industrial", "Depósitos industriales", 100000],
    ["logistics", "Centros logísticos", 30000],
    ["strategic", "Almacenes estratégicos", 1000],
    ["waste", "Centros de residuos", 50000],
  ].map(([id, label, capacity]) => ({ id, label, capacity }));
  const resources = [
    // id, name, tier, USD/unit, production per facility/month, sector, technology, inputs, storage, household units/person/year
    [
      "grains",
      "Granos",
      "basic",
      250,
      330,
      "agriculture",
      "farming",
      {},
      "silo",
      0.08,
    ],
    [
      "timber",
      "Madera",
      "basic",
      400,
      1500,
      "agriculture",
      "farming",
      {},
      "industrial",
      0,
    ],
    [
      "crude_oil",
      "Petróleo crudo",
      "basic",
      550,
      5000,
      "energy",
      "drilling",
      {},
      "tank_oil",
      0,
    ],
    [
      "iron_ore",
      "Mineral de hierro",
      "basic",
      120,
      10000,
      "industry",
      "mining",
      {},
      "industrial",
      0,
    ],
    [
      "copper",
      "Cobre",
      "basic",
      8500,
      800,
      "industry",
      "mining",
      {},
      "industrial",
      0,
    ],
    [
      "uranium",
      "Uranio",
      "basic",
      90000,
      5,
      "industry",
      "mining",
      {},
      "strategic",
      0,
    ],
    [
      "minerals",
      "Minerales industriales",
      "basic",
      90,
      20000,
      "industry",
      "mining",
      {},
      "industrial",
      0,
    ],
    [
      "lithium",
      "Litio bruto",
      "basic",
      2500,
      1000,
      "industry",
      "lithium",
      {},
      "industrial",
      0,
    ],
    [
      "gold",
      "Oro bruto",
      "basic",
      30000000,
      0.08,
      "industry",
      "precious",
      {},
      "strategic",
      0,
    ],
    [
      "diamonds",
      "Diamantes en bruto",
      "basic",
      150000000,
      0.004,
      "industry",
      "precious",
      {},
      "strategic",
      0,
    ],
    [
      "cement",
      "Cemento",
      "intermediate",
      110,
      8000,
      "industry",
      "cement",
      { minerals: 1.4, fuel: 0.08 },
      "industrial",
      0,
    ],
    [
      "steel",
      "Acero",
      "intermediate",
      750,
      6000,
      "industry",
      "steel",
      { iron_ore: 1.5, fuel: 0.15 },
      "industrial",
      0,
    ],
    [
      "fuel",
      "Combustible",
      "intermediate",
      950,
      4500,
      "energy",
      "refining",
      { crude_oil: 1.2 },
      "tank_fuel",
      0.08,
    ],
    [
      "chemicals",
      "Químicos",
      "intermediate",
      1400,
      2000,
      "industry",
      "petrochem",
      { crude_oil: 0.65, fuel: 0.1 },
      "tank_chem",
      0,
    ],
    [
      "components",
      "Componentes electrónicos",
      "intermediate",
      18000,
      200,
      "industry",
      "electronics",
      { copper: 0.3, chemicals: 0.4 },
      "logistics",
      0,
    ],
    [
      "refined_lithium",
      "Litio refinado",
      "intermediate",
      12000,
      300,
      "industry",
      "lithium",
      { lithium: 2, chemicals: 0.3 },
      "industrial",
      0,
    ],
    [
      "refined_gold",
      "Oro refinado",
      "intermediate",
      60000000,
      0.06,
      "industry",
      "mineral_refining",
      { gold: 1.5, chemicals: 0.1 },
      "strategic",
      0,
    ],
    [
      "cut_diamonds",
      "Diamantes procesados",
      "intermediate",
      240000000,
      0.002,
      "industry",
      "precious",
      { diamonds: 1.6 },
      "strategic",
      0,
    ],
    [
      "semiconductors",
      "Semiconductores",
      "intermediate",
      5,
      300000,
      "industry",
      "semiconductors",
      { minerals: 0.0001, components: 0.00001, chemicals: 0.00002 },
      "logistics",
      0,
    ],
    [
      "chips",
      "Microchips avanzados",
      "intermediate",
      120,
      30000,
      "industry",
      "advanced_chips",
      { semiconductors: 2, components: 0.00002 },
      "logistics",
      0,
    ],
    [
      "cells",
      "Celdas de batería",
      "intermediate",
      12,
      100000,
      "industry",
      "cells",
      { refined_lithium: 0.00003, components: 0.00005, chemicals: 0.0001 },
      "logistics",
      0,
    ],
    [
      "feed",
      "Alimento balanceado",
      "intermediate",
      350,
      2000,
      "agriculture",
      "feed",
      { grains: 1.1 },
      "silo",
      0,
    ],
    [
      "food_products",
      "Alimentos elaborados",
      "final",
      1200,
      1500,
      "agriculture",
      "food_processing",
      { grains: 1.1, fuel: 0.02 },
      "cold",
      0.12,
    ],
    [
      "automobiles",
      "Automóviles",
      "final",
      23000,
      100,
      "industry",
      "vehicles",
      { steel: 1.2, components: 0.015, fuel: 0.05 },
      "logistics",
      0.007,
    ],
    [
      "machinery",
      "Maquinaria productiva",
      "final",
      55000,
      60,
      "industry",
      "industrial_vehicles",
      { steel: 2.4, components: 0.03, fuel: 0.08 },
      "logistics",
      0,
    ],
    [
      "electronics",
      "Equipos electrónicos",
      "final",
      800,
      1500,
      "industry",
      "electronics",
      { components: 0.005, semiconductors: 4 },
      "logistics",
      0.02,
    ],
    [
      "plutonium",
      "Plutonio procesado",
      "final",
      150000000,
      0.002,
      "industry",
      "nuclear_safety",
      { uranium: 5, chemicals: 1 },
      "strategic",
      0,
    ],
    [
      "batteries",
      "Baterías",
      "final",
      300,
      3000,
      "industry",
      "batteries",
      { cells: 20, components: 0.0001 },
      "logistics",
      0,
    ],
    [
      "computers",
      "Computadoras",
      "final",
      1000,
      2000,
      "industry",
      "computing",
      { chips: 2, components: 0.005 },
      "logistics",
      0.015,
    ],
    [
      "smartphones",
      "Teléfonos de alta gama",
      "final",
      1100,
      4000,
      "industry",
      "smartphones",
      { chips: 3, cells: 2, components: 0.001 },
      "logistics",
      0.035,
    ],
    [
      "servers",
      "Servidores",
      "final",
      6000,
      500,
      "industry",
      "servers",
      { chips: 16, components: 0.01 },
      "logistics",
      0,
    ],
    [
      "supercomputers",
      "Supercomputadoras",
      "final",
      50000000,
      0.1,
      "industry",
      "supercomputing",
      { servers: 3000, chips: 100000, components: 5 },
      "logistics",
      0,
    ],
    [
      "electric_vehicles",
      "Vehículos eléctricos",
      "final",
      38000,
      100,
      "industry",
      "electric_vehicles",
      { steel: 1.2, batteries: 30, chips: 20 },
      "logistics",
      0.001,
    ],
    [
      "jewelry",
      "Joyería",
      "final",
      600,
      5000,
      "industry",
      "jewelry",
      { refined_gold: 0.000004, cut_diamonds: 0.0000002 },
      "logistics",
      0.006,
    ],
    [
      "diamond_tools",
      "Herramientas de diamante",
      "final",
      250,
      4000,
      "industry",
      "diamond_tools",
      { cut_diamonds: 0.0000003, steel: 0.002 },
      "logistics",
      0,
    ],
    [
      "appliances",
      "Electrodomésticos",
      "final",
      550,
      2000,
      "industry",
      "appliances",
      { steel: 0.04, components: 0.002, semiconductors: 3 },
      "logistics",
      0.018,
    ],
    [
      "transport_vehicles",
      "Vehículos de transporte",
      "final",
      90000,
      40,
      "industry",
      "industrial_vehicles",
      { steel: 5, components: 0.05, fuel: 0.1 },
      "logistics",
      0,
    ],
    [
      "milk",
      "Leche cruda",
      "basic",
      500,
      250,
      "agriculture",
      "livestock",
      {},
      "cold",
      0.03,
    ],
    [
      "meat",
      "Carne",
      "intermediate",
      3500,
      100,
      "agriculture",
      "veterinary",
      {},
      "cold",
      0.045,
    ],
    [
      "raw_leather",
      "Cuero sin procesar",
      "basic",
      900,
      15,
      "agriculture",
      "livestock",
      {},
      "industrial",
      0,
    ],
    [
      "wool",
      "Lana",
      "basic",
      2200,
      8,
      "agriculture",
      "livestock",
      {},
      "industrial",
      0,
    ],
    [
      "dairy",
      "Lácteos",
      "final",
      1800,
      400,
      "agriculture",
      "dairy",
      { milk: 1.4 },
      "cold",
      0.035,
    ],
    [
      "leather",
      "Cuero acondicionado",
      "intermediate",
      3500,
      50,
      "agriculture",
      "leather",
      { raw_leather: 1.3, chemicals: 0.1 },
      "industrial",
      0,
    ],
    [
      "textiles",
      "Textiles de lana",
      "final",
      9000,
      40,
      "industry",
      "leather",
      { wool: 1.3, chemicals: 0.08 },
      "logistics",
      0.0003,
    ],
    [
      "organic_waste",
      "Residuos orgánicos",
      "basic",
      -45,
      0,
      "services",
      "waste_collection",
      {},
      "waste",
      0,
    ],
    [
      "recyclables",
      "Residuos reciclables",
      "basic",
      45,
      0,
      "services",
      "separation",
      {},
      "waste",
      0,
    ],
    [
      "waste",
      "Basura no aprovechable",
      "basic",
      -70,
      0,
      "services",
      "waste_collection",
      {},
      "waste",
      0,
    ],
    [
      "biomass",
      "Biomasa agrícola",
      "basic",
      40,
      0,
      "agriculture",
      "farming",
      {},
      "waste",
      0,
    ],
  ];
  const existing = Object.fromEntries(D.materials.map((m) => [m.id, m]));
  const overrides = {
    grains: "farm",
    timber: "forestry",
    crude_oil: "oil_well",
    food_products: "food_plant",
    automobiles: "vehicle_factory",
    machinery: "industrial_vehicle_factory",
    electronics: "electronics_factory",
    plutonium: "nuclear_lab",
    milk: "cattle_ranch",
    meat: "slaughterhouse",
    raw_leather: "slaughterhouse",
    wool: "sheep_ranch",
  };
  D.materials = resources.map(
    ([
      id,
      label,
      tier,
      usd,
      baseOutput,
      sector,
      technology,
      inputs,
      storage,
      household,
    ]) => ({
      ...existing[id],
      id,
      label,
      tier,
      value: usd / 1e9,
      baseOutput,
      sector,
      technology,
      inputs,
      storage,
      household,
      icon: label.slice(0, 2).toUpperCase(),
      unit: [
        "semiconductors",
        "chips",
        "cells",
        "automobiles",
        "machinery",
        "electronics",
        "batteries",
        "computers",
        "smartphones",
        "servers",
        "supercomputers",
        "electric_vehicles",
        "jewelry",
        "diamond_tools",
        "appliances",
        "transport_vehicles",
      ].includes(id)
        ? "unidades"
        : "t",
      unlock: overrides[id] || `plant_${id}`,
      strategic: storage === "strategic",
      waste: usd < 0 || ["recyclables", "biomass"].includes(id),
      natural: [
        "crude_oil",
        "iron_ore",
        "copper",
        "uranium",
        "minerals",
        "lithium",
        "gold",
        "diamonds",
      ].includes(id),
    }),
  );
  function building(id, label, sector, tech, meta = {}) {
    return {
      id,
      label,
      sector,
      technology: tech,
      icon: "▦",
      months: 12,
      fixedCost: 0.025,
      laborNeed: 0.1,
      skillNeed: 45,
      requirements: { cement: 200, steel: 50, fuel: 10 },
      effects: {},
      description: label,
      ...meta,
    };
  }
  const old = Object.fromEntries(D.constructions.map((b) => [b.id, b]));
  const infrastructure = [
    building(
      "housing",
      "Plan de 1.000 viviendas",
      "infrastructure",
      "housing",
      {
        housingUnits: 0.001,
        landHa: 10,
        quantity: 1000,
        unit: "viviendas",
        fixedCost: 0.035,
      },
    ),
    building(
      "housing_dense",
      "Edificio de 500 viviendas",
      "infrastructure",
      "vertical",
      {
        housingUnits: 0.0005,
        landHa: 0.6,
        quantity: 500,
        unit: "viviendas",
        fixedCost: 0.03,
      },
    ),
    building(
      "housing_maintenance",
      "Refacción de 1.000 viviendas",
      "infrastructure",
      "rehabilitation",
      {
        housingRepairUnits: 0.001,
        quantity: 1000,
        unit: "viviendas",
        fixedCost: 0.008,
        landHa: 0,
      },
    ),
    ...[
      ["streets", "Calles urbanas", 10, "civil", 20, 0.012],
      ["roads", "Carreteras", 25, "paving", 75, 0.035],
      ["highways", "Autopistas", 20, "motorways", 100, 0.1],
      ["rail", "Ferrocarril", 20, "railway", 40, 0.08],
      ["subway", "Subterráneo", 2, "subway", 1, 0.18],
      ["bullet_train", "Tren de alta velocidad", 10, "high_speed", 30, 0.25],
    ].map(([id, label, quantity, tech, landHa, cost]) =>
      building(id, label, "infrastructure", tech, {
        quantity,
        unit: "km",
        landHa,
        fixedCost: cost,
      }),
    ),
    building("airport", "Aeropuerto", "infrastructure", "airports", {
      quantity: 1,
      unit: "aeropuertos",
      landHa: 120,
      fixedCost: 0.35,
      months: 30,
    }),
    building("port", "Puerto comercial", "infrastructure", "ports", {
      quantity: 1,
      unit: "puertos",
      landHa: 40,
      fixedCost: 0.2,
      coastal: true,
      logistics: 300000,
    }),
    building(
      "irrigation",
      "Distrito de riego · 1.000 ha",
      "agriculture",
      "irrigation",
      { quantity: 1000, unit: "ha", irrigatedHa: 1000, fixedCost: 0.009 },
    ),
    building("farm", "Zona agrícola · 1.000 ha", "agriculture", "farming", {
      quantity: 1000,
      unit: "ha",
      agricultureHa: 1000,
      fixedCost: 0.005,
    }),
    building("forestry", "Distrito forestal", "agriculture", "farming", {
      landHa: 1000,
      quantity: 1000,
      unit: "ha",
      fixedCost: 0.008,
    }),
    building(
      "research_lab",
      "Laboratorio de investigación",
      "education",
      "university",
      {
        quantity: 1,
        unit: "laboratorios",
        landHa: 1,
        fixedCost: 0.012,
        science: 1,
        skillNeed: 75,
      },
    ),
    building(
      "cattle_ranch",
      "Establecimiento bovino",
      "agriculture",
      "livestock",
      { landHa: 300, livestock: "cattle", heads: 2000 },
    ),
    building("pig_farm", "Granja porcina", "agriculture", "livestock", {
      landHa: 20,
      livestock: "pigs",
      heads: 3000,
    }),
    building("poultry_farm", "Granja avícola", "agriculture", "livestock", {
      landHa: 10,
      livestock: "poultry",
      heads: 40000,
    }),
    building(
      "sheep_ranch",
      "Establecimiento ovino",
      "agriculture",
      "livestock",
      { landHa: 300, livestock: "sheep", heads: 3000 },
    ),
    building("slaughterhouse", "Frigorífico", "agriculture", "veterinary", {
      landHa: 3,
      fixedCost: 0.018,
    }),
    building("oil_well", "Pozo petrolero terrestre", "energy", "drilling", {
      deposit: "crude_oil",
      landHa: 2,
      fixedCost: 0.035,
    }),
    building(
      "offshore_platform",
      "Plataforma petrolera marítima",
      "energy",
      "offshore",
      {
        deposit: "crude_oil",
        offshore: true,
        coastal: true,
        landHa: 0,
        fixedCost: 0.16,
      },
    ),
  ];
  D.constructions = D.constructions
    .filter((b) => !infrastructure.some((n) => n.id === b.id))
    .map((b) =>
      building(
        b.id,
        b.label,
        b.sector,
        {
          nuclear_plant: "fission",
          nuclear_lab: "nuclear_safety",
          renewable_park: "wind",
          power_grid: "grid",
          technical_school: "technical",
          university: "university",
          clinics: "primary_care",
          hospital: "hospitals",
          civil_defense: "civil_defense",
          police_network: "census",
          tourism_district: "tourism",
          industrial_park: "machine_tools",
          machine_plant: "industrial_vehicles",
          logistics_hub: "intermodal",
          silos: "farming",
        }[b.id] ||
          D.materials.find((m) => m.unlock === b.id)?.technology ||
          "civil",
        {
          ...b,
          technology:
            {
              nuclear_plant: "fission",
              nuclear_lab: "nuclear_safety",
              renewable_park: "wind",
              power_grid: "grid",
              technical_school: "technical",
              university: "university",
              clinics: "primary_care",
              hospital: "hospitals",
              civil_defense: "civil_defense",
              police_network: "census",
              tourism_district: "tourism",
              industrial_park: "machine_tools",
              machine_plant: "industrial_vehicles",
              logistics_hub: "intermodal",
              silos: "farming",
            }[b.id] ||
            D.materials.find((m) => m.unlock === b.id)?.technology ||
            "civil",
          fixedCost:
            b.id === "nuclear_plant" ? 6 : b.id === "nuclear_lab" ? 0.25 : 0.04,
          landHa: 5,
          laborNeed: 0.1,
          requirements: { cement: 500, steel: 100, fuel: 20 },
          effects: {},
          quantity: 1,
          unit: "instalaciones",
        },
      ),
    );
  D.constructions.push(...infrastructure);
  const energy = [
    ["hydro_plant", "Central hidroeléctrica", "hydro", 1.6, "hydro"],
    ["wind_farm", "Parque eólico terrestre", "wind", 0.3, "wind"],
    ["solar_farm", "Parque solar", "solar", 0.2, "solar"],
    ["geothermal_plant", "Central geotérmica", "geothermal", 0.4, "geothermal"],
    ["fossil_plant", "Central fósil", "thermal", 2, "fossil"],
    ["biomass_plant", "Central de biomasa", "biomass", 0.15, "biomass"],
  ];
  for (const [id, label, tech, energyOutput, kind] of energy)
    D.constructions.push(
      building(id, label, "energy", tech, {
        energyOutput,
        energyKind: kind,
        fixedCost: kind === "hydro" ? 0.45 : 0.12,
        landHa: kind === "hydro" ? 150 : 40,
        months: 24,
        quantity: 1,
        unit: "centrales",
      }),
    );
  Object.assign(
    D.constructions.find((b) => b.id === "nuclear_plant"),
    { energyKind: "nuclear", energyOutput: 12 },
  );
  Object.assign(
    D.constructions.find((b) => b.id === "renewable_park"),
    { energyKind: "wind", energyOutput: 0.3 },
  );
  for (const m of D.materials) {
    if (m.waste) continue;
    if (!D.constructions.some((b) => b.id === m.unlock))
      D.constructions.push(
        building(
          m.unlock,
          `Planta de ${m.label.toLowerCase()}`,
          m.sector,
          m.technology,
          {
            deposit: m.natural ? m.id : null,
            landHa: 5,
            fixedCost: m.strategic ? 0.15 : 0.035,
            skillNeed: techs.find((t) => t.id === m.technology).skill,
          },
        ),
      );
  }
  for (const type of D.storageTypes) {
    const id =
      type.id === "silo"
        ? "silos"
        : type.id === "logistics"
          ? "logistics_hub"
          : `storage_${type.id}`;
    let b = D.constructions.find((x) => x.id === id);
    if (!b) {
      b = building(
        id,
        type.label,
        "services",
        type.id === "cold" ? "cold_chain" : "civil",
        { landHa: 3, fixedCost: 0.008 },
      );
      D.constructions.push(b);
    }
    b.storage = type.id;
    b.storageAmount = type.capacity;
  }
  D.constructions.push(
    building(
      "recycling_plant",
      "Planta de reciclaje",
      "services",
      "separation",
      { treatment: 12000, landHa: 6 },
    ),
    building(
      "waste_treatment",
      "Planta de tratamiento de residuos",
      "services",
      "waste_collection",
      { treatment: 20000, landHa: 6 },
    ),
    building("primary_school", "Escuela primaria", "education", "primary", {
      educationLevel: "primary",
      seats: 600,
      landHa: 1,
      fixedCost: 0.003,
    }),
    building(
      "secondary_school",
      "Escuela secundaria",
      "education",
      "secondary",
      { educationLevel: "secondary", seats: 500, landHa: 1, fixedCost: 0.004 },
    ),
  );
  Object.assign(
    D.constructions.find((b) => b.id === "technical_school"),
    { educationLevel: "technical", seats: 1000 },
  );
  Object.assign(
    D.constructions.find((b) => b.id === "university"),
    { educationLevel: "university", seats: 3000 },
  );
  D.landlocked =
    "AFG AND ARM AUT AZE BFA BDI BTN BOL BWA BLR CAF TCD CZE ETH HUN KAZ KGZ LAO LSO LUX MDA MLI MNG MWI NER NPL PRY RWA SSD SWZ TJK TKM UGA UZB ZMB ZWE CHE SRB SVK MKD".split(
      " ",
    );
  D.knownFields = {
    lithium: "ARG CHL AUS CHN BOL BRA CAN USA ZWE PRT",
    gold: "AUS CHN RUS ZAF GHA USA CAN PER BRA MEX UZB MLI BFA TZA",
    diamonds: "RUS BWA CAN AGO ZAF NAM COD SLE ZWE",
  };
  Object.assign(D.knownFields, {
    crude_oil:
      "USA RUS SAU CAN IRQ IRN ARE CHN BRA KWT NOR KAZ MEX NGA QAT DZA LBY AGO VEN GBR COL ECU ARG AZE OMN MYS IDN EGY GAB GHA CMR TCD COG TUN BHR TTO PER BOL BRN VNM THA SYR YEM SDN SSD GNQ CUB",
    uranium: "KAZ CAN AUS NAM UZB RUS NER CHN USA UKR ZAF BRA MNG",
    iron_ore:
      "AUS BRA CHN IND RUS UKR ZAF CAN IRN SWE KAZ MRT LBR PER CHL TUR MEX VEN",
    copper:
      "CHL PER COD CHN USA AUS RUS ZMB MEX KAZ POL CAN IDN PAN MNG IRN TUR ARM BGR SRB ESP PRT",
  });
  D.events.push(
    {
      id: "credit_crunch",
      type: "political",
      title: "Crisis de crédito internacional",
      scope: "global",
      weight: 0.35,
      duration: [5, 10],
      impact: { growth: -1.6, demand: -0.06 },
      summary:
        "La incertidumbre financiera frena inversión y consumo sin requerir una decisión emergente.",
    },
    {
      id: "trade_disruption",
      type: "political",
      title: "Tensión comercial regional",
      scope: "region",
      weight: 0.6,
      duration: [3, 7],
      impact: { growth: -1.2, demand: -0.04, migrationPush: 0.4 },
      summary:
        "Conflictos diplomáticos e interrupciones comerciales afectan la actividad regional.",
    },
  );
  const materialIndex = new Map(D.materials.map((m) => [m.id, m])),
    buildingIndex = new Map(D.constructions.map((b) => [b.id, b])),
    techIndex = new Map(techs.map((t) => [t.id, t]));
  D.getMaterial = (id) => materialIndex.get(id);
  D.getBuilding = (id) => buildingIndex.get(id);
  D.getTechnology = (id) => techIndex.get(id);
  return D;
});
