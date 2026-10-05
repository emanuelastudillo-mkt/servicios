// Four game-balance indices plus a documented reference mass in kilograms.
export const STAT_KEYS = [
  "speed",
  "acceleration",
  "comfort",
  "control",
  "weightKg",
];
export const STAT_LABELS = {
  speed: "Velocidad",
  acceleration: "Aceleración",
  comfort: "Comodidad",
  control: "Control",
  weightKg: "Peso",
};
export const WEIGHT_REFERENCES = {
  hilux: { kg: 2010, kind: "Mínimo FIA en seco · Hilux EVO 2025" },
  raptor: { kg: 2010, kind: "Peso mínimo declarado · Raptor T1+ 2024" },
  sandrider: { kg: 2010, kind: "Referencia: mínimo FIA T1+ gasolina 2024" },
  mini: { kg: 2020, kind: "Peso en vacío declarado por X-raid" },
  niva: { kg: 1210, kind: "Peso en vacío · Niva Legend 3 puertas de serie" },
  hunter: { kg: 2010, kind: "Referencia: mínimo FIA T1+ gasolina 2024" },
  audi: { kg: 2100, kind: "Referencia: mínimo reglamentario Dakar 2024" },
};
const defaults = {
  hilux: [70, 72, 78, 80],
  raptor: [74, 80, 70, 72],
  sandrider: [72, 76, 73, 85],
  mini: [69, 68, 83, 87],
  niva: [36, 40, 44, 62],
  hunter: [86, 90, 75, 88],
  audi: [90, 96, 86, 90],
};
export function validVehicleStats(stats) {
  return (
    !!stats &&
    STAT_KEYS.slice(0, 4).every(
      (k) => Number.isInteger(stats[k]) && stats[k] >= 0 && stats[k] <= 100,
    ) &&
    Number.isInteger(stats.weightKg) &&
    stats.weightKg >= 700 &&
    stats.weightKg <= 6000
  );
}
export function modelStats(id, catalog) {
  const row = catalog?.vehicles.find((v) => v.id === id);
  const values = Object.fromEntries(
    STAT_KEYS.map((k, i) => [
      k,
      row?.[k] ??
        (k === "weightKg"
          ? (WEIGHT_REFERENCES[id] || WEIGHT_REFERENCES.hilux).kg
          : (defaults[id] || defaults.hilux)[i]),
    ]),
  );
  return values;
}
export function teamVehicleStats(team) {
  return (
    team.garage?.find((c) => c.id === team.activeCarId)?.stats ||
    modelStats(team.vehicleId)
  );
}
// v0.4.0's daily importer passed unknown CSV columns through as strings.
// Normalize only legacy saves without per-car stats; modern saves stay strict.
export function migrateLegacyCatalogStats(state) {
  if (
    !state.teams.every(
      (t) =>
        Array.isArray(t.garage) && t.garage.every((c) => c.stats === undefined),
    )
  )
    return;
  for (const row of state.management?.catalog?.vehicles || []) {
    for (const k of STAT_KEYS) {
      if (typeof row[k] === "string" && /^\d+$/.test(row[k]))
        row[k] = Number(row[k]);
    }
  }
}
export function statFactors(stats, terrain) {
  const technical = ["rock", "mountain"].includes(terrain);
  const acceleration =
    1 +
    (stats.acceleration - 70) *
      (technical ? 0.0018 : terrain === "sand" ? 0.0012 : 0.0008);
  const control =
    1 + (stats.control - 70) * (terrain === "asphalt" ? 0.0003 : 0.001);
  const massDelta = (stats.weightKg - 2010) / 2010;
  const weight =
    1 / (1 + massDelta * (technical || terrain === "sand" ? 0.3 : 0.1));
  return {
    speed: (0.3 + stats.speed * 0.01) * acceleration * control * weight,
    risk: 1 + (70 - stats.control) * 0.01,
    fatigue: 1 + (70 - stats.comfort) * 0.006,
    fuel: 1 + massDelta * 0.3,
    wear: 1 + massDelta * 0.3,
  };
}
