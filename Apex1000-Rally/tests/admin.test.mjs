import test from "node:test";
import assert from "node:assert/strict";
import { createRace } from "./fixture.mjs";
import { injectMoney } from "../src/admin-commands.js";
import { adminBar } from "../src/admin-ui.js";
import { encodeSave, validateSave } from "../src/storage.js";

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
