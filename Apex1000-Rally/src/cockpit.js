import { clamp, vehicle } from "./catalog.js";
import { vehicleHealth } from "./reliability.js";
import { esc } from "./visuals.js";
import { stopStatus } from "./service-telemetry.js";

const number = (n, digits = 0) =>
  Number(n).toLocaleString("es-AR", { maximumFractionDigits: digits });
const minutes = (seconds) => {
  const n = Math.ceil(Math.max(0, seconds) / 60);
  return n >= 60 ? `${Math.floor(n / 60)} h ${n % 60} min` : `${n} min`;
};
export const speedAngle = (speed) => -130 + (clamp(speed, 0, 280) / 280) * 260;
export function arcadeRPM(
  team,
  clock,
  visualSeconds = 0,
  reducedMotion = false,
) {
  if (team.phase !== "racing" || team.holdUntil > clock)
    return { rpm: 0, gear: "N" };
  const speed = Math.max(0, team.speed);
  if (speed < 1) return { rpm: 850, gear: "N" };
  const bands = [0, 28, 58, 95, 140, 190, 280];
  let gear = 1;
  while (gear < 6 && speed >= bands[gear]) gear++;
  const ratio = clamp(
    (speed - bands[gear - 1]) / (bands[gear] - bands[gear - 1]),
    0,
    1,
  );
  const pulse = reducedMotion
    ? 0
    : Math.sin(visualSeconds * 2.5) * 145 + Math.sin(visualSeconds * 5.7) * 55;
  // Visual gearing only: the simulation speed is never changed here.
  return {
    gear,
    rpm: Math.round(
      clamp(
        (gear === 1 ? 1000 : 2500) + ratio * (gear === 1 ? 4700 : 3400) + pulse,
        850,
        6800,
      ),
    ),
  };
}

const polar = (r, degrees) => [
  100 + Math.sin((degrees * Math.PI) / 180) * r,
  100 - Math.cos((degrees * Math.PI) / 180) * r,
];
function gauge(kind, max, step, label, suffix, value) {
  const ticks = Array.from({ length: (max / step) * 4 + 1 }, (_, i) => {
    const angle = -130 + (i / ((max / step) * 4)) * 260,
      major = i % 4 === 0;
    const a = polar(major ? 73 : 79, angle),
      b = polar(85, angle),
      n = polar(59, angle);
    const red = kind === "rpm" && (i * step) / 4 >= 6.5;
    return `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="dial-tick ${major ? "major" : ""} ${red ? "redline" : ""}"/>${major ? `<text x="${n[0]}" y="${n[1]}" class="dial-number ${red ? "redline" : ""}">${(i * step) / 4}</text>` : ""}`;
  }).join("");
  const angle = kind === "speed" ? speedAngle(value) : -130;
  return `<div class="dial"><svg viewBox="0 0 200 200" aria-label="${label}" role="img"><circle cx="100" cy="100" r="96" class="dial-bezel"/><circle cx="100" cy="100" r="89" class="dial-face"/>${ticks}<text x="100" y="139" class="dial-unit">${suffix}</text><g class="dial-needle" data-needle="${kind}" data-live-owned style="transform:rotate(${angle}deg)"><path d="M97 113 L98.5 26 L101.5 26 L103 113 Z"/><path class="needle-glint" d="M99 105 L100 30 L100 105"/></g><circle cx="100" cy="100" r="10" class="needle-hub"/></svg><div class="dial-readout"><strong data-readout="${kind}" data-live-owned>${kind === "speed" ? number(value, 1) : "0"}</strong><small>${label}</small></div></div>`;
}
const lampPaths = {
  engine: "M3 9h4l3-4h9v4h3v10H7v-3H3z M11 2h7 M14 2v3 M1 9v7",
  transmission: "M7 3h10v5h4v8h-4v5H7v-5H3V8h4z M9 9l6 6m0-6-6 6",
  suspension: "M8 2v3l8 3-8 3 8 3-8 3 8 3v2 M12 2h6 M6 22h6",
  tyres:
    "M20 12a8 10 0 1 1-16 0 8 10 0 0 1 16 0 M12 5v8m0 3v2 M5 5l3 2m-4 5h4m-3 6 3-2m11-11-3 2m4 5h-4m3 6-3-2",
  cooling: "M12 2c-2 4-8 8-8 13a8 8 0 0 0 16 0c0-5-6-9-8-13z M8 16c0 3 2 4 4 4",
  brakes:
    "M5 4a11 11 0 0 0 0 16m14-16a11 11 0 0 1 0 16 M19 12a7 7 0 1 1-14 0 7 7 0 0 1 14 0 M12 7v6m0 3v1",
  heat: "M10 3a2 2 0 0 1 4 0v10a5 5 0 1 1-4 0z M12 7v10 M17 5h4m-4 4h4",
  fuel: "M4 21V3h10v18 M4 10h10 M2 21h14 M16 5l4 4v9c0 3-4 3-4 0v-4h-2",
  driver: "M18 3a9 9 0 1 0 3 14A8 8 0 0 1 18 3z",
};
export function dashboardHTML(team, clock) {
  const health = vehicleHealth(team),
    driver = team.drivers.find((d) => d.id === team.activeDriver) ||
      team.drivers[0] || { energy: 0 };
  const fuel = clamp((team.fuel / vehicle(team.vehicleId).tank) * 100, 0, 100);
  const lamps = [
    ...[
      "engine",
      "transmission",
      "suspension",
      "tyres",
      "cooling",
      "brakes",
    ].map((id) => {
      const p = health.parts.find((p) => p.id === id);
      return {
        id,
        label:
          { suspension: "SUSP.", tyres: "NEUM.", cooling: "REFRIG." }[id] ||
          p.short.toUpperCase(),
        level: p.level,
        detail: p.broken
          ? `${p.name}: avería`
          : p.level === "warning"
            ? `${p.name}: riesgo elevado`
            : `${p.name}: sin alertas`,
      };
    }),
    {
      id: "heat",
      label: "TEMP",
      level:
        team.heat > 122 ? "critical" : team.heat > 112 ? "warning" : "normal",
      detail: `Temperatura: ${number(team.heat)} °C`,
    },
    {
      id: "fuel",
      label: "FUEL",
      level: fuel <= 0 ? "critical" : fuel <= 10 ? "warning" : "normal",
      detail: `Combustible: ${number(team.fuel)} L (${number(fuel)}%)`,
    },
    {
      id: "driver",
      label: "FATIGA",
      level:
        driver.energy <= 5
          ? "critical"
          : driver.energy <= 20
            ? "warning"
            : "normal",
      detail: `Energía del piloto: ${number(driver.energy)}%`,
    },
  ];
  return `<section class="cockpit" data-dashboard data-team="${esc(team.id)}" aria-label="Tablero de ${esc(team.name)}"><div class="cockpit-brand"><span>APEX / RAID SYSTEMS</span><b>${team.phase === "racing" && team.holdUntil <= clock ? "EN MARCHA" : "MOTOR DETENIDO"}</b></div><div class="instrument-pair">${gauge("speed", 280, 40, "km/h", "VELOCIDAD", team.speed)}${gauge("rpm", 8, 1, "RPM", "RPM × 1000", 0)}</div><div class="dashboard-lamps" aria-label="Testigos de avería y advertencia">${lamps.map((l) => `<span class="dash-lamp ${l.level}" title="${esc(l.detail)}" aria-label="${esc(l.detail)}"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${lampPaths[l.id]}"/></svg><small>${l.label}</small></span>`).join("")}</div><div class="dash-lcd"><div class="fuel-gauge"><span>COMBUSTIBLE <b>${number(team.fuel)} L</b></span><div class="fuel-track ${fuel <= 10 ? "low" : ""}"><i style="width:${fuel}%"></i></div><small><span>E</span><span>${number(fuel)}%</span><span>F</span></small></div><div class="dash-trip"><span>RECORRIDO <b>${number(team.totalKm, 1)} km</b></span><span>TEMP. <b>${number(team.heat)} °C</b></span><span>MARCHA VISUAL <b data-readout="gear" data-live-owned>N</b></span></div></div><small class="rpm-note">Velocidad de carrera · RPM y marchas ilustrativas</small></section>`;
}

