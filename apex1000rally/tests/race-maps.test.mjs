import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { CATALOG } from "../data/catalog.js";
import { RACE_MAPS } from "../data/race-maps.js";
import { routeFor, setActiveRoute } from "../src/route.js";
import { mapSVG, project, fitMap, zoom, camera } from "../src/visuals.js";

test("cada circuito tiene un fondo WebP propio y un brief reproducible", () => {
  assert.deepEqual(
    Object.keys(RACE_MAPS).sort(),
    CATALOG.races.map((r) => r.id).sort(),
  );
  assert.equal(new Set(Object.values(RACE_MAPS).map((m) => m.src)).size, 32);
  const metadata = JSON.parse(
    readFileSync(new URL("../docs/mapas/activos.json", import.meta.url)),
  );
  for (const race of CATALOG.races) {
    const map = RACE_MAPS[race.id];
    const bytes = readFileSync(new URL("../" + map.src, import.meta.url));
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
    assert.ok(bytes.length < 5 * 1024 * 1024);
    assert.ok(
      existsSync(
        new URL(`../docs/mapas/prompts/${race.id}.txt`, import.meta.url),
      ),
    );
    const item = metadata.find((m) => m.id === race.id);
    assert.ok(item.width >= 1000 && item.height >= 950);
    assert.ok(Math.abs(item.width / item.height / (1000 / 950) - 1) < 0.01);
    assert.equal(item.bytes, bytes.length);
  }
});
test("el fondo correcto cambia con el circuito y queda debajo de los trazados", () => {
  for (const race of [...CATALOG.races, ...CATALOG.races].reverse()) {
    setActiveRoute(race.id);
    const svg = mapSVG({ routeId: race.id, teams: [] }, { features: [] });
    assert.equal((svg.match(/class="race-terrain-image"/g) || []).length, 1);
    assert.ok(svg.includes(`href="${RACE_MAPS[race.id].src}"`));
    assert.ok(
      svg.indexOf("race-terrain-image") < svg.indexOf('class="route-lines"'),
    );
    assert.equal(
      (svg.match(/class="stage-trace"/g) || []).length,
      routeFor(race.id).stages.length,
    );
    for (const stage of routeFor(race.id).stages)
      for (const p of stage.path) {
        const [x, y] = project(...p);
        assert.ok(
          x > 0 && x < 1000 && y > 0 && y < 950,
          `${race.id} fuera del fondo`,
        );
      }
  }
  setActiveRoute("andes");
  fitMap();
});
test("zoom 2000x conserva fondo, trazado y escudo en el mismo sistema de coordenadas", () => {
  setActiveRoute("sprint-finland");
  fitMap();
  zoom(0.00001);
  const svg = mapSVG(
    {
      routeId: "sprint-finland",
      teams: [{ id: "qa", name: "Equipo ficticio", shieldId: 1 }],
    },
    { features: [] },
  );
  assert.equal(camera.w, 0.5);
  assert.ok(svg.includes('width="1000" height="950"'));
  assert.ok(svg.includes('id="map-team-qa"'));
  assert.ok(svg.includes('pointer-events="none"'));
  fitMap();
  setActiveRoute("andes");
});
