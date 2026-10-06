import { partSpec } from "./part-brands.js";
import { partProtected } from "./staff.js";
import { GRADES, PART_TYPES, STEP } from "./catalog.js";
import { vehicleFactors, activeCar } from "./workshop.js";

// Shared with the simulation: failures are sampled once per driving tick.
export function failureRate(piece, heat, boost = 0) {
  if (piece.grade === "reserve" || piece.broken) return 0;
  return (
    partSpec(piece).failure *
    (1 + ((100 - piece.condition) / 35) ** 2) *
    (boost + 1) *
    (1 + Math.max(0, heat - 110) * 0.07)
  );
}
export function failureProbability(
  piece,
  heat,
  boost = 0,
  hours = 1,
  carRisk = 1,
) {
  const tick = Math.min(
    1,
    (failureRate(piece, heat, boost) * carRisk * STEP) / 3600,
  );
  return 1 - (1 - tick) ** ((hours * 3600) / STEP);
}
export function vehicleHealth(team) {
  const plan = team.activePlan || team.plans[team.stageIndex];
  const parts = PART_TYPES.map((type) => {
    const piece = team.parts[type.id];
    const probability = partProtected(team, type.id)
      ? 0
      : failureProbability(
          piece,
          team.heat,
          plan?.boost || 0,
          1,
          vehicleFactors(team).risk,
        );
    return {
      id: type.id,
      name: type.name,
      short: type.short,
      probability,
      level: piece.broken
        ? "critical"
        : probability >= 0.08
          ? "warning"
          : "normal",
      broken: piece.broken,
      reserve: piece.grade === "reserve",
      protected: partProtected(team, type.id),
    };
  });
  const alerts = parts
    .filter((p) => p.level !== "normal")
    .map((p) => ({
      id: p.id,
      level: p.level,
      text: p.broken ? `${p.short}: avería` : `${p.short}: riesgo elevado`,
      detail: p.broken
        ? "Reparar o sustituir en el próximo campamento."
        : `${(p.probability * 100).toFixed(1)}% aprox. en 1 h de conducción con las condiciones actuales.`,
    }));
  if (team.phase !== "finished") {
    const car = activeCar(team);
    if (car?.condition < 40)
      alerts.push({
        id: "chassis",
        level: car.condition < 20 ? "critical" : "warning",
        text: "Vehículo deteriorado",
        detail: `Estado ${Math.round(car.condition)}/100. Reparalo en la base al finalizar la carrera.`,
      });
    if (team.heat > 112)
      alerts.push({
        id: "heat",
        level: team.heat > 122 ? "critical" : "warning",
        text: team.heat > 122 ? "Sobrecalentamiento" : "Temperatura elevada",
        detail: `${Math.round(team.heat)} °C. Abrir refrigeración o reducir exigencia en el próximo plan.`,
      });
    if (["racing", "hold"].includes(team.phase) && team.fuel <= 0)
      alerts.push({
        id: "fuel",
        level: "critical",
        text: "Sin combustible",
        detail: "Asistencia en ruta y penalización de tiempo.",
      });
  }
  return {
    parts,
    alerts,
    level: alerts.some((a) => a.level === "critical")
      ? "critical"
      : alerts.length
        ? "warning"
        : "normal",
  };
}
