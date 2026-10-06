import { readFile, writeFile, mkdir, cp } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const { build } = require(
  require.resolve("esbuild", {
    paths: [path.dirname(require.resolve("wrangler/package.json"))],
  }),
);
const online = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."),
  root = path.dirname(online);
const out = path.join(online, "public");
await mkdir(out, { recursive: true });
for (const name of ["src", "data", "assets"])
  await cp(path.join(root, name), path.join(out, name), { recursive: true });
for (const name of [
  "index.html",
  "style.css",
  "economy.css",
  "identity.css",
  "favicon.svg",
])
  await cp(path.join(root, name), path.join(out, name));
const read = (name) => readFile(path.join(root, name), "utf8");
let s = await read("src/app.js");
const cut = (start, end, replacement = "") => {
  const a = s.indexOf(start),
    b = s.indexOf(end, a);
  if (a < 0 || b < 0) throw Error("Build anchor missing: " + start);
  s = s.slice(0, a) + replacement + s.slice(b);
};
s =
  'import { registerPasskey, loginPasskey } from "./passkeys.js";\nimport { ApexAPI } from "./online-api.js";\nimport { API_BASE } from "./online-config.js";\n' +
  s;
s =
  'import { onlineEnrollmentPage, allocationCommand, updateAllocation, clearEnrollmentDraft } from "./online-enrollment-ui.js";\n' +
  s;
