export const NAV_GROUPS = [
  {
    id: "races",
    label: "Carreras",
    icon: "flag",
    items: [
      ["race", "map", "Carrera en curso"],
      ["championship", "flag", "Inscripción y calendario"],
      ["roadbook", "route", "Roadbook"],
      ["journal", "route", "Bitácora"],
    ],
  },
  {
    id: "team",
    label: "Escudería",
    icon: "crew",
    items: [
      ["crew", "crew", "Equipo y contratos"],
      ["workshop", "tools", "Taller y vehículos"],
      ["camp", "tools", "Campamento y configuración"],
    ],
  },
  {
    id: "economy",
    label: "Economía",
    icon: "shop",
    items: [
      ["market", "shop", "Mercado"],
      ["finance", "shop", "Finanzas"],
    ],
  },
];

export function navigationHTML(icon, tab, enabled) {
  const item = ([id, symbol, label]) =>
    `<button type="button" class="nav-item ${tab === id ? "active" : ""}" data-action="tab" data-tab="${id}" ${tab === id ? 'aria-current="page"' : ""} ${enabled ? "" : "disabled"}>${icon(symbol)}<span>${label}</span></button>`;
  return `<nav class="section-nav" aria-label="Secciones">${item(["home", "flag", "Inicio"])}${NAV_GROUPS.map((group) => `<details class="nav-group ${group.items.some(([id]) => id === tab) ? "active" : ""}" id="nav-${group.id}" data-preserve-open><summary class="nav-trigger" ${enabled ? "" : 'aria-disabled="true" tabindex="-1"'}>${icon(group.icon)}<span>${group.label}</span><svg class="nav-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="m2 4 4 4 4-4"/></svg></summary><div class="nav-dropdown">${group.items.map(item).join("")}</div></details>`).join("")}</nav>`;
}

export function bindNavigation(document) {
  const groups = () => [...document.querySelectorAll(".nav-group")];
  const close = () =>
    groups().forEach((group) => {
      group.open = false;
    });
  document.addEventListener(
    "toggle",
    (event) => {
      const group = event.target;
      if (!group.matches?.(".nav-group") || !group.open) return;
      groups().forEach((other) => {
        if (other !== group) other.open = false;
      });
    },
    true,
  );
  document.addEventListener("click", (event) => {
    if (event.target.closest('.nav-trigger[aria-disabled="true"]')) {
      event.preventDefault();
      return;
    }
    if (
      !event.target.closest(".section-nav") ||
      event.target.closest("[data-tab]")
    )
      close();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    const open = groups().find((group) => group.open);
    if (!open) return;
    close();
    open.querySelector("summary").focus();
    event.preventDefault();
  });
  document.addEventListener("focusout", (event) => {
    const nav = event.target.closest(".section-nav");
    if (nav && event.relatedTarget && !nav.contains(event.relatedTarget))
      close();
  });
}
