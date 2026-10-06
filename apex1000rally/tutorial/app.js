import {
  SAVE_KEY,
  PARTS,
  DRIVERS,
  KITS,
  STAGES,
  newTraining,
  startPreparation,
  stageDistance,
  defaultDecision,
  commitStage,
  phaseDuration,
  telemetry,
  advanceTraining,
  resumeTraining,
} from "./engine.js?v=1.6.2";
import { createRaceViewer } from "./viewer.js?v=1.6.2";
import { trainingField } from "./viewer-model.js?v=1.6.2";
const $ = (q) => document.querySelector(q);
const raceViewer = createRaceViewer($("#race-viewer"), {
  onPause() {
    state.paused = !state.paused;
    lastWall = performance.now();
    save();
    tickDOM();
  },
  onSpeed(speed) {
    if (![1, 2, 10].includes(speed)) return;
    state.speed = speed;
    lastWall = performance.now();
    save();
    tickDOM();
  },
});
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const clock = (s) =>
  `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
let state = newTraining(),
  storageOK = true,
  savedAttempt = null;
try {
  savedAttempt = localStorage.getItem(SAVE_KEY);
  state = resumeTraining(savedAttempt) || state;
  if (state.legacyRestart && JSON.parse(savedAttempt)?.version === 1)
    localStorage.setItem(SAVE_KEY + "-legacy-v1", savedAttempt);
} catch {
  storageOK = false;
}
const note = (text) =>
  ($("#storage-note").textContent =
    (state.legacyRestart
      ? "La actualización corrigió los saltos de campamento. Tu intento anterior se conservó como respaldo; repetí desde la largada con tus reglajes y piezas. "
      : "") + text);
function save() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
  } catch {
    storageOK = false;
    note(
      "El navegador no permite guardar. Podés jugar, pero este intento no se conservará al cerrar.",
    );
  }
}
if (!storageOK)
  note(
    "Guardado local no disponible: mantené esta pestaña abierta para conservar el intento.",
  );
else if (savedAttempt && !resumeTraining(savedAttempt))
  note(
    "No se pudo recuperar el intento guardado. Se inició uno nuevo; la partida online no fue consultada.",
  );
function controls() {
  return `<div class="controls"><button id="pause" ${phaseDuration(state) ? "" : "disabled"}>${state.paused ? "▶ Continuar" : "Ⅱ Pausar"}</button><label>Velocidad <select id="speed" aria-label="Velocidad del simulador">${[1, 2, 10].map((n) => `<option value="${n}" ${state.speed === n ? "selected" : ""}>×${n}</option>`).join("")}</select></label><span class="small">Simulación: <b id="elapsed">${clock(state.elapsed)}</b> / 40:00 · las decisiones pausan el reloj</span><button id="retry">Reiniciar intento</button></div>`;
}
function timeline() {
  return `<ol class="timeline">${STAGES.map((r, i) => `<li class="${state.stage === i ? "current" : state.stage > i ? "done" : ""}"><span>${state.stage > i ? "✓ " : ""}ETAPA ${i + 1} · ${r.terrain}</span><strong>${r.name}</strong><small>${r.km} km · ${r.heat} °C</small></li>`).join("")}</ol>`;
}
function briefing() {
  return `<section class="panel hero"><span class="eyebrow">INTENTO ${state.attempt} · ENTRENAMIENTO REJUGABLE</span><h1>Cada ajuste cuenta.</h1><p>Dirigí la escudería ficticia <strong>Horizonte Virtual</strong> en cinco etapas intensivas. Desgaste que supera 60 puntos por etapa, consumo de hasta 92 puntos de energía y situaciones de avería provocadas por decisiones equivocadas.</p><p><strong>Hasta 40 minutos de reloj simulado: 40 min a ×1, 20 a ×2 o 4 a ×10</strong>, más el tiempo que dediques a decidir. Podés pausar y cerrar: al volver se abre pausado.</p><div class="tip"><strong>Un desafío para aprender, con una solución única.</strong><p>Los mismos rivales y condiciones se repiten. Necesitás acertar el auto, las seis piezas y reglajes, y el plan de cada etapa. Un error impide ganar este examen; el auto debe alcanzar cada campamento para continuar. Sin combustible o al agotar los 40 minutos, el intento termina en su posición real. Esa regla estricta pertenece sólo al tutorial.</p></div><p class="small">Todo es ficticio y local. No hay conexión al Worker, inscripciones, dinero, premios ni cambios en tu equipo online. Si el navegador permite caché offline, después de la primera carga también podés abrirlo sin conexión.</p></section><form id="setup"><div class="grid"><section class="panel"><span class="eyebrow">01 · BASE PARA LAS CINCO SUPERFICIES</span><h2>Elegí vehículo y repuestos.</h2><label>Vehículo<select name="car">${[
    ["scout", "Scout · control 90 · comodidad 85 · velocidad 70"],
    ["dune", "Dune · control 65 · comodidad 40 · velocidad 90"],
    ["rocket", "Rocket · control 20 · comodidad 15 · velocidad 99"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${state.config.car === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label><div class="tip"><p>Una velocidad máxima alta no compensa la fatiga ni el control en roca. Buscá una base versátil. Motor, caja, suspensión y refrigeración deben sobrevivir al raid; en gomas y frenos el chasis y la asistencia permiten priorizar rendimiento.</p></div>${PARTS.map(([id, name]) => `<label>${name}<select name="kit-${id}">${KITS.map((k) => `<option value="${k.id}" ${state.config.kits[id] === k.id ? "selected" : ""}>${k.name} · ${k.description}</option>`).join("")}</select></label>`).join("")}<p class="small">Atlas y Vector son marcas ficticias exclusivas del entrenamiento. La reserva nunca se rompe, pero su baja performance alarga el trayecto.</p></section><section class="panel"><span class="eyebrow">02 · SE FIJAN PARA TODA LA CARRERA</span><h2>Calibrá los seis reglajes.</h2><div class="tip"><p>Motor en torno al tercio inferior, sin llevarlo al mínimo. Caja larga, cerca de siete décimos. Suspensión algo por debajo de dos tercios. Presión de gomas en torno a dos quintos. Refrigeración alta, a cuatro quintos. Frenos apenas por encima de la mitad.</p><p class="small">Mové las barras en pasos de cinco. Las pistas orientan; el informe de cada intento indica hacia dónde corregir. Después de la puesta a punto no se pueden cambiar.</p></div>${PARTS.map(([id, name, left, right]) => `<label>${name}<output id="out-${id}">${state.config.tuning[id]}</output><input type="range" name="tune-${id}" aria-label="Reglaje ${name}" min="0" max="100" step="5" value="${state.config.tuning[id]}"><span class="range-ends"><span>${left}</span><span>${right}</span></span></label>`).join("")}<button class="primary" type="submit">Guardar reglajes y preparar el auto</button><p class="small">Puesta a punto: 5 minutos simulados. La preparación real del juego online dura 5 horas; aquí está comprimida.</p></section></div></form>`;
}
function drivers() {
  return `<div class="cards">${DRIVERS.map((d, i) => `<article class="card"><strong>${d.name}</strong><small>${d.specialty}</small><div class="bar-row"><span>Energía</span><progress id="energy-${i}" max="100" value="${state.energy[i]}"></progress><span id="energy-label-${i}">${Math.round(state.energy[i])}%</span></div></article>`).join("")}</div>`;
}
function plan() {
  const r = STAGES[state.stage],
    d = state.draft || defaultDecision(state);
  return `<section class="panel hero"><span class="eyebrow">${state.stage ? "CAMPAMENTO" : "LISTO PARA LARGAR"} · ETAPA ${state.stage + 1}</span><h1>${r.name}</h1><p>${r.terrain} · ${r.km} km · ${r.heat} °C. Elegí ahora el plan: al largar queda bloqueado hasta el siguiente campamento.</p><div class="tip"><strong>Consejo del instructor</strong><p>${r.hint}</p><p>La demanda de combustible de esta prueba va de 30 a 45 L, en pasos de cinco; dos etapas consumen lo mismo. Una carga insuficiente o excesiva pierde rendimiento.</p></div></section>${drivers()}<div class="grid"><form id="stage-plan" class="panel"><h2>Plan de etapa</h2><label>Piloto activo<select name="driver">${DRIVERS.map((p, i) => `<option value="${i}" ${d.driver === i ? "selected" : ""}>${p.name} · ${p.specialty}</option>`).join("")}</select></label><label>Ritmo<select name="pace">${[
    ["careful", "Prudente · menor riesgo"],
    ["steady", "Constante · equilibrio"],
    ["attack", "Ataque · mayor riesgo"],
  ]
    .map(
      ([id, label]) =>
        `<option value="${id}" ${d.pace === id ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select></label><label>Combustible al largar<output id="fuel-output">${d.fuel} L</output><input type="range" name="fuel" min="20" max="60" step="5" value="${d.fuel}" aria-label="Carga de combustible"><span class="range-ends"><span>20 L</span><span>60 L</span></span></label>${
    state.stage
      ? `<fieldset><legend>Asistencia antes de salir</legend><label>Reparaciones<select name="repairs">${[
          ["all", "Reparar las seis piezas a 100%"],
          ["broken", "Sólo piezas averiadas"],
          ["none", "No reparar"],
        ]
          .map(
            ([id, label]) =>
              `<option value="${id}" ${d.repairs === id ? "selected" : ""}>${label}</option>`,
          )
          .join(
            "",
          )}</select></label><label>Descanso del equipo<select name="rest">${[
          ["full", "Recuperación completa"],
          ["half", "Recuperación parcial"],
          ["none", "Sin descanso"],
        ]
          .map(
            ([id, label]) =>
              `<option value="${id}" ${d.rest === id ? "selected" : ""}>${label}</option>`,
          )
          .join(
            "",
          )}</select></label><p class="small">Tres mecánicos ficticios. Combustible: 45 s. Reparación: 120 s. Descanso completo: 150 s. Las tareas avanzan en paralelo y el auto sale al terminar la más larga. Sólo en este escenario el descanso se comprime.</p></fieldset>`
      : `<input type="hidden" name="repairs" value="all"><input type="hidden" name="rest" value="full"><p class="small">Primer tramo: piezas nuevas y pilotos con 100% de energía.</p>`
  }<button class="primary" type="submit">${state.stage ? "Guardar plan e iniciar asistencia" : "Largar la etapa"}</button></form><section class="panel"><h2>Estado del vehículo</h2>${parts()}${journal()}</section></div>`;
}
function parts() {
  return PARTS.map(
    ([id, name]) =>
      `<div class="bar-row"><span>${name}</span><progress id="part-${id}" max="100" value="${state.condition[id]}"></progress><span id="part-label-${id}">${Math.round(state.condition[id])}%</span></div>`,
  ).join("");
}
function journal() {
  const last = state.history.at(-1);
  return `<article class="paper"><h3>Bitácora virtual</h3><p>${last ? (last.faults.length ? "“Perdimos tiempo: el auto pidió más cuidado del que le dimos. El informe conserva los ajustes para revisar al terminar.”" : "“El auto llegó exigido pero bajo control. La elección del piloto y el mantenimiento hicieron la diferencia.”") : "“La carrera se gana antes de salir: leé el terreno y no confundas potencia con una buena preparación.”"}</p><small>${last ? `Etapa ${last.stage + 1} · ${last.km.toFixed(2)} / ${STAGES[last.stage].km} km registrados` : "Primera página del instructor"}</small></article>`;
}
function dial(id, label, max) {
  return `<svg class="dial" viewBox="0 0 120 110" role="img" aria-label="${label}"><circle cx="60" cy="60" r="48" fill="#10171c" stroke="#74858c" stroke-width="3"/><path d="M24 85 A44 44 0 1 1 96 85" fill="none" stroke="#b3bdbc" stroke-width="1"/>${[
    0, 0.25, 0.5, 0.75, 1,
  ]
    .map((p) => {
      const a = ((150 + p * 240) * Math.PI) / 180;
      return `<text x="${60 + Math.cos(a) * 34}" y="${63 + Math.sin(a) * 34}">${Math.round(p * max)}</text>`;
    })
    .join(
      "",
    )}<line id="needle-${id}" class="needle" x1="60" y1="60" x2="97" y2="60" transform="rotate(150 60 60)"/><circle cx="60" cy="60" r="5" fill="#efb86a"/><text x="60" y="83">${label}</text></svg>`;
}
function running() {
  const r = STAGES[state.stage],
    prep = state.phase === "preparation",
    service = state.phase === "service";
  return `<section class="panel hero"><span class="eyebrow">${prep ? "PUESTA A PUNTO" : service ? "ASISTENCIA EN CAMPAMENTO" : "ETAPA " + (state.stage + 1) + " · EN RUTA"}</span><h1>${prep ? "El laboratorio está preparando tu auto." : r.name}</h1><p>${prep ? "Se instalan las seis piezas y se fija la calibración para toda la prueba." : service ? "Reparación, combustible y descanso avanzan en paralelo. El vehículo volverá a carrera automáticamente." : `${DRIVERS[state.decision.driver].name} al volante · ${r.terrain} · los reglajes y el plan ya están bloqueados.`}</p><progress id="phase-progress" max="100" value="0"></progress><p class="small"><span id="phase-left"></span> · <span id="run-note"></span></p></section><div class="grid"><section class="panel">${prep || service ? `<h2>Tareas en curso</h2><ul class="checklist" id="checklist"></ul>` : `<div class="dashboard"><div class="dials">${dial("speed", "km/h", 180)}${dial("rpm", "RPM", 7000)}</div><div class="lights"><span id="fault-light" class="light">AVERÍA</span><span id="heat-light" class="light">TEMPERATURA</span><span id="fuel-light" class="light">COMBUSTIBLE</span><span id="energy-light" class="light">FATIGA</span></div><div class="metrics"><div><strong id="speed-value">0</strong><small>KM/H · VELOCIDAD SIMULADA</small></div><div><strong id="fuel-value">0</strong><small>LITROS</small></div><div><strong id="heat-value">0</strong><small>°C</small></div><div><strong id="risk-value">0</strong><small>% RIESGO DIDÁCTICO</small></div></div></div><div class="tip"><strong id="incident-title">Consejo en ruta</strong><p id="incident"></p></div>`}<h3>Estado de las seis piezas</h3>${parts()}</section><section class="panel"><h2>Rivales virtuales</h2><table class="ranking"><thead><tr><th>Pos.</th><th>Escudería</th><th>Avance</th></tr></thead><tbody id="ranking"></tbody></table><p class="small">Cada etapa termina al alcanzar su campamento, nunca sólo por tiempo. Cinco minutos es el ritmo de referencia; si vas más lento, tardás más y consumís más combustible. Sin combustible o al cumplir 40 minutos, termina el intento sin trasladar el auto.</p>${journal()}</section></div>${prep ? "" : drivers()}`;
}
function result() {
  const won = state.result.won;
  const grouped = state.history
    .map(
      (h) =>
        `<details ${h.faults.length ? "open" : ""}><summary>Etapa ${h.stage + 1} · ${STAGES[h.stage].name} · ${h.km.toFixed(2)} / ${STAGES[h.stage].km} km</summary>${h.faults.length ? `<ul class="errors">${h.faults.map((f) => `<li>${esc(f.text)}</li>`).join("")}</ul>` : `<p>✓ Auto, reglajes, piezas, piloto, ritmo, combustible y asistencia correctos.</p>`}</details>`,
    )
    .join("");
  return `<section class="panel hero ${won ? "result-good" : "result-bad"}"><span class="eyebrow">INTENTO ${state.attempt} · INFORME FINAL</span><h1>${won ? "Calibración completa. Ganaste el desafío." : "Este intento no ganó. Ahora sabés qué corregir."}</h1><p>Posición ${state.result.position} de 6 · ${state.km.toFixed(2)} / 40 km completados · ${clock(state.elapsed)} de simulación.</p><p>${state.result.reason === "fuel" ? "El auto quedó sin combustible antes de alcanzar el campamento. No se habilitó asistencia ni cambio de piloto en ruta." : state.result.reason === "deadline" ? "Se agotaron los 40 minutos sin llegar a la meta. El auto queda en su posición real." : ""}</p><p>${won ? "Las cinco etapas se completaron con la única secuencia correcta. Ya aplicaste la lectura del terreno, los reglajes fijos, las especialidades, el combustible y la asistencia." : "La distancia no completada queda registrada. Revisá las diferencias y probá de nuevo: el escenario es idéntico, sin una tirada de azar que cambie el resultado."}</p><div class="controls"><button id="replay" class="primary">Reintentar desde cero</button><button id="retry-config">Reintentar conservando reglajes y piezas</button><a href="../" class="button">Volver al juego</a></div><p class="small">Este resultado es local y no da créditos, nivel ni premios online.</p></section><section class="panel"><h2>Lo que pasó en cada etapa</h2>${grouped}</section><section class="tip"><strong>Para pasar del tutorial al rally real</strong><p>En la competición hay estrategias alternativas: este examen exige una sola para enseñar. No copies sus valores como receta para otras carreras. Leé cada recorrido y administrá los recursos del equipo.</p></section>`;
}
function render() {
  $("#simulator-head").innerHTML =
    `<div class="summary"><span class="eyebrow">HORIZONTE VIRTUAL · DIRECTOR INVITADO</span><span class="status">Guardado ${storageOK ? "local e independiente" : "no disponible"}</span></div>${controls()}${state.phase === "briefing" ? "" : timeline()}`;
  $("#app").innerHTML =
    state.phase === "briefing"
      ? briefing()
      : state.phase === "result"
        ? result()
        : ["ready", "camp"].includes(state.phase)
          ? plan()
          : running();
  tickDOM();
}
function ranking() {
  return trainingField(state)
    .map(
      (t, i) =>
        `<tr class="${t.you ? "you" : ""}"><td>${t.position}</td><td>${t.name}${t.you ? " · vos" : ""}</td><td>${t.km.toFixed(2)} km</td></tr>`,
    )
    .join("");
}
const text = (id, value) => {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
};
function checklist() {
  const prep = state.phase === "preparation",
    p = state.phaseTime;
  const tasks = prep
    ? [
        ["Instalar las seis piezas", 90],
        ["Calibrar los seis reglajes", 240],
        ["Verificar puesta a punto", 300],
      ]
    : [
        ["Cargar combustible", 45],
        ["Reparar las seis piezas", 120, state.decision.repairs !== "all"],
        [
          "Descansar y recuperar energía",
          state.decision.rest === "half" ? 75 : 150,
          state.decision.rest !== "full",
        ],
      ];
  return tasks
    .map(
      ([label, seconds, skipped]) =>
        `<li class="${skipped ? "skipped" : p >= seconds ? "complete" : ""}">${skipped ? "⚠" : p >= seconds ? "✓" : "◷"} ${label} · ${skipped ? "plan parcial / omitido" : p >= seconds ? "completado" : clock(seconds - p) + " restantes"}</li>`,
    )
    .join("");
}
function tickDOM() {
  raceViewer.update(state);
  const mainSpeed = $("#speed");
  if (mainSpeed && mainSpeed.value !== String(state.speed))
    mainSpeed.value = String(state.speed);
  text("elapsed", clock(state.elapsed));
  const pause = $("#pause");
  if (pause) pause.textContent = state.paused ? "▶ Continuar" : "Ⅱ Pausar";
  const duration = phaseDuration(state),
    progress = $("#phase-progress");
  if (progress)
    progress.value =
      state.phase === "driving"
        ? (stageDistance(state) / STAGES[state.stage].km) * 100
        : (state.phaseTime / duration) * 100;
  text(
    "phase-left",
    state.phase === "driving"
      ? (STAGES[state.stage].km - stageDistance(state)).toFixed(2) +
          " km hasta el campamento · límite del intento: " +
          clock(2400 - state.elapsed)
      : clock(duration - state.phaseTime) + " restantes",
  );
  text(
    "run-note",
    state.paused ? "En pausa" : "×" + state.speed + " · guardado automático",
  );
  const checks = $("#checklist");
  if (checks) checks.innerHTML = checklist();
  for (const [id] of PARTS) {
    const bar = $("#part-" + id);
    if (bar) bar.value = state.condition[id];
    text("part-label-" + id, Math.round(state.condition[id]) + "%");
  }
  for (let i = 0; i < 3; i++) {
    const bar = $("#energy-" + i);
    if (bar) bar.value = state.energy[i];
    text("energy-label-" + i, Math.round(state.energy[i]) + "%");
  }
  const table = $("#ranking");
  if (table) table.innerHTML = ranking();
  if (state.phase !== "driving") return;
  const t = telemetry(state);
  text("speed-value", Math.round(t.speed));
  text("fuel-value", state.fuel.toFixed(1));
  text("heat-value", Math.round(t.heat));
  text("risk-value", t.risk);
  $("#needle-speed")?.setAttribute(
    "transform",
    `rotate(${150 + Math.min(1, t.speed / 180) * 240} 60 60)`,
  );
  $("#needle-rpm")?.setAttribute(
    "transform",
    `rotate(${150 + Math.min(1, t.rpm / 7000) * 240} 60 60)`,
  );
  for (const [id, warn, danger] of [
    ["fault", t.risk >= 80, t.broken],
    ["heat", t.heat > 100, t.heat > 120],
    ["fuel", state.fuel < 8, state.fuel <= 0 && state.phaseTime < 299],
    [
      "energy",
      state.energy[state.decision.driver] < 35,
      state.energy[state.decision.driver] < 15,
    ],
  ]) {
    const n = $("#" + id + "-light");
    if (n) n.className = "light" + (danger ? " danger" : warn ? " warn" : "");
  }
  text(
    "incident-title",
    state.phaseTime < 150
      ? "Consejo en ruta"
      : t.broken
        ? "Avería reproducible"
        : "Nota del piloto",
  );
  text(
    "incident",
    state.phaseTime < 150
      ? STAGES[state.stage].hint
      : t.broken
        ? "La pieza crítica falló: el piloto activo no tenía su especialidad. El auto avanza a 30 km/h. Esto se repetirá si no cambiás el plan."
        : state.drive.ratio < 1
          ? "La velocidad cayó. Revisá piezas, calibración, carga y energía en el informe final; el próximo intento conserva las mismas condiciones."
          : "La preparación está funcionando. Al llegar, fijate cuánto bajaron el estado y la energía antes de guardar el siguiente plan.",
  );
}
function captureSetup(form) {
  const d = new FormData(form);
  return {
    car: d.get("car"),
    kits: Object.fromEntries(PARTS.map(([id]) => [id, d.get("kit-" + id)])),
    tuning: Object.fromEntries(
      PARTS.map(([id]) => [id, Number(d.get("tune-" + id))]),
    ),
  };
}
function capturePlan(form) {
  const d = new FormData(form);
  return {
    driver: Number(d.get("driver")),
    pace: d.get("pace"),
    fuel: Number(d.get("fuel")),
    rest: d.get("rest"),
    repairs: d.get("repairs"),
  };
}
document.addEventListener("input", (event) => {
  if (event.target.name?.startsWith("tune-"))
    text("out-" + event.target.name.slice(5), event.target.value);
  if (event.target.name === "fuel")
    text("fuel-output", event.target.value + " L");
  const setup = $("#setup"),
    planForm = $("#stage-plan");
  if (setup) state.config = captureSetup(setup);
  if (planForm) state.draft = capturePlan(planForm);
  save();
});
document.addEventListener("change", (event) => {
  if (event.target.id === "speed") {
    state.speed = Number(event.target.value);
    lastWall = performance.now();
    save();
  }
});
document.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    if (event.target.id === "setup") {
      startPreparation(state, captureSetup(event.target));
      delete state.legacyRestart;
    } else if (event.target.id === "stage-plan") {
      commitStage(state, capturePlan(event.target));
      delete state.draft;
    }
    lastWall = performance.now();
    save();
    render();
    if (!document.fullscreenElement)
      $("#race-viewer").scrollIntoView({ block: "start", behavior: "auto" });
  } catch (e) {
    note(e.message);
  }
});
document.addEventListener("click", (event) => {
  const id = event.target.closest("button")?.id;
  if (id === "pause") {
    state.paused = !state.paused;
    lastWall = performance.now();
    save();
    tickDOM();
  }
  if (["retry", "replay", "retry-config"].includes(id)) {
    if (
      state.phase !== "result" &&
      !confirm(
        "¿Reiniciar sólo este intento del tutorial? Tu escudería online no cambia.",
      )
    )
      return;
    const config = state.config,
      attempt = state.attempt + 1;
    state = newTraining(attempt);
    if (id === "retry-config") state.config = config;
    save();
    render();
  }
});
let lastWall = performance.now(),
  lastSave = lastWall;
// Update telemetry only. Never replace mounted forms during micro-updates.
setInterval(() => {
  const now = performance.now(),
    dt = Math.min(2, (now - lastWall) / 1000),
    before = state.phase;
  lastWall = now;
  if (!document.hidden) advanceTraining(state, dt * state.speed);
  if (state.phase !== before) {
    save();
    render();
  } else tickDOM();
  if (now - lastSave > 4000) {
    save();
    lastSave = now;
  }
}, 200);
document.addEventListener("visibilitychange", () => {
  if (document.hidden && phaseDuration(state)) {
    state.paused = true;
    save();
    tickDOM();
  }
  lastWall = performance.now();
});
window.addEventListener("pagehide", save);
render();
if ("serviceWorker" in navigator) {
  navigator.serviceWorker
    .register("./sw.js")
    .then(async (registration) => {
      await navigator.serviceWorker.ready;
      const worker = registration.active || registration.waiting;
      worker?.postMessage({ type: "CHECK_OFFLINE" });
    })
    .catch(() =>
      note(
        "Podés jugar localmente; la caché para reabrir sin conexión no está disponible en este navegador.",
      ),
    );
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "OFFLINE_READY" && storageOK)
      note(
        "Tutorial listo para reabrirse sin conexión en este navegador. Guardado separado de tu escudería.",
      );
  });
}
