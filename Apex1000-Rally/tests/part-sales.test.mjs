import test from "node:test";
import assert from "node:assert/strict";
import { createRace } from "./fixture.mjs";
import { getPlayer, buyPart, dispatch, savePlan } from "../src/engine.js";
import {
  partSaleValue,
  partSaleQuote,
  sellPart,
  enqueueJob,
} from "../src/workshop.js";
import { validateSave } from "../src/storage.js";
import { defaultPlan } from "../src/catalog.js";
const fresh = () =>
  createRace({
    startAt: "2026-10-20T12:00:00Z",
    now: Date.parse("2026-10-10T12:00:00Z"),
  });
const unchanged = (s, action, reason) => {
  const before = JSON.stringify(s);
  assert.throws(action, reason);
  assert.equal(JSON.stringify(s), before);
};

test("tasación baja usa el precio nuevo del catálogo y cae por estado, original y avería", () => {
  const s = fresh(),
    piece = buyPart(s, "engine", "endurance", 100);
  s.management.catalog.parts.find(
    (p) =>
      p.type === "engine" && p.grade === "endurance" && p.condition === 100,
  ).price = 20000;
  assert.equal(partSaleValue(s, piece), 1000);
  piece.condition = 50;
  assert.equal(partSaleValue(s, piece), 500);
  piece.original = 40;
  assert.equal(partSaleValue(s, piece), 200);
  piece.broken = true;
  assert.equal(partSaleValue(s, piece), 30);
  piece.condition = 0;
  assert.equal(partSaleValue(s, piece), 0);
});
test("venta del lote acredita una sola vez, registra Finanzas y no repone stock nuevo", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = buyPart(s, "engine", "endurance", 50);
  const value = partSaleQuote(s, piece.id).value,
    budget = t.budget,
    stocks = JSON.stringify(s.management.stocks),
    count = t.ledger.length;
  assert.equal(dispatch(s, { type: "sell-part", id: piece.id }), value);
  assert.equal(t.budget, budget + value);
  assert.equal(
    t.inventory.some((p) => p.id === piece.id),
    false,
  );
  assert.equal(t.ledger.length, count + 1);
  assert.match(t.ledger.at(-1).label, /Venta de pieza/);
  assert.equal(t.ledger.at(-1).amount, value);
  assert.equal(JSON.stringify(s.management.stocks), stocks);
  unchanged(s, () => sellPart(s, piece.id), /ya vendida/);
  validateSave(JSON.parse(JSON.stringify(s)));
});
test("una pieza sin valor también puede retirarse sin crear dinero", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = buyPart(s, "tyres", "standard", 50);
  piece.condition = 0;
  piece.broken = true;
  const budget = t.budget;
  assert.equal(sellPart(s, piece.id), 0);
  assert.equal(t.budget, budget);
  validateSave(s);
});
test("reservas gratuitas, piezas en reparación y piezas reservadas no se venden", () => {
  const s = fresh(),
    t = getPlayer(s),
    reserve = t.inventory.find((p) => p.grade === "reserve"),
    piece = buyPart(s, "engine", "standard", 50);
  unchanged(s, () => sellPart(s, reserve.id), /protegida/);
  const plan = defaultPlan();
  plan.actions.engine = "replace";
  plan.replacements.engine = piece.id;
  savePlan(s, 0, plan);
  unchanged(s, () => sellPart(s, piece.id), /plan/);
  t.plans[0] = null;
  enqueueJob(s, "part", piece.id);
  unchanged(s, () => sellPart(s, piece.id), /reparación/);
});
test("vender una instalada en la base monta la reserva libre sin duplicarla y conserva el guardado", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = t.parts.engine,
    reserve = t.inventory.find(
      (p) => p.type === "engine" && p.grade === "reserve",
    );
  const count = t.inventory.length,
    value = partSaleValue(s, piece),
    budget = t.budget;
  assert.equal(partSaleQuote(s, piece.id).replacement.id, reserve.id);
  sellPart(s, piece.id);
  assert.equal(t.parts.engine.id, reserve.id);
  assert.equal(t.inventory.length, count - 1);
  assert.equal(
    t.inventory.some((p) => [piece.id, reserve.id].includes(p.id)),
    false,
  );
  assert.equal(t.budget, budget + value);
  unchanged(s, () => sellPart(s, reserve.id), /protegida/);
  validateSave(JSON.parse(JSON.stringify(s)));
});
test("una instalada no se vende en carrera ni cuando su reserva está ausente, ocupada o comprometida", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = t.parts.engine,
    reserve = t.inventory.find(
      (p) => p.type === "engine" && p.grade === "reserve",
    );
  for (const phase of ["racing", "service", "camp"]) {
    t.phase = phase;
    unchanged(s, () => sellPart(s, piece.id), /carrera/);
  }
  t.phase = "unregistered";
  t.inventory = t.inventory.filter((p) => p.id !== reserve.id);
  unchanged(s, () => sellPart(s, piece.id), /reserva estándar libre/);
  t.inventory.push(reserve);
  reserve.condition = 50;
  enqueueJob(s, "part", reserve.id);
  unchanged(s, () => sellPart(s, piece.id), /reserva estándar libre/);
  t.workshop.jobs = [];
  const plan = defaultPlan();
  plan.actions.engine = "replace";
  plan.replacements.engine = reserve.id;
  t.plans[0] = plan;
  unchanged(s, () => sellPart(s, piece.id), /reserva estándar libre/);
});
test("confirmación revalida una pieza que pasa a estar comprometida en el plan activo", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = buyPart(s, "engine", "standard", 50);
  assert.equal(partSaleQuote(s, piece.id).allowed, true);
  t.activePlan = defaultPlan();
  t.activePlan.actions.engine = "replace";
  t.activePlan.replacements.engine = piece.id;
  unchanged(s, () => dispatch(s, { type: "sell-part", id: piece.id }), /plan/);
});
test("venta que excede el límite financiero se rechaza antes de cambiar la propiedad", () => {
  const s = fresh(),
    t = getPlayer(s),
    piece = buyPart(s, "engine", "standard", 100);
  t.budget = 100000000;
  unchanged(s, () => sellPart(s, piece.id), /saldo máximo/);
});
