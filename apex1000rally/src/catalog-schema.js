import { validPartSpec } from "./part-brands.js";
import { validTraits } from "./staff.js";
import { STAT_KEYS, validVehicleStats } from "./vehicle-stats.js";
const need = (ok, message) => {
  if (!ok) throw Error(`Catálogo inválido: ${message}`);
};
const n = (v, min, max) =>
  typeof v === "number" && Number.isFinite(v) && v >= min && v <= max;
const text = (v, max = 100) =>
  typeof v === "string" && v.length > 0 && v.length <= max;
const unique = (rows) => new Set(rows.map((r) => r.id)).size === rows.length;
export function validateCatalog(c) {
  need([1, 2].includes(c?.schemaVersion), "versión");
  const modern = c.schemaVersion === 2;
  const sizes = {
    vehicles: modern ? 7 : 4,
    parts: 54,
    drivers: modern ? 16 : 6,
    mechanics: modern ? 28 : 8,
    races: modern ? 32 : 8,
    prizes: 12,
    settings: c.settings?.some((x) => x.key === "monthlyBaseCost") ? 5 : 4,
  };
  for (const [key, count] of Object.entries(sizes))
    need(
      Array.isArray(c[key]) &&
        (modern && ["vehicles", "drivers", "mechanics"].includes(key)
          ? c[key].length >= count &&
            c[key].length <= (key === "vehicles" ? 8 : 200)
          : c[key].length === count),
      key,
    );
  for (const row of [...c.drivers, ...c.mechanics]) {
    for (const [key, min, max] of [
      ["age", 18, 120],
      ["form", 0, 100],
      ["morale", 0, 100],
    ])
      if (Object.hasOwn(row, key))
        need(
          Number.isInteger(row[key]) && n(row[key], min, max),
          "atributo del personal: " + key,
        );
    if (Object.hasOwn(row, "traits"))
      need(validTraits(row.traits), "especialidades del personal");
  }
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
        row.image ===
          `assets/art/${key === "parts" ? row.type : row.id}.webp` ||
          (key === "parts" &&
            row.image === `assets/art/${row.type}-${row.grade}.webp`),
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
            n(row.salary, 0, 1000000),
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
  need(
    c.vehicles.every((v) =>
      [
        "hilux",
        "raptor",
        "sandrider",
        "mini",
        "niva",
        "hunter",
        "audi",
        "manx",
      ].includes(v.id),
    ),
    "modelo sin soporte en el motor",
  );
  c.vehicles.forEach((v) => {
    if (STAT_KEYS.some((k) => Object.hasOwn(v, k)))
      need(
        validVehicleStats(v),
        "estadísticas de vehículo: cuatro enteros de 0 a 100 y peso entero de 700 a 6000 kg",
      );
  });
  for (const p of c.parts)
    need(
      types.includes(p.type) &&
        ["standard", "endurance", "racing"].includes(p.grade) &&
        [50, 75, 100].includes(p.condition) &&
        p.id === `${p.type}-${p.grade}-${p.condition}`,
      "referencia de repuesto",
    );
  for (const p of c.parts)
    if (
      ["brand", "model", "performance", "durability", "failure", "heat"].some(
        (k) => Object.hasOwn(p, k),
      )
    )
      need(validPartSpec(p), "marca o estadísticas de repuesto");
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
      (i >= 8 && modern
        ? /^sprint-[a-z]+$/.test(r.id)
        : r.id === routeIds[i]) &&
        r.round === i + 1 &&
        text(r.name) &&
        text(r.region) &&
        n(r.prizeFactor, 0.1, 10) &&
        Number.isInteger(r.startDay) &&
        r.startDay >=
          (i >= 8 && modern ? 2 : i ? c.races[i - 1].startDay + 21 : 0) &&
        r.startDay <= 330,
      "calendario",
    ),
  );
  if (modern) {
    need(
      ["niva", "hunter", "audi"].every((id) =>
        c.vehicles.some((v) => v.id === id),
      ),
      "nuevos modelos",
    );
    c.races.forEach((r, i) =>
      need(
        r.kind === (i < 8 ? "raid" : "short") &&
          Number.isInteger(r.maxHours) &&
          (i < 8
            ? n(r.maxHours, 24, 672)
            : r.maxHours === 4 && r.startDay === 2 * (i - 7)),
        "duración o frecuencia",
      ),
    );
    c.prizes.forEach((p) =>
      need(Number.isInteger(p.short) && n(p.short, 0, 30000), "premio sprint"),
    );
  }
  need(c.races[0].startDay === 0, "primera largada");
  c.prizes.forEach((p, i) =>
    need(
      p.position === i + 1 &&
        (modern || (Number.isInteger(p.points) && n(p.points, 0, 1000))) &&
        Number.isInteger(p.race) &&
        n(p.race, 0, 10000000) &&
        (modern ||
          (Number.isInteger(p.championship) && n(p.championship, 0, 10000000))),
      "premios",
    ),
  );
  const settings = Object.fromEntries(c.settings.map((s) => [s.key, s.value]));
  need(
    Object.keys(settings).length === c.settings.length &&
      Object.keys(settings).every((k) =>
        [
          "driverLimit",
          "mechanicLimit",
          "auctionHours",
          "startingBudget",
          "monthlyBaseCost",
        ].includes(k),
      ) &&
      (settings.monthlyBaseCost === undefined ||
        (Number.isInteger(settings.monthlyBaseCost) &&
          n(settings.monthlyBaseCost, 0, 100000))) &&
      settings.driverLimit === 3 &&
      settings.mechanicLimit === 5 &&
      n(settings.auctionHours, 1, 168) &&
      n(settings.startingBudget, 1000, 10000000),
    "ajustes",
  );
  need(
    modern
      ? c.vehicles.some(
          (v) =>
            v.available && v.stock > 0 && v.price < settings.startingBudget,
        )
      : c.vehicles.every((v) => v.price <= settings.startingBudget),
    modern
      ? "el presupuesto inicial debe cubrir al menos un vehículo disponible"
      : "el presupuesto inicial debe cubrir cualquier vehículo",
  );
  need(text(c.revision, 100), "revisión");
  return c;
}
