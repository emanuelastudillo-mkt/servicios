import { clamp } from "./catalog.js";
import { jobFor, crewRate } from "./workshop.js";

// Timings mirror the actual stop: mechanical jobs in sequence, rest in parallel.
export function serviceTimeline(entries, { rate, restHours, first, seconds }) {
  let offset = 0;
  const tasks = entries.map((entry, index) => {
    const duration = entry.skipped
      ? 0
      : entry.kind === "assistance"
        ? entry.hours * 3600
        : first
          ? 0
          : (entry.hours * 3600) / rate;
    const task = {
      id: `task-${index}`,
      kind: entry.kind,
      label: entry.label,
      detail: entry.detail || "",
      skipped: !!entry.skipped,
      offset,
      duration,
    };
    offset += duration;
    return task;
  });
  const rest = first ? 0 : restHours * 3600;
  tasks.push({
    id: "rest",
    kind: "rest",
    label: "Descanso del piloto",
    detail: "En paralelo con la asistencia, hasta el descanso elegido.",
    skipped: false,
    offset: 0,
    duration: rest,
  });
  const last = Math.max(offset, rest);
  if (seconds > last + 0.001)
    tasks.push({
      id: "checkout",
      kind: "checkout",
      label: "Control de salida",
      detail: "Verificación final del campamento.",
      skipped: false,
      offset: last,
      duration: seconds - last,
    });
  return { tasks, mechanicalSeconds: offset, restSeconds: rest };
}

export function stopStatus(state, team) {
  if (
    team.preparation &&
    state.clock < team.preparation.until &&
    ["waiting", "preparing"].includes(team.phase)
  ) {
    const p = team.preparation,
      duration = p.until - p.start,
      elapsed = clamp(state.clock - p.start, 0, duration);
    return {
      title:
        state.clock < p.start
          ? "Puesta a punto programada"
          : "Puesta a punto inicial",
      remaining: p.until - state.clock,
      progress: elapsed / duration,
      tasks: [
        {
          id: "preparation",
          kind: "preparation",
          label: "Verificar y ajustar las seis piezas",
          status: state.clock < p.start ? "queued" : "active",
          duration,
          progress: elapsed / duration,
          remaining: p.until - state.clock,
        },
      ],
      reason:
        "Cinco horas de preparación, una sola vez antes de la primera etapa.",
      advice:
        "La salida es automática cuando termina la preparación y llega la largada oficial. Los reglajes quedan fijos durante toda la carrera.",
    };
  }
  if (team.phase === "service" && team.service) {
    const s = team.service,
      total = Math.max(0, s.until - s.start),
      elapsed = clamp(state.clock - s.start, 0, total);
    const source = s.tasks || [
      {
        id: "legacy",
        kind: "legacy",
        label: "Asistencia y descanso",
        detail:
          "Esta parada empezó en una versión anterior: se conserva su horario de salida.",
        skipped: false,
        offset: 0,
        duration: total,
      },
    ];
    const tasks = source.map((t) => {
      const done = elapsed + 1e-6 >= t.offset + t.duration;
      return {
        ...t,
        status: t.skipped
          ? "skipped"
          : done
            ? "done"
            : elapsed < t.offset
              ? "queued"
              : "active",
        progress: t.skipped
          ? 0
          : t.duration
            ? clamp((elapsed - t.offset) / t.duration, 0, 1)
            : 1,
        remaining: Math.max(0, t.offset + t.duration - elapsed),
      };
    });
    const pending = tasks.filter(
      (t) => !["done", "skipped"].includes(t.status),
    );
    const longest = pending.reduce(
      (a, b) => (!a || b.remaining > a.remaining ? b : a),
      null,
    );
    const restDominates = longest?.kind === "rest";
    return {
      title: "Parada en campamento",
      remaining: Math.max(0, s.until - state.clock),
      tasks,
      progress: total ? elapsed / total : 1,
      reason: !longest
        ? "Tareas completas. Salida en el próximo paso de simulación."
        : restDominates
          ? "El descanso del piloto define la salida."
          : longest.kind === "assistance"
            ? "La asistencia de combustible agrega 4 horas."
            : "El trabajo de asistencia define la salida.",
      advice: !longest
        ? "El auto retoma la carrera automáticamente."
        : restDominates
          ? "Para la próxima etapa: alterná un piloto descansado o revisá las horas de descanso elegidas."
          : longest.kind === "assistance"
            ? "Reservá presupuesto para combustible antes de llegar a la parada."
            : "Más mecánicos en carrera, repuestos en mejor estado o piezas de recambio reducen esta espera.",
    };
  }
  if (team.phase === "camp") {
    const blocked = jobFor(team, team.activeCarId),
      plan = team.plans[team.stageIndex];
    return {
      title: "Esperando en campamento",
      tasks: [],
      remaining: null,
      reason: blocked
        ? "El auto tiene un trabajo pendiente en el taller de la base."
        : crewRate(team, "race") === 0
          ? "Faltan mecánicos asignados a carrera."
          : !plan
            ? "Se aplicará el plan automático: reparación máxima, descanso completo y tanque lleno."
            : !plan.auto
              ? "La salida automática está desactivada en el plan."
              : "Plan listo. La asistencia comienza en el próximo paso del reloj.",
      advice: blocked
        ? "Completá el trabajo del auto o cancelalo desde el Taller."
        : !plan
          ? "Podés personalizar las etapas futuras. La asistencia automática comienza en el próximo paso del reloj."
          : !plan.auto
          ? "Revisá y guardá el plan en Campamento para continuar."
          : "El reloj debe estar en marcha para continuar.",
    };
  }
  if (team.phase === "racing" && team.holdUntil > state.clock)
    return {
      title: "Detenido en ruta",
      remaining: team.holdUntil - state.clock,
      tasks: [],
      reason: "Asistencia o incidente en curso.",
      advice: "La marcha se reanuda automáticamente al terminar la espera.",
    };
  if (team.phase === "waiting")
    return {
      title: "Esperando la largada",
      remaining: Math.max(0, -state.clock),
      tasks: [],
      reason: "Largada compartida de todos los equipos.",
      advice: "Guardá el plan inicial antes del horario de salida.",
    };
  return null;
}

export function validServiceTimeline(service) {
  if (service.tasks === undefined) return true; // Older saves keep their original deadline.
  const span = service.until - service.start;
  return (
    Array.isArray(service.tasks) &&
    service.tasks.length <= 20 &&
    service.tasks.length > 0 &&
    new Set(service.tasks.map((t) => t?.id)).size === service.tasks.length &&
    service.tasks.every(
      (t) =>
        t &&
        typeof t.id === "string" &&
        t.id.length <= 40 &&
        [
          "repair",
          "replace",
          "reserve",
          "fuel",
          "rest",
          "assistance",
          "checkout",
        ].includes(t.kind) &&
        typeof t.label === "string" &&
        t.label.length <= 150 &&
        typeof t.detail === "string" &&
        t.detail.length <= 300 &&
        typeof t.skipped === "boolean" &&
        Number.isFinite(t.offset) &&
        t.offset >= 0 &&
        Number.isFinite(t.duration) &&
        t.duration >= 0 &&
        t.offset + t.duration <= span + 0.01,
    )
  );
}
