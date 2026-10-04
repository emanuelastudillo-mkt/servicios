import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

// Compare both files: the browser imports catalog.js, while JSON is the audit copy.
export async function checkPublished({
  baseUrl,
  json,
  module,
  fetchImpl = fetch,
}) {
  const base = new URL(baseUrl);
  if (
    !["http:", "https:"].includes(base.protocol) ||
    base.username ||
    base.password
  )
    throw Error("Dirección pública del juego inválida.");
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const clean = (s) => s.replace(/\r\n/g, "\n").trim();
  const checks = await Promise.all(
    [
      ["catalog.json", json],
      ["catalog.js", module],
    ].map(async ([name, expected]) => {
      const url = new URL(`data/${name}`, base);
      url.searchParams.set("catalog_check", Date.now().toString());
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(20000),
        cache: "no-store",
      });
      if (!response.ok) return `${name}: HTTP ${response.status}`;
      const text = await response.text();
      return text.length <= 2000000 && clean(text) === clean(expected)
        ? null
        : `${name}: versión publicada diferente`;
    }),
  );
  return {
    ok: checks.every((x) => x === null),
    detail: checks.filter(Boolean).join("; "),
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  const value = (flag) => process.argv[process.argv.indexOf(flag) + 1];
  const baseUrl = process.argv.includes("--url")
    ? value("--url")
    : process.env.APEX_PUBLIC_URL;
  const attempts = process.argv.includes("--attempts")
    ? Number(value("--attempts"))
    : 1;
  try {
    if (
      !baseUrl ||
      !Number.isInteger(attempts) ||
      attempts < 1 ||
      attempts > 30
    )
      throw Error("Indicá --url y entre 1 y 30 intentos.");
    const [json, module] = await Promise.all([
      fs.readFile("data/catalog.json", "utf8"),
      fs.readFile("data/catalog.js", "utf8"),
    ]);
    for (let i = 0; i < attempts; i++) {
      let result;
      try {
        result = await checkPublished({ baseUrl, json, module });
      } catch (error) {
        result = { ok: false, detail: error.message };
      }
      if (result.ok) {
        console.log(
          `Catálogo publicado y verificado: ${JSON.parse(json).revision}`,
        );
        process.exit(0);
      }
      console.log(`Comprobación ${i + 1}/${attempts}: ${result.detail}`);
      if (i + 1 < attempts)
        await new Promise((resolve) => setTimeout(resolve, 20000));
    }
    throw Error(
      "La publicación no coincide todavía. El próximo chequeo diario volverá a intentar publicar.",
    );
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
