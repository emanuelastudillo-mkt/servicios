// Original vector emblems, authored in scripts/build-shields.mjs.
export const SHIELDS = Object.freeze(
  [
    {
      id: 1,
      name: "Cóndor",
      file: "assets/shields/01.svg",
    },
    {
      id: 2,
      name: "Halcón",
      file: "assets/shields/02.svg",
    },
    {
      id: 3,
      name: "Águila",
      file: "assets/shields/03.svg",
    },
    {
      id: 4,
      name: "Colibrí",
      file: "assets/shields/04.svg",
    },
    {
      id: 5,
      name: "Lobo",
      file: "assets/shields/05.svg",
    },
    {
      id: 6,
      name: "Zorro",
      file: "assets/shields/06.svg",
    },
    {
      id: 7,
      name: "Puma",
      file: "assets/shields/07.svg",
    },
    {
      id: 8,
      name: "Pantera",
      file: "assets/shields/08.svg",
    },
    {
      id: 9,
      name: "Toro",
      file: "assets/shields/09.svg",
    },
    {
      id: 10,
      name: "Carnero",
      file: "assets/shields/10.svg",
    },
    {
      id: 11,
      name: "Bisonte",
      file: "assets/shields/11.svg",
    },
    {
      id: 12,
      name: "Ciervo",
      file: "assets/shields/12.svg",
    },
    {
      id: 13,
      name: "Cumbre",
      file: "assets/shields/13.svg",
    },
    {
      id: 14,
      name: "Volcán",
      file: "assets/shields/14.svg",
    },
    {
      id: 15,
      name: "Dunas",
      file: "assets/shields/15.svg",
    },
    {
      id: 16,
      name: "Glaciar",
      file: "assets/shields/16.svg",
    },
    {
      id: 17,
      name: "Norte",
      file: "assets/shields/17.svg",
    },
    {
      id: 18,
      name: "Rumbo",
      file: "assets/shields/18.svg",
    },
    {
      id: 19,
      name: "Órbita",
      file: "assets/shields/19.svg",
    },
    {
      id: 20,
      name: "Horizonte",
      file: "assets/shields/20.svg",
    },
    {
      id: 21,
      name: "Rayo",
      file: "assets/shields/21.svg",
    },
    {
      id: 22,
      name: "Trueno",
      file: "assets/shields/22.svg",
    },
    {
      id: 23,
      name: "Centella",
      file: "assets/shields/23.svg",
    },
    {
      id: 24,
      name: "Vórtice",
      file: "assets/shields/24.svg",
    },
    {
      id: 25,
      name: "Titán",
      file: "assets/shields/25.svg",
    },
    {
      id: 26,
      name: "Atlas",
      file: "assets/shields/26.svg",
    },
    {
      id: 27,
      name: "Nómada",
      file: "assets/shields/27.svg",
    },
    {
      id: 28,
      name: "Élite",
      file: "assets/shields/28.svg",
    },
    {
      id: 29,
      name: "Fénix",
      file: "assets/shields/29.svg",
    },
    {
      id: 30,
      name: "Brasa",
      file: "assets/shields/30.svg",
    },
    {
      id: 31,
      name: "Ícaro",
      file: "assets/shields/31.svg",
    },
    {
      id: 32,
      name: "Solar",
      file: "assets/shields/32.svg",
    },
    {
      id: 33,
      name: "Bastión",
      file: "assets/shields/33.svg",
    },
    {
      id: 34,
      name: "Forja",
      file: "assets/shields/34.svg",
    },
    {
      id: 35,
      name: "Escorpión",
      file: "assets/shields/35.svg",
    },
    {
      id: 36,
      name: "Cobra",
      file: "assets/shields/36.svg",
    },
    {
      id: 37,
      name: "Tridente",
      file: "assets/shields/37.svg",
    },
    {
      id: 38,
      name: "Vértice",
      file: "assets/shields/38.svg",
    },
    {
      id: 39,
      name: "Delta",
      file: "assets/shields/39.svg",
    },
    {
      id: 40,
      name: "Cobalto",
      file: "assets/shields/40.svg",
    },
    {
      id: 41,
      name: "Ónix",
      file: "assets/shields/41.svg",
    },
    {
      id: 42,
      name: "Prisma",
      file: "assets/shields/42.svg",
    },
    {
      id: 43,
      name: "Áurea",
      file: "assets/shields/43.svg",
    },
    {
      id: 44,
      name: "Impulso",
      file: "assets/shields/44.svg",
    },
    {
      id: 45,
      name: "Turbina",
      file: "assets/shields/45.svg",
    },
    {
      id: 46,
      name: "Pistón",
      file: "assets/shields/46.svg",
    },
    {
      id: 47,
      name: "Coraza",
      file: "assets/shields/47.svg",
    },
    {
      id: 48,
      name: "Centinela",
      file: "assets/shields/48.svg",
    },
  ].map(Object.freeze),
);
export const SHIELD_COUNT = SHIELDS.length;
export const shieldInfo = (id = 1) =>
  SHIELDS.find((s) => s.id === Number(id)) || SHIELDS[0];
export function shieldSVG(id = 1) {
  const s = shieldInfo(id);
  return `<svg xmlns="http://www.w3.org/2000/svg" class="team-shield" viewBox="0 0 100 100" role="img" aria-label="Escudo ${s.id} · ${s.name}"><title>${s.name}</title><image href="${s.file}" width="100" height="100"/></svg>`;
}
