// Hidden, deterministic pace variation. No new random draws or catch-up bonuses.
function hash(text) {
  let value = 2166136261;
  for (const char of text)
    value = Math.imul(value ^ char.charCodeAt(0), 16777619);
  return value >>> 0;
}
export function driverRhythm(
  team,
  driver,
  seconds = team.statistics?.driving || 0,
) {
  if (seconds === null) return 1; // Planning estimates use the mean pace.
  const seed = hash(
    `${team.id}:${driver.personId || driver.id}:${team.stageIndex}`,
  );
  const phase = ((seed % 4096) / 4096) * Math.PI * 2;
  const fastPeriod = 480 + (seed % 960);
  const slowPeriod = 2400 + ((seed >>> 8) % 3000);
  const condition = ((driver.form ?? 85) + (driver.morale ?? 80)) / 200;
  const amplitude = Math.min(
    0.095,
    0.045 + (seed % 24) / 1000 + (1 - condition) * 0.035,
  );
  return (
    1 +
    amplitude *
      (0.65 * Math.sin((seconds / fastPeriod) * Math.PI * 2 + phase) +
        0.35 * Math.sin((seconds / slowPeriod) * Math.PI * 2 + phase * 1.7))
  );
}
export const PART_WEIGHTS = {
  asphalt: {
    engine: 0.38,
    transmission: 0.23,
    suspension: 0.05,
    tyres: 0.14,
    brakes: 0.15,
    cooling: 0.05,
  },
  gravel: {
    engine: 0.24,
    transmission: 0.14,
    suspension: 0.25,
    tyres: 0.23,
    brakes: 0.09,
    cooling: 0.05,
  },
  sand: {
    engine: 0.3,
    transmission: 0.17,
    suspension: 0.19,
    tyres: 0.27,
    brakes: 0.02,
    cooling: 0.05,
  },
  rock: {
    engine: 0.18,
    transmission: 0.14,
    suspension: 0.32,
    tyres: 0.24,
    brakes: 0.07,
    cooling: 0.05,
  },
  mountain: {
    engine: 0.2,
    transmission: 0.17,
    suspension: 0.22,
    tyres: 0.17,
    brakes: 0.19,
    cooling: 0.05,
  },
};
export function terrainPartFactors(effects, terrain) {
  const weights = PART_WEIGHTS[terrain] || PART_WEIGHTS.gravel;
  const speed = Object.entries(weights).reduce(
    (value, [type, weight]) => value * effects[type] ** weight,
    1,
  );
  const handling =
    (effects.suspension * effects.tyres * effects.brakes) ** (1 / 3);
  return { speed, risk: Math.max(0.7, 1 + (1 - handling) * 1.8) };
}
