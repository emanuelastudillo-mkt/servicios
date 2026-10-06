import { partSpec } from "./part-brands.js";
import { partType, clamp } from "./catalog.js";

// Original measures remaining rebuild potential, separately from wear/condition.
export const REPAIR_TIME_MULTIPLIER = 10;
export function repairQuote(piece, { timeMultiplier = 1 } = {}) {
  const type = partType(piece.type),
    original = piece.original ?? 100;
  const target = 40 + original * 0.6;
  const recovered = Math.max(0, target - piece.condition);
  const needed = recovered > 1e-8 || piece.broken;
  const difficulty = 1 + (100 - original) / 20;
  return {
    cost: needed
      ? Math.ceil(
          (((partSpec(piece).price * recovered) / 100) * 0.52 +
            (piece.broken ? type.price * 0.12 : 0)) *
            (1 + ((100 - original) / 100) * 0.6),
        )
      : 0,
    hours: needed
      ? ((type.hours * recovered) / 100 + (piece.broken ? 0.75 : 0)) *
        difficulty *
        timeMultiplier
      : 0,
    target: Math.max(piece.condition, target),
    ceiling: target,
    originalAfter: needed
      ? clamp(original - (piece.broken ? 7 : 4), 0, 100)
      : original,
    difficulty,
    needed,
  };
}

export function repairPiece(piece) {
  const q = repairQuote(piece);
  if (!q.needed) return q;
  piece.condition = q.target;
  piece.broken = false;
  piece.original = q.originalAfter;
  return q;
}
