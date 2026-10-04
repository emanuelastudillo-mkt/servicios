import { esc } from "./visuals.js";
import { routeFor } from "./route.js";
import { journalEntry } from "./journal.js";

export function journalPage(state) {
  const team = state.teams.find((t) => t.id === "player"),
    route = routeFor(state),
    pages = [...(team.journal || [])];
  if (
    team.stageNotes &&
    !pages.some((p) => p.stage === team.stageNotes.stage)
  ) {
    const live = journalEntry(
      team,
      route.stages[team.stageNotes.stage],
      state.clock,
      false,
    );
    if (live) pages.push(live);
  }
  return `<div class="page-title"><div><span class="eyebrow">CUADERNO DE RUTA / ${esc(route.name)}</span><h1>Lo que nos dejó el camino.</h1><p>Una o dos notas por etapa, escritas a partir de lo que le ocurrió a tu equipo.</p></div><span class="badge">${pages.length} ${pages.length === 1 ? "ETAPA" : "ETAPAS"} CON NOTAS</span></div><section class="journal-cover"><span>Bitácora de la escudería</span><h2>${esc(team.name)}</h2><p>Las mejores decisiones suelen empezar con una anotación al margen.</p></section><div class="journal-pages">${
    pages.length
      ? pages
          .map((page) => {
            const stage = route.stages[page.stage];
            return `<article class="journal-paper"><div class="paper-holes" aria-hidden="true"></div><header><span>ETAPA ${String(page.stage + 1).padStart(2, "0")} · ${page.complete ? "COMPLETADA" : "OBSERVACIONES DE LA ETAPA"}</span><h2>${esc(stage.from.name)} → ${esc(stage.to.name)}</h2><p>Al volante: ${esc(page.driver)}</p>${page.partial ? "<small>Observaciones desde la actualización, no de toda la etapa.</small>" : ""}</header>${page.lines.map((line) => `<section class="journal-note note-${line.tone}"><p class="handwritten">${esc(line.text)}</p><div class="journal-margin"><span>Para la próxima</span><p>${esc(line.hint)}</p></div></section>`).join("")}<footer>${page.complete ? "Llegamos. Hora de preparar la siguiente etapa." : "Notas de esta etapa; pueden cambiar mientras seguimos observando."}</footer></article>`;
          })
          .join("")
      : `<article class="journal-paper journal-empty"><div class="paper-holes" aria-hidden="true"></div><header><span>PRIMERA PÁGINA</span><h2>Antes de salir...</h2></header><p class="handwritten">El cuaderno está listo. Cuando salgamos a la ruta, vamos a anotar lo que salió bien y lo que nos hizo perder tiempo.</p><p class="journal-empty-help">Las etapas anteriores a esta actualización no se reconstruyen: las notas empiezan con las nuevas observaciones.</p></article>`
  }</div>`;
}
