// Deterministic teaching scenario. Isolated from the online race engine and API.
export const VERSION = 2;
export const SAVE_KEY = "apex1000-virtual-training-v1";
export const MAX_SECONDS = 2400;
export const PARTS = [
  ["engine", "Motor", "Bajo / ahorro", "Alto / potencia"],
  ["gearbox", "Caja", "Corta", "Larga"],
  ["suspension", "Suspensión", "Blanda", "Dura"],
  ["tires", "Neumáticos", "Baja presión", "Alta presión"],
  ["cooling", "Refrigeración", "Menor flujo", "Mayor flujo"],
  ["brakes", "Frenos", "Suave", "Agresivo"],
];
export const DRIVERS = [
  { name: "Vera Ríos", specialty: "Suspensión · ripio y roca" },
  { name: "Mauro Solís", specialty: "Refrigeración · arena" },
  { name: "Inés Vidal", specialty: "Frenos · montaña y asfalto" },
];
export const KITS = [
  {
    id: "shield",
    name: "Atlas",
    description: "Rendimiento 65 · resistencia 95 · riesgo 18%",
  },
  {
    id: "light",
    name: "Vector",
    description: "Rendimiento 95 · resistencia 35 · riesgo 82%",
  },
  {
    id: "reserve",
    name: "Reserva",
    description: "Rendimiento 20 · resistencia 60 · irrompible",
  },
];
export const STAGES = [
  {
    name: "Quebrada de entrada",
    terrain: "Ripio",
    km: 8,
    heat: 30,
    weak: "suspension",
    driver: 0,
    pace: "steady",
    fuel: 40,
    wear: 52,
    fatigue: 84,
    hint: "El ripio castiga la suspensión. La especialista que conduce puede evitar su avería; en descanso no protege. Un ritmo constante y una carga intermedia ayudan.",
  },
  {
    name: "Dunas del horno",
    terrain: "Arena",
    km: 7,
    heat: 46,
    weak: "cooling",
    driver: 1,
    pace: "careful",
    fuel: 45,
    wear: 59,
    fatigue: 92,
    hint: "El calor y la arena exigen refrigeración y paciencia. El consumo es el mayor de la prueba. El piloto de relevo sólo recupera energía a 0,1× en ruta.",
  },
  {
    name: "Paso del Cóndor",
    terrain: "Montaña",
    km: 6,
    heat: 18,
    weak: "brakes",
    driver: 2,
    pace: "careful",
    fuel: 35,
    wear: 57,
    fatigue: 87,
    hint: "En el descenso, cuidar los frenos vale más que acelerar. Elegí a quien sepa protegerlos. Esta es la segunda carga más baja de combustible.",
  },
  {
    name: "Cañón de las agujas",
    terrain: "Roca",
    km: 7,
    heat: 34,
    weak: "suspension",
    driver: 0,
    pace: "steady",
    fuel: 40,
    wear: 61,
    fatigue: 89,
    hint: "Vera vuelve al volante: verificá que haya descansado de verdad. Las rocas exigen la misma carga y el mismo ritmo que la primera etapa. Reparar sólo lo roto deja mucho desgaste.",
  },
  {
    name: "Recta del horizonte",
    terrain: "Asfalto",
    km: 12,
    heat: 25,
    weak: "brakes",
    driver: 2,
    pace: "attack",
    fuel: 30,
    wear: 48,
    fatigue: 80,
    hint: "El asfalto permite atacar si llegás con todo reparado y un piloto descansado. Los frenos siguen siendo esenciales. Usá la carga más liviana de las cinco.",
  },
];
// A single calibration is intentional: this is a repeatable virtual exam,
// not a claim that the online simulator has one universally optimal strategy.
export const SOLUTION = {
  car: "scout",
  tuning: {
    engine: 35,
    gearbox: 70,
    suspension: 65,
    tires: 40,
    cooling: 80,
    brakes: 55,
  },
  kits: {
    engine: "shield",
    gearbox: "shield",
    suspension: "shield",
    tires: "light",
    cooling: "shield",
    brakes: "light",
  },
};
const clone = (v) => JSON.parse(JSON.stringify(v));
export function newTraining(attempt = 1) {
  return {
    version: VERSION,
    attempt,
    phase: "briefing",
    stage: 0,
    elapsed: 0,
    phaseTime: 0,
    paused: true,
    speed: 1,
    config: {
      car: "scout",
      tuning: Object.fromEntries(PARTS.map(([id]) => [id, 50])),
      kits: Object.fromEntries(PARTS.map(([id]) => [id, "shield"])),
    },
    condition: Object.fromEntries(PARTS.map(([id]) => [id, 100])),
    energy: [100, 100, 100],
    fuel: 0,
    decision: null,
    drive: null,
    km: 0,
    faults: [],
    history: [],
    result: null,
  };
}
export function startPreparation(s, config) {
  if (s.phase !== "briefing") throw Error("La preparación ya comenzó.");
  if (!["scout", "dune", "rocket"].includes(config.car))
    throw Error("Vehículo inválido.");
  for (const [id] of PARTS) {
    if (!KITS.some((k) => k.id === config.kits[id]))
      throw Error("Pieza inválida.");
    if (
      !Number.isInteger(config.tuning[id]) ||
      config.tuning[id] < 0 ||
      config.tuning[id] > 100 ||
      config.tuning[id] % 5
    )
      throw Error("Reglaje inválido.");
  }
  s.config = clone(config);
  s.phase = "preparation";
  s.phaseTime = 0;
  s.paused = false;
}
export function defaultDecision(s) {
  return { driver: 0, pace: "steady", fuel: 40, repairs: "all", rest: "full" };
}
function problem(s, stage, code, text) {
  if (!s.faults.some((f) => f.stage === stage && f.code === code))
    s.faults.push({ stage, code, text });
}
function evaluate(s) {
  const r = STAGES[s.stage],
    d = s.decision;
  let penalty = 0;
  const add = (code, text, weight = 4) => {
    penalty += weight;
    problem(s, s.stage, code, text);
  };
  if (s.config.car !== SOLUTION.car)
    add(
      "car",
      "El auto elegido no combina control y comodidad para las cinco superficies. Probá el Scout.",
      12,
    );
  for (const [id, name] of PARTS) {
    const diff = s.config.tuning[id] - SOLUTION.tuning[id];
    if (diff)
      add(
        "tune-" + id,
        `${name}: reglaje ${s.config.tuning[id]} demasiado ${diff > 0 ? "alto; movelo hacia la izquierda" : "bajo; movelo hacia la derecha"}. ${Math.abs(diff) <= 5 ? "Estuviste a un paso de calibrarlo." : "Todavía falta afinarlo."}`,
        Math.max(1, Math.abs(diff) / 5),
      );
    if (s.config.kits[id] !== SOLUTION.kits[id])
      add(
        "kit-" + id,
        `${name}: ${KITS.find((k) => k.id === s.config.kits[id]).name} no sirve para este examen. ${SOLUTION.kits[id] === "shield" ? "Priorizá resistencia." : "Aquí necesitás la pieza liviana de mayor rendimiento."}`,
      );
    if (s.condition[id] < 99.9)
      add(
        "wear-" + id,
        `${name} salió con ${Math.round(s.condition[id])}% de estado. Repará todas las piezas antes de salir.`,
      );
  }
  if (d.driver !== r.driver)
    add(
      "driver",
      `La especialidad del piloto activo no protege ${PARTS.find(([id]) => id === r.weak)[1].toLowerCase()} en ${r.terrain.toLowerCase()}. Revisá las fichas.`,
      12,
    );
  if (s.energy[d.driver] < 99.9)
    add(
      "energy",
      `${DRIVERS[d.driver].name} largó con ${Math.round(s.energy[d.driver])}% de energía. Recuperá completamente al equipo en campamento.`,
      10,
    );
  if (d.pace !== r.pace)
    add(
      "pace",
      r.pace === "careful"
        ? "Acá se necesitaba ritmo prudente: el riesgo anuló la ganancia de velocidad."
        : r.pace === "attack"
          ? "Llegaste al sector rápido sin aprovechar el ritmo de ataque."
          : "Este tramo pedía ritmo constante, sin forzar ni perder tiempo.",
      8,
    );
  if (d.fuel !== r.fuel)
    add(
      "fuel",
      `Carga de ${d.fuel} L ${d.fuel < r.fuel ? "insuficiente: faltaron " + (r.fuel - d.fuel) + " L" : "excesiva: sobraron " + (d.fuel - r.fuel) + " L de lastre"}. Recordá esta demanda para el próximo intento.`,
      5,
    );
  if (s.stage && d.repairs !== "all")
    add(
      "repairs",
      "El mantenimiento parcial dejó piezas desgastadas. En este entrenamiento se exige reparar las seis.",
      8,
    );
  if (s.stage && d.rest !== "full")
    add(
      "rest",
      "El descanso incompleto dejó al relevo sin recuperar. En este entrenamiento, descansá al equipo por completo.",
      8,
    );
  const ratio = penalty ? Math.max(0.32, 1 - penalty / 140) : 1;
  const wrongKit = s.config.kits[r.weak] !== SOLUTION.kits[r.weak];
  return {
    ratio,
    startCondition: clone(s.condition),
    startEnergy: [...s.energy],
    startFuel: d.fuel,
    breakdown: d.driver !== r.driver && s.config.kits[r.weak] !== "reserve",
    highRisk: wrongKit || d.pace !== r.pace || s.config.tuning.cooling < 75,
  };
}
function beginDrive(s) {
  s.drive = evaluate(s);
  s.phase = "driving";
  s.phaseTime = 0;
  s.fuel = s.decision.fuel;
  s.paused = false;
}
export function commitStage(s, decision) {
  if (!["ready", "camp"].includes(s.phase))
    throw Error("Esperá al campamento.");
  if (
    ![0, 1, 2].includes(decision.driver) ||
    !["steady", "careful", "attack"].includes(decision.pace) ||
    !["all", "broken", "none"].includes(decision.repairs) ||
    !["full", "half", "none"].includes(decision.rest) ||
    !Number.isInteger(decision.fuel) ||
    decision.fuel < 20 ||
    decision.fuel > 60 ||
    decision.fuel % 5
  )
    throw Error("Plan inválido.");
  s.decision = clone(decision);
  if (!s.stage) beginDrive(s);
  else {
    s.serviceStart = { condition: clone(s.condition), energy: [...s.energy] };
    s.phase = "service";
    s.phaseTime = 0;
    s.paused = false;
  }
}
export function phaseDuration(s) {
  return s.phase === "driving"
    ? Math.min(
        arrivalSeconds(s),
        (300 * s.drive.startFuel) / STAGES[s.stage].fuel,
      )
    : s.phase === "preparation"
      ? 300
      : s.phase === "service"
        ? Math.max(
            45,
            s.decision.repairs !== "none" ? 120 : 0,
            s.decision.rest === "full"
              ? 150
              : s.decision.rest === "half"
                ? 75
                : 0,
          )
        : 0;
}
// The five-minute pace is a reference, never a trigger to teleport to camp.
function arrivalSeconds(s) {
  const r = STAGES[s.stage],
    d = s.drive;
  return d.breakdown
    ? 165 + (r.km - r.km * d.ratio * 0.55) * 120
    : 300 / d.ratio;
}
export function stageDistance(s, fraction = s.phaseTime / 300) {
  const r = STAGES[s.stage],
    p = Math.min(Math.max(0, fraction), s.drive.startFuel / r.fuel);
  const km =
    s.drive.breakdown && p > 0.55
      ? r.km * s.drive.ratio * 0.55 + 2.5 * (p - 0.55)
      : r.km * s.drive.ratio * p;
  return Math.min(r.km, km);
}
export function rivalReference(seconds, ratio = 1) {
  if (seconds < 300) return { km: 0, speed: 0, phase: "Puesta a punto" };
  let time = Math.max(0, seconds - 300),
    km = 0;
  for (const r of STAGES) {
    const duration = 300 / ratio;
    if (time < duration)
      return {
        km: km + (r.km * time) / duration,
        speed: r.km * 12 * ratio,
        phase: "En carrera",
      };
    km += r.km;
    time -= duration;
    if (r !== STAGES.at(-1)) {
      if (time < 150)
        return { km, speed: 0, phase: "Asistencia en campamento" };
      time -= 150;
    }
  }
  return { km: 40, speed: 0, phase: "Recorrido de referencia finalizado" };
}
function recordStage(s, km, completed) {
  s.km += km;
  s.history.push({
    stage: s.stage,
    km,
    completed,
    faults: s.faults.filter((f) => f.stage === s.stage),
    driver: s.decision.driver,
    breakdown: s.drive.breakdown,
  });
}
function finishTraining(s, reason) {
  s.phase = "result";
  s.paused = true;
  s.result = {
    won: reason === "finished" && s.faults.length === 0,
    reason,
    km: s.km,
    position:
      1 +
      [0.9999, 0.94, 0.88, 0.82, 0.75].filter(
        (ratio) => rivalReference(s.elapsed, ratio).km > s.km,
      ).length,
  };
}
export function telemetry(s) {
  if (s.phase !== "driving") return { speed: 0, rpm: 850, heat: 25, risk: 0 };
  const r = STAGES[s.stage],
    p = s.phaseTime / 300,
    broken = s.drive.breakdown && p >= 0.55;
  const speed = s.fuel <= 0 ? 0 : broken ? 30 : r.km * 12 * s.drive.ratio;
  return {
    speed,
    rpm:
      speed === 0
        ? 850
        : broken
          ? 1700
          : 2100 + speed * 11 + Math.sin(s.phaseTime / 3) * 450,
    heat: r.heat + 52 + (s.config.tuning.cooling < 75 ? 30 : 0),
    risk: s.drive.highRisk ? 82 : 18,
    broken,
  };
}
export function advanceTraining(s, seconds) {
  if (s.paused || !phaseDuration(s)) return s;
  let remaining = Math.max(0, Math.min(2400, Number(seconds) || 0));
  while (remaining > 0 && !s.paused && phaseDuration(s)) {
    const duration = phaseDuration(s),
      delta = Math.max(
        0,
        Math.min(remaining, duration - s.phaseTime, MAX_SECONDS - s.elapsed),
      );
    s.phaseTime += delta;
    s.elapsed += delta;
    remaining -= delta;
    if (s.phase === "service") {
      const repair = Math.min(1, s.phaseTime / 120),
        rest = Math.min(1, s.phaseTime / 150);
      for (const [id] of PARTS) {
        const from = s.serviceStart.condition[id],
          yes =
            s.decision.repairs === "all" ||
            (s.decision.repairs === "broken" && from === 0);
        s.condition[id] = yes ? from + (100 - from) * repair : from;
      }
      s.energy = s.serviceStart.energy.map((e) =>
        Math.min(
          100,
          e +
            100 *
              (s.decision.rest === "full"
                ? rest
                : s.decision.rest === "half"
                  ? Math.min(0.5, s.phaseTime / 150)
                  : 0),
        ),
      );
      s.fuel = s.decision.fuel * Math.min(1, s.phaseTime / 45);
    }
    if (s.phase === "driving") {
      const r = STAGES[s.stage],
        p = s.phaseTime / 300;
      for (const [id] of PARTS)
        s.condition[id] = Math.max(
          0,
          s.drive.startCondition[id] -
            (r.wear + (s.drive.ratio < 1 ? 15 : 0)) *
              (s.config.kits[id] === "shield"
                ? 0.85
                : s.config.kits[id] === "light"
                  ? 1.2
                  : 0.95) *
              p,
        );
      if (s.drive.breakdown && p >= 0.55) s.condition[r.weak] = 0;
      s.energy = s.drive.startEnergy.map((e, i) =>
        i === s.decision.driver
          ? Math.max(0, e - r.fatigue * p)
          : Math.min(100, e + 20 * p),
      );
      s.fuel = Math.max(0, s.drive.startFuel - r.fuel * p);
    }
    const reached =
      s.phase === "driving" && stageDistance(s) >= STAGES[s.stage].km - 1e-9;
    if (
      s.elapsed >= MAX_SECONDS - 1e-9 &&
      !(reached && s.stage === STAGES.length - 1)
    ) {
      problem(
        s,
        s.stage,
        "deadline",
        "Se agotaron los 40 minutos del intento. No alcanzaste la meta; no se puede cambiar el plan fuera de un campamento.",
      );
      if (s.phase === "driving") recordStage(s, stageDistance(s), false);
      finishTraining(s, "deadline");
      break;
    }
    if (s.phaseTime < duration - 1e-9) break;
    s.elapsed = Math.round(s.elapsed * 1000000) / 1000000;
    if (s.phase === "preparation") {
      s.phase = "ready";
      s.paused = true;
    } else if (s.phase === "service") beginDrive(s);
    else {
      if (!reached) {
        problem(
          s,
          s.stage,
          "stranded",
          "Te quedaste sin combustible antes del campamento. La baja velocidad y las averías alargan el trayecto; revisá el plan y la preparación. No hay asistencia ni relevo en ruta.",
        );
        recordStage(s, stageDistance(s), false);
        finishTraining(s, "fuel");
        break;
      }
      recordStage(s, STAGES[s.stage].km, true);
      s.stage++;
      if (s.stage === 5) {
        finishTraining(s, "finished");
      } else s.phase = "camp";
      s.paused = true;
    }
  }
  return s;
}
export function resumeTraining(raw) {
  try {
    const s = JSON.parse(raw);
    if (s?.version === 1) {
      // Old attempts could already have skipped a camp. Keep their setup, but
      // restart only those inconsistent attempts; the UI backs up their save.
      if (s.history?.some((h) => Math.abs(h.km - STAGES[h.stage]?.km) > 1e-9)) {
        const fresh = newTraining((s.attempt || 1) + 1);
        fresh.config = s.config;
        fresh.legacyRestart = true;
        return resumeTraining(JSON.stringify(fresh));
      }
      s.version = VERSION;
      s.history?.forEach((h) => (h.completed = true));
      if (s.result) s.result.reason = "finished";
    }
    if (
      s.version !== VERSION ||
      ![
        "briefing",
        "preparation",
        "ready",
        "driving",
        "service",
        "camp",
        "result",
      ].includes(s.phase) ||
      !Number.isInteger(s.stage) ||
      s.stage < 0 ||
      s.stage > 5 ||
      (s.stage === 5 && s.phase !== "result") ||
      !Number.isFinite(s.elapsed) ||
      s.elapsed < 0 ||
      s.elapsed > MAX_SECONDS + 0.001 ||
      !Number.isFinite(s.phaseTime) ||
      s.phaseTime < 0 ||
      s.phaseTime > MAX_SECONDS ||
      !Array.isArray(s.energy) ||
      s.energy.length !== 3 ||
      s.energy.some((n) => !Number.isFinite(n) || n < 0 || n > 100) ||
      !Array.isArray(s.faults) ||
      !Array.isArray(s.history) ||
      !s.config?.tuning ||
      !s.config?.kits ||
      !s.condition ||
      ![1, 2, 10].includes(s.speed) ||
      !Number.isFinite(s.km) ||
      s.km < 0 ||
      s.km > 40 ||
      !Number.isInteger(s.attempt) ||
      s.attempt < 1 ||
      !["scout", "dune", "rocket"].includes(s.config.car)
    )
      return null;
    for (const [id] of PARTS)
      if (
        !Number.isFinite(s.condition[id]) ||
        s.condition[id] < 0 ||
        s.condition[id] > 100 ||
        !Number.isInteger(s.config.tuning[id]) ||
        s.config.tuning[id] < 0 ||
        s.config.tuning[id] > 100 ||
        s.config.tuning[id] % 5 ||
        !KITS.some((k) => k.id === s.config.kits[id])
      )
        return null;
    if (["driving", "service"].includes(s.phase) && !s.decision) return null;
    if (
      (s.phase === "driving" && !s.drive) ||
      (s.phase === "service" && !s.serviceStart)
    )
      return null;
    if (
      s.decision &&
      (![0, 1, 2].includes(s.decision.driver) ||
        !["steady", "careful", "attack"].includes(s.decision.pace) ||
        !["all", "broken", "none"].includes(s.decision.repairs) ||
        !["full", "half", "none"].includes(s.decision.rest) ||
        !Number.isInteger(s.decision.fuel) ||
        s.decision.fuel < 20 ||
        s.decision.fuel > 60)
    )
      return null;
    if (
      s.drive &&
      (!Number.isFinite(s.drive.ratio) ||
        s.drive.ratio < 0.32 ||
        s.drive.ratio > 1 ||
        !Number.isFinite(s.drive.startFuel) ||
        !Array.isArray(s.drive.startEnergy) ||
        !s.drive.startCondition)
    )
      return null;
    if (
      s.serviceStart &&
      (!Array.isArray(s.serviceStart.energy) || !s.serviceStart.condition)
    )
      return null;
    if (
      s.history.length > STAGES.length ||
      s.history.some(
        (h) => !Number.isInteger(h.stage) || !Array.isArray(h.faults),
      ) ||
      s.faults.some(
        (f) =>
          typeof f.text !== "string" ||
          typeof f.code !== "string" ||
          !Number.isInteger(f.stage),
      )
    )
      return null;
    if (
      s.phase === "result" &&
      (!s.result ||
        typeof s.result.won !== "boolean" ||
        !["finished", "fuel", "deadline"].includes(s.result.reason) ||
        (s.result.reason === "finished") !== (s.stage === 5))
    )
      return null;
    if (
      s.history.some(
        (h, i) =>
          h.stage !== i ||
          !Number.isFinite(h.km) ||
          h.km < 0 ||
          h.km > STAGES[i]?.km ||
          (i < s.stage &&
            (!h.completed || Math.abs(h.km - STAGES[i].km) > 1e-9)),
      )
    )
      return null;
    if (
      Math.abs(s.km - s.history.reduce((n, h) => n + h.km, 0)) > 1e-9 ||
      (s.phase !== "result" && s.history.length !== s.stage)
    )
      return null;
    s.paused = true;
    return s;
  } catch {
    return null;
  }
}
