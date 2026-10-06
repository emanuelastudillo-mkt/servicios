import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SHIELDS, SHIELD_COUNT, shieldSVG } from "../src/shields.js";
import { createCurrentRace as createRace } from "./fixture.mjs";
import { dispatch, getPlayer, publicSnapshot } from "../src/engine.js";
import { validateSave, encodeSave } from "../src/storage.js";
import { identityPanel, shieldPicker } from "../src/identity-ui.js";
import { migrateIdentity } from "../src/identity.js";

test("48 símbolos con trazados distintos, nombres y archivos SVG disponibles", () => {
  assert.equal(SHIELD_COUNT, 48);
  const paths = new Set();
  for (const [i, s] of SHIELDS.entries()) {
    assert.equal(s.id, i + 1);
    const svg = readFileSync(new URL("../" + s.file, import.meta.url), "utf8");
    paths.add([...svg.matchAll(/<path d="([^"]+)"/g)].at(-1)[1]);
    assert.match(svg, /<linearGradient id="chrome"/);
    assert.match(svg, /viewBox="0 0 100 100"/);
    assert.ok(svg.includes(`<title>${s.name} · Apex1000</title>`));
    assert.ok(shieldSVG(s.id).includes(`href="${s.file}"`));
  }
  assert.equal(paths.size, 48);
  assert.equal(new Set(SHIELDS.map((s) => s.name)).size, 48);
  assert.equal(
    (shieldPicker().match(/class="shield-option/g) || []).length,
    48,
  );
});

test("escudería y director son independientes y persisten en exportación e importación", () => {
  const s = createRace({
    name: "Cóndor Racing",
    director: "Emanuel_01",
    shieldId: 48,
  });
  const t = getPlayer(s),
    before = {
      budget: t.budget,
      drivers: structuredClone(t.drivers),
      km: t.totalKm,
    };
  dispatch(s, {
    type: "rename-identity",
    name: "  Ruta Austral  ",
    director: "  Director.X  ",
  });
  dispatch(s, { type: "choose-shield", shieldId: 17 });
  const restored = validateSave(JSON.parse(encodeSave(s))),
    p = getPlayer(restored);
  assert.equal(p.name, "Ruta Austral");
  assert.equal(p.directorName, "Director.X");
  assert.equal(p.shieldId, 17);
  assert.equal(p.shieldCollection, "apex48");
  assert.equal(p.budget, before.budget);
  assert.equal(p.totalKm, before.km);
  assert.deepEqual(p.drivers, before.drivers);
  p.participating = true;
  const entry = publicSnapshot(restored).entries.find(
    (e) => e.entryId === "player",
  );
  assert.equal(entry.directorName, "Director.X");
  assert.equal(entry.shieldId, 17);
  assert.ok(identityPanel(restored).includes("@Director.X"));
});

test("partidas anteriores reciben director y migran escudos 49–100 sin alterar dinero ni plantel", () => {
  const s = createRace(),
    t = getPlayer(s);
  delete t.shieldCollection;
  delete t.directorName;
  t.shieldId = 100;
  const before = {
    budget: t.budget,
    drivers: structuredClone(t.drivers),
    parts: structuredClone(t.parts),
  };
  const restored = validateSave(s),
    p = getPlayer(restored);
  assert.equal(t.shieldId, 100, "El objeto original se conserva");
  assert.equal(p.shieldId, 4);
  assert.equal(p.legacyShieldId, 100);
  assert.equal(p.directorName, "Director");
  assert.equal(p.budget, before.budget);
  assert.deepEqual(p.drivers, before.drivers);
  assert.deepEqual(p.parts, before.parts);
  migrateIdentity(p);
  assert.equal(p.shieldId, 4);
});

test("rechaza escudos y usuarios inválidos, sin cambiar parcialmente la identidad", () => {
  const s = createRace({ name: "Original", director: "Usuario_1" }),
    t = getPlayer(s);
  for (const id of [0, 49, 100, 1.1, "2", NaN])
    assert.throws(() => dispatch(s, { type: "choose-shield", shieldId: id }));
  for (const director of [
    "ab",
    "con espacios",
    "<script>",
    "@usuario",
    "a".repeat(25),
    null,
  ]) {
    assert.throws(() =>
      dispatch(s, { type: "rename-identity", name: "Nuevo", director }),
    );
    assert.equal(t.name, "Original");
    assert.equal(t.directorName, "Usuario_1");
  }
  for (const name of ["", "a".repeat(41), "hola\nmundo"])
    assert.throws(() =>
      dispatch(s, { type: "rename-identity", name, director: "Valido" }),
    );
  const bad = structuredClone(s);
  getPlayer(bad).shieldId = 49;
  assert.throws(() => validateSave(bad));
  const badUser = structuredClone(s);
  getPlayer(badUser).directorName = "<img>";
  assert.throws(() => validateSave(badUser));
  assert.throws(() => createRace({ director: "no vale" }));
});

test("acepta usuarios con acentos y muestra nombres escapados en la ficha", () => {
  const s = createRace({ name: "Equipo <Aurora>", director: "José_Raid" });
  assert.equal(getPlayer(s).directorName, "José_Raid");
  const html = identityPanel(s);
  assert.ok(html.includes("Equipo &lt;Aurora&gt;"));
  assert.ok(!html.includes("Equipo <Aurora>"));
});
