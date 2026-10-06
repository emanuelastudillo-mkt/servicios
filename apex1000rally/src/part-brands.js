// Brands are real; models, compatibility, costs and all comparative values are fictional game balance.
const rows = {
  engine: [
    ["Cummins", "Trail D", 0.91, 1.86, 0.0018, 0.8, 17900],
    ["Toyota", "Raid V6", 1.05, 1.12, 0.0052, 0.97, 14200],
    ["Cosworth", "Sprint X", 1.25, 0.67, 0.018, 1.26, 28900],
  ],
  transmission: [
    ["Allison", "Trail AT", 0.94, 1.92, 0.0021, 0.83, 13900],
    ["ZF", "Raid 6", 1.03, 1.19, 0.0048, 0.96, 10800],
    ["SADEV", "Sprint SQ", 1.2, 0.81, 0.014, 1.16, 21500],
  ],
  suspension: [
    ["Old Man Emu", "Trail HD", 0.95, 1.98, 0.0017, 0.82, 10200],
    ["Bilstein", "Raid B", 1.06, 1.22, 0.0044, 0.94, 8700],
    ["FOX", "Sprint R", 1.22, 0.78, 0.0128, 1.12, 16800],
  ],
  tyres: [
    ["BFGoodrich", "Trail AT", 0.92, 2.06, 0.0022, 0.79, 4900],
    ["Cooper", "Raid ST", 1.04, 1.16, 0.0064, 1.02, 3600],
    ["Michelin", "Sprint RX", 1.24, 0.65, 0.0175, 1.24, 7300],
  ],
  cooling: [
    ["DENSO", "Trail Core", 0.97, 1.82, 0.0016, 0.75, 7900],
    ["Nissens", "Raid Alloy", 1.07, 1.14, 0.0055, 0.92, 6300],
    ["Mishimoto", "Sprint Flow", 1.26, 0.76, 0.015, 1.13, 12900],
  ],
  brakes: [
    ["Brembo", "Trail Iron", 0.96, 1.88, 0.0019, 0.81, 6100],
    ["ATE", "Raid Disc", 1.02, 1.2, 0.0049, 0.95, 4600],
    ["AP Racing", "Sprint Carbon", 1.23, 0.71, 0.0162, 1.21, 9800],
  ],
};
const grades = ["endurance", "standard", "racing"];
export const PART_BRANDS = Object.fromEntries(
  Object.entries(rows).map(([type, values]) => [
    type,
    Object.fromEntries(
      values.map(
        ([brand, model, performance, durability, failure, heat, price], i) => [
          grades[i],
          {
            brand,
            model,
            performance,
            durability,
            failure,
            heat,
            price,
            image: `assets/art/${type}${grades[i] === "standard" ? "" : "-" + grades[i]}.webp`,
            color: ["#a6c68e", "#82b7d2", "#efb065"][i],
          },
        ],
      ),
    ),
  ]),
);
export function validPartSpec(p) {
  return (
    !!p &&
    typeof p.brand === "string" &&
    p.brand.length > 0 &&
    p.brand.length <= 40 &&
    typeof p.model === "string" &&
    p.model.length > 0 &&
    p.model.length <= 60 &&
    [
      ["performance", 0.5, 1.5],
      ["durability", 0.4, 3],
      ["failure", 0, 0.1],
      ["heat", 0.5, 1.5],
      ["price", 1, 1000000],
    ].every(
      ([k, min, max]) =>
        typeof p[k] === "number" &&
        Number.isFinite(p[k]) &&
        p[k] >= min &&
        p[k] <= max,
    ) &&
    /^assets\/art\/[a-z0-9-]+\.webp$/.test(p.image) &&
    (p.color === undefined || /^#[a-fA-F0-9]{6}$/.test(p.color))
  );
}
export function partSpec(piece) {
  if (piece.grade === "reserve")
    return {
      brand: "Apex",
      model: "Reserva estándar",
      performance: 0.68,
      durability: 1.3,
      failure: 0,
      heat: 0.85,
      price: 0,
      color: "#99a59c",
      image: `assets/art/${piece.type}.webp`,
    };
  const legacy = {
    endurance: {
      performance: 0.96,
      durability: 1.65,
      failure: 0.0025,
      heat: 0.85,
    },
    standard: { performance: 1.04, durability: 1.05, failure: 0.006, heat: 1 },
    racing: { performance: 1.19, durability: 0.73, failure: 0.016, heat: 1.2 },
  };
  const base = PART_BRANDS[piece.type]?.[piece.grade] || legacy[piece.grade];
  return { ...base, ...(piece.spec || {}) };
}
export const partName = (piece) => {
  const p = partSpec(piece);
  return `${p.brand} · ${p.model}`;
};
export function specFromOffer(offer) {
  const base = partSpec(offer);
  const result = Object.fromEntries(
    [
      "brand",
      "model",
      "performance",
      "durability",
      "failure",
      "heat",
      "image",
      "color",
    ].map((k) => [k, offer[k] ?? base[k]]),
  );
  // Compare resale/repairs with the same model's new price, not its used purchase price.
  result.price = Math.round(
    offer.price / (0.3 + (0.7 * offer.condition) / 100),
  );
  return result;
}
