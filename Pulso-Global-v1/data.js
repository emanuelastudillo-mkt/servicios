(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.PULSO_DATA = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECTORS = [
    { id: "infrastructure", label: "Vivienda y transporte", short: "Infraestructura", icon: "▰", commodity: null },
    { id: "agriculture", label: "Agro y alimentos", short: "Agro", icon: "◆", commodity: "food" },
    { id: "industry", label: "Industria", short: "Industria", icon: "▥", commodity: "manufactures" },
    { id: "services", label: "Servicios", short: "Servicios", icon: "●", commodity: null },
    { id: "education", label: "Educación", short: "Educación", icon: "▤", commodity: "technology" },
    { id: "health", label: "Salud", short: "Salud", icon: "+", commodity: null },
    { id: "security", label: "Seguridad y defensa", short: "Seguridad", icon: "◇", commodity: null },
    { id: "energy", label: "Energía", short: "Energía", icon: "ϟ", commodity: "energy" }
  ];

  const MATERIALS = [
    { id: "cement", label: "Cemento", icon: "CE" },
    { id: "steel", label: "Acero", icon: "AC" },
    { id: "timber", label: "Madera", icon: "MA" },
    { id: "fuel", label: "Combustible", icon: "CO" },
    { id: "machinery", label: "Maquinaria", icon: "MQ" },
    { id: "electronics", label: "Electrónica", icon: "EL" }
  ];

  const TAXES = [
    { id: "vat", label: "IVA / consumo", short: "IVA", min: 0, max: 35, description: "Recauda sobre el consumo; tasas altas enfrían demanda y presionan precios." },
    { id: "income", label: "Ganancias", short: "Ganancias", min: 0, max: 50, description: "Grava ingresos y utilidades; sostiene la recaudación, con costo sobre inversión." },
    { id: "inheritance", label: "Herencias", short: "Herencias", min: 0, max: 30, description: "Aporta poco volumen fiscal y mejora moderadamente la percepción distributiva." },
    { id: "imports", label: "Derechos de importación", short: "Importación", min: 0, max: 40, description: "Protege oferta local y recauda, pero encarece insumos y reduce intercambios." },
    { id: "exports", label: "Derechos de exportación", short: "Exportación", min: 0, max: 30, description: "Captura renta exportadora, aunque desalienta parte de la oferta externa." }
  ];

  function construction(id, sector, label, icon, months, costShare, requirements, effects, description) {
    return { id, sector, label, icon, months, costShare, requirements, effects, description };
  }

  const CONSTRUCTIONS = [
    construction("housing", "infrastructure", "Plan de viviendas", "⌂", 10, 0.13, { cement: 38, steel: 14, timber: 24, fuel: 8, machinery: 8 }, { housing: 3.2, happiness: 1.8, immigration: 0.35 }, "Amplía la oferta habitacional y reduce la presión urbana."),
    construction("streets", "infrastructure", "Calles urbanas", "▦", 7, 0.08, { cement: 28, steel: 7, fuel: 13, machinery: 6 }, { infrastructure: 1.1, happiness: 0.8, tourism: 0.15 }, "Pavimento, iluminación y mantenimiento de la red urbana."),
    construction("highways", "infrastructure", "Rutas nacionales", "═", 14, 0.22, { cement: 52, steel: 24, fuel: 24, machinery: 16 }, { infrastructure: 2.1, tradeCapacity: 2.5, tourism: 0.3 }, "Conecta regiones productivas y reduce los costos logísticos."),
    construction("airport", "infrastructure", "Aeropuerto internacional", "✈", 22, 0.42, { cement: 70, steel: 52, fuel: 25, machinery: 28, electronics: 22 }, { infrastructure: 2.6, tradeCapacity: 4.5, tourism: 1.1, happiness: 0.4 }, "Aumenta conectividad, turismo y capacidad de carga."),
    construction("rail", "infrastructure", "Red ferroviaria", "▣", 28, 0.58, { cement: 76, steel: 92, fuel: 28, machinery: 35, electronics: 16 }, { infrastructure: 3.8, tradeCapacity: 6, happiness: 1.2 }, "Transporte masivo de pasajeros y mercadería a escala nacional."),
    construction("irrigation", "agriculture", "Distrito de riego", "≈", 9, 0.1, { cement: 22, steel: 8, fuel: 7, machinery: 12 }, { foodCapacity: 4, infrastructure: 0.5 }, "Estabiliza rendimientos y eleva la producción de alimentos."),
    construction("silos", "agriculture", "Red de silos", "◫", 7, 0.07, { cement: 16, steel: 19, fuel: 5, machinery: 7 }, { foodCapacity: 2.5, tradeCapacity: 1 }, "Reduce pérdidas y mejora la salida exportadora."),
    construction("industrial_park", "industry", "Parque industrial", "▥", 15, 0.24, { cement: 48, steel: 46, fuel: 15, machinery: 28, electronics: 8 }, { industryCapacity: 4, productivity: 0.8, jobs: 0.35 }, "Concentra proveedores, plantas y empleo formal."),
    construction("machine_plant", "industry", "Planta de maquinaria", "⚙", 18, 0.31, { cement: 35, steel: 58, fuel: 18, machinery: 22, electronics: 12 }, { industryCapacity: 5, materialMachinery: 0.8, jobs: 0.45 }, "Sustituye importaciones de equipos y amplía la base industrial."),
    construction("logistics_hub", "services", "Centro logístico", "↔", 11, 0.14, { cement: 28, steel: 23, fuel: 15, machinery: 13, electronics: 8 }, { tradeCapacity: 3, productivity: 0.6, jobs: 0.25 }, "Coordina almacenamiento, distribución y comercio interno."),
    construction("tourism_district", "services", "Distrito turístico", "★", 12, 0.16, { cement: 25, steel: 9, timber: 22, fuel: 7, machinery: 7 }, { tourism: 0.9, happiness: 1.2, jobs: 0.3 }, "Mejora servicios urbanos y la experiencia de visitantes."),
    construction("technical_school", "education", "Institutos técnicos", "⌁", 10, 0.11, { cement: 24, steel: 11, timber: 14, machinery: 5, electronics: 13 }, { education: 1.1, productivity: 0.65 }, "Forma perfiles para industria, energía y construcción."),
    construction("university", "education", "Universidad pública", "▤", 18, 0.28, { cement: 46, steel: 22, timber: 18, machinery: 9, electronics: 28 }, { education: 2.2, productivity: 1.3, immigration: 0.2 }, "Amplía capital humano, investigación y atracción de talento."),
    construction("clinics", "health", "Red de centros de salud", "+", 9, 0.12, { cement: 27, steel: 12, timber: 8, machinery: 7, electronics: 12 }, { health: 2.2, happiness: 1.2, mortality: -0.15 }, "Extiende la atención primaria y la prevención."),
    construction("hospital", "health", "Hospital regional", "✚", 17, 0.3, { cement: 49, steel: 32, timber: 8, machinery: 20, electronics: 31 }, { health: 3.5, happiness: 1.7, mortality: -0.25 }, "Suma capacidad de alta complejidad y empleo sanitario."),
    construction("civil_defense", "security", "Base de defensa civil", "◇", 10, 0.1, { cement: 21, steel: 17, fuel: 10, machinery: 9, electronics: 10 }, { stability: 1.2, happiness: 0.5 }, "Coordina emergencias, rescate y protección territorial."),
    construction("police_network", "security", "Red de seguridad urbana", "⬡", 8, 0.09, { cement: 17, steel: 10, fuel: 9, machinery: 5, electronics: 17 }, { stability: 1.4, happiness: 0.35 }, "Mejora presencia territorial y tiempos de respuesta."),
    construction("renewable_park", "energy", "Parque renovable", "☼", 14, 0.21, { cement: 34, steel: 31, fuel: 8, machinery: 20, electronics: 22 }, { energyCapacity: 4, happiness: 0.5 }, "Aumenta la oferta eléctrica con menor exposición a combustibles."),
    construction("power_grid", "energy", "Red eléctrica inteligente", "ϟ", 18, 0.3, { cement: 25, steel: 44, fuel: 9, machinery: 18, electronics: 37 }, { energyCapacity: 3, infrastructure: 1.4, productivity: 0.7 }, "Reduce cortes y conecta nueva capacidad productiva.")
  ];

  const COUNTRY_CENTERS = {
    ARG: [-64, -35], USA: [-99, 38], ECU: [-78.2, -1.4], BRA: [-52, -10], MEX: [-102, 23],
    CHN: [104, 35], RUS: [88, 60], DEU: [10.5, 51], IND: [79, 22], ZAF: [24, -29],
    CUB: [-79.5, 21.5], ZMB: [27.8, -13.1], NGA: [8.7, 9.1], URY: [-55.8, -32.8],
    HTI: [-72.3, 19], NRU: [166.9, -0.5]
  };

  const COUNTRY_DEMOGRAPHICS = {
    ARG: { children: 23, workers: 65, retired: 12 }, USA: { children: 21, workers: 62, retired: 17 },
    ECU: { children: 27, workers: 65, retired: 8 }, BRA: { children: 22, workers: 68, retired: 10 },
    MEX: { children: 26, workers: 66, retired: 8 }, CHN: { children: 17, workers: 68, retired: 15 },
    RUS: { children: 18, workers: 66, retired: 16 }, DEU: { children: 18, workers: 59, retired: 23 },
    IND: { children: 29, workers: 64, retired: 7 }, ZAF: { children: 28, workers: 66, retired: 6 },
    CUB: { children: 17, workers: 66, retired: 17 }, ZMB: { children: 47, workers: 51, retired: 2 },
    NGA: { children: 47, workers: 50, retired: 3 }, URY: { children: 21, workers: 63, retired: 16 },
    HTI: { children: 37, workers: 58, retired: 5 }, NRU: { children: 43, workers: 54, retired: 3 }
  };

  const COUNTRY_TAXES = {
    ARG: { vat: 21, income: 35, inheritance: 0, imports: 12, exports: 12 },
    USA: { vat: 7, income: 21, inheritance: 20, imports: 4, exports: 0 },
    ECU: { vat: 15, income: 25, inheritance: 20, imports: 10, exports: 4 },
    BRA: { vat: 20, income: 34, inheritance: 8, imports: 12, exports: 5 },
    MEX: { vat: 16, income: 30, inheritance: 20, imports: 8, exports: 0 },
    CHN: { vat: 13, income: 25, inheritance: 10, imports: 8, exports: 2 },
    RUS: { vat: 20, income: 25, inheritance: 10, imports: 10, exports: 3 },
    DEU: { vat: 19, income: 30, inheritance: 30, imports: 5, exports: 0 },
    IND: { vat: 18, income: 25, inheritance: 10, imports: 8, exports: 2 },
    ZAF: { vat: 15, income: 27, inheritance: 20, imports: 9, exports: 1 },
    CUB: { vat: 10, income: 30, inheritance: 0, imports: 12, exports: 5 },
    ZMB: { vat: 16, income: 30, inheritance: 0, imports: 15, exports: 5 },
    NGA: { vat: 7.5, income: 30, inheritance: 10, imports: 12, exports: 2 },
    URY: { vat: 22, income: 25, inheritance: 15, imports: 10, exports: 1 },
    HTI: { vat: 10, income: 30, inheritance: 5, imports: 12, exports: 1 },
    NRU: { vat: 10, income: 20, inheritance: 0, imports: 10, exports: 0 }
  };

  const COMMODITIES = [
    { id: "food", label: "Alimentos", icon: "A", basePrice: 1.0 },
    { id: "energy", label: "Energía", icon: "E", basePrice: 1.3 },
    { id: "manufactures", label: "Manufacturas", icon: "M", basePrice: 1.1 },
    { id: "technology", label: "Tecnología", icon: "T", basePrice: 1.7 }
  ];

  const DEFAULT_BUDGET = {
    agriculture: 7, industry: 11, services: 6, education: 17,
    health: 18, infrastructure: 16, security: 15, energy: 10
  };

  const DEFAULT_LABOR = {
    agriculture: 9, industry: 20, services: 34, education: 8,
    health: 8, infrastructure: 7, security: 6, energy: 8
  };

  function leader(id, name, initials, archetype, description, bonuses) {
    return { id, name, initials, archetype, description, bonuses };
  }

  function country(config) {
    return {
      politicalSystem: "República",
      currency: "USD",
      baseGrowth: 2,
      spendingTarget: 35,
      taxEfficiency: 0.78,
      budget: { ...DEFAULT_BUDGET, ...(config.budget || {}) },
      labor: { ...DEFAULT_LABOR, ...(config.labor || {}) },
      ...config
    };
  }

  const COUNTRIES = [
    country({
      id: "ARG", name: "Argentina", flag: "🇦🇷", region: "América del Sur", currency: "ARS",
      population: 46.6, gdp: 640, education: 73, unemployment: 7.4, infrastructure: 64,
      debt: 86, inflation: 21, popularity: 52, stability: 55, birthRate: 14.7,
      mortality: 8.2, migration: 0.4, productivity: 76, reserves: 31, baseGrowth: 2.4,
      spendingTarget: 38, revenueRate: 33, taxEfficiency: 0.62,
      resources: { food: 1.5, energy: 0.9, manufactures: 0.72, technology: 0.52 },
      leaders: [
        leader("milei", "Javier Milei", "JM", "Shock fiscal", "Ajuste rápido, desregulación y alta volatilidad social.", { efficiency: 6, industry: 2, welfare: -3, volatility: 5 }),
        leader("cfk", "Cristina Fernández de Kirchner", "CFK", "Estado activo", "Consumo interno, protección social y conducción política intensa.", { welfare: 6, industry: 2, efficiency: -2, diplomacy: 2 }),
        leader("kicillof", "Axel Kicillof", "AK", "Desarrollo productivo", "Industria, educación pública e inversión coordinada.", { industry: 5, education: 4, efficiency: -1, infrastructure: 2 })
      ]
    }),
    country({
      id: "USA", name: "Estados Unidos", flag: "🇺🇸", region: "América del Norte", currency: "USD",
      population: 342, gdp: 29170, education: 87, unemployment: 4.2, infrastructure: 82,
      debt: 123, inflation: 3.1, popularity: 51, stability: 72, birthRate: 11,
      mortality: 9.2, migration: 2.6, productivity: 116, reserves: 245, baseGrowth: 2.1,
      spendingTarget: 36, revenueRate: 30, taxEfficiency: 0.91,
      resources: { food: 1.3, energy: 1.25, manufactures: 1.15, technology: 1.65 },
      leaders: [
        leader("trump", "Donald Trump", "DT", "America First", "Industria nacional, aranceles y negociación confrontativa.", { industry: 6, security: 3, diplomacy: -3, volatility: 4 }),
        leader("harris", "Kamala Harris", "KH", "Coalición institucional", "Protección social, acuerdos amplios y transición gradual.", { welfare: 4, diplomacy: 4, education: 2, efficiency: -1 }),
        leader("newsom", "Gavin Newsom", "GN", "Innovación verde", "Tecnología, infraestructura y transición energética.", { education: 4, infrastructure: 4, green: 6, welfare: 1 })
      ]
    }),
    country({
      id: "ECU", name: "Ecuador", flag: "🇪🇨", region: "Región Andina", currency: "USD",
      population: 18.4, gdp: 125, education: 66, unemployment: 4.5, infrastructure: 58,
      debt: 59, inflation: 2.2, popularity: 50, stability: 47, birthRate: 16.5,
      mortality: 5.3, migration: -1.2, productivity: 63, reserves: 8, baseGrowth: 1.8,
      spendingTarget: 34, revenueRate: 31, taxEfficiency: 0.58,
      resources: { food: 1.2, energy: 1.1, manufactures: 0.5, technology: 0.35 },
      leaders: [
        leader("noboa", "Daniel Noboa", "DN", "Modernización empresarial", "Apertura a la inversión y respuesta ejecutiva a la inseguridad.", { efficiency: 3, industry: 4, security: 3, volatility: 2 }),
        leader("correa", "Rafael Correa", "RC", "Inversión pública", "Obra pública intensiva y liderazgo centralizado.", { infrastructure: 7, welfare: 3, debtPressure: 3, diplomacy: 2 }),
        leader("gonzalez", "Luisa González", "LG", "Protección social", "Servicios públicos, empleo y coordinación regional.", { welfare: 5, education: 3, diplomacy: 3, efficiency: -1 })
      ]
    }),
    country({
      id: "BRA", name: "Brasil", flag: "🇧🇷", region: "América del Sur", currency: "BRL",
      population: 212, gdp: 2330, education: 69, unemployment: 7.1, infrastructure: 67,
      debt: 91, inflation: 4.8, popularity: 52, stability: 61, birthRate: 12.7,
      mortality: 7.1, migration: 0.2, productivity: 75, reserves: 360, baseGrowth: 2.2,
      spendingTarget: 39, revenueRate: 32, taxEfficiency: 0.72,
      resources: { food: 1.55, energy: 1.18, manufactures: 0.9, technology: 0.62 },
      leaders: [
        leader("lula", "Luiz Inácio Lula da Silva", "LULA", "Pacto social", "Consumo, empleo, integración regional y negociación sindical.", { welfare: 6, diplomacy: 4, industry: 2, efficiency: -1 }),
        leader("bolsonaro", "Jair Bolsonaro", "JB", "Orden conservador", "Seguridad, agro y menor regulación económica.", { security: 6, industry: 2, welfare: -2, green: -4 }),
        leader("tarcisio", "Tarcísio de Freitas", "TF", "Infraestructura técnica", "Concesiones, logística y administración orientada a resultados.", { infrastructure: 6, efficiency: 4, industry: 3, welfare: -1 })
      ]
    }),
    country({
      id: "MEX", name: "México", flag: "🇲🇽", region: "América del Norte", currency: "MXN",
      population: 131, gdp: 1850, education: 68, unemployment: 3.1, infrastructure: 69,
      debt: 58, inflation: 4.1, popularity: 56, stability: 58, birthRate: 15.2,
      mortality: 6.3, migration: -0.5, productivity: 78, reserves: 225, baseGrowth: 2,
      spendingTarget: 31, revenueRate: 27, taxEfficiency: 0.66,
      resources: { food: 0.92, energy: 0.82, manufactures: 1.22, technology: 0.72 },
      leaders: [
        leader("sheinbaum", "Claudia Sheinbaum", "CS", "Continuidad científica", "Política social, coordinación pública y transición energética.", { welfare: 4, education: 4, green: 5, efficiency: 1 }),
        leader("ebrard", "Marcelo Ebrard", "ME", "Diplomacia productiva", "Comercio exterior, relocalización industrial y acuerdos.", { diplomacy: 6, industry: 5, infrastructure: 2 }),
        leader("galvez", "Xóchitl Gálvez", "XG", "Innovación competitiva", "Emprendimiento, digitalización y contrapesos institucionales.", { efficiency: 4, education: 3, industry: 3, volatility: 1 })
      ]
    }),
    country({
      id: "CHN", name: "China", flag: "🇨🇳", region: "Asia Oriental", currency: "CNY", politicalSystem: "Estado de partido único",
      population: 1408, gdp: 18500, education: 82, unemployment: 5.2, infrastructure: 91,
      debt: 88, inflation: 1.6, popularity: 63, stability: 83, birthRate: 6.8,
      mortality: 7.9, migration: -0.2, productivity: 101, reserves: 3200, baseGrowth: 4.3,
      spendingTarget: 33, revenueRate: 28, taxEfficiency: 0.89,
      resources: { food: 0.82, energy: 0.62, manufactures: 1.72, technology: 1.34 },
      leaders: [
        leader("xi", "Xi Jinping", "XJ", "Planificación estratégica", "Estabilidad, industria avanzada y dirección central.", { stability: 6, industry: 5, security: 3, diplomacy: -1 }),
        leader("li", "Li Qiang", "LQ", "Gestión económica", "Producción, inversión privada y administración ejecutiva.", { efficiency: 5, industry: 4, diplomacy: 2 }),
        leader("wang", "Wang Yi", "WY", "Proyección diplomática", "Acuerdos internacionales, comercio y alianzas.", { diplomacy: 7, industry: 2, stability: 2 })
      ]
    }),
    country({
      id: "RUS", name: "Rusia", flag: "🇷🇺", region: "Eurasia", currency: "RUB", politicalSystem: "República federal",
      population: 144, gdp: 2200, education: 84, unemployment: 3.4, infrastructure: 72,
      debt: 22, inflation: 7.8, popularity: 59, stability: 69, birthRate: 8.7,
      mortality: 12.3, migration: 0.8, productivity: 82, reserves: 590, baseGrowth: 1.7,
      spendingTarget: 37, revenueRate: 35, taxEfficiency: 0.79,
      resources: { food: 1.08, energy: 1.85, manufactures: 0.83, technology: 0.68 },
      leaders: [
        leader("putin", "Vladimir Putin", "VP", "Poder estratégico", "Seguridad, energía y control político central.", { security: 7, stability: 5, energy: 5, diplomacy: -2 }),
        leader("mishustin", "Mikhail Mishustin", "MM", "Administración digital", "Eficiencia tributaria, gestión técnica y servicios estatales.", { efficiency: 7, education: 2, stability: 2 }),
        leader("medvedev", "Dmitry Medvedev", "DM", "Centralismo tecnológico", "Modernización industrial y política exterior firme.", { industry: 4, technology: 4, security: 3, volatility: 2 })
      ]
    }),
    country({
      id: "DEU", name: "Alemania", flag: "🇩🇪", region: "Europa", currency: "EUR", politicalSystem: "República parlamentaria",
      population: 84.5, gdp: 4700, education: 90, unemployment: 3.4, infrastructure: 90,
      debt: 64, inflation: 2.5, popularity: 51, stability: 82, birthRate: 9,
      mortality: 12.1, migration: 4.2, productivity: 112, reserves: 310, baseGrowth: 1.1,
      spendingTarget: 49, revenueRate: 46, taxEfficiency: 0.94,
      resources: { food: 0.82, energy: 0.35, manufactures: 1.62, technology: 1.42 },
      leaders: [
        leader("merz", "Friedrich Merz", "FM", "Competitividad fiscal", "Industria, inversión privada y disciplina presupuestaria.", { efficiency: 5, industry: 5, welfare: -1, diplomacy: 2 }),
        leader("scholz", "Olaf Scholz", "OS", "Pragmatismo social", "Estabilidad institucional, empleo y transición gradual.", { stability: 4, welfare: 3, diplomacy: 3 }),
        leader("weidel", "Alice Weidel", "AW", "Soberanía económica", "Control migratorio, seguridad y revisión de compromisos externos.", { security: 5, efficiency: 2, diplomacy: -4, volatility: 4 })
      ]
    }),
    country({
      id: "IND", name: "India", flag: "🇮🇳", region: "Asia Meridional", currency: "INR", politicalSystem: "República parlamentaria",
      population: 1450, gdp: 4100, education: 66, unemployment: 7.8, infrastructure: 64,
      debt: 82, inflation: 5.1, popularity: 58, stability: 68, birthRate: 16.4,
      mortality: 7.3, migration: -0.7, productivity: 68, reserves: 650, baseGrowth: 6.3,
      spendingTarget: 29, revenueRate: 23, taxEfficiency: 0.65,
      resources: { food: 1.05, energy: 0.42, manufactures: 1.05, technology: 1.18 },
      leaders: [
        leader("modi", "Narendra Modi", "NM", "Industrialización nacional", "Infraestructura, manufactura y centralización ejecutiva.", { industry: 6, infrastructure: 5, stability: 2, volatility: 2 }),
        leader("rahul", "Rahul Gandhi", "RG", "Coalición social", "Protección social, federalismo y empleo juvenil.", { welfare: 5, education: 4, diplomacy: 2, efficiency: -1 }),
        leader("mamata", "Mamata Banerjee", "MB", "Federalismo popular", "Política territorial, servicios y movilización social.", { welfare: 4, stability: 2, diplomacy: 1, volatility: 3 })
      ]
    }),
    country({
      id: "ZAF", name: "Sudáfrica", flag: "🇿🇦", region: "África Austral", currency: "ZAR", politicalSystem: "República parlamentaria",
      population: 63, gdp: 410, education: 64, unemployment: 31.8, infrastructure: 55,
      debt: 76, inflation: 4.7, popularity: 47, stability: 52, birthRate: 19.2,
      mortality: 9.2, migration: 1.1, productivity: 61, reserves: 61, baseGrowth: 1.4,
      spendingTarget: 34, revenueRate: 29, taxEfficiency: 0.59,
      resources: { food: 0.88, energy: 1.05, manufactures: 0.65, technology: 0.44 },
      leaders: [
        leader("ramaphosa", "Cyril Ramaphosa", "CR", "Acuerdo institucional", "Estabilidad, inversión y negociación entre sectores.", { stability: 5, diplomacy: 3, industry: 2, efficiency: 1 }),
        leader("steenhuisen", "John Steenhuisen", "JS", "Reforma administrativa", "Eficiencia estatal, inversión privada e infraestructura.", { efficiency: 6, infrastructure: 3, industry: 2, welfare: -1 }),
        leader("malema", "Julius Malema", "JM", "Redistribución acelerada", "Empleo público, redistribución y nacionalización estratégica.", { welfare: 7, industry: 2, efficiency: -3, volatility: 5 })
      ]
    }),
    country({
      id: "CUB", name: "Cuba", flag: "🇨🇺", region: "Caribe", currency: "CUP", politicalSystem: "Estado socialista de partido único",
      population: 10.94, gdp: 107, education: 79, unemployment: 1.7, infrastructure: 61,
      debt: 47, inflation: 24, popularity: 48, stability: 64, birthRate: 8.6,
      mortality: 10.4, migration: -10, productivity: 58, reserves: 9, baseGrowth: 0.5,
      spendingTarget: 45, revenueRate: 38, taxEfficiency: 0.71,
      resources: { food: 0.58, energy: 0.22, manufactures: 0.56, technology: 0.48 },
      leaders: [
        leader("diaz_canel", "Miguel Díaz-Canel", "MDC", "Continuidad socialista", "Planificación estatal, estabilidad institucional y servicios públicos.", { stability: 6, welfare: 4, education: 3, efficiency: -1 }),
        leader("marrero", "Manuel Marrero Cruz", "MMC", "Gestión ejecutiva", "Administración central, turismo y coordinación productiva.", { efficiency: 4, infrastructure: 3, industry: 2, stability: 1 }),
        leader("bruno_rodriguez", "Bruno Rodríguez Parrilla", "BRP", "Diplomacia soberana", "Relaciones exteriores, alianzas estratégicas y negociación comercial.", { stability: 4, education: 2, efficiency: 1, industry: 1 })
      ]
    }),
    country({
      id: "ZMB", name: "Zambia", flag: "🇿🇲", region: "África Austral", currency: "ZMW", politicalSystem: "República presidencial",
      population: 21.91, gdp: 28.9, education: 56, unemployment: 5.9, infrastructure: 45,
      debt: 112, inflation: 13.5, popularity: 53, stability: 57, birthRate: 32.7,
      mortality: 5.2, migration: -0.2, productivity: 45, reserves: 4, baseGrowth: 5,
      spendingTarget: 31, revenueRate: 25, taxEfficiency: 0.52,
      resources: { food: 1.05, energy: 0.86, manufactures: 0.76, technology: 0.25 },
      leaders: [
        leader("hichilema", "Hakainde Hichilema", "HH", "Reforma e inversión", "Disciplina económica, inversión privada e integración comercial.", { efficiency: 5, diplomacy: 4, industry: 3, welfare: -1 }),
        leader("mundubile", "Brian Mundubile", "BM", "Reconstrucción opositora", "Infraestructura, producción minera y control del costo de vida.", { infrastructure: 4, industry: 4, stability: 1, volatility: 2 }),
        leader("mmembe", "Fred M’membe", "FM", "Socialismo panafricano", "Redistribución, servicios públicos y soberanía sobre recursos.", { welfare: 6, education: 3, diplomacy: 2, efficiency: -2 })
      ]
    }),
    country({
      id: "NGA", name: "Nigeria", flag: "🇳🇬", region: "África Occidental", currency: "NGN", politicalSystem: "República federal presidencial",
      population: 237.53, gdp: 290.8, education: 52, unemployment: 3.1, infrastructure: 43,
      debt: 53, inflation: 23, popularity: 45, stability: 43, birthRate: 32.5,
      mortality: 11.6, migration: -0.3, productivity: 52, reserves: 40, baseGrowth: 3.4,
      spendingTarget: 20, revenueRate: 16, taxEfficiency: 0.45,
      resources: { food: 1.02, energy: 1.68, manufactures: 0.57, technology: 0.48 },
      leaders: [
        leader("tinubu", "Bola Tinubu", "BT", "Reformas de mercado", "Inversión, infraestructura y eliminación gradual de distorsiones fiscales.", { efficiency: 3, infrastructure: 4, industry: 3, volatility: 3 }),
        leader("peter_obi", "Peter Obi", "PO", "Austeridad productiva", "Disciplina fiscal, educación y movilización del empleo joven.", { efficiency: 6, education: 4, debtPressure: -2, welfare: -1 }),
        leader("atiku", "Atiku Abubakar", "AA", "Federalismo económico", "Descentralización, apertura comercial y alianzas territoriales.", { industry: 4, stability: 3, efficiency: 2, infrastructure: 2 })
      ]
    }),
    country({
      id: "URY", name: "Uruguay", flag: "🇺🇾", region: "América del Sur", currency: "UYU", politicalSystem: "República presidencial",
      population: 3.38, gdp: 85.35, education: 83, unemployment: 7.5, infrastructure: 82,
      debt: 66, inflation: 4.7, popularity: 58, stability: 88, birthRate: 9.8,
      mortality: 9.9, migration: 2.1, productivity: 92, reserves: 18, baseGrowth: 2.5,
      spendingTarget: 49, revenueRate: 42, taxEfficiency: 0.9,
      resources: { food: 1.68, energy: 0.82, manufactures: 0.66, technology: 0.76 },
      leaders: [
        leader("orsi", "Yamandú Orsi", "YO", "Desarrollo con acuerdos", "Producción, cohesión social y construcción de consensos.", { welfare: 4, industry: 3, stability: 4, efficiency: 1 }),
        leader("lacalle_pou", "Luis Lacalle Pou", "LLP", "Apertura competitiva", "Comercio, modernización estatal y equilibrio entre coaliciones.", { efficiency: 5, industry: 3, infrastructure: 2, welfare: -1 }),
        leader("cosse", "Carolina Cosse", "CC", "Innovación pública", "Tecnología, infraestructura urbana y empresas estatales estratégicas.", { education: 5, infrastructure: 4, industry: 2, debtPressure: 1 })
      ]
    }),
    country({
      id: "HTI", name: "Haití", flag: "🇭🇹", region: "Caribe", currency: "HTG", politicalSystem: "Gobierno transitorio",
      population: 11.91, gdp: 32.08, education: 40, unemployment: 14.9, infrastructure: 24,
      debt: 18, inflation: 25, popularity: 36, stability: 19, birthRate: 21.9,
      mortality: 7.8, migration: -2, productivity: 30, reserves: 2, baseGrowth: -1.2,
      spendingTarget: 18, revenueRate: 9, taxEfficiency: 0.25,
      resources: { food: 0.55, energy: 0.08, manufactures: 0.25, technology: 0.12 },
      leaders: [
        leader("fils_aime", "Alix Didier Fils-Aimé", "ADFA", "Reconstrucción administrativa", "Seguridad pública, reactivación económica y recuperación institucional.", { security: 5, efficiency: 3, infrastructure: 2, volatility: 4 }),
        leader("lesly_voltaire", "Lesly Voltaire", "LV", "Transición y diálogo", "Acuerdos políticos, reconstrucción urbana y cooperación internacional.", { stability: 4, infrastructure: 4, welfare: 2, efficiency: -1 }),
        leader("fritz_jean", "Fritz Alphonse Jean", "FAJ", "Estabilización económica", "Gestión monetaria, transparencia y fortalecimiento productivo.", { efficiency: 5, industry: 3, stability: 2, welfare: -1 })
      ]
    }),
    country({
      id: "NRU", name: "Nauru", flag: "🇳🇷", region: "Pacífico", currency: "AUD", politicalSystem: "República parlamentaria",
      population: 0.012, gdp: 0.176, education: 71, unemployment: 18, infrastructure: 57,
      debt: 32, inflation: 4.2, popularity: 51, stability: 69, birthRate: 24.6,
      mortality: 7.6, migration: 0, productivity: 50, reserves: 0.15, baseGrowth: 2.3,
      spendingTarget: 80, revenueRate: 70, taxEfficiency: 0.68,
      resources: { food: 0.08, energy: 0.05, manufactures: 0.05, technology: 0.25 },
      leaders: [
        leader("adeang", "David Adeang", "DA", "Continuidad insular", "Estabilidad gubernamental, acuerdos externos y administración de recursos.", { stability: 6, efficiency: 3, industry: 2, infrastructure: 1 }),
        leader("aingimea", "Lionel Aingimea", "LA", "Diplomacia del Pacífico", "Relaciones regionales, justicia y servicios públicos insulares.", { welfare: 3, stability: 3, education: 2, efficiency: 1 }),
        leader("russ_kun", "Russ Kun", "RK", "Gestión comunitaria", "Administración pública, turismo de nicho y desarrollo local.", { efficiency: 4, infrastructure: 3, welfare: 2, stability: 1 })
      ]
    })
  ];

  const EVENTS = [
    {
      id: "drought", type: "natural", title: "Sequía prolongada",
      summary: "La falta de lluvias reduce cosechas, presiona los alimentos y amenaza exportaciones.",
      impact: { food: -0.28, growth: -0.7, inflation: 0.7, stability: -1, duration: 7 },
      choices: [
        { label: "Auxilio y riego de emergencia", detail: "Protege productores y precios, pero aumenta la deuda.", effects: { debt: 1.8, popularity: 3, infrastructure: 0.7, inflation: -0.4 } },
        { label: "Racionar y priorizar exportaciones", detail: "Cuida las reservas a costa del consumo interno.", effects: { reserves: 2.5, popularity: -4, inflation: 0.9, stability: -2 } }
      ]
    },
    {
      id: "flood", type: "natural", title: "Inundaciones regionales",
      summary: "Rutas, viviendas y centros productivos quedan parcialmente aislados.",
      impact: { food: -0.12, industry: -0.08, growth: -0.45, infrastructure: -1.4, duration: 5 },
      choices: [
        { label: "Reconstrucción inmediata", detail: "Moviliza empleo y recupera infraestructura con gasto extraordinario.", effects: { debt: 1.4, popularity: 3, infrastructure: 1.6 } },
        { label: "Delegar en provincias", detail: "Limita el costo nacional, pero la respuesta será desigual.", effects: { debt: 0.2, popularity: -2, stability: -2 } }
      ]
    },
    {
      id: "earthquake", type: "natural", title: "Terremoto destructivo",
      summary: "Un sismo severo afecta infraestructura, hospitales y cadenas logísticas.",
      impact: { industry: -0.15, growth: -1.1, infrastructure: -3, stability: -2, duration: 8 },
      choices: [
        { label: "Plan nacional de reconstrucción", detail: "Recuperación rápida con fuerte compromiso fiscal.", effects: { debt: 2.5, popularity: 4, infrastructure: 2.2 } },
        { label: "Solicitar ayuda internacional", detail: "Reduce el costo, pero expone dependencia externa.", effects: { reserves: 3, popularity: 1, stability: -1 } }
      ]
    },
    {
      id: "wildfire", type: "natural", title: "Incendios fuera de control",
      summary: "El fuego compromete zonas productivas y obliga a evacuar comunidades.",
      impact: { food: -0.1, growth: -0.35, stability: -1.3, duration: 4 },
      choices: [
        { label: "Comando federal de emergencia", detail: "Despliega recursos y refuerza prevención futura.", effects: { debt: 0.8, popularity: 3, infrastructure: 0.5 } },
        { label: "Contención presupuestaria", detail: "Evita nuevo gasto, pero prolonga el daño político.", effects: { popularity: -4, stability: -2 } }
      ]
    },
    {
      id: "general_strike", type: "political", title: "Huelga general",
      summary: "Sindicatos y movimientos sociales paralizan transporte y producción.",
      impact: { industry: -0.18, growth: -0.55, stability: -2.5, duration: 3 },
      choices: [
        { label: "Abrir una mesa salarial", detail: "Recupera estabilidad con mayor presión sobre el gasto.", effects: { debt: 0.9, popularity: 2, stability: 4, inflation: 0.3 } },
        { label: "Sostener el rumbo", detail: "Evita concesiones, pero eleva la conflictividad.", effects: { popularity: -4, stability: -4, debt: -0.2 } }
      ]
    },
    {
      id: "scandal", type: "political", title: "Escándalo en el gabinete",
      summary: "Documentos filtrados comprometen a funcionarios y dominan la agenda pública.",
      impact: { stability: -2, growth: -0.1, duration: 3 },
      choices: [
        { label: "Remover e investigar", detail: "Pierde control político, pero recupera credibilidad.", effects: { popularity: 2, stability: 2, efficiency: 1 } },
        { label: "Cerrar filas", detail: "Preserva el equipo y arriesga una crisis de confianza.", effects: { popularity: -5, stability: -2, efficiency: -1 } }
      ]
    },
    {
      id: "coalition", type: "political", title: "Ruptura de la coalición",
      summary: "Un aliado decisivo abandona el gobierno y amenaza la aprobación de reformas.",
      impact: { stability: -3, growth: -0.2, duration: 6 },
      choices: [
        { label: "Negociar un nuevo pacto", detail: "Cede presupuesto a aliados para recomponer mayoría.", effects: { debt: 0.7, popularity: 1, stability: 5 } },
        { label: "Gobernar en minoría", detail: "Mantiene el programa con mayor riesgo institucional.", effects: { popularity: -2, stability: -5, efficiency: 1 } }
      ]
    },
    {
      id: "border", type: "political", title: "Tensión fronteriza",
      summary: "Un incidente diplomático eleva la alerta militar y afecta el comercio regional.",
      impact: { industry: -0.06, growth: -0.25, stability: -1.5, duration: 5 },
      choices: [
        { label: "Mediación internacional", detail: "Busca desescalar y protege los intercambios.", effects: { popularity: 1, stability: 2, reserves: -0.5 } },
        { label: "Movilización preventiva", detail: "Refuerza la imagen interna con alto costo y riesgo.", effects: { debt: 1.1, popularity: 2, stability: -2 } }
      ]
    },
    {
      id: "energy_shock", type: "global", title: "Shock energético mundial",
      summary: "La oferta internacional se contrae y el precio de la energía se dispara.",
      impact: { energy: -0.22, growth: -0.35, inflation: 0.9, duration: 7 },
      choices: [
        { label: "Subsidio transitorio", detail: "Amortigua tarifas con costo fiscal.", effects: { debt: 1.3, popularity: 3, inflation: -0.7 } },
        { label: "Trasladar el precio", detail: "Protege el presupuesto, pero golpea ingresos reales.", effects: { debt: -0.3, popularity: -4, inflation: 1.1 } }
      ]
    },
    {
      id: "supply_chain", type: "global", title: "Ruptura de suministros",
      summary: "Puertos saturados y restricciones comerciales frenan insumos industriales.",
      impact: { industry: -0.16, technology: -0.12, growth: -0.5, inflation: 0.5, duration: 6 },
      choices: [
        { label: "Diversificar proveedores", detail: "Usa reservas para sostener producción.", effects: { reserves: -2.2, stability: 1, popularity: 1 } },
        { label: "Sustitución local", detail: "La transición es lenta, pero fortalece capacidades internas.", effects: { debt: 0.7, popularity: -1, efficiency: 1.5 } }
      ]
    },
    {
      id: "tech_boom", type: "global", title: "Salto tecnológico",
      summary: "Una nueva ola de automatización impulsa inversión, pero desplaza empleos rutinarios.",
      impact: { technology: 0.2, growth: 0.55, unemployment: 0.25, duration: 8 },
      choices: [
        { label: "Capacitación masiva", detail: "Convierte innovación en productividad con inversión educativa.", effects: { debt: 0.8, education: 1.2, productivity: 1.1, popularity: 2 } },
        { label: "Dejar actuar al mercado", detail: "Captura ganancias rápidas y tolera mayor desigualdad laboral.", effects: { productivity: 0.8, unemployment: 0.8, popularity: -2 } }
      ]
    },
    {
      id: "commodity_boom", type: "global", title: "Auge de materias primas",
      summary: "La demanda internacional eleva precios y reordena flujos de capital.",
      impact: { food: 0.12, energy: 0.14, growth: 0.35, inflation: 0.2, duration: 6 },
      choices: [
        { label: "Crear un fondo anticíclico", detail: "Ahorra parte del ingreso extraordinario.", effects: { reserves: 3.5, popularity: 1, stability: 1 } },
        { label: "Expandir gasto e inversión", detail: "Acelera actividad con riesgo de sobrecalentamiento.", effects: { debt: -0.6, popularity: 3, inflation: 0.5, infrastructure: 0.8 } }
      ]
    }
  ];

  COUNTRIES.forEach((item) => {
    item.center = COUNTRY_CENTERS[item.id];
    item.demographics = COUNTRY_DEMOGRAPHICS[item.id];
    item.taxes = COUNTRY_TAXES[item.id];
  });

  return {
    version: 3,
    release: "3.1.0",
    disclaimer: "Escenario hipotético. Los perfiles y valores son abstracciones de juego, no evaluaciones ni estadísticas oficiales.",
    sectors: SECTORS,
    commodities: COMMODITIES,
    materials: MATERIALS,
    taxes: TAXES,
    constructions: CONSTRUCTIONS,
    countries: COUNTRIES,
    events: [],
    eventsEnabled: false
  };
});
