"use strict";

importScripts(
  "./countries-extra.js",
  "./data.js",
  "./country-facts.js",
  "./catalog-v6.js",
  "./simulation-v6.js",
  "./engine.js",
);

let state = null;
let countrySnapshots = new Map();
self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "ping") {
    self.postMessage({ type: "ready", id: message.id });
    return;
  }
  if (message.type !== "advance-day") return;
  try {
    if (message.state) {
      state = message.state;
      countrySnapshots = new Map(
        Object.entries(state.countries).map(([id, c]) => [
          id,
          JSON.stringify(c),
        ]),
      );
    }
    if (!state) throw Error("Falta sincronizar la partida.");
    const beforeMonth = state.date.month,
      beforeYear = state.date.year;
    self.PulsoEngine.advanceDay(state);
    const changedCountries = {};
    for (const [id, country] of Object.entries(state.countries)) {
      const snapshot = JSON.stringify(country);
      if (snapshot !== countrySnapshots.get(id)) changedCountries[id] = country;
      countrySnapshots.set(id, snapshot);
    }
    self.postMessage({
      type: "day-complete",
      id: message.id,
      state: { ...state, countries: changedCountries },
      incremental: true,
      monthClosed:
        state.date.month !== beforeMonth || state.date.year !== beforeYear,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: error?.message || String(error),
    });
  }
};
