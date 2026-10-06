import { teamLevel } from "./progression.js";
import { staffDefaults, validTraits } from "./staff.js";
const HOUR = 3600000,
  DAY = 24 * HOUR,
  OFFSET = 3 * HOUR;
export const gameNow = (s) => Date.parse(s.startAt) + s.clock * 1000;
export const gameDate = (at) =>
  new Intl.DateTimeFormat("es-AR", {
    timeZone: "America/Argentina/Buenos_Aires",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(at);
export function monthStart(at) {
  const d = new Date(at - OFFSET);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) + OFFSET;
}
export function addMonths(at, n) {
  const d = new Date(at - OFFSET),
    day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  const last = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
  ).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return +d + OFFSET;
}
export const nextPayroll = (at) => addMonths(monthStart(at), 1);
export function recordCash(s, t, amount, label, category, at = gameNow(s)) {
  amount = Math.round(amount * 100) / 100;
  t.budget = Math.round((t.budget + amount) * 100) / 100;
  t.ledger.push({
    time: (at - Date.parse(s.startAt)) / 1000,
    at,
    amount: amount || 0,
    label,
    ...(category ? { category } : {}),
  });
}
export function startContract(s, t, p, kind, at = gameNow(s), index = 0) {
  Object.assign(p, staffDefaults(p, kind, index));
  p.birthAt = addMonths(at, -12 * p.age);
  p.contract = {
    signedAt: at,
    expiresAt: addMonths(at, 12),
    levelAtSigning: teamLevel(t).level,
    renewals: 0,
    pendingSalary: null,
  };
}
export function initializeEmployment(s) {
  if (s.employment) return;
  // Older CSV importers stored unknown numeric columns as strings. Only migration accepts them.
  for (const p of [
    ...s.management.catalog.drivers,
    ...s.management.catalog.mechanics,
  ])
    for (const key of ["age", "form", "morale"])
      if (typeof p[key] === "string" && /^\d+$/.test(p[key]))
        p[key] = Number(p[key]);
  const at = gameNow(s);
  s.employment = { version: 1, lastAt: at, nextPayrollAt: nextPayroll(at) };
  for (const t of s.teams) {
    t.finance = { accrued: { drivers: 0, mechanics: 0 }, bills: [] };
    for (const [kind, list] of [
      ["driver", t.drivers],
      ["mechanic", t.mechanics],
    ])
      list.forEach((p, i) => startContract(s, t, p, kind, at, i));
  }
}
export function renewalQuote(t, p) {
  const delta = teamLevel(t).level - p.contract.levelAtSigning;
  const change =
    delta >= 2 ? 0.2 : delta === 1 ? 0.1 : delta === 0 ? 0.03 : -0.2;
  const base = p.contract.pendingSalary ?? p.salary;
  return {
    delta,
    change,
    salary: Math.min(1000000, Math.round(base * (1 + change))),
    expiresAt: addMonths(p.contract.expiresAt, 12),
  };
}
export function renewContract(s, kind, id) {
  initializeEmployment(s);
  if (!["driver", "mechanic"].includes(kind))
    throw Error("Tipo de contrato inválido.");
  const t = s.teams.find((t) => t.id === "player"),
    p = (kind === "driver" ? t.drivers : t.mechanics).find((p) => p.id === id);
  if (!p) throw Error("La persona ya no pertenece al equipo.");
  const quote = renewalQuote(t, p);
  p.contract.expiresAt = quote.expiresAt;
  p.contract.pendingSalary = quote.salary;
  p.contract.levelAtSigning = teamLevel(t).level;
  p.contract.renewals++;
  p.morale = Math.min(100, p.morale + 3);
  return quote;
}
function announce(s, t, text) {
  s.events.push({
    id: ++s.eventCounter,
    time: s.clock,
    teamId: t.id,
    type: "contract",
    text,
  });
  if (s.events.length > 600) s.events.splice(0, s.events.length - 600);
}
function returnToMarket(s, t, p, kind) {
  const key = p.personId || p.id,
    pool =
      kind === "driver"
        ? s.management.catalog.drivers
        : s.management.catalog.mechanics;
  const ref = pool.find((x) => x.id === key);
  if (ref)
    Object.assign(ref, {
      salary: p.salary,
      age: p.age,
      form: Math.round(p.form),
      morale: Math.round(p.morale),
      traits: p.traits,
    });
  delete s.management.owners[key];
  const list = kind === "driver" ? t.drivers : t.mechanics;
  list.splice(list.indexOf(p), 1);
  if (kind === "driver") {
    const replacement = t.drivers[0]?.id || null;
    if (t.activeDriver === p.id) t.activeDriver = replacement;
    t.plans = t.plans.map((plan) =>
      plan?.driverId === p.id
        ? replacement
          ? { ...plan, driverId: replacement }
          : null
        : plan,
    );
    if (t.activePlan?.driverId === p.id)
      t.activePlan = replacement
        ? { ...t.activePlan, driverId: replacement }
        : null;
    if (s.competition)
      s.competition.registrations = s.competition.registrations.filter(
        (r) =>
          r.driverId !== p.id ||
          Number(r.eventId.split("@").at(-1)) < gameNow(s),
      );
  }
  if (
    !t.drivers.length ||
    !t.mechanics.some((m) => (m.assignment || "race") === "race")
  ) {
    if (!["finished", "cutoff"].includes(t.phase)) {
      t.participating = false;
      t.phase = "unregistered";
    }
    t.speed = 0;
    if (s.competition)
      s.competition.registrations = s.competition.registrations.filter(
        (r) => Number(r.eventId.split("@").at(-1)) < gameNow(s),
      );
  }
  announce(
    s,
    t,
    `${p.name}: contrato vencido; vuelve al mercado. ${!t.drivers.length ? "Contratá un piloto para volver a correr." : ""}`,
  );
}
export function processContracts(s, at = gameNow(s)) {
  for (const t of s.teams)
    for (const [kind, list] of [
      ["driver", t.drivers],
      ["mechanic", t.mechanics],
    ])
      for (const p of [...list]) {
        if (at < p.contract.expiresAt) continue;
        if (t.ai) {
          while (at >= p.contract.expiresAt)
            p.contract.expiresAt = addMonths(p.contract.expiresAt, 12);
          continue;
        }
        const running = s.competition
          ? t.participating && !s.competition.closed && s.competition.started
          : ["racing", "service", "camp"].includes(t.phase);
        if (!running) returnToMarket(s, t, p, kind);
      }
}
function payMonth(s, at) {
  for (const t of s.teams) {
    const fixed = Number(
      s.management.catalog.settings.find((x) => x.key === "monthlyBaseCost")
        ?.value ?? 1500,
    );
    const due = { ...t.finance.accrued, base: fixed },
      paid = {};
    for (const [category, amount] of Object.entries(due)) {
      due[category] = Math.round(amount * 100) / 100;
      paid[category] = Math.min(due[category], t.budget);
      recordCash(
        s,
        t,
        -paid[category],
        `Liquidación mensual · ${category === "drivers" ? "pilotos" : category === "mechanics" ? "mecánicos" : "base y taller"} · ${gameDate(at)}`,
        category,
        at,
      );
      t.debt =
        Math.round((t.debt + due[category] - paid[category]) * 100) / 100;
    }
    const unpaid =
      Object.values(due).reduce((a, b) => a + b, 0) -
      Object.values(paid).reduce((a, b) => a + b, 0);
    t.finance.bills.push({ at, due, paid, unpaid });
    if (t.finance.bills.length > 120) t.finance.bills.shift();
    t.finance.accrued = { drivers: 0, mechanics: 0 };
    for (const p of [...t.drivers, ...t.mechanics]) {
      p.morale = Math.max(0, Math.min(100, p.morale + (unpaid > 0 ? -8 : 2)));
      if (p.contract.pendingSalary !== null) {
        p.salary = p.contract.pendingSalary;
        p.contract.pendingSalary = null;
      }
    }
    if (t.id === "player")
      announce(
        s,
        t,
        `Sueldos y gastos mensuales liquidados. ${unpaid > 0 ? "Saldo impago agregado a deuda." : "Pagos al día."}`,
      );
  }
}
// Accrue the actual fraction of the calendar month; bill once at its boundary.
export function advanceEmployment(s) {
  initializeEmployment(s);
  const end = gameNow(s),
    e = s.employment;
  let at = e.lastAt;
  while (at < end) {
    processContracts(s, at);
    const stop = Math.min(
      end,
      e.nextPayrollAt,
      ...s.teams.flatMap((t) =>
        [...t.drivers, ...t.mechanics]
          .map((p) => p.contract.expiresAt)
          .filter((x) => x > at),
      ),
    );
    const elapsed = stop - at,
      span = e.nextPayrollAt - monthStart(at);
    for (const t of s.teams)
      for (const [kind, list] of [
        ["drivers", t.drivers],
        ["mechanics", t.mechanics],
      ])
        for (const p of list) {
          t.finance.accrued[kind] += (p.salary * elapsed) / span;
          const racing =
            t.phase === "racing" &&
            (!s.competition || t.participating) &&
            p.id === t.activeDriver;
          p.form = Math.max(
            0,
            Math.min(100, p.form + (elapsed / HOUR) * (racing ? -0.1 : 0.03)),
          );
          const birthday = addMonths(p.birthAt, 12 * (p.age + 1));
          if (stop >= birthday) p.age++;
        }
    at = stop;
    e.lastAt = at;
    if (at === e.nextPayrollAt) {
      payMonth(s, at);
      e.nextPayrollAt = nextPayroll(at);
    }
    processContracts(s, at);
  }
  processContracts(s, end);
}
export function validateEmployment(s) {
  initializeEmployment(s);
  const finite = (x, min = -Infinity, max = Infinity) =>
    typeof x === "number" && Number.isFinite(x) && x >= min && x <= max;
  const e = s.employment;
  if (
    e.version !== 1 ||
    !finite(e.lastAt) ||
    e.lastAt !== gameNow(s) ||
    e.nextPayrollAt !== nextPayroll(e.lastAt)
  )
    throw Error("Reloj de nómina inválido.");
  for (const t of s.teams) {
    const f = t.finance;
    if (
      !f ||
      !["drivers", "mechanics"].every((k) => finite(f.accrued?.[k], 0, 1e9)) ||
      !Array.isArray(f.bills) ||
      f.bills.length > 120
    )
      throw Error("Finanzas mensuales inválidas.");
    for (const bill of f.bills) {
      if (
        !finite(bill.at) ||
        bill.at > gameNow(s) ||
        monthStart(bill.at) !== bill.at ||
        !finite(bill.unpaid, 0, 1e9)
      )
        throw Error("Liquidación mensual inválida.");
      for (const k of ["drivers", "mechanics", "base"])
        if (
          !finite(bill.due?.[k], 0, 1e9) ||
          !finite(bill.paid?.[k], 0, bill.due[k])
        )
          throw Error("Liquidación mensual inválida.");
      if (
        Math.abs(
          bill.unpaid -
            Object.keys(bill.due).reduce(
              (sum, k) => sum + bill.due[k] - bill.paid[k],
              0,
            ),
        ) > 0.01
      )
        throw Error("Liquidación mensual inconsistente.");
    }
    for (const p of [...t.drivers, ...t.mechanics]) {
      const c = p.contract;
      if (
        !Number.isInteger(p.age) ||
        !finite(p.age, 18, 120) ||
        !finite(p.form, 0, 100) ||
        !finite(p.morale, 0, 100) ||
        !validTraits(p.traits) ||
        !finite(p.birthAt, -8.64e15, gameNow(s)) ||
        !c ||
        !finite(c.signedAt, -8.64e15, gameNow(s)) ||
        c.signedAt > gameNow(s) ||
        !finite(c.expiresAt, c.signedAt + DAY, 8.64e15) ||
        !Number.isInteger(c.levelAtSigning) ||
        !finite(c.levelAtSigning, 1, 10000) ||
        !Number.isInteger(c.renewals) ||
        !finite(c.renewals, 0, 1000) ||
        !(
          c.pendingSalary === null ||
          (Number.isInteger(c.pendingSalary) &&
            finite(c.pendingSalary, 0, 1000000))
        )
      )
        throw Error("Atributos o contrato del personal inválidos.");
    }
  }
}
