import { RACE_LOGOS } from "../data/race-logos.js";
import { esc } from "./visuals.js";
export function raceLogo(race, variant = "") {
  const id =
    typeof race === "string" ? race.split("@")[0] : race?.routeId || race?.id;
  const info = RACE_LOGOS[id?.split("@")[0]];
  if (!info) return "";
  const name = typeof race === "object" ? race.name || info.name : info.name;
  const description = `${name} · Bandera de ${info.countryName} (largada en ${info.startCity}) · ${info.terrainName}`;
  const size = ["compact", "hero"].includes(variant)
    ? ` race-logo-${variant}`
    : "";
  return `<img class="race-logo${size}" src="assets/races/${id.split("@")[0]}.svg" width="128" height="144" alt="${esc(description)}" title="${esc(description)}" loading="lazy" decoding="async">`;
}
