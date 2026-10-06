import { mkdir, readFile, writeFile } from "node:fs/promises";
import { CATALOG } from "../data/catalog.js";
import { routeFor, setActiveRoute } from "../src/route.js";
import { project } from "../src/visuals.js";
import { RACE_LOGOS } from "../data/race-logos.js";

// Artistic geographic settings, not satellite survey data. Route coordinates
// remain those used by the simulation and are never adjusted to fit the art.
const settings = {
  andes:
    "South America: elongated Andes along the western third, Patagonia gravel plains in the south, green Pampas southeast, Mendoza dry foothills central west, northern Altiplano salt flats and Atacama ochres. Passes and broad valleys within mountains; sparse snow only on summits. Pacific sliver at far west, Atlantic sliver at far east only if clear of the corridors.",
  sahara:
    "Morocco to Senegal: northern Atlas mountains and olive agricultural valleys, dry stone plateaus transitioning south into immense Sahara dunes, Atlantic coastal desert along western edge, semi-arid Sahel scrub in far south. Ocean only in far western margin; all marked city anchors on dry land.",
  arabia:
    "Saudi Arabia: Red Sea coastal plain along far west, rugged western Hijaz and Asir ridges, ochre central plateau, large pale sand ergs in east and southeast, black basalt and dry wadis in north. Western mountain valleys provide traversable passages. Sea confined to far left edge.",
  australia:
    "Continental Australia: western ochre outback, red central interior with dry basins and ancient ranges, tropical sparse woodland north, greener Great Dividing Range on eastern side, temperate southern agricultural plains. A continent-scale painted atlas, coastline outside the route anchors, not a single desert.",
  africa:
    "Southern Africa: Cape folded mountains and cultivated south, Namib coastal dune desert northwest, gravel plateaus in western interior, Kalahari sand and scrub centrally, Okavango green mosaic in north centre, savanna with sparse baobabs northeast. Keep marked corridors dry; Atlantic restricted to far west.",
  america:
    "Southwestern USA and northern Mexico: Californian coastal ranges in far west, Sonoran and Chihuahuan deserts south, Mojave and layered sandstone west-central, Colorado high ranges northeast, Utah salt and rock basins northwest. Strong warm desert versus cool mountain contrast, wide connected valleys.",
  iberia:
    "Iberian peninsula: greener Atlantic west and northern foothills, dry olive groves and rolling plains south, central plateau, folded sierras, southeastern rocky semi-desert, agricultural river valleys. Coastal water restricted to far outer margins, never crossing city anchors.",
  asia: "Kazakhstan and Kyrgyzstan: vast muted green and straw-coloured steppe across north, western arid plateau near Caspian, central dry basins, Altai rugged northeast, snowy Tian Shan ranges along southeast with broad foothill corridors. Continental atlas scale with mountains and extensive plains.",
  "sprint-salta":
    "Argentina Calchaqui valleys: reddish Quebrada de las Conchas canyon and folded rock ridges, broad gravel riverbed corridors, dark green scrub near Salta at upper right, arid vineyards and ochre valley near Cafayate lower left. No ocean or lakes.",
  "sprint-mendoza":
    "Argentina Mendoza to Uspallata: cultivated green urban foothill plain lower right, Andes rocky ranges and wide gravel mountain passes upper left, pale arid valley floors, isolated high snowy summits outside corridor. No ocean.",
  "sprint-atacama":
    "Chile Copiapo to Caldera: barren Atacama coastal desert, pale sand sheets, rust rocky hills, dry alluvial fans and narrow valley. Pacific blue sliver only at extreme upper-left boundary, Caldera anchor stays inland on sandy coastal terrace.",
  "sprint-cordoba":
    "Argentina Cordoba sierras: green eastern slopes upper right, stony highland pampas and granite ridges centre, dry western valley lower left. Traversable mountain passes, small rural patches and rocky streambeds. No ocean.",
  "sprint-uyuni":
    "Bolivia Uyuni to Colchani: enormous ivory salt flat mainly west and centre, subtle polygonal salt texture, sandy brown shore along eastern side, small scrub islands and distant arid mountains at margins. Both anchors and corridor on solid salt or dry shore, no standing water.",
  "sprint-nazca":
    "Peru Nazca to Ica: warm coastal desert, sweeping pale dunes, bare stony pampas, cultivated green oasis valleys near endpoints, foothills east. No Nazca glyphs or giant drawings. No ocean within corridor.",
  "sprint-merzouga":
    "Morocco Erfoud to Merzouga: rocky desert hamada and palm oasis at upper left, tall warm golden Erg Chebbi dunes towards lower right, gravel flats and natural dune corridors. No ocean, snow or water.",
  "sprint-agadir":
    "Morocco Souss valley: Atlantic coast only extreme left, Agadir on land left-centre, Taroudant right-centre, wide dry gravel valley with cultivated orchards and palm groves, High Atlas foothills north, Anti-Atlas south.",
  "sprint-tozeur":
    "Tunisia Tozeur to Douz: green palm oasis near upper-left anchor, white and pale pink dry Chott el Djerid salt crust centre, golden Sahara dunes toward lower right, warm arid foothills at margins. Dry salt, no open lake.",
  "sprint-tabuk":
    "Saudi Tabuk to Duba: northern rocky sandstone plateau at upper right, dramatic rust-coloured dissected mountain ridges centre, broad descending wadis to dry Red Sea coastal terrace lower left. Water only extreme lower-left corner outside destination anchor.",
  "sprint-alula":
    "Saudi AlUla to Khaybar: sculpted orange sandstone mesas upper left, green narrow oasis patches, tawny gravel valleys centre, dark basalt lava fields and ancient volcanic cones lower right. Connected passable dry valley corridor.",
  "sprint-oman":
    "Oman Nizwa to Bahla: pale jagged Hajar foothills north, gravel alluvial fans, date-palm oases and small beige settlements across a broad arid east-west valley. Rocky mountain backdrop, no dunes covering every surface or ocean.",
  "sprint-namib":
    "Namibia Walvis Bay to Swakopmund: cold blue Atlantic only far western 0-25 percent, immense warm Namib dunes east, flat pale coastal gravel strip through the two middle anchors. Walvis Bay lagoon only far southwest outside corridor. Both anchors on dry land.",
  "sprint-cape":
    "South Africa Ceres to Worcester: Cape folded sandstone ranges, wide agricultural valleys with patchwork orchards and vineyards, dry pale gravel passes linking northern and southern anchors, green-grey vegetation and ochre bare ridges. No ocean.",
  "sprint-naivasha":
    "Kenya Rift Valley: muted green acacia savanna, volcanic hills and agricultural mosaics, dusty gravel plains, Naivasha southeast and Nakuru northwest. Small blue lake areas only at far margins well outside travel corridor. No tropical rainforest blanket.",
  "sprint-bardenas":
    "Spain Bardenas Reales: buff clay badlands, eroded mesas, pale gravel gullies, dry scrub and muted olive agricultural fields at edges. Broad arid east-west basin, layered earth ochres, no ocean or alpine snow.",
  "sprint-almeria":
    "Spain Almeria to Tabernas: arid coastal terrace south, heavily dissected ochre Tabernas badlands north, dry wadis and gravel fans, sparse Mediterranean scrub, rock ridges flanking central north-south corridor. Sea only at extreme bottom edge.",
  "sprint-algarve":
    "Portugal Loule to Tavira: Mediterranean rolling hills, cork and olive groves, orange orchards and rural patchwork, dry gravel tracks through valleys. Blue Atlantic only far southern margin, inland east-west corridor on solid land.",
  "sprint-sardinia":
    "Italy northeastern Sardinia: Mediterranean olive-green maquis, rugged granite hills and boulders, pale dry valleys, small agricultural clearings. Olbia northeast and Ala dei Sardi southwest. Tiny coastal sea only far upper-right edge outside endpoint.",
  "sprint-finland":
    "Finland Jyvaskyla to Jamsa: dense dark conifer and birch woodland, rounded glacial rocky hills, blue lakes with complex shores and small fields. Keep continuous dry diagonal corridor northeast to southwest through forested land; lakes never block corridor.",
  "sprint-baja":
    "Mexico northern Baja California: Pacific coastal terrace at upper left, rugged dry peninsula spine centre with traversable mountain pass, cactus-dotted gravel fans and dunes toward lower-right Gulf coast. Water only extreme upper-left and lower-right corners outside anchors.",
  "sprint-moab":
    "USA Utah Moab to Green River: spectacular red-orange sandstone mesas, layered canyon walls, pale desert gravel basins, dry washes and scant sagebrush, connected valleys southeast to northwest. Any tiny river well outside route corridor; no ocean.",
  "sprint-outback":
    "Australia Alice Springs to Hermannsburg: red central Australian soil, parallel dark MacDonnell rock ridges, broad dry sandy riverbeds and gravel valley floors, scattered spinifex sage-green scrub. East-west connected dry corridor, no ocean or forest.",
  "sprint-wanaka":
    "New Zealand Central Otago: cool-grey mountains and tussock slopes, dry gold valleys and vineyards, green valley floors, Wanaka north and Cromwell south. Blue lake slivers only at outer west/east margins, keep entire north-south corridor on dry valley land.",
};

