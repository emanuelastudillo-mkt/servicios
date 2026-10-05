const DAY = 86400000;
const nowAt = (s) => Date.parse(s.startAt) + s.clock * 1000;
export function initializeProgression(s) {
  for (const t of s.teams)
    if (t.progression === undefined)
      t.progression = {
        xp: 0,
        lastParticipationAt: nowAt(s),
        lastDecayAt: nowAt(s),
        lastResult: null,
      };
}
export function teamLevel(t) {
  const xp = t.progression?.xp || 0,
    level = Math.floor((xp / 100) ** (1 / 2.4)) + 1;
  const previous = level === 1 ? 0 : 100 * (level - 1) ** 2.4,
    next = 100 * level ** 2.4;
  return {
    level,
    xp,
    previous,
    next,
    progress: Math.max(0, Math.min(1, (xp - previous) / (next - previous))),
  };
}
export function advanceProgression(s) {
  const now = nowAt(s);
  for (const t of s.teams) {
    const p = t.progression;
    if (!p || now <= p.lastDecayAt) continue;
    if (!(s.clock >= 0 && t.participating && !s.competition.closed)) {
      const elapsed = Math.max(
        0,
        now - Math.max(p.lastDecayAt, p.lastParticipationAt + 3 * DAY),
      );
      p.xp *= Math.exp((Math.log(0.99) * elapsed) / DAY);
      if (p.xp < 1e-8) p.xp = 0;
    }
    p.lastDecayAt = now;
  }
}
export function markParticipation(s, t) {
  t.progression.lastParticipationAt = nowAt(s);
}
export function awardProgression(s, t, event, entry, totalKm) {
  const p = t.progression,
    factor = event.kind === "short" ? 0.075 : 1;
  const base = entry.finished
    ? [400, 280, 210, 160, 120, 80, 40, 10, -20, -35, -50, -65][
        entry.position - 1
      ]
    : -80 * (1 - entry.km / totalKm);
  const before = p.xp;
  p.xp = Math.max(0, p.xp + base * factor);
  p.lastResult = {
    eventId: event.eventId,
    change: p.xp - before,
    finished: entry.finished,
    position: entry.position,
  };
  p.lastParticipationAt = p.lastDecayAt = nowAt(s);
}
export function validateProgression(s) {
  initializeProgression(s);
  for (const t of s.teams) {
    const p = t.progression;
    if (
      !Number.isFinite(p.xp) ||
      p.xp < 0 ||
      p.xp > 1e9 ||
      ![p.lastParticipationAt, p.lastDecayAt].every(
        (v) => Number.isFinite(v) && v <= nowAt(s),
      )
    )
      throw Error("Nivel de escudería inválido.");
    if (
      p.lastResult !== null &&
      (typeof p.lastResult.eventId !== "string" ||
        !Number.isFinite(p.lastResult.change) ||
        typeof p.lastResult.finished !== "boolean" ||
        !Number.isInteger(p.lastResult.position) ||
        p.lastResult.position < 1 ||
        p.lastResult.position > 12)
    )
      throw Error("Experiencia de carrera inválida.");
  }
}
