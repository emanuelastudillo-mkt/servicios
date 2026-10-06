import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CATALOG } from "../data/catalog.js";
import { routeFor } from "../src/route.js";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const countries = {
  Argentina: "AR",
  Chile: "CL",
  Bolivia: "BO",
  Perú: "PE",
  Marruecos: "MA",
  Túnez: "TN",
  "Arabia Saudita": "SA",
  Omán: "OM",
  Namibia: "NA",
  Sudáfrica: "ZA",
  Kenia: "KE",
  España: "ES",
  Portugal: "PT",
  Italia: "IT",
  Finlandia: "FI",
  México: "MX",
  "Estados Unidos": "US",
  Australia: "AU",
  "Nueva Zelanda": "NZ",
};
const countryNames = {
  ...Object.fromEntries(Object.entries(countries).map(([k, v]) => [v, k])),
  KZ: "Kazajistán",
};
const terrainNames = {
  gravel: "Ripio",
  sand: "Arena",
  rock: "Roca",
  mountain: "Montaña",
  asphalt: "Asfalto",
};
const colors = {
  gravel: "#e6b169",
  sand: "#f79a50",
  rock: "#b9a1e5",
  mountain: "#77d0db",
  asphalt: "#c5d8ef",
};
const shortNames = {
  andes: "ANDES",
  sahara: "SAHARA",
  arabia: "DUNAS",
  australia: "OUTBACK",
  africa: "ÁFRICA",
  america: "AMÉRICA",
  iberia: "IBERIA",
  asia: "ESTEPAS",
};
const xml = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
await mkdir(path.join(root, "assets/races"), { recursive: true });
const meta = {};
for (const [index, r] of CATALOG.races.entries()) {
  const route = routeFor(r.id),
    city = route.cities[0],
    country = city.country || countries[r.region];
  if (!country || !countryNames[country])
    throw Error(`País de largada sin identificar: ${r.id}`);
  const sums = {};
  for (const stage of route.stages)
    for (const s of stage.segments) sums[s.type] = (sums[s.type] || 0) + s.km;
  const terrain = Object.entries(sums).sort((a, b) => b[1] - a[1])[0][0],
    color = colors[terrain];
  const label =
    shortNames[r.id] || city.name.toLocaleUpperCase("es-AR").slice(0, 8);
  const title = `${r.name} · Largada en ${countryNames[country]} · ${terrainNames[terrain]}`;
  let flag = await readFile(
    path.join(root, "assets/race-flags", country.toLowerCase() + ".svg"),
    "utf8",
  );
  if (/<script|<foreignObject|(?:href|src)=["'](?:https?:|data:)/i.test(flag))
    throw Error("Bandera con contenido externo");
  flag = flag.replace(/<svg\b/, '<svg x="42" y="95" width="44" height="33"');
  const shift = (index % 5) * 3,
    peak = 31 + shift;
  let land = "";
  if (terrain === "sand")
    land = `<circle cx="91" cy="43" r="9" fill="${color}" opacity=".9"/><path d="M18 69Q${48 + shift} ${36 + shift} 76 67T110 62V92H18Z" fill="${color}" opacity=".35"/><path d="M18 81Q${58 - shift} 57 90 77L110 70V93H18Z" fill="${color}"/><path d="M22 78Q47 62 72 76" fill="none" stroke="#fff5df" stroke-width="2"/>`;
  if (terrain === "mountain")
    land = `<path d="M15 85L${peak} 48L53 72L77 ${35 + shift}L115 85Z" fill="${color}" opacity=".36"/><path d="M24 87L${49 + shift} ${43 + shift}L91 87Z" fill="${color}"/><path d="M${49 + shift} ${43 + shift}L${40 + shift} 61L${48 + shift} 57L${57 + shift} 63Z" fill="#f5f7ec"/><path d="M77 ${35 + shift}L67 54L77 50L89 59" fill="none" stroke="#e4f9fb" stroke-width="2"/>`;
  if (terrain === "rock")
    land = `<path d="M15 84L${28 + shift} 54L46 61L62 ${38 + shift}L86 46L113 86Z" fill="${color}" opacity=".4"/><path d="M23 89L34 65L54 59L68 77L61 91Z" fill="${color}"/><path d="M68 91L77 58L97 64L108 87Z" fill="${color}" opacity=".7"/><path d="M34 65L44 79L54 59M77 58L88 77L97 64" fill="none" stroke="#f8efff" stroke-width="2"/>`;
  if (terrain === "gravel")
    land = `<path d="M16 65L${peak} 47L51 59L78 ${40 + shift}L113 65" fill="none" stroke="${color}" opacity=".5" stroke-width="3"/><path d="M22 89L${48 + shift} 57H${65 + shift}L101 89Z" fill="${color}" opacity=".28"/>${Array.from({ length: 9 }, (_, i) => `<path d="M${26 + ((i * 17 + shift) % 73)} ${70 + (i % 4) * 6}l4 -2l3 4l-5 1Z" fill="${color}"/>`).join("")}`;
  if (terrain === "asphalt")
    land = `<path d="M28 91L50 42H72L105 91Z" fill="${color}" opacity=".4"/><path d="M48 91L60 42M90 91L69 42" stroke="#eaf3ff" stroke-width="2"/><path d="M67 83L65 73M64 66L62 56M61 50L60 43" stroke="${color}" stroke-width="3"/>`;
  const track = `M${24 + (index % 4) * 2} 85C${40 + shift} 83 ${82 - shift} 89 84 75S${52 + shift} 64 70 56`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 144" role="img" aria-labelledby="title"><title id="title">${xml(title)}</title><defs><linearGradient id="metal" x2=".9" y2="1"><stop stop-color="#f2e6cb"/><stop offset=".27" stop-color="#657681"/><stop offset=".56" stop-color="#e6eaf0"/><stop offset="1" stop-color="#596774"/></linearGradient><linearGradient id="face" x2="0" y2="1"><stop stop-color="#253139"/><stop offset="1" stop-color="#0b1219"/></linearGradient><clipPath id="face-clip"><path d="M8 18L64 4L120 18V102Q111 126 64 139Q17 126 8 102Z"/></clipPath></defs><path d="M8 18L64 4L120 18V102Q111 126 64 139Q17 126 8 102Z" fill="url(#face)" stroke="url(#metal)" stroke-width="4"/><path d="M14 23L64 11L114 23V100Q101 121 64 132Q27 121 14 100Z" fill="none" stroke="${color}" opacity=".75"/><g clip-path="url(#face-clip)"><path d="M9 33H119" stroke="${color}" opacity=".35"/>${land}<path d="${track}" fill="none" stroke="#0b1219" stroke-width="5"/><path d="${track}" fill="none" stroke="#f5f1df" stroke-width="2.5" stroke-linecap="round"/><circle cx="70" cy="56" r="3" fill="${color}"/><rect x="40" y="93" width="48" height="37" rx="3" fill="#080d12" stroke="url(#metal)" stroke-width="1.5"/>${flag}</g><text x="64" y="27" text-anchor="middle" fill="#f3f0e7" font-family="Arial,sans-serif" font-size="10" font-weight="800" letter-spacing="1">${xml(label)}</text><path d="M19 104l9 10M109 104l-9 10" stroke="${color}" stroke-width="2"/></svg>\n`;
  await writeFile(path.join(root, "assets/races", r.id + ".svg"), svg);
  meta[r.id] = {
    country,
    countryName: countryNames[country],
    startCity: city.name,
    terrain,
    terrainName: terrainNames[terrain],
    name: r.name,
  };
}
await writeFile(
  path.join(root, "data/race-logos.js"),
  `// Generated by scripts/build-race-logos.mjs from actual start cities and terrain kilometres.\nexport const RACE_LOGOS = ${JSON.stringify(meta, null, 2)};\n`,
);
await writeFile(
  path.join(root, "assets/races/README.md"),
  `# Logos de carreras\n\n${Object.keys(meta).length} emblemas originales SVG, 128 × 144, con entorno predominante calculado por kilómetros y bandera del país de largada. El trazado pequeño es decorativo, no un mapa.\n\nBanderas: flag-icons 7.3.2, https://github.com/lipis/flag-icons, MIT. Fuentes y licencia en ../race-flags/. No se descargan banderas durante el juego.\n\nRegenerar: node scripts/build-race-logos.mjs. No modifica premios, distancias, calendario, Sheets ni simulación.\n`,
);
console.log(`${Object.keys(meta).length} logos generados.`);
