import { SHIELDS, shieldSVG, shieldInfo } from "./shields.js";
import { esc } from "./visuals.js";
export function shieldPicker(id = 1, action = "choose-shield") {
  const selected = shieldInfo(id);
  return `<details id="shield-picker" class="shield-picker" data-preserve-open><summary>Elegir escudo · ${selected.name} · 48 diseños</summary><p class="small-note">Emblemas originales de cromo y esmalte. El nombre del diseño no cambia el de tu escudería.</p><div class="shield-grid">${SHIELDS.map((s) => `<button type="button" class="shield-option ${id === s.id ? "selected" : ""}" data-action="${action}" data-id="${s.id}" aria-label="Elegir escudo ${s.id} · ${s.name}" aria-pressed="${id === s.id}">${shieldSVG(s.id)}<strong>${s.name}</strong><small>${String(s.id).padStart(2, "0")}</small>${id === s.id ? '<span class="shield-check" aria-hidden="true">✓</span>' : ""}</button>`).join("")}</div></details>`;
}
export function identityPanel(s) {
  const t = s.teams.find((t) => t.id === "player");
  return `<section class="panel identity-panel"><div class="identity-preview">${shieldSVG(t.shieldId)}<div><span class="eyebrow">IDENTIDAD DE LA ESCUDERÍA</span><h2>${esc(t.name)}</h2><p class="director-label">Director · <strong>@${esc(t.directorName)}</strong></p><p class="small-note">Hasta 3 pilotos y 5 mecánicos.</p></div></div><form id="identity-form" class="identity-form"><label>Nombre de la escudería<input id="team-name" name="teamName" maxlength="40" value="${esc(t.name)}" required></label><label>Usuario del director<input id="director-name" name="directorName" minlength="3" maxlength="24" value="${esc(t.directorName)}" autocomplete="nickname" spellcheck="false" required></label><button class="button primary" type="submit">Guardar identidad</button></form><p class="small-note">El director sos vos; los pilotos forman parte de tu plantel. Usuario de 3 a 24 caracteres, sin espacios.</p>${shieldPicker(t.shieldId)}</section>`;
}
