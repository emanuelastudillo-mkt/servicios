// Prototype-only presentation. Removing this import and mount removes the menu.
export const ADMIN_ENABLED = true;
export function adminBar(state, { busy = false, canNext = true } = {}) {
  if (!ADMIN_ENABLED || !state) return "";
  const player = state.teams.find((t) => t.id === "player");
  return `<aside class="admin-menu" aria-label="Administración del prototipo"><div class="admin-label"><strong>ADMIN</strong><span>Controles del prototipo</span></div><div class="admin-actions"><button class="button small" data-action="toggle-time" ${busy ? "disabled" : ""}>${state.speed ? "Pausar" : "Reanudar"}</button><select id="time-speed" aria-label="Velocidad del tiempo" ${busy ? "disabled" : ""}>${[
    [0, "Pausado"],
    [1, "1× · tiempo real"],
    [60, "60×"],
    [600, "600×"],
    [3600, "3600×"],
  ]
    .map(
      ([v, label]) =>
        `<option value="${v}" ${state.speed === v ? "selected" : ""}>${label}</option>`,
    )
    .join(
      "",
    )}</select>${state.clock < 0 ? `<button class="button small" data-action="skip-start" ${busy ? "disabled" : ""}>Ir a la largada</button>` : ""}<button class="button small" data-action="advance-hour" ${busy ? "disabled" : ""}>+1 hora</button><button class="button small" data-action="advance-day" ${busy ? "disabled" : ""}>+24 horas</button><button class="button small" data-action="next-camp" ${busy || ["finished", "cutoff", "dns", "unregistered"].includes(player.phase) ? "disabled" : ""}>${busy ? "Calculando…" : "Próxima parada"}</button><button class="button small admin-next" data-action="next-race" ${busy || !canNext ? "disabled" : ""}>Próxima carrera</button></div></aside>`;
}
