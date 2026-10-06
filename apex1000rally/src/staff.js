// Fictional balance parameters, separate from energy and vehicle attributes.
export const PART_SPECIALTIES = [
  "engine",
  "transmission",
  "suspension",
  "tyres",
  "cooling",
  "brakes",
];
export const TERRAIN_SPECIALTIES = [
  "gravel",
  "asphalt",
  "mountain",
  "sand",
  "rock",
];
export const CAR_SPECIALTIES = [
  "hilux",
  "raptor",
  "sandrider",
  "mini",
  "niva",
  "hunter",
  "audi",
];
const labels = {
  engine: "motor",
  transmission: "transmisión",
  suspension: "suspensión",
  tyres: "neumáticos",
  cooling: "refrigeración",
  brakes: "frenos",
  gravel: "ripio",
  asphalt: "asfalto",
  mountain: "montaña",
  sand: "arena",
  rock: "roca",
  hilux: "Hilux",
  raptor: "Raptor",
  sandrider: "Sandrider",
  mini: "MINI",
  niva: "Niva",
  hunter: "Hunter",
  audi: "Audi RS Q e-tron",
};
export const validTraits = (value) =>
  typeof value === "string" &&
  value.length <= 180 &&
  (!value ||
    value.split("|").every((id) => {
      const [kind, key, ...extra] = id.split(":");
      return (
        !extra.length &&
        (
          {
            part: PART_SPECIALTIES,
            terrain: TERRAIN_SPECIALTIES,
            car: CAR_SPECIALTIES,
          }[kind] || []
        ).includes(key)
      );
    }));
export const traitList = (p) => (p?.traits || "").split("|").filter(Boolean);
export const hasTrait = (p, id) => traitList(p).includes(id);
export function traitDescription(id, kind = "driver") {
  const [type, key] = id.split(":");
  if (type === "part")
    return `Experto en ${labels[key]}: evita averías aleatorias ${kind === "mechanic" ? "si está asignado a carrera" : "mientras conduce"}. Conserva desgaste, calor y daños por accidentes.${key === "cooling" ? " Reduce además la temperatura objetivo 8 °C." : ""}`;
  if (type === "terrain")
    return `Especialista en ${labels[key]}: +6% de ritmo y −15% de riesgo sólo en esa superficie ${kind === "mechanic" ? "si está asignado a carrera" : "mientras conduce"}.`;
  return `Experto con ${labels[key]}: +4% de ritmo y −10% de riesgo sólo con ese modelo ${kind === "mechanic" ? "si está asignado a carrera" : "mientras conduce"}.`;
}
export const traitLabel = (id) => {
  const [type, key] = id.split(":");
  return `${type === "part" ? "Experto en" : type === "terrain" ? "Especialista en" : "Experto con"} ${labels[key] || key}`;
};
export function staffDefaults(p, kind, index = 0) {
  return {
    age: p.age ?? (kind === "driver" ? 24 : 29) + (index % 19),
    form: p.form ?? 85 - (index % 13),
    morale: p.morale ?? 80 - (index % 11),
    traits:
      p.traits ??
      (kind === "driver"
        ? `terrain:${TERRAIN_SPECIALTIES[index % 5]}${index % 3 === 0 ? "|car:" + CAR_SPECIALTIES[index % 7] : ""}`
        : `part:${PART_SPECIALTIES[index % 6]}`),
  };
}
export const staffCondition = (p) =>
  (0.9 + (0.1 * (p.form ?? 100)) / 100) *
  (0.94 + (0.06 * (p.morale ?? 100)) / 100);
export const specialists = (t) =>
  [
    t.drivers?.find((d) => d.id === t.activeDriver),
    ...(t.mechanics || []).filter((m) => (m.assignment || "race") === "race"),
  ].filter(Boolean);
export const partProtected = (t, type) =>
  specialists(t).some((p) => hasTrait(p, `part:${type}`));
export function staffFactors(t, d, terrain) {
  const active = [
    d,
    ...(t.mechanics || []).filter((m) => (m.assignment || "race") === "race"),
  ].filter(Boolean);
  const surface = active.some((p) => hasTrait(p, `terrain:${terrain}`));
  const car = active.some((p) => hasTrait(p, `car:${t.vehicleId}`));
  return {
    speed: staffCondition(d) * (surface ? 1.06 : 1) * (car ? 1.04 : 1),
    risk:
      (1 + (100 - (d.morale ?? 100)) / 200) *
      (surface ? 0.85 : 1) *
      (car ? 0.9 : 1),
    cooling: active.some((p) => hasTrait(p, "part:cooling")) ? 8 : 0,
  };
}
