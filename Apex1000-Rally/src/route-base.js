import { TERRAINS, clamp } from "./catalog.js";
// Localidades reales (GeoNames). Recorrido deportivo, kilometrajes y puntos intermedios ficticios.
export const CITIES = [
  ["Buenos Aires", -58.37723, -34.61315, "AR"],
  ["Mar del Plata", -57.5562, -38.00042, "AR"],
  ["Bahía Blanca", -62.26545, -38.7176, "AR"],
  ["Puerto Madryn", -65.03827, -42.76848, "AR"],
  ["Esquel", -71.31947, -42.91147, "AR"],
  ["Bariloche", -71.30822, -41.14557, "AR"],
  ["Neuquén", -68.0592, -38.95078, "AR"],
  ["Mendoza", -68.84582, -32.88946, "AR"],
  ["San Juan", -68.52568, -31.53726, "AR"],
  ["Catamarca", -65.78524, -28.46957, "AR"],
  ["Salta", -65.41999, -24.80645, "AR"],
  ["Uyuni", -66.82503, -20.46028, "BO"],
  ["San Pedro de Atacama", -68.20113, -22.9111, "CL"],
  ["Copiapó", -70.33219, -27.36737, "CL"],
  ["La Serena", -71.25014, -29.90591, "CL"],
  ["Santiago", -70.64827, -33.45694, "CL"],
].map(([name, lon, lat, country]) => ({ name, lon, lat, country }));
const specs = [
  [
    450,
    24,
    80,
    [
      ["asphalt", 0.65],
      ["gravel", 0.35],
    ],
    "Largada hacia el Atlántico",
    "El asfalto premia relaciones largas. Guardá motor y frenos para los días que vienen.",
  ],
  [
    560,
    27,
    120,
    [
      ["gravel", 0.45],
      ["sand", 0.25],
      ["asphalt", 0.3],
    ],
    "Viento y costa",
    "El ripio suelto castiga neumáticos. La costa ofrece arena y ráfagas.",
  ],
  [
    800,
    25,
    350,
    [
      ["asphalt", 0.3],
      ["gravel", 0.55],
      ["rock", 0.15],
    ],
    "La puerta de la Patagonia",
    "Jornada extensa: la autonomía y la energía pesan más que una velocidad punta alta.",
  ],
  [
    880,
    19,
    1100,
    [
      ["gravel", 0.45],
      ["rock", 0.3],
      ["mountain", 0.25],
    ],
    "De la estepa a la cordillera",
    "Piedra y desniveles. Una suspensión resistente puede ahorrar una reparación larga.",
  ],
  [
    500,
    16,
    1500,
    [
      ["mountain", 0.6],
      ["gravel", 0.25],
      ["asphalt", 0.15],
    ],
    "Entre lagos y pasos",
    "Los frenos y la precisión de navegación son decisivos en las curvas de montaña.",
  ],
  [
    580,
    24,
    850,
    [
      ["gravel", 0.5],
      ["rock", 0.2],
      ["asphalt", 0.3],
    ],
    "La estepa vuelve a abrirse",
    "Alterná tracción y velocidad. Llegar con gomas sanas permite atacar el tramo final.",
  ],
  [
    840,
    32,
    1300,
    [
      ["asphalt", 0.35],
      ["sand", 0.3],
      ["gravel", 0.35],
    ],
    "Hacia la tierra del sol",
    "El calor y los kilómetros exigen refrigeración. Cuidado con el combustible en arena.",
  ],
  [
    460,
    35,
    1600,
    [
      ["sand", 0.35],
      ["rock", 0.4],
      ["gravel", 0.25],
    ],
    "Piedra caliente",
    "Terreno corto y duro. La potencia extra puede costar más de lo que gana.",
  ],
  [
    750,
    34,
    2100,
    [
      ["gravel", 0.35],
      ["mountain", 0.3],
      ["sand", 0.35],
    ],
    "Cruce de los valles",
    "Sube la altitud y el estrés térmico. Revisá motor, caja y filtro de refrigeración.",
  ],
  [
    790,
    29,
    2500,
    [
      ["mountain", 0.35],
      ["rock", 0.25],
      ["gravel", 0.4],
    ],
    "Rumbo al norte",
    "Una buena lectura del camino evita desvíos. Reservá energía para la jornada de altura.",
  ],
  [
    860,
    13,
    4100,
    [
      ["mountain", 0.4],
      ["rock", 0.2],
      ["gravel", 0.4],
    ],
    "Altiplano",
    "Menos potencia por altura y mucha fatiga. Prioridad a la confiabilidad y la navegación.",
  ],
  [
    730,
    20,
    4300,
    [
      ["gravel", 0.3],
      ["sand", 0.4],
      ["mountain", 0.3],
    ],
    "El paso del desierto",
    "Arena, altura y autonomía. Controlá el consumo antes de pedir más rendimiento.",
  ],
  [
    750,
    36,
    1900,
    [
      ["sand", 0.65],
      ["rock", 0.15],
      ["gravel", 0.2],
    ],
    "El corazón de Atacama",
    "Las dunas castigan motor, gomas y temperatura. Altura de chasis y presión baja ayudan.",
  ],
  [
    680,
    29,
    600,
    [
      ["gravel", 0.35],
      ["asphalt", 0.5],
      ["sand", 0.15],
    ],
    "De vuelta al Pacífico",
    "Recuperá velocidad con relaciones largas, sin descuidar las piezas que deben llegar al final.",
  ],
  [
    610,
    25,
    900,
    [
      ["asphalt", 0.65],
      ["mountain", 0.2],
      ["gravel", 0.15],
    ],
    "La última decisión",
    "Quedan kilómetros rápidos y un paso de montaña. Atacar sólo sirve si el auto llega.",
  ],
];
let cumulative = 0;
export const STAGES = specs.map(
  ([km, temp, altitude, terrain, title, brief], i) => {
    const from = CITIES[i],
      to = CITIES[i + 1],
      startKm = cumulative;
    cumulative += km;
    let consumed = 0;
    const segments = terrain.map(([type, share]) => {
      const s = { type, share, km: km * share, start: consumed };
      consumed += s.km;
      return s;
    });
    const dx = to.lon - from.lon,
      dy = to.lat - from.lat,
      magnitude = Math.hypot(dx, dy) || 1;
    const path = Array.from({ length: 17 }, (_, j) => {
      const t = j / 16,
        wiggle = Math.sin(t * Math.PI) * Math.sin(t * Math.PI * 3 + i) * 0.19;
      return [
        from.lon + dx * t - (dy / magnitude) * wiggle,
        from.lat + dy * t + (dx / magnitude) * wiggle,
      ];
    });
    return {
      id: i,
      index: i,
      from,
      to,
      km,
      startKm,
      endKm: cumulative,
      temp,
      altitude,
      segments,
      title,
      brief,
      path,
    };
  },
);
export const TOTAL_KM = cumulative;
export const ROUTE_NAME = "Travesía de los Andes";
export function segmentAt(stage, km) {
  return (
    stage.segments.find((s) => km < s.start + s.km) || stage.segments.at(-1)
  );
}
export function stageAtDistance(km) {
  return STAGES.find((s) => km < s.endKm) || STAGES.at(-1);
}
export function locationAt(totalKm) {
  const stage = stageAtDistance(totalKm),
    f = clamp((totalKm - stage.startKm) / stage.km, 0, 1),
    n = f * (stage.path.length - 1),
    a = Math.min(stage.path.length - 2, Math.floor(n)),
    u = n - a;
  return {
    lon: stage.path[a][0] + (stage.path[a + 1][0] - stage.path[a][0]) * u,
    lat: stage.path[a][1] + (stage.path[a + 1][1] - stage.path[a][1]) * u,
    stage: stage.index,
  };
}
export function recommendedSetup(stage) {
  const dominant = [...stage.segments].sort((a, b) => b.share - a.share)[0]
    .type;
  return {
    ride: ["rock", "sand", "mountain"].includes(dominant) ? "high" : "balanced",
    pressure:
      dominant === "sand" ? "soft" : dominant === "asphalt" ? "firm" : "mixed",
    gearing: ["mountain", "sand", "rock"].includes(dominant)
      ? "short"
      : dominant === "asphalt"
        ? "long"
        : "mixed",
    cooling: stage.temp >= 30 ? "open" : "balanced",
  };
}
export function terrainDescription(stage) {
  return stage.segments
    .map((s) => `${TERRAINS[s.type].name} ${Math.round(s.share * 100)}%`)
    .join(" · ");
}
