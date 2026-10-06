import test from "node:test";
import assert from "node:assert/strict";
import { createRace } from "./fixture.mjs";
import { injectMoney, resetPrototypeSave } from "../src/admin-commands.js";
import { adminBar } from "../src/admin-ui.js";
import { SAVE_KEY, encodeSave, validateSave } from "../src/storage.js";

function memoryStorage(entries) {
  const data = new Map(entries);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
}

test("reset total deja vacía la partida activa y respalda todos sus datos sin tocar otros guardados", () => {
  const state = createRace(),
    original = structuredClone(state);
  injectMoney(state, 500000);
  const storage = memoryStorage([
    [SAVE_KEY, encodeSave(state)],
    ["otro-juego", "intacto"],
    [SAVE_KEY + "-archive-old", "anterior"],
  ]);
  const key = resetPrototypeSave(storage, state, { now: 123 });
  assert.equal(storage.getItem(SAVE_KEY), "");
  assert.equal(storage.getItem("otro-juego"), "intacto");
  assert.equal(storage.getItem(SAVE_KEY + "-archive-old"), "anterior");
  const restored = validateSave(JSON.parse(storage.getItem(key)));
  assert.equal(restored.teams[0].budget, state.teams[0].budget);
  assert.deepEqual(restored.teams[0].parts, state.teams[0].parts);
  assert.deepEqual(restored.teams[0].drivers, state.teams[0].drivers);
  assert.equal(original.teams[0].budget + 500000, state.teams[0].budget);
  const second = resetPrototypeSave(storage, state, { now: 123 });
  assert.notEqual(second, key);
  assert.equal(storage.getItem(second), storage.getItem(key));
});

test("reset rechazado fuera de Admin o en online conserva partida y respaldos", () => {
  const state = createRace(),
    storage = memoryStorage([[SAVE_KEY, encodeSave(state)]]);
  const before = [...storage.data];
  assert.throws(() => resetPrototypeSave(storage, state, { enabled: false }));
  state.mode = "online";
  assert.throws(() => resetPrototypeSave(storage, state));
  assert.deepEqual([...storage.data], before);
});

test("si falla el guardado del respaldo, el reset conserva el progreso activo", () => {
  const state = createRace(),
    active = encodeSave(state);
  const storage = {
    getItem: (key) => (key === SAVE_KEY ? active : null),
    setItem: () => {
      throw Error("Sin espacio");
    },
  };
  assert.throws(() => resetPrototypeSave(storage, state));
  assert.equal(storage.getItem(SAVE_KEY), active);
  assert.deepEqual(JSON.parse(active), state);
  assert.match(
    adminBar(state, { busy: true }),
    /data-action="admin-reset" disabled/,
  );
});

test("Admin acredita sólo al jugador, registra el ingreso y permite guardar y recargar", () => {
  const state = createRace(),
    player = state.teams[0];
  const budget = player.budget,
    initial = player.initialBudget;
  const rivals = state.teams.slice(1).map((t) => t.budget);
  injectMoney(state, 234567);
  assert.equal(player.budget, budget + 234567);
  assert.equal(player.initialBudget, initial);
  assert.deepEqual(
    state.teams.slice(1).map((t) => t.budget),
    rivals,
  );
  assert.equal(player.ledger.at(-1).amount, 234567);
  assert.match(player.ledger.at(-1).label, /Admin/);
  const restored = validateSave(JSON.parse(encodeSave(state)));
  assert.equal(restored.teams[0].budget, player.budget);
  assert.equal(
    player.budget,
    Math.round(
      (initial + player.ledger.reduce((n, l) => n + l.amount, 0)) * 100,
    ) / 100,
  );
});
test("Admin rechaza importes inválidos, límites y modalidad online sin modificar el saldo", () => {
  const state = createRace(),
    before = structuredClone(state);
  for (const amount of [0, -1, 1.5, NaN, Infinity, "100", 10000001])
    assert.throws(() => injectMoney(state, amount));
  assert.throws(() => injectMoney(state, 100, { enabled: false }));
  assert.deepEqual(state, before);
  state.mode = "online";
  assert.equal(adminBar(state), "");
  assert.throws(() => injectMoney(state, 100));
  state.mode = "single";
  state.teams[0].budget = 99999999;
  assert.throws(() => injectMoney(state, 2));
  state.teams[0].budget = 0;
  state.teams[0].ledger = Array.from({ length: 5000 }, () => ({
    time: 0,
    amount: 0,
    label: "Test",
  }));
  assert.throws(() => injectMoney(state, 1));
});
