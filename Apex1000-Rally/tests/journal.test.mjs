import test from "node:test";
import assert from "node:assert/strict";
import { createRace } from "./fixture.mjs";
import { advance, getPlayer, savePlan, nextPlayerCamp } from "../src/engine.js";
import { defaultPlan } from "../src/catalog.js";
import { routeFor } from "../src/route.js";
import {
  startJournal,
  observeJournal,
  noteIncident,
  journalEntry,
  finishJournal,
} from "../src/journal.js";
import { validateSave } from "../src/storage.js";
import { journalPage } from "../src/journal-ui.js";
const fresh = () =>
  createRace({
    startAt: "2026-10-10T12:00:00Z",
    now: Date.parse("2026-10-10T12:00:00Z"),
  });
const setup = () => {
  const s = fresh(),
    t = getPlayer(s),
    stage = routeFor(s).stages[0];
  t.activePlan = { ...defaultPlan(), fuelTarget: 540 };
  startJournal(t, stage, 0);
  return { s, t, stage };
};
test("bitácora prioriza hechos, limita dos notas y no duplica páginas", () => {
  const { t, stage } = setup();
  for (const type of ["engine", "engine", "cooling"])
    noteIncident(t, "failure", type);
  noteIncident(t, "error");
  noteIncident(t, "fuel");
  t.heat = 130;
  t.drivers[0].energy = 0;
  observeJournal(t, stage, {
    terrainId: "sand",
    distance: 100,
    seconds: 3600,
    wasHot: true,
  });
  assert.deepEqual(t.stageNotes.failures, ["engine", "cooling"]);
  const page = journalEntry(t, stage, 3600, true);
  assert.deepEqual(
    page.lines.map((l) => l.key),
    ["failure", "fuel"],
  );
  finishJournal(t, stage, 3600);
  finishJournal(t, stage, 3600);
  assert.equal(t.journal.length, 1);
  assert.equal(t.stageNotes, null);
});
test("el tutorial distingue calor que frenó al auto, fatiga y configuración incorrecta", () => {
  const { t, stage } = setup();
  t.activePlan.pressure = "firm";
  t.heat = 140;
  observeJournal(t, stage, {
    terrainId: "sand",
    distance: 100,
    seconds: 3600,
    wasHot: false,
  });
  assert.equal(journalEntry(t, stage, 3600).lines[0].key, "setup-pressure");
  assert.ok(!journalEntry(t, stage, 3600).lines.some((l) => l.key === "heat"));
  t.drivers[0].energy = 10;
  observeJournal(t, stage, {
    terrainId: "sand",
    distance: 10,
    seconds: 180,
    wasHot: true,
  });
  assert.deepEqual(
    journalEntry(t, stage, 3780).lines.map((l) => l.key),
    ["heat", "fatigue"],
  );
});
test("partidas antiguas no inventan etapas limpias ni pierden datos por migrar", () => {
  const { t, stage } = setup();
  t.stageKm = 300;
  startJournal(t, stage, 100);
  observeJournal(t, stage, {
    terrainId: "gravel",
    distance: 10,
    seconds: 300,
    wasHot: false,
  });
  const page = journalEntry(t, stage, 400, true);
  assert.equal(page.partial, true);
  assert.ok(page.lines.every((l) => l.tone !== "positive"));
  const s = fresh();
  for (const team of s.teams) {
    delete team.journal;
    delete team.stageNotes;
  }
  const migrated = validateSave(s);
  assert.deepEqual(getPlayer(migrated).journal, []);
  assert.equal(getPlayer(migrated).budget, getPlayer(s).budget);
});
test("una etapa simulada guarda notas y la importación rechaza observaciones corruptas", () => {
  const s = fresh();
  savePlan(s, 0, { ...defaultPlan(), fuelTarget: 540 });
  advance(s, 1800);
  assert.ok(getPlayer(s).stageNotes.km > 0);
  assert.doesNotThrow(() => validateSave(s));
  const bad = structuredClone(s);
  getPlayer(bad).stageNotes.badSetup.pressure = 100000;
  assert.throws(() => validateSave(bad), /Observación/);
  nextPlayerCamp(s);
  assert.equal(getPlayer(s).journal.length, 1);
  assert.equal(getPlayer(s).journal[0].complete, true);
  assert.ok(getPlayer(s).journal[0].lines.length <= 2);
  assert.doesNotThrow(() => validateSave(s));
  getPlayer(s).journal[0].lines.push(...getPlayer(s).journal[0].lines);
  assert.throws(() => validateSave(s), /bitácora/);
});
test("las notas escapan nombres y textos importados antes de dibujar el cuaderno", () => {
  const { s, t, stage } = setup();
  finishJournal(t, stage, 0);
  t.journal[0].lines[0].text = "<img src=x onerror=alert(1)>";
  t.name = "<script>bad()</script>";
  const html = journalPage(s);
  assert.ok(!html.includes("<script>"));
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;img"));
});
