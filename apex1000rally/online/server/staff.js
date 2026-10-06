const SURNAMES = [
  "Álvarez",
  "Benítez",
  "Cabrera",
  "Domínguez",
  "Escobar",
  "Figueroa",
  "Giménez",
  "Herrera",
  "Ibarra",
  "Juárez",
  "Ledesma",
  "Molina",
  "Navarro",
  "Olivera",
  "Pereyra",
  "Quiroga",
  "Romero",
  "Sosa",
  "Torres",
  "Vega",
  "Acosta",
  "Bustos",
  "Castro",
  "Duarte",
];

// Stable fictional names: changing a display name never changes ownership or contracts.
export function starterStaffName(teamId, kind, index = 0) {
  let seed = 2166136261;
  for (const char of teamId)
    seed = Math.imul(seed ^ char.charCodeAt(0), 16777619);
  const offset = kind === "mechanic" ? 3 : index;
  const first = kind === "mechanic" ? "Elena" : ["Alex", "Dani", "Sol"][index];
  return `${first} ${SURNAMES[((seed >>> 0) + offset) % SURNAMES.length]}`;
}

export function normalizeStaffNames(w) {
  for (const team of w.engine.teams) {
    team.drivers.forEach((person) => {
      const match = person.id.match(/-academy-driver-(\d+)$/);
      if (
        match &&
        person.id === `${team.id}-academy-driver-${match[1]}` &&
        Number(match[1]) >= 1 &&
        Number(match[1]) <= 3 &&
        ["Alex · Academia", "Dani · Academia", "Sol · Academia"].includes(
          person.name,
        )
      )
        person.name = starterStaffName(team.id, "driver", Number(match[1]) - 1);
    });
    for (const person of team.mechanics)
      if (
        person.id === `${team.id}-academy-mechanic` &&
        person.name === "Asistencia de academia"
      )
        person.name = starterStaffName(team.id, "mechanic");
  }
}
