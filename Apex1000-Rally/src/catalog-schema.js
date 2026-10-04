const need = (ok, message) => {
  if (!ok) throw Error(`Catálogo inválido: ${message}`);
};
const n = (v, min, max) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v, max = 100) =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const unique = (rows) => new Set(rows.map((r) => r.id)).size === rows.length;
export function validateCatalog(c) {
  need(c?.schemaVersion === 1, "versión");
  const sizes = {
    vehicles: 4,
    parts: 54,
    drivers: 6,
    mechanics: 8,
    races: 8,
    prizes: 12,
    settings: 4,
  };
  for (const [key, count] of Object.entries(sizes))
    need(Array.isArray(c[key]) && c[key].length === count, key);
  const types = [
    "engine",
    "transmission",
    "suspension",
    "tyres",
    "cooling",
    "brakes",
  ];
  for (const key of ["vehicles", "parts", "drivers", "mechanics", "races"]) {
    need(unique(c[key]), `identificadores repetidos en ${key}`);
    for (const row of c[key])
      need(text(row.id, 80) && /^[a-z0-9-]+$/.test(row.id), "identificador");
  }
  for (const key of ["vehicles", "parts", "drivers", "mechanics"])
    for (const row of c[key]) {
      need(typeof row.available === "boolean", "disponibilidad");
      need(
        row.image === `assets/art/${key === "parts" ? row.type : row.id}.webp`,
        "imagen",
      );
      if (key === "vehicles" || key === "parts")
        need(
          n(row.price, 1, 1000000) &&
            Number.isInteger(row.price) &&
            Number.isInteger(row.stock) &&
            n(row.stock, 0, 100000),
          "precio o stock",
        );
      else
        need(
          text(row.name, 60) &&
            Number.isInteger(row.salary) &&
            n(row.salary, 0, 100000),
          "sueldo o nombre",
        );
    }
  need(
    ["hilux", "raptor", "sandrider", "mini"].every((id) =>
      c.vehicles.some((v) => v.id === id),
    ),
    "modelos",
  );
  c.vehicles.forEach((v) => need(text(v.name, 100), "nombre de vehículo"));
  for (const p of c.parts)
    need(
      types.includes(p.type) &&
        ["standard", "endurance", "racing"].includes(p.grade) &&
        [50, 75, 100].includes(p.condition) &&
        p.id === `${p.type}-${p.grade}-${p.condition}`,
      "referencia de repuesto",
    );
  c.drivers.forEach((d) =>
    need(
      ["technical", "fast", "navigator"].includes(d.profile),
      "perfil del piloto",
    ),
  );
  need(
    ["lucia", "bruno", "mateo", "ines", "alex", "sara"].every((id) =>
      c.drivers.some((d) => d.id === id),
    ),
    "IDs de pilotos",
  );
  need(
    ["elena", "tomas", "nora", "omar", "eva", "leo", "emma", "ivan"].every(
      (id) => c.mechanics.some((d) => d.id === id),
    ),
    "IDs de mecánicos",
  );
  c.mechanics.forEach((m) =>
    need(n(m.efficiency, 1, 1.6), "capacidad mecánica"),
  );
  const routeIds = [
    "andes",
    "sahara",
    "arabia",
    "australia",
    "africa",
    "america",
    "iberia",
    "asia",
  ];
  c.races.forEach((r, i) =>
    need(
      r.id === routeIds[i] &&
        r.round === i + 1 &&
        text(r.name) &&
        text(r.region) &&
        n(r.prizeFactor, 0.1, 10) &&
        Number.isInteger(r.startDay) &&
        r.startDay >= (i ? c.races[i - 1].startDay + 21 : 0) &&
        r.startDay <= 330,
      "calendario",
    ),
  );
  need(c.races[0].startDay === 0, "primera largada");
  c.prizes.forEach((p, i) =>
    need(
      p.position === i + 1 &&
        Number.isInteger(p.points) &&
        n(p.points, 0, 1000) &&
        Number.isInteger(p.race) &&
        n(p.race, 0, 10000000) &&
        Number.isInteger(p.championship) &&
        n(p.championship, 0, 10000000),
      "premios",
    ),
  );
  const settings = Object.fromEntries(c.settings.map((s) => [s.key, s.value]));
  need(
    Object.keys(settings).length === 4 &&
      settings.driverLimit === 3 &&
      settings.mechanicLimit === 5 &&
      n(settings.auctionHours, 1, 168) &&
      n(settings.startingBudget, 100000, 10000000),
    "ajustes",
  );
  need(
    c.vehicles.every((v) => v.price <= settings.startingBudget),
    "el presupuesto inicial debe cubrir cualquier vehículo",
  );
  need(text(c.revision, 100), "revisión");
  return c;
}
