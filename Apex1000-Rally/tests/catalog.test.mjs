import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildCatalog, parseCSV, sync } from "../scripts/sync-catalog.mjs";
import { checkPublished } from "../scripts/verify-catalog-published.mjs";
test("CSV interpreta comillas, saltos de línea, números y disponibilidad", () => {
  const rows = parseCSV(
    'id,name,price,available\r\na,"Un nombre, con ""comillas""",1200,TRUE\r\nb,"Dos\nlíneas",500,FALSE\r\n',
  );
  assert.equal(rows[0].name, 'Un nombre, con "comillas"');
  assert.equal(rows[0].price, 1200);
  assert.equal(rows[1].available, false);
  assert.equal(rows[1].name, "Dos\nlíneas");
});

test("publicación comprueba también el módulo que realmente carga el juego", async () => {
  const expected = {
    baseUrl: "https://example.com/Apex1000-Rally/",
    json: '{"revision":"new"}',
    module: 'export const CATALOG = {"revision":"new"};',
  };
  const response = (text, status = 200) => ({
    ok: status === 200,
    status,
    text: async () => text,
  });
  const good = await checkPublished({
    ...expected,
    fetchImpl: async (url) =>
      response(url.pathname.endsWith(".js") ? expected.module : expected.json),
  });
  assert.equal(good.ok, true);
  const staleModule = await checkPublished({
    ...expected,
    fetchImpl: async (url) =>
      response(
        url.pathname.endsWith(".js")
          ? 'export const CATALOG = {"revision":"old"};'
          : expected.json,
      ),
  });
  assert.equal(staleModule.ok, false);
  assert.match(staleModule.detail, /catalog.js/);
  const unavailable = await checkPublished({
    ...expected,
    fetchImpl: async () => response("Not found", 404),
  });
  assert.equal(unavailable.ok, false);
  assert.match(unavailable.detail, /404/);
  const html = await checkPublished({
    ...expected,
    fetchImpl: async () => response("<html>Login</html>"),
  });
  assert.equal(html.ok, false);
});
test("los siete CSV generan catálogo verificable y revisión estable", async () => {
  const read = (_, name) =>
    fs.readFile(new URL(`../catalogos/${name}.csv`, import.meta.url), "utf8");
  const a = await buildCatalog(read),
    b = await buildCatalog(read);
  assert.deepEqual(a, b);
  assert.equal(a.parts.length, 54);
  assert.equal(a.drivers.length, 16);
  assert.equal(a.mechanics.length, 28);
});
test("importación inválida falla antes de escribir datos y conexión pendiente se identifica", async () => {
  await assert.rejects(
    () =>
      buildCatalog(async (_, name) =>
        name === "Premios"
          ? "position,points,race,championship\n1,-1,5,5"
          : fs.readFile(
              new URL(`../catalogos/${name}.csv`, import.meta.url),
              "utf8",
            ),
      ),
    /inválido/,
  );
  await assert.rejects(
    () =>
      sync({
        configPath: new URL("fixtures/sheets-disabled.json", import.meta.url),
        check: true,
      }),
    /pendiente/,
  );
  assert.throws(() => parseCSV("id,price\na,NaN"), /Número/);
  assert.throws(() => parseCSV("id,id\na,a"), /Encabezados/);
});