export function stopChecklistHTML(state, team) {
  const stop = stopStatus(state, team);
  if (!stop) return "";
  const labels = {
    done: "Completado",
    active: "En curso",
    queued: "Pendiente",
    skipped: "Omitido",
  };
  return `<section class="stop-checklist" aria-label="Estado de la parada"><div class="stop-heading"><span>CONTROL DE PARADA</span><strong>${esc(stop.title)}</strong>${stop.remaining !== null ? `<b>${minutes(stop.remaining)} <small>para ${team.phase === "waiting" ? "la largada" : "salir"}</small></b>` : ""}<p>${esc(stop.reason)}</p>${!state.speed ? `<small>RELOJ DEL PROTOTIPO PAUSADO</small>` : ""}</div>${stop.tasks.length ? `<ol>${stop.tasks.map((t) => `<li class="stop-task ${t.status}"><span class="task-symbol" aria-hidden="true">${t.status === "done" ? "✓" : t.status === "skipped" ? "!" : t.status === "active" ? "◷" : "○"}</span><div><strong>${esc(t.label)}</strong><small>${labels[t.status]}${["queued", "active"].includes(t.status) ? ` · ${minutes(t.remaining)} hasta completar` : ""}</small>${t.skipped || ["fuel", "assistance", "reserve", "legacy"].includes(t.kind) ? `<p>${esc(t.detail)}</p>` : ""}${["active", "queued"].includes(t.status) ? `<progress max="1" value="${t.progress}" aria-label="Progreso: ${esc(t.label)}"></progress>` : ""}</div></li>`).join("")}</ol>` : ""}<div class="stop-advice"><strong>${stop.tasks.length ? "Para la próxima parada" : "Cómo continuar"}</strong><p>${esc(stop.advice)}</p></div><small class="stop-clock-note">${state.speed ? "" : "Reloj del prototipo pausado. "}Reparaciones en secuencia; descanso en paralelo.</small></section>`;
}

export function updateInstruments(state, visualSeconds, reducedMotion = false) {
  if (!state) return;
  for (const panel of document.querySelectorAll("[data-dashboard]")) {
    const team = state.teams.find((t) => t.id === panel.dataset.team);
    if (!team) continue;
    const { rpm, gear } = arcadeRPM(
      team,
      state.clock,
      visualSeconds,
      reducedMotion,
    );
    panel.querySelector('[data-needle="speed"]').style.transform =
      `rotate(${speedAngle(team.speed)}deg)`;
    panel.querySelector('[data-needle="rpm"]').style.transform =
      `rotate(${-130 + (rpm / 8000) * 260}deg)`;
    panel.querySelector('[data-readout="speed"]').textContent = number(
      team.speed,
      1,
    );
    panel.querySelector('[data-readout="rpm"]').textContent = number(rpm);
    panel.querySelector('[data-readout="gear"]').textContent = gear;
  }
}
