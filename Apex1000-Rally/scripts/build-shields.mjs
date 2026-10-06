import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const dir = fileURLToPath(new URL("../assets/shields/", import.meta.url));
// Each mark has its own silhouette. These are original illustrations, not brand reproductions.
const marks = [
  [
    "Cóndor",
    "M50 64 38 49 10 39 14 55 32 59 23 64 40 64 50 80 60 64 77 64 68 59 86 55 90 39 62 49Z M42 40 50 30 60 33 55 40 61 43 50 49Z",
  ],
  [
    "Halcón",
    "M16 65 39 43 31 26 56 33 72 25 86 31 72 42 77 55 58 58 43 75 47 57 30 70Z M58 39 65 36 64 42Z",
  ],
  [
    "Águila",
    "M49 27 59 29 55 38 70 44 90 29 84 51 65 60 61 76 50 69 39 76 35 60 16 51 10 29 30 44 45 38Z M46 50 54 50 50 60Z",
  ],
  [
    "Colibrí",
    "M12 31 42 45 50 26 59 38 86 36 67 47 76 59 60 56 53 70 35 77 44 61 29 50Z",
  ],
  [
    "Lobo",
    "M25 24 41 36 50 30 59 36 75 24 72 53 63 64 50 79 37 64 28 53Z M35 46 46 50 39 55Z M65 46 54 50 61 55Z M44 63H56L50 70Z",
  ],
  [
    "Zorro",
    "M22 25 42 38 51 32 62 39 81 27 71 56 50 78 30 60Z M30 45 46 53 49 67 37 57Z M70 45 54 53 51 67 63 57Z",
  ],
  [
    "Puma",
    "M29 35 33 25 44 33 65 31 77 42 68 49 74 59 59 68 45 76 40 64 25 57 21 45Z M35 44 47 43 43 51Z M57 47 64 45 61 52Z M46 61 61 58 54 66Z",
  ],
  [
    "Pantera",
    "M24 29 38 32 50 27 62 32 76 29 75 57 62 71 50 78 38 71 25 57Z M32 46 46 49 39 55Z M68 46 54 49 61 55Z M40 63 50 59 60 63 50 70Z",
  ],
  [
    "Toro",
    "M16 26 22 43 39 44 44 34 56 34 61 44 78 43 84 26 89 47 75 56 64 54 61 72 50 81 39 72 36 54 25 56 11 47Z M41 60 50 65 59 60 56 71 44 71Z",
  ],
  [
    "Carnero",
    "M29 31C6 22 5 61 29 64L38 56 36 45 26 42 21 49 25 53 19 53C14 45 21 34 31 40L40 47 40 66 50 78 60 66 60 47 69 40C79 34 86 45 81 53L75 53 79 49 74 42 64 45 62 56 71 64C95 61 94 22 71 31L59 37 50 32 41 37Z",
  ],
  [
    "Bisonte",
    "M24 37 18 27 34 33 39 27 61 27 66 33 82 27 76 37 81 48 70 56 65 72 50 78 35 72 30 56 19 48Z M34 43 44 46 38 52Z M66 43 56 46 62 52Z M42 63H58V69H42Z",
  ],
  [
    "Ciervo",
    "M50 47 43 39 36 40 30 31 20 34 18 23 26 27 30 17 33 31 39 28 40 37 47 40 50 35 53 40 60 37 61 28 67 31 70 17 74 27 82 23 80 34 70 31 64 40 57 39Z M37 47 50 43 63 47 60 64 50 78 40 64Z M45 59H55L50 67Z",
  ],
  [
    "Cumbre",
    "M13 70 34 31 48 49 61 24 89 70Z M27 47 34 35 41 47 34 43Z M53 43 61 29 69 43 62 39Z M22 73H78V78H22Z",
  ],
  [
    "Volcán",
    "M19 73 38 42H62L81 73Z M35 67 43 48H57L65 67 51 61Z M43 35 39 24 46 29 50 17 55 29 62 24 57 35Z M14 80H86V84H14Z",
  ],
  [
    "Dunas",
    "M12 53Q33 29 55 52T88 50V58Q72 68 51 58T12 63Z M12 67Q32 45 54 66T88 64V75H12Z M60 26A8 8 0 1 0 76 26 8 8 0 1 0 60 26Z",
  ],
  [
    "Glaciar",
    "M21 58 31 31 42 44 50 18 67 39 74 30 83 58 67 80H34Z M34 50 41 60 47 31 52 60 65 49 60 73H40Z",
  ],
  [
    "Norte",
    "M50 17 58 42 83 50 58 58 50 83 42 58 17 50 42 42Z M50 28V50H71L54 54 50 72V50H29L46 46Z",
  ],
  [
    "Rumbo",
    "M25 32Q48 14 72 34L65 40Q47 24 31 39Z M72 67Q48 87 25 68L32 61Q48 75 66 60Z M31 62 42 39 69 27 57 56Z M45 45 43 53 52 51 57 40Z",
  ],
  [
    "Órbita",
    "M15 53C15 29 81 21 87 40C93 59 27 76 15 53Z M22 51C28 63 78 51 81 41C70 28 23 38 22 51Z M40 33A17 17 0 0 0 62 67L66 58 61 37Z M72 27H79V34H72Z",
  ],
  [
    "Horizonte",
    "M23 54A27 27 0 0 1 77 54H68A18 18 0 0 0 32 54Z M12 58H88V64H12Z M24 70H76V75H24Z M39 80H61V85H39Z M47 15H53V25H47Z M18 31 23 26 30 34 25 39Z M82 31 77 26 70 34 75 39Z",
  ],
  ["Rayo", "M52 19H74L58 41H76L34 83 42 55H24Z"],
  [
    "Trueno",
    "M36 21H51L38 46H49L24 79 30 54H17Z M68 21H83L70 46H81L56 79 62 54H49Z",
  ],
  [
    "Centella",
    "M13 45 43 38 53 20 58 38 88 43 62 53 57 80 46 59 20 69 36 50Z M47 45 54 43 57 49 50 54 44 51Z",
  ],
  [
    "Vórtice",
    "M51 19C83 20 94 51 76 72C60 90 31 85 21 65C10 41 31 25 49 31C68 36 72 60 56 66C43 71 32 54 43 47L50 53C48 62 62 57 60 48C56 33 32 37 29 54C26 77 58 87 73 66C88 45 67 23 48 27Z",
  ],
  ["Titán", "M21 26H79V38H57V76H43V38H21Z M29 43H35V69H29Z M65 43H71V69H65Z"],
  [
    "Atlas",
    "M50 19 83 77H66L59 64H41L34 77H17Z M50 38 42 53H58Z M45 71H55V81H45Z",
  ],
  [
    "Nómada",
    "M24 76V25H38L62 54V25H76V76H63L38 46V76Z M14 35H19V67H14Z M81 35H86V67H81Z",
  ],
  ["Élite", "M24 25H77L68 38H40V45H68L61 58H40V65H77L68 78H24Z"],
  [
    "Fénix",
    "M50 73 37 57 16 59 27 45 14 32 40 40 50 23 60 40 86 32 73 45 84 59 63 57Z M42 45 50 37 58 45 53 61 50 69 47 61Z",
  ],
  [
    "Brasa",
    "M50 17C59 36 66 29 64 44C81 39 84 63 68 75C41 95 16 66 33 45C30 61 42 60 42 49C41 37 47 31 50 17Z M50 53C35 67 49 80 57 69C64 61 55 64 50 53Z",
  ],
  [
    "Ícaro",
    "M43 49 14 25 18 46 39 58 31 63 15 53 22 67 43 73 50 62 57 73 78 67 85 53 69 63 61 58 82 46 86 25 57 49Z M41 33A9 9 0 1 0 59 33 9 9 0 1 0 41 33Z",
  ],
  [
    "Solar",
    "M50 24 58 37 73 34 70 49 83 57 68 63 69 79 54 74 44 86 38 70 21 70 28 55 16 44 33 40 35 24 45 32Z M38 53A13 13 0 1 0 64 53 13 13 0 1 0 38 53Z",
  ],
  [
    "Bastión",
    "M24 72V38H33V25H43V38H57V25H67V38H76V72L50 83Z M43 73H57V54H43Z M22 20H33V28H22Z M67 20H78V28H67Z",
  ],
  [
    "Forja",
    "M17 32H83V44L66 53H55V64H67V76H33V64H45V53H33L17 44Z M29 26H71V30H29Z",
  ],
  [
    "Escorpión",
    "M34 49 25 42 15 49 17 31 31 38 38 34 45 45 58 45 66 56 62 68 45 73 33 64Z M61 38C83 42 88 24 71 20L72 28C81 33 74 37 65 32L59 25 54 36Z M27 58 19 65 24 70 33 65Z M72 59 82 66 77 71 68 66Z",
  ],
  [
    "Cobra",
    "M29 35Q50 8 71 35L75 53 60 60 58 74 42 74 40 60 25 53Z M37 40 48 44 43 49Z M63 40 52 44 57 49Z M46 55H54V63H46Z M47 74V82L50 78 53 82V74Z",
  ],
  [
    "Tridente",
    "M46 25H54V50H64V32L60 36V21L74 32V53L66 60H54V79H46V60H34L26 53V32L40 21V36L36 32V50H46Z",
  ],
  ["Vértice", "M50 20 85 77H15Z M50 36 29 70H71Z M50 50 61 67H39Z"],
  ["Delta", "M50 18 81 72H66L50 44 35 69H58L65 81H14Z"],
  [
    "Cobalto",
    "M50 18 78 34V66L50 82 22 66V34Z M50 29 68 40V60L50 71 32 60V40Z M50 39 59 45V55L50 61 41 55V45Z",
  ],
  [
    "Ónix",
    "M50 20 79 37V67L50 83 21 67V37Z M28 41 46 51V73L28 62Z M54 51 72 41V62L54 73Z M32 37 50 27 68 37 50 47Z",
  ],
  [
    "Prisma",
    "M50 18 79 38 70 70 50 82 30 70 21 38Z M50 30 39 42 50 65 61 42Z M29 40 34 61 44 73 35 44Z M71 40 66 61 56 73 65 44Z",
  ],
  [
    "Áurea",
    "M50 21Q72 21 62 43Q83 32 83 51Q83 73 60 62Q73 84 51 84Q29 84 39 63Q17 74 17 52Q17 30 39 41Q28 21 50 21Z M50 33 46 47 32 52 46 57 51 72 56 57 71 52 56 47Z",
  ],
  [
    "Impulso",
    "M20 36Q57 13 83 34L68 34Q45 24 27 43Z M17 48Q50 27 81 43L75 52Q48 38 18 57Z M18 65Q52 43 78 57L69 69Q51 57 18 74Z",
  ],
  [
    "Turbina",
    "M50 45 46 20Q68 17 73 35L57 43Z M56 49 76 28Q89 45 79 60L62 52Z M54 55 82 64Q73 83 54 80L55 61Z M46 55 50 83Q29 86 25 66L41 59Z M44 49 22 71Q8 54 21 38L39 47Z M46 43 19 34Q29 15 45 20L44 39Z",
  ],
  [
    "Pistón",
    "M32 23H68V44H57V53L65 66 59 81H41L35 66 43 53V44H32Z M36 30H64V35H36Z M46 61A7 7 0 1 0 60 61 7 7 0 1 0 46 61Z",
  ],
  [
    "Coraza",
    "M24 26 50 17 76 26 72 60 50 83 28 60Z M34 36 46 40V63L36 53Z M66 36 54 40V63L64 53Z M43 27H57V32H43Z M45 69H55L50 75Z",
  ],
  [
    "Centinela",
    "M27 43Q28 20 50 20Q72 20 73 43V65L50 81 27 65Z M35 42H65V49H35Z M35 56H43V66L35 62Z M57 56H65V62L57 66Z M47 55H53V73H47Z",
  ],
];
const plates = [
  "M50 7 84 19V50Q83 73 50 91Q17 73 16 50V19Z",
  "M50 7 87 28V72L50 93 13 72V28Z",
  "M50 8C76 8 94 25 94 50C94 75 76 92 50 92C24 92 6 75 6 50C6 25 24 8 50 8Z",
  "M50 12C76 12 94 24 94 50S76 88 50 88S6 76 6 50S24 12 50 12Z",
  "M18 11H82L89 21V72L50 92 11 72V21Z",
  "M50 8 93 50 50 92 7 50Z",
];
const palettes = [
  ["#c74636", "#40131b"],
  ["#2679ab", "#102b4d"],
  ["#328f79", "#0e332c"],
  ["#d6aa54", "#46351a"],
  ["#735fa6", "#271d42"],
  ["#b7bfc9", "#303b47"],
  ["#cb6b2d", "#4e2513"],
  ["#359cac", "#103a40"],
];
await mkdir(dir, { recursive: true });
const catalog = [];
for (let i = 0; i < marks.length; i++) {
  const [name, d] = marks[i],
    id = i + 1,
    slug = String(id).padStart(2, "0"),
    [light, dark] = palettes[i % palettes.length],
    plate = plates[Math.floor(i / 8)];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="${name}"><title>${name} · Apex1000</title><defs><linearGradient id="chrome" x1=".1" y1="0" x2=".85" y2="1"><stop stop-color="#f6f8fc"/><stop offset=".18" stop-color="#9ba7b3"/><stop offset=".38" stop-color="#fff"/><stop offset=".49" stop-color="#b9c5d2"/><stop offset=".52" stop-color="#485669"/><stop offset=".7" stop-color="#b4c1d0"/><stop offset="1" stop-color="#eef3fa"/></linearGradient><linearGradient id="enamel" x2=".7" y2="1"><stop stop-color="${light}"/><stop offset=".46" stop-color="${dark}"/><stop offset="1" stop-color="#0a111b"/></linearGradient><linearGradient id="shine" x2="0" y2="1"><stop stop-color="#fff" stop-opacity=".3"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><clipPath id="plate"><path d="${plate}"/></clipPath></defs><path d="${plate}" transform="translate(0 1.5)" fill="#050a11" stroke="#050a11" stroke-width="3"/><path d="${plate}" fill="url(#enamel)" stroke="url(#chrome)" stroke-width="4"/><path d="${plate}" transform="translate(5 5) scale(.9)" fill="none" stroke="#d6e7fa" stroke-opacity=".35" stroke-width=".8"/><path d="M3 8H97V32Q48 51 3 40Z" fill="url(#shine)" clip-path="url(#plate)"/><path d="${d}" transform="translate(0 1.1)" fill="#01050a" fill-rule="evenodd" stroke="#050a10" stroke-width="1.2"/><path d="${d}" fill="url(#chrome)" fill-rule="evenodd" stroke="#edf4ff" stroke-opacity=".65" stroke-width=".55" stroke-linejoin="round"/></svg>\n`;
  await writeFile(`${dir}${slug}.svg`, svg);
  catalog.push({ id, name, file: `assets/shields/${slug}.svg` });
}
await writeFile(
  new URL("../src/shields.js", import.meta.url),
  `// Original vector emblems, authored in scripts/build-shields.mjs.\nexport const SHIELDS = Object.freeze(${JSON.stringify(catalog, null, 2)}.map(Object.freeze));\nexport const SHIELD_COUNT = SHIELDS.length;\nexport const shieldInfo = (id = 1) => SHIELDS.find(s => s.id === Number(id)) || SHIELDS[0];\nexport function shieldSVG(id = 1) {\n const s = shieldInfo(id);\n return \`<svg xmlns="http://www.w3.org/2000/svg" class="team-shield" viewBox="0 0 100 100" role="img" aria-label="Escudo \${s.id} · \${s.name}"><title>\${s.name}</title><image href="\${s.file}" width="100" height="100"/></svg>\`;\n}\n`,
);
await writeFile(
  `${dir}README.md`,
  "# 48 escudos originales\n\nIlustraciones SVG originales de Apex1000, inspiradas en materiales cromados, esmaltes y formas de emblemas automotrices. Cada símbolo tiene un trazado propio; no son logotipos de fabricantes. Tamaño escalable, fondo transparente. Fuente reproducible: `scripts/build-shields.mjs`. IDs estables del 1 al 48.\n",
);
await writeFile(
  `${dir}galeria.html`,
  `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Apex1000 · 48 escudos</title><style>*{box-sizing:border-box}body{margin:0;padding:36px;background:#0d141c;color:#e3eaf1;font-family:system-ui}h1{font-size:26px;margin:0}p{color:#9aaec2;margin-bottom:28px}.grid{display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:14px}.card{margin:0;text-align:center;background:linear-gradient(145deg,#1c2a39,#121d28);border:1px solid #34495e;border-radius:14px;padding:14px 8px}.card img{width:100%;max-width:116px;aspect-ratio:1}.card figcaption{font-size:13px;margin:8px 0 2px}.card small{color:#8199af;font-size:10px}@media(max-width:800px){.grid{grid-template-columns:repeat(4,1fr)}body{padding:18px}}</style><h1>APEX1000 · 48 escudos originales</h1><p>Cromo y esmalte · elegí la identidad de tu escudería</p><div class="grid">${catalog.map((s) => `<figure class="card"><img src="${String(s.id).padStart(2, "0")}.svg" alt="${s.name}"><figcaption>${s.name}</figcaption><small>${String(s.id).padStart(2, "0")}</small></figure>`).join("")}</div></html>`,
);
console.log(`Created ${catalog.length} original SVG emblems.`);
