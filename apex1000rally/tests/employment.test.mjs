import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentRace as createRace } from "./fixture.mjs";
import {
  getPlayer,
  advance,
  performance,
  updateRaceClosure,
  dispatch,
} from "../src/engine.js";
import {
  advanceEmployment,
  gameNow,
  addMonths,
  nextPayroll,
  monthStart,
  renewalQuote,
  renewContract,
} from "../src/employment.js";
import { partProtected, staffFactors, staffCondition } from "../src/staff.js";
import { crewRate, assignMechanic } from "../src/workshop.js";
import { currentEvent, enroll } from "../src/competition.js";
import { bid, settleAuctions } from "../src/management.js";
import { validateSave } from "../src/storage.js";
import { vehicleHealth } from "../src/reliability.js";
import { routeFor } from "../src/route.js";
import { defaultPlan } from "../src/catalog.js";
import { financePage, staffPanel } from "../src/economy-ui.js";
import { PART_SPECIALTIES } from "../src/staff.js";
const start = Date.parse("2026-10-31T23:00:00-03:00");
const fresh = () =>
  createRace({ startAt: new Date(start + 3600000).toISOString(), now: start });
const at = (s, time) => {
  s.clock = (time - Date.parse(s.startAt)) / 1000;
  advanceEmployment(s);
};
const setLevel = (t, n) => {
  t.progression.xp = n === 1 ? 0 : 100 * (n - 1) ** 2.4 + 0.001;
};

