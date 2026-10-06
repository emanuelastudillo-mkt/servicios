import { readFileSync } from "node:fs";
import { createRace as create } from "../src/engine.js";
import { CATALOG } from "../data/catalog.js";

// Keep rule tests stable when an administrator edits the live catalog.
export const TEST_CATALOG = JSON.parse(
  readFileSync(new URL("fixtures/catalog-v3.json", import.meta.url), "utf8"),
);
export const TEST_BUDGET = TEST_CATALOG.settings.find(
  (s) => s.key === "startingBudget",
).value;
export const createRace = (options = {}) =>
  create({ ...options, catalog: TEST_CATALOG });
// Current rule fixtures need funds to exercise upgrades and all vehicle models.
// Production onboarding is covered separately with its actual 30,000 budget.
export const createCurrentRace = (options = {}) => {
  const catalog = structuredClone(CATALOG);
  catalog.settings.find((s) => s.key === "startingBudget").value = TEST_BUDGET;
  return create({ ...options, catalog });
};
