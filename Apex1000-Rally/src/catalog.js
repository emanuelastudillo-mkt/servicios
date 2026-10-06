import { CATALOG } from "../data/catalog.js";
export const VERSION = "0.4.6";
export const ENGINE_VERSION = "rally-3";
export const STARTING_BUDGET = CATALOG.settings.find(
  (s) => s.key === "startingBudget",
).value;
export const FUEL_PRICE = 2.4;
export const STEP = 30;
export const VEHICLES = [
  {
    id: "hilux",
    name: "Toyota GR DKR Hilux EVO",
    short: "Hilux EVO",
    engine: "V6 biturbo · 3,5 L",
    mass: 2010,
    tank: 540,
    fee: 48000,
    color: "#e98769",
    speed: 1,
    efficiency: 1,
    reliability: 1.08,
    terrain: { asphalt: 1, gravel: 1.03, sand: 1.02, rock: 1.04, mountain: 1 },
    tag: "Equilibrio y resistencia",
    source: "https://toyotagazooracing.com/dakar/release/2024/1126-01/",
    description:
      "Una base equilibrada para alternar ripio, dunas y jornadas largas.",
  },
  {
    id: "raptor",
    name: "Ford Raptor T1+",
    short: "Raptor T1+",
    engine: "V8 Coyote · 5,0 L",
    mass: 2010,
    tank: 520,
    fee: 54000,
    color: "#87ace7",
    speed: 1.035,
    efficiency: 0.91,
    reliability: 1,
    terrain: {
      asphalt: 1.03,
      gravel: 1.04,
      sand: 1.02,
      rock: 0.99,
      mountain: 0.96,
    },
    tag: "Potencia y terreno abierto",
    source:
      "https://media.ford.com/content/fordmedia/feu/de/de/news/2024/07/12/weltpremiere-in-goodwood--neuer-ford-raptor-t1--zeigt-sich-berei.html",
    description:
      "Rápido en tramos abiertos. Necesita controlar consumo y temperatura.",
  },
  {
    id: "sandrider",
    name: "Dacia Sandrider",
    short: "Sandrider",
    engine: "V6 biturbo · 3,0 L",
    mass: 2010,
    tank: 500,
    fee: 56000,
    color: "#cfbf87",
    speed: 1.02,
    efficiency: 1.04,
    reliability: 0.98,
    terrain: {
      asphalt: 1.01,
      gravel: 1.02,
      sand: 1.08,
      rock: 0.97,
      mountain: 1.02,
    },
    tag: "Agilidad sobre arena",
    source:
      "https://media.dacia.com/dacia-presents-sandrider-adventurous-brand-heads-for-dakar/?lang=eng",
    description:
      "La opción ágil para dunas y arena. Cuidá la suspensión entre piedras.",
  },
  {
    id: "mini",
    name: "MINI JCW Rally 3.0i",
    short: "JCW Rally",
    engine: "6 en línea turbo · 3,0 L",
    mass: 2020,
    tank: 580,
    fee: 45000,
    color: "#b5c7a2",
    speed: 0.99,
    efficiency: 1.07,
    reliability: 1.04,
    terrain: {
      asphalt: 0.99,
      gravel: 1.01,
      sand: 0.98,
      rock: 1.04,
      mountain: 1.04,
    },
    tag: "Autonomía y precisión",
    source: "https://www.x-raid.de/en/vehicles/mini-jcw-rally-3-0i/",
    description:
      "Tanque amplio y comportamiento consistente en montaña y etapas técnicas.",
  },
];
VEHICLES.push(
  {
    id: "niva",
    name: "LADA Niva Legend · Raid",
    short: "Niva Raid",
    engine: "Nafta · preparación ficticia de raid",
    mass: 1210,
    tank: 300,
    fee: 16000,
    color: "#9ac093",
    speed: 0.66,
    efficiency: 1.18,
    reliability: 1.12,
    terrain: {
      asphalt: 0.94,
      gravel: 1,
      sand: 0.85,
      rock: 1.06,
      mountain: 1.04,
    },
    tag: "Accesible, lento y sencillo",
    source: "https://www.lada.ru/en/press-releases/121983",
    description:
      "Un modelo real con preparación de juego: poco costo y menor ritmo. Tanque y rendimiento son valores ficticios.",
  },
  {
    id: "hunter",
    name: "Prodrive Hunter T1+",
    short: "Hunter T1+",
    engine: "V6 biturbo · preparación de competición",
    mass: 2010,
    tank: 540,
    fee: 360000,
    color: "#e28d4e",
    speed: 1.16,
    efficiency: 0.9,
    reliability: 1.03,
    terrain: {
      asphalt: 1.04,
      gravel: 1.1,
      sand: 1.12,
      rock: 1.04,
      mountain: 1.01,
    },
    tag: "Élite · gran ritmo y alto consumo",
    source: "https://www.prodrive.com",
    description:
      "Compra de élite. Más velocidad sobre dunas y ripio; requiere un presupuesto amplio.",
  },
  {
    id: "audi",
    name: "Audi RS Q e-tron",
    short: "RS Q e-tron",
    engine: "Tracción eléctrica · convertidor de energía",
    mass: 2100,
    tank: 480,
    fee: 480000,
    color: "#d5dce6",
    speed: 1.2,
    efficiency: 1.2,
    reliability: 0.94,
    terrain: {
      asphalt: 1.12,
      gravel: 1.09,
      sand: 1.06,
      rock: 1.02,
      mountain: 1.08,
    },
    tag: "Élite · rapidez y complejidad técnica",
    source:
      "https://www.audi-mediacenter.com/en/audi-at-the-dakar-rally-2024-15749/the-audi-rs-q-e-tron-new-details-for-the-technological-pioneer-15803",
    description:
      "Prototipo real de tracción eléctrica. El juego simplifica su convertidor con combustible y seis piezas comunes; no simula su batería.",
  },
);
// Las características comparativas y económicas son balance del juego; no datos homologados.
export const PART_TYPES = [
  {
    id: "engine",
    name: "Motor",
    short: "Motor",
    price: 14000,
    hours: 4,
    wear: 2.4,
    icon: "engine",
  },
  {
    id: "transmission",
    name: "Transmisión",
    short: "Caja",
    price: 10000,
    hours: 3,
    wear: 2.3,
    icon: "gear",
  },
  {
    id: "suspension",
    name: "Suspensión",
    short: "Suspensión",
    price: 8000,
    hours: 2.5,
    wear: 3,
    icon: "spring",
  },
  {
    id: "tyres",
    name: "Juego de neumáticos",
    short: "Neumáticos",
    price: 3500,
    hours: 0.7,
    wear: 5.7,
    icon: "wheel",
  },
  {
    id: "cooling",
    name: "Refrigeración",
    short: "Refrigeración",
    price: 6000,
    hours: 2,
    wear: 2,
    icon: "cooling",
  },
  {
    id: "brakes",
    name: "Frenos",
    short: "Frenos",
    price: 4500,
    hours: 1.3,
    wear: 2.6,
    icon: "brake",
  },
];
export const GRADES = {
  reserve: {
    name: "Reserva",
    tag: "Indestructible",
    performance: 0.68,
    durability: 1.3,
    failure: 0,
    heat: 0.85,
    price: 0,
    color: "#99a59c",
    description:
      "Gratis, una por tipo. Nunca se avería; el desgaste sólo reduce su rendimiento.",
  },
  endurance: {
    name: "Endurance",
    tag: "Resistencia",
    performance: 0.96,
    durability: 1.65,
    failure: 0.0025,
    heat: 0.85,
    price: 1.12,
    color: "#a6c68e",
    description:
      "Menor desgaste y temperatura. Una apuesta sólida para jornadas difíciles.",
  },
  standard: {
    name: "Sport",
    tag: "Equilibrio",
    performance: 1.04,
    durability: 1.05,
    failure: 0.006,
    heat: 1,
    price: 1,
    color: "#82b7d2",
    description: "Buen rendimiento con costos y riesgos intermedios.",
  },
  racing: {
    name: "Factory",
    tag: "Rendimiento",
    performance: 1.19,
    durability: 0.73,
    failure: 0.016,
    heat: 1.2,
    price: 1.75,
    color: "#efb065",
    description:
      "Más rápida, más sensible al castigo. Conviene elegir dónde usarla.",
  },
};
export const DRIVER_PROFILES = [
  {
    id: "technical",
    name: "Lucía Ferrer",
    role: "Técnica",
    initials: "LF",
    color: "#90bdae",
    speed: 0.975,
    parts: 1.055,
    wear: 0.78,
    risk: 0.8,
    fatigue: 1,
    recovery: 11,
    description: "Saca más rendimiento de las piezas y reduce su desgaste.",
  },
  {
    id: "fast",
    name: "Bruno Acosta",
    role: "Velocista",
    initials: "BA",
    color: "#e8a174",
    speed: 1.09,
    parts: 1,
    wear: 1.1,
    risk: 1.85,
    fatigue: 1.08,
    recovery: 11,
    description: "Más velocidad, con más desgaste, salidas de pista y errores.",
  },
  {
    id: "navigator",
    name: "Mateo Cruz",
    role: "Navegante",
    initials: "MC",
    color: "#acb4e7",
    speed: 1,
    parts: 1,
    wear: 0.95,
    risk: 0.55,
    fatigue: 0.72,
    recovery: 12,
    description:
      "Menos errores de navegación y mayor resistencia al cansancio.",
  },
];
export const PACES = {
  conserve: {
    name: "Conservar",
    speed: 0.89,
    wear: 0.66,
    risk: 0.58,
    fuel: 0.9,
  },
  balanced: { name: "Equilibrado", speed: 1, wear: 1, risk: 1, fuel: 1 },
  attack: { name: "Atacar", speed: 1.115, wear: 1.48, risk: 1.75, fuel: 1.15 },
};
export const TERRAINS = {
  asphalt: {
    name: "Asfalto",
    color: "#98adc1",
    speed: 180,
    cap: 250,
    wear: 0.7,
    fuel: 0.78,
    risk: 0.5,
  },
  gravel: {
    name: "Ripio",
    color: "#d7b685",
    speed: 115,
    cap: 165,
    wear: 1.05,
    fuel: 1,
    risk: 1,
  },
  sand: {
    name: "Dunas",
    color: "#e6c26e",
    speed: 82,
    cap: 130,
    wear: 1.22,
    fuel: 1.38,
    risk: 1.25,
  },
  rock: {
    name: "Piedra",
    color: "#ba9e99",
    speed: 58,
    cap: 95,
    wear: 1.6,
    fuel: 1.2,
    risk: 1.45,
  },
  mountain: {
    name: "Montaña",
    color: "#9fbaa0",
    speed: 76,
    cap: 120,
    wear: 1.25,
    fuel: 1.16,
    risk: 1.3,
  },
};
export const PHASES = {
  waiting: "Esperando largada",
  camp: "En campamento",
  service: "Asistencia y descanso",
  racing: "En carrera",
  finished: "Finalizado",
  cutoff: "Clasificado al cierre",
  unregistered: "En taller · sin inscripción",
};
export const PRIZES = [
  65000, 48000, 36000, 29000, 24000, 21000, 19000, 17000, 15000, 13000, 11000,
  9000,
];
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const vehicle = (id) => VEHICLES.find((v) => v.id === id) || VEHICLES[0];
export const partType = (id) => PART_TYPES.find((p) => p.id === id);
export function partEffect(item) {
  const g = GRADES[item.grade];
  return g.performance * (0.55 + (0.45 * clamp(item.condition, 0, 100)) / 100);
}
export function priceFor(type, grade, condition = 100) {
  return Math.round(
    partType(type).price *
      GRADES[grade].price *
      (0.3 + (0.7 * condition) / 100),
  );
}
export function defaultPlan(stageIndex = 0) {
  return {
    driverId: DRIVER_PROFILES[stageIndex % 3].id,
    pace: "balanced",
    boost: 0,
    ride: "balanced",
    pressure: "mixed",
    gearing: "mixed",
    cooling: "balanced",
    fuelTarget: 450,
    rest: "full",
    actions: Object.fromEntries(PART_TYPES.map((p) => [p.id, "repair"])),
    replacements: {},
    auto: true,
  };
}

for (const v of VEHICLES)
  v.fee = CATALOG.vehicles.find((row) => row.id === v.id).price;