s = s.replaceAll("championshipPage(state)", "onlineEnrollmentPage(state)");
s = s.replace(
  "function render() {",
  "function render() {\n  selectOnlinePresentation();",
);
s = s.replace(
  "function refresh() {",
  "function refresh() {\n  selectOnlinePresentation();",
);
s = s.replace(
  'import { adminBar, ADMIN_ENABLED } from "./admin-ui.js";',
  'const ADMIN_ENABLED = false; const adminBar = () => "";',
);
cut(
  "try {\n  const raw = localStorage.getItem(SAVE_KEY);",
  "let lastWall = Date.now(),",
);
cut("function persist() {", "function draft(", "function persist() {}\n");
cut(
  "function onboarding() {",
  "function mapPanel()",
  "function onboarding() { return onlineOnboarding(); }\n",
);
cut(
  "function footer() {",
  "const adminRoot =",
  'function footer() {return `<footer><span>APEX1000 RALLY · ONLINE · Worker + D1</span><button data-action="help">Reglas</button></footer>`;}\n',
);
cut(
  "function runTime(command) {",
  "function download(",
  'function runTime() { throw Error("El reloj pertenece al servidor."); }\n',
);
cut(
  '  if (state && $("#identity-form")) {',
  "\n}\nfunction refresh()",
  "  bindOnlineForms();",
);
s = s.replaceAll("SINGLE PLAYER", "ONLINE");
s = s.replace(
  "Este plan ya está cerrado. Podés consultarlo y configurar una etapa futura.",
  "El plan está cerrado. Durante la etapa y la asistencia sólo podés consultarlo; cambiá la preparación al llegar al campamento.",
);
s = s.replace(
  /<h3>Tiempo del prototipo<\/h3><p>.*?<\/p>/,
  "<h3>Tiempo compartido</h3><p>El servidor mantiene el reloj real y procesa todas las escuderías aunque cierres el navegador. El visor consulta el estado cada 60 segundos. Los controles de aceleración están disponibles únicamente en la beta offline.</p>",
);
s = s.replace(
  /<h3>Online, más adelante<\/h3><p>.*?<\/p>/,
  "<h3>Competición online</h3><p>Hasta 20 directores comparten la sala con cinco escuderías BOT permanentes. Las compras, contratos, inscripciones y premios se resuelven en el servidor. El acceso utiliza una passkey de tu dispositivo o gestor de contraseñas.</p>",
);
s = s.replace(
  "En el prototipo puede acelerarse; el modo online futuro usará la fecha real del servidor.",
  "En esta versión coincide con la fecha real del servidor.",
);
s = s.replace(
  "home: () => homePage(state),",
  "home: () => homePage(state), rankings: rankingsPage,",
);
s = s.replace(
  "function racePage() {",
  "function racePage() {\n  if(state.competition.closed)return closedRaceHTML();",
);
s = s.replace(
  'if (ui.tab === "race") {\n    updateMap',
  'if (ui.tab === "race" && !state.competition.closed) {\n    updateMap',
);
s = s.replace(
  'if (state && ui.tab === "race") {',
  'if (state && ui.tab === "race" && !state.competition.closed) {',
);
s = s.replace(
  "clockBar() + content + footer()",
  "onlineBanner() + clockBar() + content + footer()",
);
s = s.replace(
  "header() + clockBar() + content + footer()",
  "header() + onlineBanner() + clockBar() + content + footer()",
);
cut(
  '$("#import-file").addEventListener(',
  "// One animation loop for both dashboard views;",
);
cut(
  'window.addEventListener("beforeunload",',
  "function teamReleaseDisabled()",
  `try {
  const response = await fetch(new URL("../assets/world.json", import.meta.url));
  if(!response.ok)throw Error("No se pudo cargar el mapa.");geo=await response.json();
  try {await loadOnline(true);pendingCommand=JSON.parse(sessionStorage.getItem(pendingKey())||'null');startPolling();}
  catch(e){if(e.status!==401)toast(e.message);state=null;publicData=await api.public().catch(()=>null);render();}
} catch(e) {document.querySelector('#app').innerHTML='<main><h1>No se pudo abrir el rally</h1><p>'+esc(e.message)+'</p></main>';}
\n`,
);
s = s.replace(
  "bindNavigation(document);",
  (await readFile(path.join(online, "client/controller.inc.js"), "utf8")) +
    "\nbindNavigation(document);",
);
s = s.replace(
  "t.service.until - state.clock",
  "(t.service?.until ?? state.clock) - state.clock",
);
s = s.replace(
  " · ${money(t.budget)} cr</small>",
  ' ${t.id === "player" ? "· " + money(t.budget) + " cr" : ""}</small>',
);
await writeFile(path.join(out, "src/app.js"), s);
await cp(
  path.join(online, "client/api-client.js"),
  path.join(out, "src/online-api.js"),
);
await cp(
  path.join(online, "client/enrollment-ui.js"),
  path.join(out, "src/online-enrollment-ui.js"),
);
await writeFile(
  path.join(out, "src/online-config.js"),
  `export const API_BASE = ${JSON.stringify(process.env.APEX_API_URL || "https://apex1000-online.emanuelmkt.workers.dev")};\n`,
);
let nav = await read("src/navigation.js");
nav = nav.replace(
  '["journal", "route", "Bitácora"],',
  '["journal", "route", "Bitácora"],\n      ["rankings", "flag", "Rankings y directores"],',
);
await writeFile(path.join(out, "src/navigation.js"), nav);
let market = await read("src/management-ui.js");
market = market.replace(
  "mejor ${money(best)} cr",
  'tu oferta ${own ? money(own.salary) + " cr" : "pendiente"}',
);
market = market.replace(
  "Mercado local con ofertas de rivales simulados. En la versión online, el servidor asignará cada contrato de forma exclusiva.",
  "Mercado compartido. Las ofertas rivales son privadas; el servidor adjudica cada contrato de forma exclusiva.",
);
await writeFile(path.join(out, "src/management-ui.js"), market);
let enrollment = await read("src/enrollment-ui.js");
enrollment = enrollment.replace(
  "<h2>${esc(e.name)}</h2><p>${num(route.totalKm)}",
  '<h2>${esc(e.name)}</h2><button class="button small ghost" data-action="view-event" data-id="${e.eventId}">Ver y preparar esta carrera</button><p>${num(route.totalKm)}',
);
await writeFile(path.join(out, "src/enrollment-ui.js"), enrollment);
let home = await read("src/home-independent-ui.js");
home = home.replace(
  '  const t = s.teams.find((t) => t.id === "player");\n  const past',
  '  const t = s.teams.find((t) => t.id === "player");\n  if(s.online) return {finishes:s.online.stats.finishes,stages:t.history.length,km:s.online.stats.km+(t.participating?t.totalKm:0)};\n  const past',
);
await writeFile(path.join(out, "src/home-independent-ui.js"), home);
await writeFile(
  path.join(out, "online.css"),
  `.online-toolbar{padding:12px 3%;display:flex;align-items:center;gap:18px;flex-wrap:wrap;background:#17242b;border-bottom:1px solid #35464f}.online-toolbar label{display:flex;gap:10px;align-items:center}.online-toolbar select{max-width:480px}.online-toolbar span{color:#b7c9cb;font-size:12px}.online-auth{display:grid;grid-template-columns:1fr 1fr;gap:24px;margin:32px 0}.online-auth .panel{padding:28px}.online-auth form{display:grid;gap:18px}.online-auth label{display:grid;gap:7px}.online-auth .shield-grid{max-height:300px;overflow:auto}.online-auth input{width:100%}.table-wrap{overflow:auto}table{width:100%;border-collapse:collapse}td,th{padding:14px;border-bottom:1px solid #34454a;text-align:left}@media(max-width:760px){.online-auth{grid-template-columns:1fr}.online-toolbar select{max-width:90vw}}`,
);
await writeFile(
  path.join(out, "online.css"),
  (await readFile(path.join(out, "online.css"), "utf8")) +
    `\n.race-allocation{display:grid;gap:16px;padding:20px 0}.race-allocation fieldset{border:1px solid #35464f;padding:14px;display:grid;gap:10px;border-radius:8px}.race-allocation legend{color:#e8c386;padding:0 8px}.race-allocation label{display:grid;gap:6px}.race-allocation select{width:100%;min-width:0}.race-allocation .allocation-choice{display:flex;align-items:center;gap:10px;cursor:pointer}.allocation-choice input{width:18px;height:18px;flex-shrink:0}.allocation-choice span{font-size:14px}.allocation-choice small{display:block;color:#8caaae}.enrollment-card details{margin:18px 0}.enrollment-card summary{cursor:pointer;color:#e8c386;padding:12px 0}.enrollment-card .full{margin-top:10px}\n`,
);
await writeFile(
  path.join(out, "online.css"),
  (await readFile(path.join(out, "online.css"), "utf8")) +
    `.enrollment-grid{grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}.enrollment-card{padding:24px}.race-allocation .allocation-choice{flex-direction:row;justify-content:flex-start;text-align:left}.assignment-summary{background:#101a1e;padding:14px;border-radius:8px;line-height:1.7;color:#b7c9cb}.assignment-summary strong{color:#e8c386}.race-allocation fieldset label{text-align:left}@media(max-width:850px){.enrollment-grid{grid-template-columns:1fr}}`,
);
await writeFile(
  path.join(out, "online.css"),
  (await readFile(path.join(out, "online.css"), "utf8")) +
    `.race-allocation .race-tuning{display:block;margin:16px 0}.race-tuning>span{display:flex;gap:6px;align-items:baseline}.race-tuning strong{margin-right:auto}.race-tuning output{color:#f5bc63;font-variant-numeric:tabular-nums}.race-tuning input[type=range]{width:100%;accent-color:#f5bc63;min-height:32px}.race-tuning small{display:flex;justify-content:space-between;gap:12px}.preparation-notice strong{color:#f5bc63}`,
);
let html = await readFile(
  path.join(online, "client/index.template.html"),
  "utf8",
);
html = html.replace(
  "<title>Apex1000 — World Raid</title>",
  "<title>Apex1000 Rally · Online</title>",
);
html = html
  .replace("</head>", '<link rel="stylesheet" href="./online.css" />\n</head>')
  .replace("./src/app.js", "./online-game.js");
await writeFile(path.join(out, "index.html"), html);
await build({
  entryPoints: [path.join(online, "client/passkey-client.js")],
  outfile: path.join(out, "src/passkeys.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
});
// The bundle lives at the site root; map geometry must resolve beside it.
s = s.replaceAll(
  'new URL("../assets/world.json", import.meta.url)',
  'new URL("./assets/world.json", import.meta.url)',
);
await writeFile(path.join(out, "src/app.js"), s);
await build({
  entryPoints: [path.join(out, "src/app.js")],
  outfile: path.join(out, "online-game.js"),
  bundle: true,
  format: "esm",
  platform: "browser",
  minify: true,
});
const bundleVersion = createHash("sha256")
  .update(await readFile(path.join(out, "online-game.js")))
  .digest("hex")
  .slice(0, 12);
await writeFile(
  path.join(out, "index.html"),
  html.replace(
    'src="./online-game.js"',
    `src="./online-game.js?v=${bundleVersion}"`,
  ),
);
console.log("Interfaz online generada en " + out);
