"use strict";

importScripts(
  "./countries-extra.js",
  "./data.js",
  "./country-facts.js",
  "./catalog-v6.js",
  "./simulation-v6.js",
  "./engine.js",
);

self.onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "ping") {
    self.postMessage({ type: "ready", id: message.id });
    return;
  }
  if (message.type !== "advance-day") return;
  try {
    const beforeMonth = message.state.date.month,
      beforeYear = message.state.date.year;
    self.PulsoEngine.advanceDay(message.state);
    self.postMessage({
      type: "day-complete",
      id: message.id,
      state: message.state,
      monthClosed:
        message.state.date.month !== beforeMonth ||
        message.state.date.year !== beforeYear,
    });
  } catch (error) {
    self.postMessage({
      type: "error",
      id: message.id,
      message: error?.message || String(error),
    });
  }
};
