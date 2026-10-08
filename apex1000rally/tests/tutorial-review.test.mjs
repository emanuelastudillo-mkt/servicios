import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  newTraining,
  SOLUTION,
  STAGES,
  PARTS,
  startPreparation,
  commitStage,
  advanceTraining,
  resumeTraining,
  phaseDuration,
  serviceTasks,
  telemetry,
} from "../tutorial/engine.js";
import {
  markerLayout,
  trainingField,
  routePoint,
} from "../tutorial/viewer-model.js";
const copy = structuredClone;
const plan = (i) => ({
  driver: STAGES[i].driver,
  pace: STAGES[i].pace,
  fuel: STAGES[i].fuel,
  repairs: "all",
  rest: "full",
});
function driving() {
  const s = newTraining();
  startPreparation(s, copy(SOLUTION));
  advanceTraining(s, 300);
  commitStage(s, plan(0));
  return s;
}
test("pause freezes both distance and dashboard; resuming restores the same speed", () => {
  const s = driving();
  advanceTraining(s, 60);
  const speed = telemetry(s).speed,
    elapsed = s.elapsed;
  s.paused = true;
  assert.equal(telemetry(s).speed, 0);
  assert.equal(telemetry(s).rpm, 850);
  advanceTraining(s, 500);
  assert.equal(s.elapsed, elapsed);
  s.paused = false;
  assert.equal(telemetry(s).speed, speed);
});
test("an unprotected critical part warns before the scripted breakdown", () => {
  const s = newTraining();
  startPreparation(s, copy(SOLUTION));
  advanceTraining(s, 300);
  commitStage(s, { ...plan(0), driver: 1 });
  assert.equal(telemetry(s).broken, false);
  assert.equal(telemetry(s).risk, 82);
  advanceTraining(s, 165);
  assert.equal(telemetry(s).broken, true);
});
test("all phases survive save and reload through a complete run with fractional clock ticks", () => {
  let s = newTraining();
  startPreparation(s, copy(SOLUTION));
  let cycles = 0;
  while (s.phase !== "result" && cycles++ < 30000) {
    const restored = resumeTraining(JSON.stringify(s));
    assert.ok(restored, `${s.phase} ${s.stage} ${s.phaseTime}`);
    s = restored;
    if (["ready", "camp"].includes(s.phase)) commitStage(s, plan(s.stage));
    else {
      s.paused = false;
      advanceTraining(s, [0.17, 0.203, 1.997, 2.13][cycles % 4]);
    }
  }
  assert.ok(cycles < 30000);
  assert.equal(s.result.won, true);
  assert.equal(s.km, 40);
  assert.equal(s.elapsed, 2400);
  assert.ok(resumeTraining(JSON.stringify(s)));
});
test("incomplete nested snapshots and inconsistent phases cannot reach rendering or freeze the engine", () => {
  const mutations = [
    (s) => delete s.fuel,
    (s) => (s.fuel = "10"),
    (s) => (s.fuel = -1),
    (s) => (s.drive.startCondition.engine = null),
    (s) => (s.drive.startEnergy = [100]),
    (s) => (s.drive.startFuel = -10),
    (s) => (s.drive.breakdown = "false"),
    (s) => (s.phaseTime = 1000),
    (s) => (s.decision.fuel = 41),
    (s) => {
      s.phase = "camp";
      s.stage = 0;
    },
    (s) => {
      s.phase = "ready";
      s.elapsed = 100;
    },
  ];
  for (const mutate of mutations) {
    const s = driving();
    mutate(s);
    assert.equal(resumeTraining(JSON.stringify(s)), null);
  }
  const s = driving();
  advanceTraining(s, 300);
  s.history[0].faults = [null];
  assert.equal(resumeTraining(JSON.stringify(s)), null);
});
test("invalid draft is discarded without losing a healthy saved attempt", () => {
  const s = driving();
  advanceTraining(s, 300);
  s.draft = { fuel: "<img src=x onerror=alert(1)>" };
  const recovered = resumeTraining(JSON.stringify(s));
  assert.ok(recovered);
  assert.equal(recovered.draft, undefined);
  assert.equal(recovered.km, 8);
});
test("partial camp tasks use the selected work and their actual durations", () => {
  const s = driving();
  advanceTraining(s, 300);
  commitStage(s, { ...plan(1), repairs: "broken", rest: "half" });
  const tasks = serviceTasks(s);
  assert.equal(tasks[1].seconds, 0);
  assert.equal(tasks[2].seconds, 75);
  assert.ok(!tasks[2].skipped);
  assert.equal(phaseDuration(s), 75);
  advanceTraining(s, 74);
  assert.equal(s.phase, "service");
  advanceTraining(s, 1);
  assert.equal(s.phase, "driving");
  const t = driving();
  advanceTraining(t, 300);
  t.condition.engine = 0;
  commitStage(t, { ...plan(1), repairs: "broken", rest: "none" });
  assert.equal(phaseDuration(t), 120);
  advanceTraining(t, 60);
  assert.equal(t.condition.engine, 50);
  assert.equal(t.condition.gearbox, t.serviceStart.condition.gearbox);
});
test("camp refuelling starts with the remaining fuel and old assistance saves still resume", () => {
  const s = driving();
  advanceTraining(s, 300);
  s.fuel = 8;
  commitStage(s, plan(1));
  advanceTraining(s, 22.5);
  assert.equal(s.fuel, 26.5);
  advanceTraining(s, 22.5);
  assert.equal(s.fuel, 45);
  const old = driving();
  advanceTraining(old, 300);
  commitStage(old, { ...plan(1), repairs: "broken", rest: "none" });
  delete old.serviceStart.fuel;
  old.phaseTime = 100;
  old.elapsed += 100;
  const restored = resumeTraining(JSON.stringify(old));
  assert.ok(restored);
  assert.equal(phaseDuration(restored), 120);
});
test("separate map cars sit on the road; grouped cars retain exact route anchors", () => {
  const field = trainingField(driving());
  field.forEach((t, i) => (t.location = routePoint(i * 7)));
  for (const z of [1, 4, 16])
    for (const p of markerLayout(field, z)) {
      assert.equal(p.displaced, false);
      assert.equal(p.x, p.anchorX);
      assert.equal(p.y, p.anchorY);
    }
  field.forEach((t) => (t.location = routePoint(8)));
  for (const z of [1, 4, 16]) {
    const layout = markerLayout(field, z);
    assert.equal(layout.filter((p) => p.displaced).length, 5);
    for (const p of layout) {
      assert.equal(p.anchorX, routePoint(8).x);
      assert.equal(p.anchorY, routePoint(8).y);
    }
    for (let i = 0; i < layout.length; i++)
      for (let j = i + 1; j < layout.length; j++)
        assert.ok(
          Math.hypot(layout[i].x - layout[j].x, layout[i].y - layout[j].y) *
            z >=
            39,
        );
  }
});

