import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  ROUTE,
  TEAMS,
  WORLD,
  routePoint,
  cameraBounds,
  trainingField,
} from "../tutorial/viewer-model.js";
import {
  SOLUTION,
  STAGES,
  newTraining,
  startPreparation,
  commitStage,
  advanceTraining,
  stageDistance,
  telemetry,
} from "../tutorial/engine.js";
function driving(driver = 0) {
  const s = newTraining();
  startPreparation(s, structuredClone(SOLUTION));
  advanceTraining(s, 300);
  commitStage(s, {
    driver,
    pace: "steady",
    fuel: 40,
    repairs: "all",
    rest: "full",
  });
  return s;
}
test("five detailed route segments use the exact tutorial distances and join continuously", () => {
  assert.equal(ROUTE.length, 5);
  assert.equal(ROUTE.at(-1).endKm, 40);
  for (const r of ROUTE) {
    assert.equal(r.endKm - r.startKm, STAGES[r.stage].km);
    assert.ok(r.points.length >= 120);
    assert.ok(r.length > 0);
    for (const [x, y] of r.points) {
      assert.ok(x >= 0 && x <= WORLD.width && y >= 0 && y <= WORLD.height);
    }
    if (r.stage) {
      const before = routePoint(r.startKm - 1e-6),
        after = routePoint(r.startKm);
      assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 0.001);
    }
  }
  assert.equal(routePoint(-20).x, 65);
  assert.equal(routePoint(900).x, 1135);
});
test("markers move continuously on curved routes with no corner-cutting", () => {
  let prev = routePoint(0);
  let curveChanges = 0;
  for (let km = 0.01; km <= 40; km += 0.01) {
    const p = routePoint(km);
    assert.ok(
      Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.angle),
    );
    assert.ok(Math.hypot(p.x - prev.x, p.y - prev.y) < 2);
    if (Math.abs(p.angle - prev.angle) > 0.1) curveChanges++;
    prev = p;
  }
  assert.ok(curveChanges > 500);
});
test("six uniquely identifiable teams, valid ranks and exact nearest-rival gaps", () => {
  assert.equal(new Set(TEAMS.map((t) => t.id)).size, 6);
  assert.equal(new Set(TEAMS.map((t) => t.color)).size, 6);
  const s = driving();
  advanceTraining(s, 100);
  const field = trainingField(s),
    you = field.find((t) => t.you);
  assert.equal(you.position, 1);
  assert.equal(you.km, stageDistance(s));
  assert.equal(you.speed, telemetry(s).speed);
  assert.equal(you.previousGap, null);
  assert.deepEqual(
    field.map((t) => t.position),
    [1, 2, 3, 4, 5, 6],
  );
  assert.equal(field.at(-1).nextGap, null);
  for (let i = 0; i < 5; i++) {
    assert.equal(field[i].nextGap, field[i].km - field[i + 1].km);
    assert.equal(field[i + 1].previousGap, field[i].nextGap);
  }
});
test("a failure's map position matches credited distance, limp speed and overtaking", () => {
  const s = driving(1);
  advanceTraining(s, 210);
  const field = trainingField(s),
    you = field.find((t) => t.you);
  assert.ok(you.position > 1);
  assert.equal(you.speed, 30);
  assert.equal(you.km, stageDistance(s));
  assert.deepEqual(you.location, routePoint(you.km));
  const raw = JSON.stringify(s);
  trainingField(s);
  assert.equal(JSON.stringify(s), raw);
});
test("camp, pause and final positions stay stable and match race results", () => {
  const s = driving();
  advanceTraining(s, 300);
  let field = trainingField(s);
  assert.equal(field.find((t) => t.you).km, s.km);
  assert.ok(field.every((t) => t.speed === 0));
  for (let i = 1; i < 5; i++) {
    const r = STAGES[i];
    commitStage(s, {
      driver: r.driver,
      pace: r.pace,
      fuel: r.fuel,
      repairs: "all",
      rest: "full",
    });
    advanceTraining(s, 2400);
  }
  field = trainingField(s);
  assert.equal(field.find((t) => t.you).position, s.result.position);
  assert.equal(field.find((t) => t.you).km, 40);
  assert.ok(field.every((t) => t.km <= 40));
});
test("camera clamps 1–16×, frames the full route and keeps followed cars within bounds", () => {
  assert.deepEqual(cameraBounds(0, 0, 1), {
    x: 0,
    y: 0,
    width: 1200,
    height: 460,
    cx: 600,
    cy: 230,
    zoom: 1,
  });
  assert.equal(cameraBounds(0, 0, 90).zoom, 16);
  for (const z of [1, 2, 8, 16])
    for (let km = 0; km <= 40; km += 0.5) {
      const p = routePoint(km),
        c = cameraBounds(p.x, p.y, z);
      assert.ok(
        p.x >= c.x &&
          p.x <= c.x + c.width &&
          p.y >= c.y &&
          p.y <= c.y + c.height,
      );
      assert.ok(
        c.x >= 0 && c.y >= 0 && c.x + c.width <= 1200 && c.y + c.height <= 460,
      );
    }
});
test("offline cache includes both map modules; map is mounted outside rerendered content", async () => {
  const sw = await readFile(
      new URL("../tutorial/sw.js", import.meta.url),
      "utf8",
    ),
    html = await readFile(
      new URL("../tutorial/index.html", import.meta.url),
      "utf8",
    ),
    viewer = await readFile(
      new URL("../tutorial/viewer.js", import.meta.url),
      "utf8",
    );
  assert.match(sw, /viewer\.js\?v=1\.7\.1/);
  assert.match(sw, /viewer-model\.js\?v=1\.7\.1/);
  assert.ok(html.indexOf('id="race-viewer"') < html.indexOf('id="app"'));
  assert.doesNotMatch(viewer, /fetch\(|workers\.dev|ApexAPI|sessionStorage/);
});
test("every completed stage ends exactly at its mapped camp, with no distance lost or skipped", () => {
  const s = driving();
  for (let i = 0; i < 5; i++) {
    if (i) {
      const r = STAGES[i];
      commitStage(s, {
        driver: r.driver,
        pace: r.pace,
        fuel: r.fuel,
        repairs: "all",
        rest: "full",
      });
    }
    advanceTraining(s, 2400);
    const you = trainingField(s).find((t) => t.you);
    assert.equal(you.km, ROUTE[i].endKm);
    assert.equal(you.location.x, ROUTE[i].points.at(-1)[0]);
    assert.equal(you.location.y, ROUTE[i].points.at(-1)[1]);
  }
});
test("rivals follow the simulation clock independently of delayed player stages", () => {
  const s = driving();
  s.decision.fuel = 60;
  s.drive.startFuel = 60;
  s.drive.ratio = 0.8;
  advanceTraining(s, 330);
  assert.equal(s.phase, "driving");
  assert.equal(s.stage, 0);
  const field = trainingField(s);
  const you = field.find((t) => t.you),
    rival = field.find((t) => t.id === "cobalto");
  assert.ok(you.km < 8);
  assert.equal(rival.km, 8);
  assert.equal(rival.speed, 0);
  assert.equal(rival.phase, "Asistencia en campamento");
});
test("DNF result, ranking and map agree and remain before the unreached camp", () => {
  const s = driving(1);
  advanceTraining(s, 2400);
  const field = trainingField(s),
    you = field.find((t) => t.you);
  assert.equal(s.result.reason, "fuel");
  assert.equal(you.position, s.result.position);
  assert.equal(you.km, s.km);
  assert.ok(you.km < ROUTE[0].endKm);
  assert.deepEqual(you.location, routePoint(s.km));
  assert.ok(field.every((t) => t.speed === 0));
});
test("rivals stop only at their own exact camp coordinates", () => {
  const s = driving();
  for (const team of TEAMS.filter((t) => t.id !== "player")) {
    s.elapsed = 300 + 300 / team.ratio + 1;
    const rival = trainingField(s).find((t) => t.id === team.id);
    assert.equal(rival.km, 8);
    assert.deepEqual(rival.location, routePoint(8));
    assert.equal(rival.speed, 0);
    assert.equal(rival.phase, "Asistencia en campamento");
  }
});
test("illustrated terrain is a project-local PNG aligned with the world and cached offline", async () => {
  const viewer = await readFile(
    new URL("../tutorial/viewer.js", import.meta.url),
    "utf8",
  );
  const sw = await readFile(
    new URL("../tutorial/sw.js", import.meta.url),
    "utf8",
  );
  const png = await readFile(
    new URL("../tutorial/assets/tutorial-terrain-v1.png", import.meta.url),
  );
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  const width = png.readUInt32BE(16),
    height = png.readUInt32BE(20);
  assert.ok(width >= 2000 && height >= 750);
  assert.ok(Math.abs(width / height / (WORLD.width / WORLD.height) - 1) < 0.01);
  assert.ok(png.length < 5 * 1024 * 1024);
  assert.match(
    viewer,
    /TERRAIN_ASSET = "\.\/assets\/tutorial-terrain-v1\.png"/,
  );
  assert.match(viewer, /preserveAspectRatio="none"/);
  assert.match(viewer, /vector-effect="non-scaling-stroke"/);
  assert.match(viewer, /terrain-unavailable/);
  assert.match(sw, /\.\/assets\/tutorial-terrain-v1\.png/);
});
test("map art specification matches stage distances, temperatures and delivered raster", async () => {
  const spec = JSON.parse(
    await readFile(
      new URL("../docs/mapas/FICHA-TUTORIAL.json", import.meta.url),
      "utf8",
    ),
  );
  const png = await readFile(
    new URL("../tutorial/assets/tutorial-terrain-v1.png", import.meta.url),
  );
  assert.equal(spec.raster.width, png.readUInt32BE(16));
  assert.equal(spec.raster.height, png.readUInt32BE(20));
  assert.equal(spec.raster.bytes, png.length);
  assert.equal(spec.world.width, WORLD.width);
  assert.equal(spec.world.height, WORLD.height);
  for (let i = 0; i < 5; i++) {
    assert.equal(spec.stages[i].name, STAGES[i].name);
    assert.equal(spec.stages[i].km, STAGES[i].km);
    assert.equal(spec.stages[i].heatC, STAGES[i].heat);
  }
});
