import test from "node:test";
import assert from "node:assert/strict";
import {
  createWorld,
  addDirector,
  command,
  events,
  advanceWorld,
  privateWorld,
  publicWorld,
} from "../server/world.js";
import {
  participant,
  reservations,
  refreshAssignments,
  allocation,
} from "../server/resources.js";
import { viewWorld } from "../server/view.js";
import { forecastNext, projectTime } from "../server/schedule.js";
import { optimalTunings } from "../server/race-tuning.js";
import {
  TUNINGS,
  defaultTunings,
  tuningEffects,
  validateTunings,
  PREPARATION_MS,
  preparationWindow,
} from "../../src/race-tuning.js";
import { terrainPartFactors } from "../../src/race-dynamics.js";
import { performance } from "../../src/engine.js";
import { stopStatus } from "../../src/service-telemetry.js";
const NOW = Date.parse("2026-10-06T12:00:00Z");
function fixture(lead = 6 * 3600000, short = false) {
  const w = createWorld(NOW, new Date(NOW + lead).toISOString());
  const t = addDirector(w, "tuning", "director_tuning", "Puesta a punto", 1);
  const e = events(w).find((e) =>
    short ? e.kind === "short" : e.id === "andes",
  );
  const c = { type: "enroll", eventId: e.eventId, tunings: defaultTunings() };
  return { w, t, e, c };
}
test("seis reglajes: validación estricta sin aceptar claves falsas, fracciones o valores fuera de rango", () => {
  assert.equal(TUNINGS.length, 6);
  for (const v of [
    null,
    [],
    {},
    { ...defaultTunings(), engine: -1 },
    { ...defaultTunings(), tyres: 101 },
    { ...defaultTunings(), brakes: 1.5 },
    { ...defaultTunings(), engine: "50" },
    { ...defaultTunings(), extra: 20 },
  ])
    assert.throws(() => validateTunings(v));
  assert.deepEqual(validateTunings(), defaultTunings());
});
test("óptimo +30%, peor extremo −30%: combinación ponderada no acumula seis multiplicadores", () => {
  const optimal = {
    engine: 12,
    transmission: 84,
    suspension: 45,
    tyres: 60,
    cooling: 8,
    brakes: 93,
  };
  const worst = Object.fromEntries(
    TUNINGS.map((t) => [t.id, optimal[t.id] < 50 ? 100 : 0]),
  );
  for (const terrain of ["asphalt", "gravel", "mountain", "sand", "rock"])
    for (const [values, expected] of [
      [optimal, 1.3],
      [worst, 0.7],
    ])
      assert.ok(
        Math.abs(
          terrainPartFactors(tuningEffects(values, optimal), terrain).speed -
            expected,
        ) < 1e-12,
      );
  for (const t of TUNINGS) {
    const changed = { ...optimal, [t.id]: worst[t.id] };
    assert.ok(
      terrainPartFactors(tuningEffects(changed, optimal), "gravel").speed < 1.3,
    );
  }
});
test("perfil oculto reproducible, específico de la carrera y con valores finitos", () => {
  const { w, e } = fixture(),
    a = optimalTunings(w, e);
  assert.deepEqual(optimalTunings(w, e), a);
  assert.notDeepEqual(
    optimalTunings(w, { ...e, eventId: e.eventId + "next" }),
    a,
  );
  assert.ok(
    Object.values(a).every((v) => Number.isInteger(v) && v >= 5 && v <= 95),
  );
});
test("inscripción temprana: preparación en las cinco horas anteriores, reserva ampliada y bloqueo al comenzar", () => {
  const { w, t, e, c } = fixture();
  command(w, t.id, c);
  const entry = w.races[e.eventId].entries[t.id];
  assert.equal(entry.preparationStart, e.start - PREPARATION_MS);
  assert.equal(entry.readyAt, e.start);
  assert.equal(reservations(w, t.id)[0].start, entry.preparationStart);
  command(w, t.id, {
    ...c,
    type: "configure-enrollment",
    tunings: { ...c.tunings, engine: 80 },
  });
  assert.equal(entry.readyAt, w.races[e.eventId].entries[t.id].readyAt);
  projectTime(w, entry.preparationStart);
  assert.throws(
    () => command(w, t.id, { ...c, type: "configure-enrollment" }),
    /ya comenzó/,
  );
  assert.equal(viewWorld(w, t.id, e.eventId).teams[0].phase, "preparing");
});
test("inscripción tardía antes de largar: salida personalizada tras cinco horas; cierre y horario comunes intactos", () => {
  const { w, t, e, c } = fixture(3600000);
  command(w, t.id, c);
  projectTime(w, e.start + 60000);
  const r = w.races[e.eventId],
    p = participant(w, r, t.id);
  assert.equal(p.phase, "preparing");
  assert.equal(p.totalKm, 0);
  assert.equal(p.speed, 0);
  assert.equal(r.event.start, e.start);
  assert.equal(r.event.end, e.end);
  const status = stopStatus({ clock: (w.at - e.start) / 1000 }, p);
  assert.equal(status.tasks.length, 1);
  assert.ok(status.remaining > 0);
  projectTime(w, NOW + PREPARATION_MS + 60000);
  assert.ok(participant(w, r, t.id).totalKm > 0);
  assert.notEqual(participant(w, r, t.id).phase, "preparing");
  assert.equal(r.entries[t.id].readyAt, NOW + PREPARATION_MS);
});
test("no se permite inscripción después de la largada oficial", () => {
  const { w, t, e, c } = fixture(60000);
  projectTime(w, e.start);
  assert.throws(() => command(w, t.id, c), /cerrada/);
});
test("sprint rechaza preparar si no queda tiempo de carrera; con margen conserva una sola preparación", () => {
  const { w, t, e, c } = fixture(60000, true);
  w.at = e.start - 3600000;
  assert.throws(() => command(w, t.id, c), /cinco horas/);
  w.at = e.start - 2 * 3600000;
  command(w, t.id, c);
  const entry = w.races[e.eventId].entries[t.id];
  assert.equal(entry.readyAt, e.start + 3 * 3600000);
  assert.equal(entry.readyAt - entry.preparationStart, PREPARATION_MS);
});
test("preparación reserva también mecánico, detiene trabajo en base y cancelar libera antes de la largada", () => {
  const { w, t, e, c } = fixture();
  t.mechanics[0].assignment = "workshop";
  c.mechanicIds = [t.mechanics[0].id];
  command(w, t.id, c);
  assert.equal(t.mechanics[0].assignment, "workshop");
  projectTime(w, e.start - PREPARATION_MS);
  assert.equal(t.mechanics[0].assignment, "race");
  assert.throws(
    () =>
      command(w, t.id, {
        type: "assign-mechanic",
        id: t.mechanics[0].id,
        place: "workshop",
      }),
    /reservado/,
  );
  command(w, t.id, { type: "cancel-enrollment", eventId: e.eventId });
  assert.equal(t.mechanics[0].assignment, "workshop");
});
test("forecast despierta al inicio de preparación, no a cada segundo del contador", () => {
  const { w, t, e, c } = fixture();
  command(w, t.id, c);
  const next = forecastNext(w);
  assert.equal(next.at, e.start - PREPARATION_MS);
  assert.equal(next.world.engine.teams[0].mechanics[0].assignment, "race");
  const following = forecastNext(next.world);
  assert.equal(following.at, e.start);
});
test("intervalos que sólo se superponen durante preparación también bloquean recursos compartidos", () => {
  const { w, t, e, c } = fixture();
  command(w, t.id, c);
  const next = {
    event: {
      ...e,
      eventId: "other",
      start: e.end + 2 * 3600000,
      end: e.end + 8 * 3600000,
    },
  };
  assert.throws(
    () =>
      allocation(w, t, next, {
        ...c,
        preparationStart: next.event.start - PREPARATION_MS,
      }),
    /superpone/,
  );
  assert.doesNotThrow(() =>
    allocation(w, t, next, { ...c, preparationStart: e.end }),
  );
});
test("el taller progresa antes de preparar y pausa cuando su único mecánico se incorpora a la carrera", () => {
  const { w, t, e, c } = fixture();
  const m = t.mechanics[0];
  m.assignment = "workshop";
  c.mechanicIds = [m.id];
  const p = t.inventory[0];
  p.condition = 10;
  command(w, t.id, { type: "enqueue-work", kind: "part", id: p.id });
  command(w, t.id, c);
  projectTime(w, e.start - PREPARATION_MS);
  const worked = t.workshop.jobs[0].worked;
  assert.ok(worked > 0);
  projectTime(w, w.at + 2 * 3600000);
  assert.equal(t.workshop.jobs[0].worked, worked);
});
test("nunca se publican óptimos ni multiplicadores en vistas públicas o privadas", () => {
  const { w, t, e, c } = fixture(60000);
  command(w, t.id, c);
  projectTime(w, e.start + 60000);
  assert.ok(w.races[e.eventId].optimalTunings);
  for (const obj of [
    privateWorld(w, t.id),
    publicWorld(w),
    viewWorld(w, t.id, e.eventId),
  ]) {
    const json = JSON.stringify(obj);
    assert.ok(!json.includes("optimalTunings"));
    assert.ok(!json.includes("raceTuningEffects"));
    assert.ok(!json.includes('"seed"'));
  }
});
test("reglajes afectan velocidad real, conservando límite por sector y avería de 30 km/h", () => {
  const { w, t, e, c } = fixture();
  command(w, t.id, c);
  projectTime(w, e.start);
  projectTime(w, e.start + 120000);
  const p = participant(w, w.races[e.eventId], t.id);
  delete p.raceTuningEffects;
  const base = performance(p).speed;
  p.raceTuningEffects = Object.fromEntries(TUNINGS.map((t) => [t.id, 0.7]));
  assert.ok(performance(p).speed < base);
  p.raceTuningEffects = Object.fromEntries(TUNINGS.map((t) => [t.id, 1.3]));
  assert.ok(performance(p).speed >= base);
  p.parts.engine.broken = true;
  assert.equal(performance(p).speed, 30);
});
test("partidas ya en curso mantienen su avance y no agregan preparación retroactiva", () => {
  const { w, t, e, c } = fixture();
  command(w, t.id, c);
  const entry = w.races[e.eventId].entries[t.id];
  delete entry.tunings;
  delete entry.preparationStart;
  delete entry.readyAt;
  projectTime(w, e.start);
  projectTime(w, e.start + 120000);
  const r = w.races[e.eventId],
    before = participant(w, r, t.id).totalKm;
  assert.equal(r.entries[t.id].runtime.raceTuningEffects, undefined);
  advanceWorld(w, w.at + 60000);
  refreshAssignments(w);
  assert.ok(participant(w, r, t.id).totalKm > before);
  assert.notEqual(participant(w, r, t.id).phase, "preparing");
});
