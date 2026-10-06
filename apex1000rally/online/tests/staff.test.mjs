import test from "node:test";
import assert from "node:assert/strict";
import { createWorld, addDirector, privateWorld } from "../server/world.js";
import { normalizeStaffNames } from "../server/staff.js";
const at = Date.parse("2026-10-06T12:00:00Z");
function fixture() {
  const w = createWorld(at, new Date(at + 60000).toISOString());
  const t = addDirector(w, "staff-test", "director_test", "Prueba", 1);
  return { w, t };
}
test("el personal inicial tiene nombres completos y estables", () => {
  const { w, t } = fixture();
  const names = [...t.drivers, ...t.mechanics].map((p) => p.name);
  assert.ok(
    names.every((n) => n.split(" ").length === 2 && !/academia/i.test(n)),
  );
  assert.equal(new Set(names).size, 4);
  const again = fixture();
  assert.deepEqual(
    names,
    [...again.t.drivers, ...again.t.mechanics].map((p) => p.name),
  );
  assert.ok(
    [
      ...w.engine.management.catalog.drivers,
      ...w.engine.management.catalog.mechanics,
    ].every((p) => p.name.trim().split(/\s+/).length >= 2),
  );
});
test("las partidas anteriores cambian sólo el nombre del personal básico", () => {
  const { w, t } = fixture();
  t.drivers.forEach(
    (p, i) => (p.name = `${["Alex", "Dani", "Sol"][i]} · Academia`),
  );
  t.mechanics[0].name = "Asistencia de academia";
  const before = structuredClone([...t.drivers, ...t.mechanics]);
  privateWorld(w, t.id);
  const staff = [...t.drivers, ...t.mechanics];
  for (let i = 0; i < staff.length; i++) {
    assert.notEqual(staff[i].name, before[i].name);
    assert.deepEqual({ ...staff[i], name: before[i].name }, before[i]);
  }
  const migrated = structuredClone(w);
  normalizeStaffNames(w);
  assert.deepEqual(w, migrated);
  t.drivers[0].name = "Nombre Personalizado";
  normalizeStaffNames(w);
  assert.equal(t.drivers[0].name, "Nombre Personalizado");
});
