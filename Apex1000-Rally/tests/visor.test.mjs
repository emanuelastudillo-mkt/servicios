import test from "node:test";
import assert from "node:assert/strict";
import { CATALOG } from "../data/catalog.js";
import { routeFor, setActiveRoute, locationAt } from "../src/route.js";
import { pointAlong } from "../src/route-geometry.js";
import { camera, fitMap, focusTeam, zoom, MAX_ZOOM } from "../src/visuals.js";
import {
  failureProbability,
  failureRate,
  vehicleHealth,
} from "../src/reliability.js";
import { raceNeighbors } from "../src/race-telemetry.js";
import { createRace } from "./fixture.mjs";

test("las 120 etapas tienen curvas detalladas, longitudes crecientes y extremos exactos", () => {
  for (const race of CATALOG.races)
    for (const s of routeFor(race.id).stages) {
      assert.ok(s.path.length >= 641);
      assert.deepEqual(s.path[0], [s.from.lon, s.from.lat]);
      assert.deepEqual(s.path.at(-1), [s.to.lon, s.to.lat]);
      assert.ok(s.path.every((p) => p.every(Number.isFinite)));
      assert.ok(
        s.pathDistances.every((d, i) => i === 0 || d > s.pathDistances[i - 1]),
      );
      const dx = s.to.lon - s.from.lon,
        dy = s.to.lat - s.from.lat;
      assert.ok(
        s.path.some(
          ([x, y]) =>
            Math.abs((x - s.from.lon) * dy - (y - s.from.lat) * dx) > 0.00001,
        ),
      );
    }
});
test("los equipos se interpolan sobre el mismo trazado, sin salto en campamentos", () => {
  for (const race of CATALOG.races) {
    const r = routeFor(race.id);
    for (const s of r.stages)
      for (const f of [0, 0.125, 0.5, 0.95, 1]) {
        const expected = pointAlong(s, f),
          actual = locationAt(s.startKm + f * s.km, r.id);
        assert.ok(Math.abs(actual.lon - expected[0]) < 1e-8);
        assert.ok(Math.abs(actual.lat - expected[1]) < 1e-8);
      }
  }
});
test("zoom 2000x, ancla fija al cursor y seguimiento que conserva el aumento", () => {
  setActiveRoute("andes");
  fitMap();
  const anchor = { x: 260, y: 130 },
    ratio = { x: anchor.x / 1000, y: anchor.y / 950 };
  zoom(0.2, anchor);
  assert.ok(Math.abs((anchor.x - camera.x) / camera.w - ratio.x) < 1e-10);
  assert.ok(Math.abs((anchor.y - camera.y) / camera.h - ratio.y) < 1e-10);
  zoom(0.00001);
  assert.ok(Math.abs(1000 / camera.w - MAX_ZOOM) < 1e-10);
  assert.equal(MAX_ZOOM, 2000);
  focusTeam({ id: "player", totalKm: 345 });
  assert.ok(Math.abs(1000 / camera.w - 2000) < 1e-10);
  assert.equal(camera.follow, "player");
  zoom(1.2);
  assert.equal(camera.follow, "player");
  zoom(100000);
  assert.equal(camera.w, 1600);
  fitMap();
});
test("posición e intervalos usan vecinos de clasificación y cubren líder, último y meta", () => {
  const team = (id, km, finishTime = null) => ({
    id,
    name: id,
    totalKm: km,
    finishTime,
    history: [],
  });
  const state = { teams: [team("a", 200), team("b", 180.5), team("c", 100)] };
  assert.deepEqual(raceNeighbors(state, "b"), {
    position: 2,
    total: 3,
    ahead: { id: "a", name: "a", km: 19.5, seconds: null },
    behind: { id: "c", name: "c", km: 80.5, seconds: null },
  });
  assert.equal(raceNeighbors(state, "a").ahead, null);
  assert.equal(raceNeighbors(state, "c").behind, null);
  state.teams = [
    team("a", 1000, 30000),
    team("b", 1000, 30070),
    team("c", 990),
  ];
  assert.equal(raceNeighbors(state, "b").ahead.km, 0);
  assert.equal(raceNeighbors(state, "b").ahead.seconds, 70);
  assert.equal(raceNeighbors(state, "b").behind.km, 10);
});
test("alertas diferencian avería, riesgo alto, calor y reservas irrompibles", () => {
  const t = createRace().teams[0];
  t.heat = 100;
  assert.equal(vehicleHealth(t).level, "normal");
  t.activePlan = { boost: 2 };
  Object.assign(t.parts.engine, { grade: "racing", condition: 10 });
  let h = vehicleHealth(t);
  assert.equal(h.parts.find((p) => p.id === "engine").level, "warning");
  assert.ok(h.parts.find((p) => p.id === "engine").probability >= 0.08);
  t.parts.engine.broken = true;
  assert.equal(vehicleHealth(t).level, "critical");
  Object.assign(t.parts.engine, {
    grade: "reserve",
    condition: 0,
    broken: false,
  });
  assert.equal(failureProbability(t.parts.engine, 160, 2), 0);
  assert.equal(
    vehicleHealth(t).parts.find((p) => p.id === "engine").level,
    "normal",
  );
  t.heat = 120;
  assert.ok(
    vehicleHealth(t).alerts.some(
      (a) => a.id === "heat" && a.level === "warning",
    ),
  );
  t.heat = 125;
  assert.ok(
    vehicleHealth(t).alerts.some(
      (a) => a.id === "heat" && a.level === "critical",
    ),
  );
});
test("riesgo por hora acumula el muestreo real de ticks y crece con calor y exigencia", () => {
  const piece = { grade: "racing", condition: 45, broken: false };
  const rate = failureRate(piece, 110, 0);
  assert.equal(
    failureProbability(piece, 110, 0),
    1 - (1 - (rate * 30) / 3600) ** 120,
  );
  assert.ok(
    failureProbability(piece, 130, 2) > failureProbability(piece, 110, 0),
  );
  assert.ok(
    failureProbability(piece, 130, 2, 2) > failureProbability(piece, 130, 2, 1),
  );
});
