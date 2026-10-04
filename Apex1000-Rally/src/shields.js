const colors = [
  "#eeb45d",
  "#7fcbd4",
  "#c2d6a3",
  "#c4a0ef",
  "#ed8580",
  "#e6e8ed",
  "#4cbf97",
  "#fa9452",
  "#7d9fe4",
  "#d5bd86",
];
const symbols = [
  "M27 67 50 25 73 67H60L50 47 40 67Z",
  "M30 30 70 70M70 30 30 70M50 23v54M23 50h54",
  "M50 22 58 40 78 42 63 56 67 77 50 66 33 77 37 56 22 42 42 40Z",
  "M32 25H68V52L50 74 32 52Z",
  "M28 68 44 28H67L53 45H70L36 76 44 54H30Z",
  "M26 50 50 25 74 50 50 75Z M40 50 50 40 60 50 50 60Z",
  "M28 34h44v13H55v27H43V47H28Z",
  "M29 26v48h42V61H43V26Z",
  "M28 69V29L50 51 72 29V69H59V55L50 64 41 55V69Z",
  "M30 25H70V38H43V44H62V56H43V62H70V75H30Z",
];
const shapes = [
  "M10 9H90V51Q88 77 50 94Q12 77 10 51Z",
  "M50 4 92 25 84 78 50 97 16 78 8 25Z",
  "M18 8H82L94 30 84 81 50 96 16 81 6 30Z",
  "M50 4 92 18V63L50 97 8 63V18Z",
  "M10 10H90V75L50 96 10 75Z",
  "M50 3 94 35 79 87H21L6 35Z",
  "M23 7H77L95 49 77 91H23L5 49Z",
  "M50 4C108 15 103 77 50 96C-3 77-8 15 50 4Z",
  "M13 6H87V60L69 86 50 96 31 86 13 60Z",
  "M50 4 96 49 50 96 4 49Z",
];
export function shieldSVG(id = 1) {
  const n = Math.max(0, Math.min(99, Number(id) - 1)),
    color = colors[Math.floor(n / 10)],
    shape = shapes[Math.floor(n / 10)],
    symbol = symbols[n % 10];
  return `<svg xmlns="http://www.w3.org/2000/svg" class="team-shield" viewBox="0 0 100 100" role="img" aria-label="Escudo ${n + 1}"><path d="${shape}" fill="#151b22" stroke="${color}" stroke-width="4"/><path d="${shape}" transform="translate(9 9) scale(.82)" fill="none" stroke="${color}" opacity=".4"/><path d="${symbol}" fill="${n % 10 === 1 ? "none" : color}" stroke="${color}" stroke-width="3" stroke-linejoin="round"/></svg>`;
}
