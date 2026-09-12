(function (root, factory) {
  const data = factory();
  if (typeof module === "object" && module.exports) module.exports = data;
  else root.PULSO_DATA = data;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECTORS = [
    { id: "agriculture", label: "Agro y alimentos", short: "Agro", commodity: "food" },
    { id: "industry", label: "Industria", short: "Industria", commodity: "manufactures" },
    { id: "services", label: "Servicios", short: "Servicios", commodity: null },
    { id: "education", label: "Educación", short: "Educación", commodity: "technology" },
    { id: "health", label: "Salud", short: "Salud", commodity: null },
    { id: "infrastructure", label: "Obra pública", short: "Obra pública", commodity: null },
    { id: "security", label: "Seguridad y defensa", short: "Seguridad", commodity: null },
    { id: "energy", label: "Energía", short: "Energía", commodity: "energy" }
  ];

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

  return {
    version: 1,
    disclaimer: "Escenario hipotético. Los perfiles y valores son abstracciones de juego, no evaluaciones ni estadísticas oficiales.",
    sectors: SECTORS,
    commodities: COMMODITIES,
    countries: COUNTRIES,
    events: EVENTS
  };
});
