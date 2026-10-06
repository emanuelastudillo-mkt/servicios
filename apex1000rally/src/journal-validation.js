import { PART_TYPES } from "./catalog.js";
const number = (n, min = 0, max = Infinity) =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
const text = (s, max) => typeof s === "string" && s.length <= max;
const count = (n) => Number.isSafeInteger(n) && n >= 0;
export function validateJournal(team, stages, clock) {
  // Old saves have no observational history. Never reconstruct invented events.
  team.journal ??= [];
  team.stageNotes ??= null;
  const seen = new Set();
  if (!Array.isArray(team.journal) || team.journal.length > stages.length)
    throw Error("Bitácora inválida.");
  for (const page of team.journal) {
    if (
      !page ||
      !Number.isInteger(page.stage) ||
      page.stage < 0 ||
      page.stage >= stages.length ||
      seen.has(page.stage) ||
      !number(page.at, 0, clock + 1e-6) ||
      !text(page.driver, 80) ||
      typeof page.complete !== "boolean" ||
      typeof page.partial !== "boolean" ||
      !number(page.km, 0, stages[page.stage].km + 0.001) ||
      !Array.isArray(page.lines) ||
      page.lines.length < 1 ||
      page.lines.length > 2
    )
      throw Error("Página de bitácora inválida.");
    if (page.complete && page.stage >= team.stageIndex)
      throw Error("Etapa de bitácora inconsistente.");
    seen.add(page.stage);
    for (const line of page.lines)
      if (
        !line ||
        !text(line.key, 40) ||
        !["problem", "warning", "positive", "neutral"].includes(line.tone) ||
        !text(line.text, 800) ||
        !text(line.hint, 800)
      )
        throw Error("Nota de bitácora inválida.");
  }
  const n = team.stageNotes;
  if (!n) return;
  if (
    team.phase !== "racing" ||
    n.stage !== team.stageIndex ||
    typeof n.partial !== "boolean" ||
    !text(n.driver, 80) ||
    !number(n.startedAt, 0, clock + 1e-6) ||
    !number(n.km, 0, team.stageKm + 0.001) ||
    !number(n.maxHeat, 0, 200) ||
    !number(n.minEnergy, 0, 100) ||
    !number(n.heatSlowSeconds, 0, Math.max(0, clock - n.startedAt) + 30) ||
    !count(n.errors) ||
    !count(n.fuelStops) ||
    !Array.isArray(n.failures) ||
    n.failures.length > PART_TYPES.length ||
    new Set(n.failures).size !== n.failures.length ||
    n.failures.some((id) => !PART_TYPES.some((p) => p.id === id))
  )
    throw Error("Observaciones de etapa inválidas.");
  for (const key of ["pressure", "ride", "gearing"])
    if (!number(n.badSetup?.[key], 0, n.km + 0.001))
      throw Error("Observación de configuración inválida.");
}
