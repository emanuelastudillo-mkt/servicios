import { PART_TYPES } from "./catalog.js";

export function startJournal(team, stage, time) {
  const driver =
    team.drivers.find((d) => d.id === team.activeDriver) || team.drivers[0];
  team.stageNotes = {
    stage: stage.index,
    partial: team.stageKm > 0,
    startedAt: time,
    driver: driver.name,
    km: 0,
    maxHeat: team.heat,
    minEnergy: driver.energy,
    heatSlowSeconds: 0,
    failures: [],
    errors: 0,
    fuelStops: 0,
    badSetup: { pressure: 0, ride: 0, gearing: 0 },
  };
}
export function noteIncident(team, kind, part = null) {
  const n = team.stageNotes;
  if (!n) return;
  if (kind === "failure" && !n.failures.includes(part)) n.failures.push(part);
  if (kind === "error") n.errors++;
  if (kind === "fuel") n.fuelStops++;
}
export function observeJournal(
  team,
  stage,
  { terrainId, distance, seconds, wasHot },
) {
  if (!team.stageNotes || team.stageNotes.stage !== stage.index)
    startJournal(team, stage, team.stageStart || 0);
  const n = team.stageNotes,
    plan = team.activePlan,
    d = team.drivers.find((d) => d.id === team.activeDriver) || team.drivers[0];
  n.km += distance;
  n.maxHeat = Math.max(n.maxHeat, team.heat);
  n.minEnergy = Math.min(n.minEnergy, d.energy);
  if (wasHot) n.heatSlowSeconds += seconds;
  if (
    (terrainId === "sand" && plan.pressure === "firm") ||
    (terrainId === "asphalt" && plan.pressure === "soft")
  )
    n.badSetup.pressure += distance;
  if (
    (["rock", "sand"].includes(terrainId) && plan.ride === "low") ||
    (terrainId === "asphalt" && plan.ride === "high")
  )
    n.badSetup.ride += distance;
  if (
    (terrainId === "asphalt" && plan.gearing === "short") ||
    (["rock", "mountain", "sand"].includes(terrainId) &&
      plan.gearing === "long")
  )
    n.badSetup.gearing += distance;
}
export function journalEntry(team, stage, at, complete = false) {
  const n = team.stageNotes;
  if (!n || n.stage !== stage.index) return null;
  const candidates = [];
  const add = (key, priority, tone, text, hint) =>
    candidates.push({ key, priority, tone, text, hint });
  if (n.failures.length) {
    const names = n.failures
      .map((id) => PART_TYPES.find((p) => p.id === id)?.short.toLowerCase())
      .filter(Boolean)
      .join(" y ");
    add(
      "failure",
      100,
      "problem",
      `Se averió ${names} y el auto quedó limitado a 30 km/h. Una señal clara de que necesitamos revisar la preparación.`,
      `Revisá ${names}: reparar, montar una pieza más resistente o bajar la exigencia reduce este riesgo.`,
    );
  }
  if (n.fuelStops)
    add(
      "fuel",
      95,
      "problem",
      "Nos quedamos sin combustible. Ver pasar a los demás mientras esperábamos la asistencia fue durísimo.",
      "Calculá la carga para todo el terreno de la etapa. Arena, exigencia y averías elevan el consumo.",
    );
  if (n.heatSlowSeconds >= 120)
    add(
      "heat",
      90,
      "warning",
      `El calor era insoportable para el auto: llegamos a ${Math.round(n.maxHeat)} °C y perdimos velocidad para proteger la mecánica.`,
      "Abrí la refrigeración, reducí la exigencia o elegí una pieza de refrigeración más resistente y en mejor estado.",
    );
  if (n.minEnergy <= 15)
    add(
      "fatigue",
      85,
      "warning",
      "Me costaba mantener los ojos abiertos. El cansancio se sentía en cada curva; no quiero volver a manejar así.",
      "Programá más descanso o relevá al piloto. La energía baja reduce la velocidad y aumenta el riesgo de errores.",
    );
  const setup = Object.entries(n.badSetup).sort((a, b) => b[1] - a[1])[0];
  if (setup && setup[1] >= Math.max(30, n.km * 0.3)) {
    const notes = {
      pressure: [
        "La presión de los neumáticos fue un desastre en buena parte del terreno. El auto no conseguía aprovechar la tracción.",
        "Presión baja para arena; alta para asfalto. Revisá qué superficie domina la etapa.",
      ],
      ride: [
        "Con esa altura de suspensión, el auto peleaba contra el terreno en vez de acompañarlo. Perdimos ritmo sin necesidad.",
        "Altura alta para arena y piedras; baja para asfalto. Elegí el compromiso según la mezcla de superficies.",
      ],
      gearing: [
        "La relación de transmisión no acompañaba al recorrido. No encontrábamos el ritmo que necesitábamos.",
        "Relación corta en arena, piedras y montaña; larga en asfalto. La opción mixta sirve de compromiso.",
      ],
    };
    add("setup-" + setup[0], 75, "warning", ...notes[setup[0]]);
  }
  if (n.errors)
    add(
      "error",
      70,
      "warning",
      `Cometimos ${n.errors === 1 ? "un error que nos hizo perder tiempo" : `${n.errors} errores que cortaron nuestro ritmo`}. Había que volver a concentrarse antes de seguir.`,
      "Un piloto navegante, más energía y un ritmo conservador ayudan a reducir los errores.",
    );
  if (complete && !n.partial && !n.errors && !n.failures.length && !n.fuelStops)
    add(
      "clean",
      65,
      "positive",
      "Pasamos la etapa sin errores, averías ni rescates. Se sintió bien poder pensar en el camino y no en los problemas.",
      "La preparación dio resultado en esta etapa. Compará terreno y temperatura antes de repetirla.",
    );
  if (complete && !n.partial && n.maxHeat < 105 && n.km > 0)
    add(
      "cool",
      50,
      "positive",
      "La temperatura se mantuvo bajo control. Llegamos sin que el calor nos obligara a perder velocidad.",
      "Buen equilibrio térmico. Mantené la refrigeración en condiciones para las etapas más cálidas.",
    );
  if (complete && !n.partial && n.minEnergy > 40)
    add(
      "rest",
      45,
      "positive",
      "Terminamos con energía para seguir concentrados. El descanso y el relevo se notaron al volante.",
      "Una tripulación descansada sostiene el rendimiento y reduce el riesgo de errores.",
    );
  if (!candidates.length)
    add(
      "running",
      10,
      "neutral",
      complete
        ? "Etapa terminada. Hoy no hubo un problema dominante que anotar."
        : "Seguimos en ruta. Por ahora no hay un problema dominante en las observaciones de esta etapa.",
      "Revisá el estado de las piezas y el combustible antes de guardar el próximo plan.",
    );
  const chosen = candidates
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 2)
    .map(({ priority, ...line }) => line);
  return {
    stage: stage.index,
    at,
    driver: n.driver,
    complete,
    partial: n.partial,
    km: n.km,
    lines: chosen,
  };
}
export function finishJournal(team, stage, at, complete = true) {
  const entry = journalEntry(team, stage, at, complete);
  if (!entry) return;
  team.journal ||= [];
  if (!team.journal.some((e) => e.stage === stage.index))
    team.journal.push(entry);
  team.stageNotes = null;
}