await mkdir("docs/mapas/prompts", { recursive: true });
let produced = [];
try {
  produced = JSON.parse(await readFile("docs/mapas/activos.json", "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const brief = [];
for (const race of CATALOG.races) {
  if (!settings[race.id])
    throw Error(`Falta dirección artística para ${race.id}`);
  const route = routeFor(race.id);
  setActiveRoute(race.id);
  const pc = ([lon, lat]) =>
    project(lon, lat).map((n, i) => +(n / (i ? 9.5 : 10)).toFixed(1));
  const anchors = route.cities.map((c) => ({
    name: c.name,
    xyPercent: pc([c.lon, c.lat]),
  }));
  const corridors = route.stages.map((s) => ({
    stage: s.index + 1,
    km: s.km,
    surface: s.segments.map((x) => x.type),
    xyPercent: [
      s.path[0],
      s.path[Math.floor(s.path.length / 2)],
      s.path.at(-1),
    ].map(pc),
  }));
  const prompt = `Create ONE original premium illustrated satellite terrain map for the rally game Apex1000: ${race.name}. Host/start country: ${RACE_LOGOS[race.id].countryName}.\nUse case: stylized-concept. The result is a finished full-bleed terrain-only raster background, painterly satellite cartography with extremely detailed believable shaded relief, not a screenshot, UI, collage or globe. North up, strictly vertical orthographic view, no horizon or perspective.\nCanvas aspect ratio EXACTLY 1000:950 (approximately square, slightly wider), requested resolution 3072 x 2918 pixels or highest available at matching aspect.\nRegional artistic setting: ${settings[race.id]}\nComposition must fit these existing simulation anchors, expressed as percent of full image from left/top: ${JSON.stringify(anchors)}. Do not print anchors, dots, names or numbers. Connect them naturally using broad traversable land valleys and basins; the route overlay is supplied separately by the game. Required clear dry LAND corridors (3 samples per stage, x/y percent) are: ${JSON.stringify(corridors.map((c) => c.xyPercent))}. Leave at least 5 percent image-width of dry passable valley/plain around these corridors, even in mountain regions; no lakes, ocean, sheer peaks or deep canyons crossing them.\nArt direction: sophisticated illustrated satellite relief, naturally weathered terrain, coherent realistic erosion, medium-scale vegetation masses, tiny granular stones, variegated soils, subtle field patterns and sparse tiny settlements where appropriate. Detailed but restrained, rich desaturated earth palette; no oversaturation. Soft daylight from northwest, short southeast shadows. Continuous organic transitions, no biome tiles, rectangles or symmetrical patchwork. Fine detail everywhere with clear major terrain masses.\nSTRICT terrain-only: no route lines, racecourse, colored trails, road overlays, text, lettering, labels, numerals, legends, compass, pins, location dots, border, flags, brands, cars, badges, watermarks or interface. Geographic artistic interpretation, not a claim of real satellite imagery. Cover all four edges. One unique map, no multiple panels.`;
  const item = {
    id: race.id,
    name: race.name,
    world: [1000, 950],
    setting: settings[race.id],
    anchors,
    corridors,
    asset:
      produced.find((m) => m.id === race.id)?.asset ??
      `assets/maps/${race.id}-v1.webp`,
  };
  brief.push(item);
  await writeFile(`docs/mapas/prompts/${race.id}.txt`, prompt + "\n");
}
await writeFile(
  "docs/mapas/circuitos.json",
  JSON.stringify(brief, null, 2) + "\n",
);
await writeFile(
  "data/race-maps.js",
  `// Local illustrated terrain; route coordinates remain independent.\nexport const RACE_MAPS = ${JSON.stringify(Object.fromEntries(brief.map((x) => [x.id, { src: x.asset, width: 1000, height: 950 }])), null, 2)};\n`,
);
console.log(`${brief.length} independent map briefs generated.`);
