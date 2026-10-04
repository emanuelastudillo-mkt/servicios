import { standings } from "./engine.js";
export function raceNeighbors(state, teamId) {
  const order = standings(state),
    index = order.findIndex((t) => t.id === teamId),
    team = order[index];
  if (!team) throw Error("Equipo no encontrado.");
  const neighbor = (other) =>
    other
      ? {
          id: other.id,
          name: other.name,
          km: Math.abs(other.totalKm - team.totalKm),
          seconds:
            other.finishTime !== null && team.finishTime !== null
              ? Math.abs(other.finishTime - team.finishTime)
              : null,
        }
      : null;
  return {
    position: index + 1,
    total: order.length,
    ahead: neighbor(order[index - 1]),
    behind: neighbor(order[index + 1]),
  };
}
