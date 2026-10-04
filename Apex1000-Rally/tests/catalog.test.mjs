import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { buildCatalog, parseCSV, sync } from "../scripts/sync-catalog.mjs";
test("CSV interpreta comillas, saltos de línea, números y disponibilidad", () => {
  const rows = parseCSV(
    'id,name,price,available\r\na,"Un nombre, con ""comillas""",1200,TRUE\r\nb,"Dos\nlíneas",500,FALSE\r\n',
  );
  assert.equal(rows[0].name, 'Un nombre, con "comillas"');
  assert.equal(rows[0].price, 1200);
  assert.equal(rows[1].available, false);
  assert.equal(rows[1].name, "Dos\nlíneas");
});
test("los siete CSV generan catálogo verificable y revisión estable", async () => {
  const read = (_, name) =>
    fs.readFile(new URL(`../catalogos/${name}.csv`, import.meta.url), "utf8");
  const a = await buildCatalog(read),
    b = await buildCatalog(read);
  assert.deepEqual(a, b);
  assert.equal(a.parts.length, 54);
  assert.equal(a.drivers.length, 6);
  assert.equal(a.mechanics.length, 8);
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
