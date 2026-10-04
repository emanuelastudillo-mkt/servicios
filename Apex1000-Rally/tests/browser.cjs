// Optional QA: install Playwright locally or supply PLAYWRIGHT_MODULE and BROWSER_PATH.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const url = process.env.TEST_URL || "http://127.0.0.1:4182/";
const qa = path.resolve("qa");
fs.mkdirSync(qa, { recursive: true });
const getSave = (p) =>
  p.evaluate(() => JSON.parse(localStorage.getItem("apex1000-rally-v1")));
(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.BROWSER_PATH
      ? { executablePath: process.env.BROWSER_PATH }
      : {}),
  });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    timezoneId: "America/Argentina/Buenos_Aires",
  });
  const page = await context.newPage(),
    errors = [],
    failedRequests = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) failedRequests.push(`${r.status()} ${r.url()}`);
  });
  const navigate = async (name) => {
    await page.locator(`nav [data-tab="${name}"]`).click();
  };
  const screenshot = async (name) => {
    await page.locator("#toast").evaluate((el) => el.classList.remove("show"));
    await page.screenshot({
      path: path.join(qa, name + ".png"),
      fullPage: true,
    });
  };
  const noOverflow = async () => {
    const width = await page.evaluate(() => ({
      body: document.documentElement.scrollWidth,
      view: innerWidth,
    }));
    assert.ok(width.body <= width.view + 1, JSON.stringify(width));
  };
  const command = async (action) => {
    await page.locator(`[data-action="${action}"]`).first().click();
    await page.waitForFunction(
      () => !document.querySelector("#app").classList.contains("computing"),
    );
  };
  try {
    await page.goto(url);
    await page.locator("#create-form").waitFor();
    await screenshot("onboarding");
    await noOverflow();
    await page
      .locator('[data-action="choose-vehicle"][data-id="mini"]')
      .click();
    await page.locator('input[name="teamName"]').fill("Equipo de prueba");
    await page.locator("#create-form button").click();
    assert.equal((await getSave(page)).teams[0].vehicleId, "mini");
    await page.locator("#plan-boost").selectOption("1");
    await command("save-plan");
    assert.equal((await getSave(page)).teams[0].plans[0].boost, 1);
    await screenshot("camp-desktop");
    await noOverflow();
    await navigate("market");
    await page.locator("#market-condition").selectOption("75");
    const before = (await getSave(page)).teams[0].budget;
    await page.locator('[data-action="buy"][data-grade="endurance"]').click();
    let save = await getSave(page),
      spare = save.teams[0].inventory.find((i) => i.grade === "endurance");
    assert.ok(spare && save.teams[0].budget < before);
    assert.equal(spare.condition, 75);
    await screenshot("market-desktop");
    await navigate("camp");
    await page
      .locator('[data-part-action="engine"]')
      .selectOption("replace:" + spare.id);
    await command("save-plan");
    await navigate("roadbook");
    await command("fill-plans");
    assert.ok((await getSave(page)).teams[0].plans.every(Boolean));
    await screenshot("roadbook-desktop");
    await navigate("crew");
    await page
      .locator('[data-action="choose-driver"][data-id="navigator"]')
      .click();
    await command("save-plan");
    assert.equal((await getSave(page)).teams[0].plans[0].driverId, "navigator");
    await navigate("race");
    const beforeBox = await page.locator("#race-map").getAttribute("viewBox");
    await command("zoom-in");
    assert.notEqual(
      await page.locator("#race-map").getAttribute("viewBox"),
      beforeBox,
    );
    await command("fit-map");
    assert.equal(
      await page.locator("#race-map").getAttribute("viewBox"),
      beforeBox,
    );
    await page.locator('.standing-row[data-id="rival-2"]').click();
    assert.match(
      await page.locator("#team-inspector").textContent(),
      /Ruta Sur/,
    );
    await command("fit-map");
    await page.locator('path[data-action="map-stage"][data-index="3"]').scrollIntoViewIfNeeded();
    const point = await page
      .locator('path[data-action="map-stage"][data-index="3"]')
      .evaluate((el) => {
        const p = el.getPointAtLength(el.getTotalLength() / 2),
          q = new DOMPoint(p.x, p.y).matrixTransform(el.getScreenCTM());
        return { x: q.x, y: q.y };
      });
    await page.mouse.click(point.x, point.y);
    assert.notEqual(
      await page.locator("#race-map").getAttribute("viewBox"),
      beforeBox,
    );
    await command("fit-map");
    await command("skip-start");
    save = await getSave(page);
    assert.equal(save.teams[0].parts.engine.id, spare.id);
    assert.ok(save.teams.every((t) => t.stageStart === 0));
    const beforeMarker = await page
      .locator("#map-team-player")
      .getAttribute("transform");
    await command("advance-hour");
    assert.notEqual(
      await page.locator("#map-team-player").getAttribute("transform"),
      beforeMarker,
    );
    await screenshot("race-desktop");
    await noOverflow();
    await command("next-camp");
    save = await getSave(page);
    assert.equal(save.teams[0].stageIndex, 1);
    assert.equal(save.teams[0].phase, "camp");
    assert.equal(save.speed, 0);
    const stoppedClock = save.clock;
    await page.reload();
    await page.locator("#race-map").waitFor();
    assert.equal((await getSave(page)).clock, stoppedClock);
    const downloadPromise = page.waitForEvent("download");
    await page.locator('footer [data-action="export"]').click();
    const download = await downloadPromise;
    const backup = path.join(qa, "browser-backup.json");
    await download.saveAs(backup);
    assert.equal(
      JSON.parse(fs.readFileSync(backup, "utf8")).clock,
      stoppedClock,
    );
    await command("advance-hour");
    await page.locator("#import-file").setInputFiles(backup);
    await page.waitForFunction(
      (clock) =>
        JSON.parse(localStorage.getItem("apex1000-rally-v1")).clock === clock,
      stoppedClock,
    );
    assert.equal((await getSave(page)).teams[0].stageIndex, 1);
    await command("help");
    await page.locator("dialog").waitFor({ state: "visible" });
    assert.match(
      await page.locator("dialog").textContent(),
      /no conecta jugadores reales/,
    );
    await page.locator('[data-action="close-modal"]').click();
    // Finish exclusively through the same worker and controls used by a player.
    for (let stage = 2; stage <= 15; stage++) {
      await command("next-camp");
      assert.equal((await getSave(page)).teams[0].stageIndex, stage);
    }
    save = await getSave(page);
    assert.equal(save.teams[0].phase, "finished");
    assert.ok(save.teams[0].prizePaid);
    await page.locator(".finish-panel").waitFor();
    await screenshot("finish-desktop");
    await page.reload();
    await page.locator(".finish-panel").waitFor();
    assert.equal(
      (await getSave(page)).teams[0].prize.net,
      save.teams[0].prize.net,
    );
    const resultPromise = page.waitForEvent("download");
    await command("export-results");
    const resultDownload = await resultPromise;
    await resultDownload.saveAs(path.join(qa, "browser-result.json"));
    // Restore an active camp for responsive review.
    await page.locator("#import-file").setInputFiles(backup);
    await page.waitForFunction(
      () =>
        JSON.parse(localStorage.getItem("apex1000-rally-v1")).teams[0].phase ===
        "camp",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    for (const tab of ["race", "camp", "market", "roadbook", "crew"]) {
      await navigate(tab);
      await noOverflow();
      await screenshot(tab + "-mobile");
    }
    await page.setViewportSize({ width: 1920, height: 1080 });
    await navigate("race");
    await noOverflow();
    // Real-time catch-up across a browser reload (controlled saved clock metadata).
    await page.evaluate(() => {
      const s = JSON.parse(localStorage.getItem("apex1000-rally-v1"));
      s.speed = 1;
      s.wallAt = Date.now() - 120000;
      localStorage.setItem("qa-realtime", JSON.stringify(s));
    });
    const realtime = await page.evaluate(() =>
      localStorage.getItem("qa-realtime"),
    );
    const rtfile = path.join(qa, "realtime.json");
    fs.writeFileSync(rtfile, realtime);
    const rtcontext = await browser.newContext();
    const rtpage = await rtcontext.newPage();
    await rtpage.addInitScript(
      (raw) => localStorage.setItem("apex1000-rally-v1", raw),
      realtime,
    );
    await rtpage.goto(url);
    await rtpage.waitForFunction(
      (old) =>
        JSON.parse(localStorage.getItem("apex1000-rally-v1")).clock >=
        old + 120,
      stoppedClock,
    );
    await rtcontext.close();
    assert.deepEqual(errors, []);
    assert.deepEqual(failedRequests, []);
    const report = {
      url,
      engine: "Microsoft Edge / Chromium",
      checks: [
        "inscripción",
        "vehículos",
        "guardado de plan",
        "compra usada",
        "montaje",
        "piloto",
        "planes futuros",
        "zoom",
        "seguimiento rival",
        "posición dinámica",
        "15 etapas completas",
        "premio único",
        "persistencia",
        "exportar/importar",
        "retomar 1×",
        "390/1440/1920 px sin desborde",
      ],
      errors,
      failedRequests,
      finish: {
        hours: save.teams[0].finishTime / 3600,
        position: save.teams[0].prize.position,
        prize: save.teams[0].prize.net,
      },
    };
    fs.writeFileSync(
      path.join(qa, "browser-report.json"),
      JSON.stringify(report, null, 2),
    );
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await browser.close();
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