test("el cobro mensual ocurre exactamente el día 1 ART, una sola vez y sin inscripción", () => {
  const s = fresh(),
    t = getPlayer(s),
    budget = t.budget,
    pay = s.employment.nextPayrollAt;
  advance(s, 3570);
  assert.equal(t.finance.bills.length, 0);
  advance(s, 30);
  assert.equal(gameNow(s), pay);
  assert.equal(t.finance.bills.length, 1);
  assert.equal(t.totalKm, 0);
  const bill = t.finance.bills[0],
    salary = [...t.drivers, ...t.mechanics].reduce((n, p) => n + p.salary, 0);
  assert.equal(bill.due.base, 1500);
  assert.equal(
    Math.round((bill.due.drivers + bill.due.mechanics) * 100),
    Math.round((salary / 31 / 24) * 100),
  );
  assert.equal(
    t.budget,
    Math.round(
      (budget - Object.values(bill.due).reduce((a, b) => a + b, 0)) * 100,
    ) / 100,
  );
  advanceEmployment(s);
  assert.equal(t.finance.bills.length, 1);
  validateSave(s);
});
test("meses de 28, 29, 30 y 31 días; saltos grandes y bloques cobran lo mismo", () => {
  assert.equal(
    nextPayroll(Date.parse("2028-02-29T23:59:59-03:00")),
    Date.parse("2028-03-01T00:00:00-03:00"),
  );
  assert.equal(
    addMonths(Date.parse("2028-02-29T13:00:00-03:00"), 12),
    Date.parse("2029-02-28T13:00:00-03:00"),
  );
  const a = fresh(),
    b = structuredClone(a),
    end = Date.parse("2027-02-01T00:00:00-03:00");
  at(a, end);
  for (let time = start + 86400000; time < end; time += 86400000) at(b, time);
  at(b, end);
  assert.deepEqual(getPlayer(a).finance.bills, getPlayer(b).finance.bills);
  assert.equal(getPlayer(a).budget, getPlayer(b).budget);
  assert.equal(getPlayer(a).finance.bills.length, 4);
  assert.equal(monthStart(end), end);
});
test("la largada no descuenta sueldos y la reserva ganadora se devuelve al firmar", () => {
  const s = createRace({
      startAt: "2026-10-05T12:00:00Z",
      now: Date.parse("2026-10-05T11:00:00Z"),
    }),
    t = getPlayer(s),
    budget = t.budget;
  enroll(s, currentEvent(s).eventId);
  advance(s, 3600);
  assert.equal(t.budget, budget);
  const a = bid(s, "mechanic", "nora", 12000);
  advance(s, 6 * 3600);
  assert.equal(a.winnerId, "player");
  assert.equal(t.budget, budget);
  const p = t.mechanics.find((m) => m.id === "nora");
  assert.equal(p.salary, 12000);
  assert.equal(p.contract.expiresAt, addMonths(p.contract.signedAt, 12));
  validateSave(s);
});
test("renovación depende del cambio de nivel desde el último acuerdo y agrega 12 meses", () => {
  const s = fresh(),
    t = getPlayer(s),
    p = t.drivers[0];
  p.contract.levelAtSigning = 4;
  p.salary = 10000;
  for (const [level, pct] of [
    [7, 0.2],
    [6, 0.2],
    [5, 0.1],
    [4, 0.03],
    [3, -0.2],
    [2, -0.2],
    [1, -0.2],
  ]) {
    setLevel(t, level);
    assert.equal(renewalQuote(t, p).change, pct);
  }
  setLevel(t, 5);
  const end = p.contract.expiresAt;
  renewContract(s, "driver", p.id);
  assert.equal(p.contract.expiresAt, addMonths(end, 12));
  assert.equal(p.salary, 10000);
  assert.equal(p.contract.pendingSalary, 11000);
  assert.equal(p.contract.levelAtSigning, 5);
  at(s, s.employment.nextPayrollAt);
  assert.equal(p.salary, 11000);
  assert.equal(p.contract.pendingSalary, null);
  validateSave(s);
});
test("vencimientos devuelven personas al mercado, cancela reservas futuras y permite plantel vacío", () => {
  const s = fresh(),
    t = getPlayer(s),
    end = gameNow(s) + 3600000;
  for (const p of [...t.drivers, ...t.mechanics]) p.contract.expiresAt = end;
  at(s, end);
  assert.equal(t.drivers.length, 0);
  assert.equal(t.mechanics.length, 0);
  assert.equal(t.activeDriver, null);
  assert.equal(t.phase, "unregistered");
  assert.equal(s.management.owners.lucia, undefined);
  validateSave(s);
  assert.match(staffPanel(s, "driver"), /No tenés/);
  const auction = bid(s, "driver", "lucia", 10000);
  at(s, gameNow(s) + 7 * 3600000);
  settleAuctions(s);
  assert.equal(auction.winnerId, "player");
  assert.equal(t.drivers.length, 1);
  assert.equal(t.activeDriver, t.drivers[0].id);
  validateSave(s);
});
test("contrato vencido se conserva durante carrera y libera al cerrarla sin perder la clasificación", () => {
  const s = fresh(),
    t = getPlayer(s);
  enroll(s, currentEvent(s).eventId);
  advance(s, 3600);
  const d = t.drivers[0];
  d.contract.expiresAt = gameNow(s) + 30000;
  advance(s, 30);
  assert.equal(s.management.owners.lucia, "player");
  s.clock = 4 * 3600;
  s.competition.firstFinishAt = 0; // Force maximum is tested independently below.
  s.competition.firstFinishAt = null;
  s.clock = currentEvent(s).maxHours * 3600;
  updateRaceClosure(s);
  assert.equal(s.competition.closed, true);
  assert.equal(s.management.owners.lucia, undefined);
  assert.ok(s.competition.results[0].entries.some((e) => e.id === "player"));
  advanceEmployment(s);
  validateSave(s);
});
test("deuda por saldo insuficiente queda registrada y afecta moral; no duplica cobros", () => {
  const s = fresh(),
    t = getPlayer(s);
  t.budget = 0;
  const morale = t.drivers[0].morale;
  at(s, s.employment.nextPayrollAt);
  assert.ok(t.debt > 1500);
  assert.equal(t.drivers[0].morale, morale - 8);
  const debt = t.debt;
  advanceEmployment(s);
  assert.equal(t.debt, debt);
  assert.equal(t.budget, 0);
});
test("especialistas de superficie sólo bonifican su terreno y expertos de modelo sólo su auto", () => {
  const s = fresh(),
    t = getPlayer(s),
    d = t.drivers[0];
  t.mechanics[0].traits = "";
  d.traits = "terrain:gravel";
  const gravel = staffFactors(t, d, "gravel"),
    asphalt = staffFactors(t, d, "asphalt");
  assert.ok(gravel.speed > asphalt.speed);
  assert.ok(gravel.risk < asphalt.risk);
  d.traits = "car:hilux";
  assert.ok(staffFactors(t, d, "gravel").speed > staffCondition(d));
  t.vehicleId = "niva";
  assert.equal(staffFactors(t, d, "gravel").speed, staffCondition(d));
});
test("expertos por pieza protegen sólo en carrera o conduciendo; refrigeración baja calor", () => {
  const s = fresh(),
    t = getPlayer(s),
    d = t.drivers[0],
    m = t.mechanics[0];
  d.traits = "";
  m.traits = "part:engine";
  assert.equal(partProtected(t, "engine"), true);
  assert.equal(partProtected(t, "tyres"), false);
  assert.equal(
    vehicleHealth(t).parts.find((p) => p.id === "engine").probability,
    0,
  );
  assignMechanic(s, m.id, "workshop");
  assert.equal(partProtected(t, "engine"), false);
  d.traits = "part:engine";
  assert.equal(partProtected(t, "engine"), true);
  t.activeDriver = t.drivers[1].id;
  assert.equal(partProtected(t, "engine"), false);
  t.activeDriver = d.id;
  const stage = routeFor(t).stages[0],
    plan = { ...defaultPlan(), driverId: d.id };
  d.traits = "";
  const plain = performance(t, stage, plan);
  d.traits = "part:cooling";
  assert.equal(performance(t, stage, plan).heatTarget, plain.heatTarget - 8);
  t.parts.cooling.broken = true;
  assert.equal(performance(t, stage, plan).speed, 30); // Expertise never heals an existing failure.
});
test("forma y moral afectan trabajo y ritmo; edad aumenta al cumplir años", () => {
  const s = fresh(),
    t = getPlayer(s),
    m = t.mechanics[0];
  const good = crewRate(t, "race");
  m.form = 0;
  m.morale = 0;
  assert.ok(crewRate(t, "race") < good);
  const p = t.drivers[0],
    age = p.age;
  p.birthAt = addMonths(gameNow(s) + 30000, -12 * (age + 1));
  at(s, gameNow(s) + 30000);
  assert.equal(p.age, age + 1);
  assert.match(financePage(s), /Finanzas/);
  assert.match(staffPanel(s, "driver"), /MORAL/);
});
test("migración no cobra el pasado; guarda atributos, contratos y nómina y rechaza corrupción", () => {
  const original = fresh();
  delete original.employment;
  for (const t of original.teams) {
    delete t.finance;
    for (const p of [...t.drivers, ...t.mechanics]) {
      delete p.contract;
      delete p.birthAt;
      delete p.age;
      delete p.form;
      delete p.morale;
      delete p.traits;
    }
  }
  const before = getPlayer(original).budget,
    loaded = validateSave(original);
  assert.equal(getPlayer(loaded).budget, before);
  assert.equal(getPlayer(loaded).finance.bills.length, 0);
  assert.deepEqual(validateSave(loaded).employment, loaded.employment);
  for (const edit of [
    (s) => (getPlayer(s).drivers[0].form = 101),
    (s) => (getPlayer(s).drivers[0].traits = "part:unknown"),
    (s) => (s.employment.nextPayrollAt += 1000),
    (s) => (getPlayer(s).drivers[0].contract.levelAtSigning = 0),
  ]) {
    const bad = structuredClone(loaded);
    edit(bad);
    assert.throws(() => validateSave(bad));
  }
});

