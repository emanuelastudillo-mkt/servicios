import { ADMIN_ENABLED } from "./admin-ui.js";
import { cash } from "./management.js";
import { SAVE_KEY, encodeSave } from "./storage.js";

export function resetPrototypeSave(
  storage,
  state,
  { enabled = ADMIN_ENABLED, now = Date.now() } = {},
) {
  if (!enabled || state?.mode !== "single")
    throw Error(
      "El reset total sólo está disponible en el prototipo single player.",
    );
  const base = `${SAVE_KEY}-archive-reset-${now}`;
  let backupKey = base,
    suffix = 0;
  while (storage.getItem(backupKey) !== null) backupKey = `${base}-${++suffix}`;
  // Store the backup first. A quota/error must leave the active game intact.
  storage.setItem(backupKey, encodeSave(state));
  // An empty active slot starts onboarding on reload. Keep other saves/settings.
  storage.setItem(SAVE_KEY, "");
  return backupKey;
}

export function injectMoney(state, amount, { enabled = ADMIN_ENABLED } = {}) {
  if (!enabled || state?.mode !== "single")
    throw new Error(
      "La inyección de dinero sólo está disponible en Admin del prototipo single player.",
    );
  const team = state.teams.find((t) => t.id === "player");
  if (!Number.isSafeInteger(amount) || amount < 1 || amount > 10000000)
    throw new Error("Ingresá un importe entero entre 1 y 10.000.000 cr.");
  if (!team || team.budget + amount > 100000000 || team.ledger.length >= 5000)
    throw new Error(
      "La inyección supera el límite de saldo o movimientos de esta partida.",
    );
  cash(state, team, amount, "Admin · inyección de dinero de prueba");
  return team.budget;
}
