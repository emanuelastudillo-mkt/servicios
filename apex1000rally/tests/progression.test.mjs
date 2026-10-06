import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentRace as createRace } from "./fixture.mjs";
import {
  getPlayer,
  advance,
  activateEvent,
  updateRaceClosure,
} from "../src/engine.js";
import { calendar, enroll } from "../src/competition.js";
import {
  teamLevel,
  awardProgression,
  advanceProgression,
} from "../src/progression.js";
import { validateSave } from "../src/storage.js";
import { levelPanel } from "../src/home-independent-ui.js";
const epoch = Date.parse("2026-10-05T12:00:00Z");
const fresh = () =>
  createRace({ startAt: new Date(epoch).toISOString(), now: epoch - 3600000 });
test("cada nivel exige más XP, y perder XP puede bajar el nivel sin bajar de 1", () => {
  const t = getPlayer(fresh());
  assert.equal(teamLevel(t).level, 1);
  t.progression.xp = 100;
  assert.equal(teamLevel(t).level, 2);
  const a = teamLevel(t);
  t.progression.xp = a.next + 1;
  const b = teamLevel(t);
  assert.equal(b.level, 3);
  assert.ok(b.next - b.previous > a.next - a.previous);
  t.progression.xp = 99;
  assert.equal(teamLevel(t).level, 1);
  assert.match(levelPanel(t), /Nivel 1/);
});
test("ganar un raid suma más que un sprint; resultados malos o incompletos restan", () => {
  const s = fresh(),
    t = getPlayer(s),
    e = calendar(s)[0];
  const entry = { finished: true, position: 1, km: 100 };
  awardProgression(s, t, { ...e, kind: "raid" }, entry, 100);
  assert.equal(t.progression.xp, 400);
  awardProgression(s, t, { ...e, kind: "short" }, entry, 100);
  assert.equal(t.progression.xp, 430);
  awardProgression(s, t, e, { ...entry, position: 12 }, 100);
  assert.ok(t.progression.xp < 430);
  const before = t.progression.xp;
  awardProgression(s, t, e, { ...entry, finished: false, km: 10 }, 100);
  assert.ok(t.progression.xp < before);
});
test("72 h de gracia, luego decaimiento 1% diario sin inscripción; bloques deterministas", () => {
  const a = fresh(),
    b = structuredClone(a);
  getPlayer(a).progression.xp = getPlayer(b).progression.xp = 1000;
  advance(a, 72 * 3600);
  assert.equal(getPlayer(a).progression.xp, 1000);
  advance(a, 24 * 3600);
  advance(b, 96 * 3600);
  assert.ok(Math.abs(getPlayer(a).progression.xp - 990) < 1e-6);
  assert.ok(
    Math.abs(getPlayer(a).progression.xp - getPlayer(b).progression.xp) < 1e-6,
  );
  validateSave(a);
});
test("el nivel se acredita una sola vez al cerrar y admite guardados previos sin nivel", () => {
  const s = fresh(),
    e = calendar(s).find((e) => e.kind === "short");
  enroll(s, e.eventId);
  activateEvent(s, e);
  advance(s, 53 * 3600);
  assert.ok(s.competition.closed);
  const t = getPlayer(s),
    xp = t.progression.xp;
  updateRaceClosure(s);
  assert.equal(t.progression.xp, xp);
  const legacy = structuredClone(s);
  legacy.teams.forEach((t) => delete t.progression);
  const migrated = validateSave(legacy);
  assert.equal(getPlayer(migrated).progression.xp, 0);
  const corrupt = structuredClone(s);
  getPlayer(corrupt).progression.xp = -1;
  assert.throws(() => validateSave(corrupt), /Nivel/);
});
test("una carrera participante protege el nivel de inactividad mientras está en curso", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.progression.xp = 2000;
  t.participating = true;
  t.phase = "camp";
  s.clock = 10 * 86400;
  advanceProgression(s);
  assert.equal(t.progression.xp, 2000);
});
