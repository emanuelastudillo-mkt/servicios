import { SHIELD_COUNT } from "./shields.js";
export const SHIELD_COLLECTION = "apex48";
export const validDirectorName = (name) =>
  typeof name === "string" &&
  /^[\p{L}\p{N}_.-]{3,24}$/u.test(name) &&
  name === name.normalize("NFKC");
export function directorName(value) {
  const name = typeof value === "string" ? value.trim().normalize("NFKC") : "";
  if (!validDirectorName(name))
    throw Error(
      "El usuario del director debe tener 3 a 24 caracteres: letras, números, punto, guion o guion bajo.",
    );
  return name;
}
export function migrateIdentity(t) {
  if (t.shieldCollection === undefined) {
    if (!Number.isInteger(t.shieldId) || t.shieldId < 1 || t.shieldId > 100)
      throw Error("Escudo guardado inválido.");
    if (t.shieldId > SHIELD_COUNT) t.legacyShieldId = t.shieldId;
    t.shieldId = ((t.shieldId - 1) % SHIELD_COUNT) + 1;
    t.shieldCollection = SHIELD_COLLECTION;
  }
  if (
    t.shieldCollection !== SHIELD_COLLECTION ||
    !Number.isInteger(t.shieldId) ||
    t.shieldId < 1 ||
    t.shieldId > SHIELD_COUNT
  )
    throw Error("Escudo desconocido.");
  if (t.directorName === undefined)
    t.directorName =
      t.id === "player" ? "Director" : `Director_${t.id.replace("rival-", "")}`;
  if (!validDirectorName(t.directorName))
    throw Error("Usuario del director inválido en la partida.");
}
export function renameIdentity(s, name, username) {
  const t = s.teams.find((t) => t.id === "player");
  const teamName = typeof name === "string" ? name.trim() : "";
  if (!teamName || teamName.length > 40 || /[\x00-\x1f\x7f]/.test(teamName))
    throw Error(
      "El nombre de la escudería debe tener entre 1 y 40 caracteres.",
    );
  const user = directorName(username);
  t.name = teamName;
  t.directorName = user;
}
export function chooseShield(s, id) {
  if (!Number.isInteger(id) || id < 1 || id > SHIELD_COUNT)
    throw Error("Elegí uno de los 48 escudos disponibles.");
  const t = s.teams.find((t) => t.id === "player");
  t.shieldId = id;
  t.shieldCollection = SHIELD_COLLECTION;
}