async function workerHarness() {
  const handlers = {},
    entries = new Map();
  let calls = 0,
    denyStorage = false,
    network = () => new Response("network");
  const origin = "https://example.test/apex1000rally/tutorial/";
  const key = (v) => new URL(typeof v === "string" ? v : v.url, origin).href;
  const cache = {
    match: async (v) => entries.get(key(v)),
    put: async (v, response) => {
      if (denyStorage) throw Error('Quota exceeded');
      entries.set(key(v), response);
    },
    addAll: async (files) => {
      for (const f of files) entries.set(key(f), new Response(f));
    },
  };
  const context = {
    URL,
    Response,
    Promise,
    caches: { open: async () => cache, match: cache.match },
    fetch: async () => {
      calls++;
      return network();
    },
    self: {
      location: { href: origin + "sw.js", origin: "https://example.test" },
      clients: { claim: async () => {} },
      skipWaiting: async () => {},
      addEventListener: (name, fn) => (handlers[name] = fn),
    },
  };
  vm.runInNewContext(
    await readFile(new URL("../tutorial/sw.js", import.meta.url), "utf8"),
    context,
  );
  let install;
  handlers.install({ waitUntil: (p) => (install = p) });
  await install;
  return {
    entries,
    handlers,
    get calls() {
      return calls;
    },
    setNetwork: (fn) => (network = fn),
    denyStorage: value => denyStorage = value,
    async request(path, mode = "cors", method = "GET") {
      let reply;
      handlers.fetch({
        request: { url: key(path), mode, method },
        respondWith: (p) => (reply = p),
      });
      return reply ? await reply : undefined;
    },
    async ready() {
      let pending;
      const messages = [];
      handlers.message({
        data: { type: "CHECK_OFFLINE" },
        source: { postMessage: (m) => messages.push(m) },
        waitUntil: (p) => (pending = p),
      });
      await pending;
      return messages;
    },
  };
}
test("cached terrain avoids network; failed navigation reopens offline and other scopes are untouched", async () => {
  const w = await workerHarness();
  assert.equal(
    await (await w.request("./assets/tutorial-terrain-v1.png")).text(),
    "./assets/tutorial-terrain-v1.png",
  );
  assert.equal(w.calls, 0);
  assert.equal((await w.request("../favicon.svg")).status, 200);
  assert.equal(w.calls, 0);
  w.setNetwork(() => new Response("temporary error", { status: 503 }));
  assert.equal((await w.request("./?retry=1", "navigate")).status, 200);
  w.setNetwork(() => {
    throw Error("offline");
  });
  assert.equal((await w.request("./", "navigate")).status, 200);
  assert.equal(await w.request("../api/races"), undefined);
  assert.equal(await w.request("https://other.test/tutorial/"), undefined);
  assert.equal(await w.request("./", "cors", "POST"), undefined);
});
test("offline readiness requires every asset and identifies the active release", async () => {
  const w = await workerHarness();
  const messages = await w.ready();
  assert.equal(messages.length, 1);
  assert.equal(messages[0].version, "1.7.1");
  w.entries.delete(
    "https://example.test/apex1000rally/tutorial/assets/tutorial-terrain-v1.png",
  );
  assert.equal((await w.ready()).length, 0);
  w.denyStorage(true);
  assert.equal((await w.request('./assets/tutorial-terrain-v1.png')).status, 200);
  assert.equal((await w.ready()).length, 0, 'failed storage cannot claim offline readiness');
  w.denyStorage(false);
  await w.request("./assets/tutorial-terrain-v1.png");
  assert.equal(
    (await w.ready()).length,
    1,
    "a connected reload heals the missing cached asset",
  );
});

test('3D resources belong to the tutorial offline cache and never intercept the online renderer',async()=>{
  const w=await workerHarness();
  for(const file of ['viewer.js?v=1.7.1','sprint-salta.json','sprint-salta.webp','sprint-salta.i16','ATTRIBUTION.md']){
    assert.equal((await w.request('./assets/terrain3d/'+file)).status,200);
  }
  assert.equal(w.calls,0);
  assert.equal(await w.request('../assets/terrain3d/viewer.js'),undefined);
  w.entries.delete('https://example.test/apex1000rally/tutorial/assets/terrain3d/sprint-salta.i16');
  assert.equal((await w.ready()).length,0,'Sin elevaciones no puede prometer 3D offline');
});

test('the new vehicle and close-up viewer are required before declaring the tutorial ready offline',async()=>{
  const w=await workerHarness();
  assert.equal((await w.request('./assets/vehicles/trail-r4.glb')).status,200);
  assert.equal((await w.request('./vehicle-dialog.js?v=1.7.1')).status,200);
  assert.equal(w.calls,0);
  w.entries.delete('https://example.test/apex1000rally/tutorial/assets/vehicles/trail-r4.glb');
  assert.equal((await w.ready()).length,0);
});
