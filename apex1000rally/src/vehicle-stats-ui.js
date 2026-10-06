import { STAT_KEYS, STAT_LABELS, WEIGHT_REFERENCES } from "./vehicle-stats.js";
export function vehicleStatsHTML(stats, modelId) {
  const reference = WEIGHT_REFERENCES[modelId];
  const origin =
    reference && stats.weightKg === reference.kg
      ? reference.kind
      : "Peso base configurado en el catálogo";
  return `<div class="vehicle-attributes" role="group" aria-label="Estadísticas fijas del modelo">${STAT_KEYS.slice(
    0,
    4,
  )
    .map(
      (k) =>
        `<div class="vehicle-attribute"><span>${STAT_LABELS[k]}</span><strong>${stats[k]}<small>/100</small></strong><span class="attribute-track" aria-hidden="true"><i style="width:${stats[k]}%"></i></span></div>`,
    )
    .join(
      "",
    )}<div class="vehicle-attribute"><span>Peso</span><strong>${stats.weightKg.toLocaleString("es-AR")} <small>kg</small></strong></div></div><p class="vehicle-attributes-note">${origin}. Atributos fijos · Mayor comodidad reduce cansancio.</p>`;
}
