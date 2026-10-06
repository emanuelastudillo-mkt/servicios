import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  SOLUTION,
  PARTS,
  STAGES,
  SAVE_KEY,
  newTraining,
  startPreparation,
  commitStage,
  advanceTraining,
  resumeTraining,
  telemetry,
  stageDistance,
  phaseDuration,
} from "../tutorial/engine.js";
const clone = (v) => structuredClone(v);
function run(config = clone(SOLUTION), edit = () => {}, chunk = 2400) {
  const s = newTraining();
  startPreparation(s, config);
  while (s.phase === "preparation") advanceTraining(s, chunk);
  for (let i = 0; i < 5; i++) {
    const r = STAGES[i],
      d = {
        driver: r.driver,
        pace: r.pace,
        fuel: r.fuel,
        repairs: "all",
        rest: "full",
      };
    edit(d, i);
    commitStage(s, d);
    while (["service", "driving"].includes(s.phase)) advanceTraining(s, chunk);
  }
  return s;
}
test("five stages and winning sequence fit exactly 40 simulated minutes", () => {
  const s = run();
  assert.equal(s.result.won, true);
  assert.equal(s.elapsed, 2400);
  assert.equal(s.km, 40);
  assert.equal(s.history.length, 5);
  assert.equal(s.result.position, 1);
});
test("every alternate allowed tuning value loses; no luck or alternative golden calibration", () => {
  for (const [id] of PARTS)
    for (let v = 0; v <= 100; v += 5) {
      if (v === SOLUTION.tuning[id]) continue;
      const c = clone(SOLUTION);
      c.tuning[id] = v;
      const s = run(c);
      assert.equal(s.result.won, false, `${id}=${v}`);
      assert.ok(s.km < 39.996);
      assert.ok(s.faults.some((f) => f.code === "tune-" + id));
    }
});
test("alternate car or any of twelve alternate part selections loses", () => {
  for (const car of ["dune", "rocket"]) {
    const c = clone(SOLUTION);
    c.car = car;
    assert.equal(run(c).result.won, false);
  }
  for (const [id] of PARTS)
    for (const kit of ["shield", "light", "reserve"]) {
      if (kit === SOLUTION.kits[id]) continue;
      const c = clone(SOLUTION);
      c.kits[id] = kit;
      assert.equal(run(c).result.won, false, `${id}/${kit}`);
    }
});
test("each stage requires the active specialist, exact fuel and correct pace", () => {
  for (let stage = 0; stage < 5; stage++) {
    for (const driver of [0, 1, 2].filter((i) => i !== STAGES[stage].driver))
      assert.equal(
        run(clone(SOLUTION), (d, i) => {
          if (i === stage) d.driver = driver;
        }).result.won,
        false,
      );
    for (const pace of ["careful", "steady", "attack"].filter(
      (p) => p !== STAGES[stage].pace,
    ))
      assert.equal(
        run(clone(SOLUTION), (d, i) => {
          if (i === stage) d.pace = pace;
        }).result.won,
        false,
      );
    for (let fuel = 20; fuel <= 60; fuel += 5)
      if (fuel !== STAGES[stage].fuel)
        assert.equal(
          run(clone(SOLUTION), (d, i) => {
            if (i === stage) d.fuel = fuel;
          }).result.won,
          false,
        );
  }
});
test("partial repairs or rest loses at every camp and shortens assistance appropriately", () => {
  for (let stage = 1; stage < 5; stage++)
    for (const [key, choices] of [
      ["rest", ["half", "none"]],
      ["repairs", ["broken", "none"]],
    ])
      for (const choice of choices) {
        const s = run(clone(SOLUTION), (d, i) => {
          if (i === stage) d[key] = choice;
        });
        assert.equal(s.result.won, false);
        assert.ok(s.elapsed <= 2400);
        assert.ok(s.faults.some((f) => f.code === key));
      }
});
test("elapsed chunks and speeds preserve deterministic outcomes", () => {
  for (const chunk of [0.5, 2, 10, 2400])
    assert.deepEqual(
      run(clone(SOLUTION), () => {}, chunk).result,
      run().result,
    );
  const a = run(
      clone(SOLUTION),
      (d, i) => {
        if (i === 2) d.driver = 0;
      },
      0.5,
    ),
    b = run(clone(SOLUTION), (d, i) => {
      if (i === 2) d.driver = 0;
    });
  assert.deepEqual(a.result, b.result);
  assert.deepEqual(a.faults, b.faults);
});
test("pause and reopen cannot advance while closed; save is tutorial-specific", () => {
  const s = newTraining();
  startPreparation(s, clone(SOLUTION));
  advanceTraining(s, 100);
  s.speed = 10;
  const restored = resumeTraining(JSON.stringify(s));
  assert.ok(restored);
  assert.equal(restored.paused, true);
  assert.equal(restored.speed, 10);
  advanceTraining(restored, 1000);
  assert.equal(restored.elapsed, 100);
  assert.match(SAVE_KEY, /virtual-training/);
  restored.paused = false;
  advanceTraining(restored, 200);
  assert.equal(restored.phase, "ready");
});
test("running stage cannot be reconfigured; setup applies once per attempt", () => {
  const s = newTraining();
  startPreparation(s, clone(SOLUTION));
  assert.throws(() => startPreparation(s, clone(SOLUTION)));
  advanceTraining(s, 300);
  commitStage(s, {
    driver: 0,
    pace: "steady",
    fuel: 40,
    repairs: "all",
    rest: "full",
  });
  assert.throws(() => commitStage(s, { driver: 1 }));
});
test("wear, fatigue, passive 0.1 recovery and full camp recovery affect actual state", () => {
  const s = newTraining();
  startPreparation(s, clone(SOLUTION));
  advanceTraining(s, 300);
  s.energy[1] = 40;
  commitStage(s, {
    driver: 0,
    pace: "steady",
    fuel: 40,
    repairs: "all",
    rest: "full",
  });
  advanceTraining(s, 300);
  assert.equal(s.energy[0], 16);
  assert.equal(s.energy[1], 60);
  assert.ok(Math.abs(s.condition.engine - 55.8) < 1e-9);
  assert.ok(s.condition.tires < s.condition.engine);
  commitStage(s, {
    driver: 1,
    pace: "careful",
    fuel: 45,
    repairs: "all",
    rest: "full",
  });
  advanceTraining(s, 120);
  assert.equal(s.condition.engine, 100);
  assert.ok(s.energy[0] < 100);
  advanceTraining(s, 30);
  assert.equal(s.phase, "driving");
  assert.deepEqual(s.energy, [100, 100, 100]);
});
test("specialist in reserve cannot protect critical part; limp speed integrates correctly", () => {
  const s = newTraining();
  startPreparation(s, clone(SOLUTION));
  advanceTraining(s, 300);
  commitStage(s, {
    driver: 1,
    pace: "steady",
    fuel: 40,
    repairs: "all",
    rest: "full",
  });
  advanceTraining(s, 165);
  assert.equal(telemetry(s).speed, 30);
  assert.equal(s.condition.suspension, 0);
  const first = stageDistance(s);
  advanceTraining(s, 30);
  assert.ok(Math.abs(stageDistance(s) - first - 0.25) < 1e-9);
});
test("reserve avoids mechanical failure but loses performance; empty tank stops", () => {
  const s = newTraining(),
    c = clone(SOLUTION);
  c.kits.suspension = "reserve";
  startPreparation(s, c);
  advanceTraining(s, 300);
  commitStage(s, {
    driver: 1,
    pace: "steady",
    fuel: 20,
    repairs: "all",
    rest: "full",
  });
  advanceTraining(s, 160);
  assert.equal(s.drive.breakdown, false);
  assert.equal(s.fuel, 0);
  assert.equal(telemetry(s).speed, 0);
  const km = stageDistance(s);
  advanceTraining(s, 30);
  assert.equal(stageDistance(s), km);
});
test("malformed or incompatible saves safely reject instead of freezing the clock", () => {
  for (const value of [
    "bad json",
    "null",
    "{}",
    JSON.stringify({ ...newTraining(), phaseTime: "NaN" }),
    JSON.stringify({ ...newTraining(), phase: "result" }),
    JSON.stringify({ ...newTraining(), version: 99 }),
  ])
    assert.equal(resumeTraining(value), null);
  assert.ok(resumeTraining(JSON.stringify(run())));
});
test("offline tutorial contains no API/auth/online state imports; worker scope is isolated", async () => {
  const app = await readFile(
      new URL("../tutorial/app.js", import.meta.url),
      "utf8",
    ),
    engine = await readFile(
      new URL("../tutorial/engine.js", import.meta.url),
      "utf8",
    ),
    sw = await readFile(new URL("../tutorial/sw.js", import.meta.url), "utf8");
  assert.doesNotMatch(
    app + engine,
    /workers\.dev|ApexAPI|passkey|fetch\(|sessionStorage/,
  );
  assert.match(sw, /url\.pathname\.startsWith/);
  assert.match(sw, /apex1000-training/);
});
