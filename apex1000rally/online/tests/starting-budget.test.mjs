import test from 'node:test';
import assert from 'node:assert/strict';
import { createWorld, addDirector, publicWorld } from '../server/world.js';
import { validateCatalog } from '../../src/catalog-schema.js';
import { vehicleShop } from '../../src/workshop-ui.js';
const fresh = () => createWorld(Date.parse('2026-10-06T12:00:00Z'), '2026-10-07T03:00:00Z');

test('inicio de 30.000 cubre Niva, personal y un mes de gastos con margen operativo', () => {
  const w = fresh();
  validateCatalog(w.engine.management.catalog);
  const p = publicWorld(w);
  assert.equal(p.startingBudget, 30000);
  assert.equal(p.initialReserve, 6100);
  const t = addDirector(w, 'new', 'director_new', 'Escudería Nueva', 1);
  assert.equal(t.vehicleId, 'niva');
  assert.equal(t.budget, 14000);
  assert.equal(t.drivers.length, 3);
  assert.equal(t.mechanics.length, 1);
  assert.equal([...t.drivers, ...t.mechanics].reduce((sum, person) => sum + person.salary, 0), 4600);
  assert.equal(t.budget - p.initialReserve, 7900);
  const stock = structuredClone(w.engine.management.stocks);
  assert.throws(() => addDirector(w, 'costly', 'director_costly', 'Costosa', 1, 'hilux'), /Presupuesto insuficiente/);
  assert.deepEqual(w.engine.management.stocks, stock);
  assert.equal(w.engine.teams.length, 1);
});

test('auto inicial siempre conserva el mes de sueldos y base aunque alcance para comprar', () => {
  const w = fresh(), model = w.engine.management.catalog.vehicles.find(v => v.id === 'niva');
  model.price = 23901;
  assert.throws(() => addDirector(w, 'a', 'director_a', 'A', 1), /Presupuesto insuficiente/);
  model.price = 23900;
  assert.equal(addDirector(w, 'b', 'director_b', 'B', 1).budget, 6100);
});

test('catálogo público y mercado ordenan precios sin mutar el catálogo recibido', () => {
  const w = fresh(), t = addDirector(w, 'player', 'director_new', 'Nueva', 1);
  w.engine.management.catalog.vehicles.reverse();
  const before = w.engine.management.catalog.vehicles.map(v => v.id);
  const prices = publicWorld(w).vehicles.map(v => v.price);
  assert.deepEqual(prices, [...prices].sort((a, b) => a - b));
  const html = vehicleShop({...w.engine, teams:[t]});
  assert.ok(html.indexOf('LADA Niva Legend') < html.indexOf('MINI JCW'));
  assert.ok(html.indexOf('MINI JCW') < html.indexOf('Toyota GR'));
  assert.deepEqual(w.engine.management.catalog.vehicles.map(v => v.id), before);
});