test("inmunidad de las seis piezas se aplica en la simulación; sigue el desgaste", () => {
  for (const type of PART_SPECIALTIES) {
    const s = fresh(),
      t = getPlayer(s);
    at(s, start + 3600000);
    s.clock = 0;
    s.competition.started = true;
    t.participating = true;
    t.phase = "racing";
    t.stageStart = 0;
    t.activePlan = { ...defaultPlan(), driverId: t.activeDriver };
    t.fuel = 500;
    t.heat = 180;
    t.rng = 1;
    t.mechanics[0].traits = "";
    for (const d of t.drivers) d.traits = "";
    for (const [id, piece] of Object.entries(t.parts)) {
      piece.grade = id === type ? "racing" : "reserve";
      piece.condition = id === type ? 1 : 100;
    }
    const plain = structuredClone(s);
    t.drivers[0].traits = "part:" + type;
    advance(s, 30);
    advance(plain, 30);
    assert.equal(t.parts[type].broken, false, type);
    assert.ok(t.parts[type].condition < 1, type);
    assert.equal(getPlayer(plain).parts[type].broken, true, type);
  }
});
test("Admin llega al día 1 exacto después de cierres fraccionarios y meses de 31 días", () => {
  const s = createRace({
      startAt: "2026-10-05T12:00:00Z",
      now: Date.parse("2026-10-05T11:00:00Z"),
    }),
    t = getPlayer(s);
  let target = s.employment.nextPayrollAt;
  dispatch(s, { type: "next-payroll" });
  assert.equal(gameNow(s), target);
  assert.equal(t.finance.bills.length, 1);
  validateSave(s);
  target = s.employment.nextPayrollAt;
  dispatch(s, { type: "next-payroll" });
  assert.equal(gameNow(s), target);
  assert.equal(t.finance.bills.length, 2);
  validateSave(s);
});
