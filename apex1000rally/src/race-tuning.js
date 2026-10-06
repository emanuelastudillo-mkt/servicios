// Values are public; optimal values and their effects belong exclusively to the server.
export const PREPARATION_MS = 5 * 3600000;
export const TUNINGS = [
  {
    id: "engine",
    name: "Motor",
    left: "Entrega suave",
    right: "Entrega agresiva",
  },
  {
    id: "transmission",
    name: "Transmisión",
    left: "Relación corta",
    right: "Relación larga",
  },
  { id: "suspension", name: "Suspensión", left: "Blanda", right: "Firme" },
  {
    id: "tyres",
    name: "Neumáticos",
    left: "Presión baja",
    right: "Presión alta",
  },
  {
    id: "cooling",
    name: "Refrigeración",
    left: "Mayor flujo",
    right: "Menor resistencia",
  },
  {
    id: "brakes",
    name: "Frenos",
    left: "Progresivos",
    right: "Respuesta inmediata",
  },
];
export const defaultTunings = () =>
  Object.fromEntries(TUNINGS.map((t) => [t.id, 50]));
export function validateTunings(values = defaultTunings()) {
  if (
    !values ||
    typeof values !== "object" ||
    Object.keys(values).length !== TUNINGS.length ||
    !TUNINGS.every(
      (t) =>
        Number.isInteger(values[t.id]) &&
        values[t.id] >= 0 &&
        values[t.id] <= 100,
    )
  )
    throw Error("Los seis reglajes deben ser números enteros entre 0 y 100.");
  return { ...values };
}
export function tuningEffects(values, optimal) {
  return Object.fromEntries(
    TUNINGS.map(({ id }) => [
      id,
      1.3 -
        (0.6 * Math.abs(values[id] - optimal[id])) /
          Math.max(optimal[id], 100 - optimal[id]),
    ]),
  );
}
export function preparationWindow(now, event) {
  const start = Math.max(now, event.start - PREPARATION_MS);
  const readyAt = start + PREPARATION_MS;
  if (readyAt >= event.end)
    throw Error(
      "No quedan cinco horas para preparar el auto y salir antes del cierre de la carrera.",
    );
  return { preparationStart: start, readyAt };
}
