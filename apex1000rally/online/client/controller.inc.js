const api = new ApexAPI(API_BASE);
let onlineData = null,
  stopPolling = null,
  publicData = null,
  pendingCommand = null;
const pendingKey = () => "apex-pending:" + onlineData.user.id;
function selectOnlinePresentation() {
  if (!onlineData || !state) return;
  const raceTabs = ["race", "camp", "roadbook", "journal"];
  const raceTeam = onlineData.view.teams[0],
    baseTeam = onlineData.view.online.baseTeam;
  const homeTeam = {
    ...baseTeam,
    ...Object.fromEntries(
      [
        "participating",
        "phase",
        "routeId",
        "stageIndex",
        "totalKm",
        "finishTime",
        "activeCarId",
        "vehicleId",
        "history",
      ].map((k) => [k, raceTeam[k]]),
    ),
  };
  state = {
    ...onlineData.view,
    teams: [
      raceTabs.includes(ui.tab)
        ? raceTeam
        : ui.tab === "home"
          ? homeTeam
          : baseTeam,
      ...onlineData.view.teams.slice(1),
    ],
  };
}
function onlineBanner() {
  if (!state) return "";
  return `<section class="online-toolbar"><label>Carrera en el visor<select id="online-race">${state.online.events.map((e) => `<option value="${esc(e.eventId)}" ${e.eventId === state.id ? "selected" : ""}>${state.online.ownRaces.includes(e.eventId) ? "★ " : ""}${esc(e.name)} · ${localDate(e.start)} · ${e.status === "running" ? "En curso" : e.status === "closed" ? "Cerrada" : "Programada"}</option>`).join("")}</select></label><span id="online-sync">Servidor: ${localDate(onlineData.at)} · consulta cada 60 s</span>${state.online.ownRaces.map((id) => `<button class="button ghost small" data-action="view-event" data-id="${esc(id)}">Mi ${state.online.events.find((e) => e.eventId === id)?.kind === "short" ? "sprint" : "raid"}</button>`).join("")}${pendingCommand ? '<button class="button ghost small" data-action="retry-online">Reintentar acción pendiente</button>' : ""}<button class="button ghost small" data-action="logout-online">Salir</button></section>`;
}
function closedRaceHTML() {
  const race = onlineData.public.races.find((r) => r.eventId === state.id);
  return `<section class="panel"><span class="eyebrow">CARRERA CERRADA</span><h1>${esc(race?.name || "Resultado definitivo")}</h1><p>Premios acreditados. Los puestos pendientes se fijaron por distancia al cierre.</p><div class="table-wrap"><table><thead><tr><th>Puesto</th><th>Escudería</th><th>Vehículo</th><th>Resultado</th><th>Premio</th></tr></thead><tbody>${(race?.results || []).map((r) => `<tr><td>P${r.position}</td><td>${esc(r.name)}</td><td>${esc(vehicle(r.vehicleId).short)}</td><td>${r.finished ? duration(r.finishSeconds) : num(r.distanceKm) + " km"}</td><td>${money(r.prizeCents / 100)} cr</td></tr>`).join("")}</tbody></table></div><button class="button primary" data-action="tab" data-tab="championship">Elegir próxima carrera</button></section>`;
}
function applyOnline(d, full = false) {
  const previous = state?.id;
  const wasClosed = state?.competition?.closed;
  onlineData = d;
  state = d.view;
  setActiveRoute(state);
  if (previous !== state.id) {
    ui.drafts = {};
    ui.selectedStage = 0;
    ui.selectedTeam = "player";
    fitMap();
    full = true;
  }
  if (!state.teams.some((t) => t.id === ui.selectedTeam))
    ui.selectedTeam = "player";
  if (wasClosed !== state.competition.closed) full = true;
  if (full || !document.querySelector("main")) render();
  else refresh();
  const toolbar = $(".online-toolbar");
  if (toolbar)
    patchLivePanel(
      toolbar,
      onlineBanner()
        .replace(/^<section[^>]*>/, "")
        .replace(/<\/section>$/, ""),
    );
  const sync = $("#online-sync");
  if (sync)
    sync.textContent = `Servidor: ${localDate(d.at)} · consulta cada 60 s`;
}
async function loadOnline(full = true) {
  applyOnline(await api.bootstrap(), full);
}
function startPolling() {
  stopPolling?.();
  stopPolling = api.watch(
    (d) => applyOnline(d),
    (e) => {
      if (e.status === 401) {
        stopPolling?.();
        state = null;
        render();
      }
      toast(e.message);
    },
    60,
    false,
  );
}
async function sendOnline(command) {
  if (busy) return;
  if (pendingCommand && command) {
    toast("Primero reintentá la acción pendiente para conocer su resultado.");
    return;
  }
  if (command) {
    pendingCommand = { command, key: crypto.randomUUID() };
    sessionStorage.setItem(pendingKey(), JSON.stringify(pendingCommand));
  }
  if (!pendingCommand) return;
  busy = true;
  try {
    await api.command(pendingCommand.command, pendingCommand.key);
    if (
      pendingCommand.command.eventId &&
      ["enroll", "configure-enrollment", "cancel-enrollment"].includes(
        pendingCommand.command.type,
      )
    )
      clearEnrollmentDraft(pendingCommand.command.eventId);
    pendingCommand = null;
    sessionStorage.removeItem(pendingKey());
    document.querySelector("dialog[open]")?.close();
    ui.drafts = {};
    await loadOnline(true);
    toast("Cambio confirmado y guardado en el servidor.");
  } catch (e) {
    if (
      e.status &&
      e.status < 500 &&
      e.status !== 429 &&
      !/Otra operación/.test(e.message)
    ) {
      pendingCommand = null;
      sessionStorage.removeItem(pendingKey());
    }
    toast(e.message);
    render();
  } finally {
    busy = false;
  }
}
function onlineAction(a, id, b) {
  const kind = b.dataset.kind,
    eventId = state.id;
  const simple = {
    "purchase-car": { type: "purchase-car", modelId: id },
    "buy-vehicle": { type: "purchase-car", modelId: id },
    "select-car": { type: "select-car", id },
    "confirm-sale": { type: "sell-car", id },
    "confirm-part-sale": { type: "sell-part", id },
    "confirm-trade": {
      type: "purchase-car",
      modelId: id,
      tradeId: b.dataset.trade,
    },
    "cancel-work": { type: "cancel-work", id },
    "cancel-bid": { type: "cancel-bid", id },
    release: { type: "release", id, kind },
    "renew-confirm": { type: "renew-contract", id, kind },
    "choose-shield": { type: "choose-shield", shieldId: Number(id) },
    "cancel-enrollment": { type: "cancel-enrollment", eventId: id },
  };
  if (simple[a]) return simple[a];
  if (a === "enroll" || a === "configure-enrollment")
    return allocationCommand(state, id, a);
  if (a === "bid")
    return {
      type: "bid",
      kind,
      personId: id,
      salary: Number($("#bid-" + id).value),
    };
  if (a === "buy")
    return {
      type: "buy-part",
      partType: ui.marketType,
      grade: b.dataset.grade,
      condition: ui.marketCondition,
    };
  if (a === "enqueue-work")
    return {
      type: "enqueue-work",
      kind,
      id,
      points: Number(
        document.getElementById(`upgrade-${id}-${kind}`)?.value || 5,
      ),
    };
  if (a === "save-plan")
    return {
      type: "save-plan",
      eventId,
      stageIndex: ui.selectedStage,
      plan: structuredClone(draft()),
    };
  if (a === "fill-plans")
    return {
      type: "save-plans",
      eventId,
      plans: STAGES.map((stage, i) => ({
        stageIndex: i,
        plan: {
          ...defaultPlan(i),
          driverId:
            p().drivers[
              currentEvent(state).kind === "short" ? 0 : i % p().drivers.length
            ].id,
          ...recommendedSetup(stage),
          fuelTarget: vehicle(p().vehicleId).tank,
        },
      })).filter(
        (row) => row.stageIndex >= editStage() && !p().plans[row.stageIndex],
      ),
    };
  return null;
}
const localActions = new Set([
  "help",
  "close-modal",
  "choose-start-shield",
  "choose-vehicle",
  "fullscreen-map",
  "renew-preview",
  "quote-renew",
  "renew",
  "quote-part-sale",
  "quote-sale",
  "quote-trade",
  "center-timeline",
  "tab",
  "open-camp",
  "plan-stage",
  "roadbook-stage",
  "map-stage",
  "follow",
  "zoom-in",
  "zoom-out",
  "fit-map",
  "choose-driver",
  "recommended",
  "fuel-suggestion",
  "repair-all",
  "fit-reserves",
  "market-type",
  "export-results",
]);
document.addEventListener(
  "click",
  (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    const a = b.dataset.action,
      id = b.dataset.id;
    if (a === "logout-online") {
      e.stopImmediatePropagation();
      api
        .logout()
        .then(() => {
          stopPolling?.();
          state = null;
          onlineData = null;
          pendingCommand = null;
          render();
        })
        .catch((e) => toast(e.message));
      return;
    }
    if (a === "retry-online") {
      e.stopImmediatePropagation();
      sendOnline(null);
      return;
    }
    if (a === "view-event") {
      e.stopImmediatePropagation();
      api.race = id;
      loadOnline(true).catch((e) => toast(e.message));
      return;
    }
    if (a === "rankings-search") {
      e.stopImmediatePropagation();
      loadRankings();
      return;
    }
    if (a === "director-profile") {
      e.stopImmediatePropagation();
      loadProfile(id);
      return;
    }
    if (state) {
      const command = onlineAction(a, id, b);
      if (command) {
        e.stopImmediatePropagation();
        sendOnline(command);
        return;
      }
    }
    if (!localActions.has(a)) {
      e.stopImmediatePropagation();
      return;
    }
    if (a === "tab" && b.dataset.tab === "rankings") {
      e.stopImmediatePropagation();
      ui.tab = "rankings";
      render();
    }
  },
  true,
);
document.addEventListener(
  "change",
  (e) => {
    if (state && e.target.dataset.allocationEvent) {
      e.stopImmediatePropagation();
      updateAllocation(state, e.target);
      render();
      return;
    }
    if (e.target.id === "online-race") {
      api.race = e.target.value;
      loadOnline(true).catch((e) => toast(e.message));
      return;
    }
    if (e.target.dataset.mechanicAssignment) {
      e.stopImmediatePropagation();
      sendOnline({
        type: "assign-mechanic",
        id: e.target.dataset.mechanicAssignment,
        place: e.target.value,
      });
    }
  },
  true,
);
function bindOnlineForms() {
  if ($("#identity-form")) {
    $("#director-name").readOnly = true;
    $("#identity-form").onsubmit = (e) => {
      e.preventDefault();
      sendOnline({ type: "rename-team", name: $("#team-name").value });
    };
  }
  for (const [selector, isNew] of [
    ["#online-register", true],
    ["#online-login", false],
  ]) {
    const f = $(selector);
    if (!f) continue;
    f.onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      busy = true;
      const submit = f.querySelector("button[type=submit]");
      submit.disabled = true;
      try {
        const data = Object.fromEntries(new FormData(f));
        if (isNew)
          await registerPasskey(api, {
            ...data,
            vehicleId: ui.vehicleId,
            shieldId: ui.createShieldId,
          });
        else await loginPasskey(api);
        api.race = "";
        await loadOnline(true);
        pendingCommand = JSON.parse(
          sessionStorage.getItem(pendingKey()) || "null",
        );
        startPolling();
      } catch (err) {
        toast(
          err.name === "NotAllowedError"
            ? "Acceso cancelado o vencido. Podés volver a intentarlo."
            : err.message,
        );
      } finally {
        busy = false;
        submit.disabled = false;
      }
    };
  }
}
function onlineOnboarding() {
  const available = [
    ...(publicData?.vehicles ||
      VEHICLES.map((v) => ({ ...v, price: v.fee, available: true, stock: 1 }))),
  ].sort((a, b) => a.price - b.price);
  const budget =
    publicData?.startingBudget ??
    CATALOG.settings.find((s) => s.key === "startingBudget").value;
  const salaries = publicData?.initialMonthlySalary ?? 4600,
    base = publicData?.initialMonthlyBaseCost ?? 1500;
  const reserve = publicData?.initialReserve ?? salaries + base;
  const canStart = (v) =>
    v.available && v.stock > 0 && v.price <= budget - reserve;
  if (!available.some((v) => v.id === ui.vehicleId && canStart(v)))
    ui.vehicleId = available.find(canStart)?.id || "";
  const selected = available.find((v) => v.id === ui.vehicleId);
  return `<main class="onboarding"><div class="intro-copy"><span class="eyebrow">ONLINE · 20 DIRECTORES · 5 ESCUDERÍAS BOT</span><h1>Tu equipo.<br>Una carrera real en el tiempo.</h1><p>Elegí un sprint de cuatro horas o una expedición de varios días. Cada compra, contrato e inscripción se guarda en el servidor.</p></div><div class="online-auth"><section class="panel"><h2>Volver a mi escudería</h2><form id="online-login"><p>Usá tu passkey guardada en Windows Hello, el teléfono o tu gestor de contraseñas. El PIN o la huella nunca se envían al juego.</p><button type="submit" class="button primary">Entrar con passkey</button></form></section><section class="panel"><h2>Crear mi escudería</h2><form id="online-register"><p><strong>Capital inicial: ${money(budget)} cr.</strong> Incluye tres pilotos y un mecánico de academia: ${money(salaries)} cr/mes, más ${money(base)} cr/mes de base y taller.</p><label>Usuario del director<input name="username" minlength="3" maxlength="24" autocomplete="username" required></label><label>Email<input type="email" name="email" autocomplete="email" required></label><p>En el siguiente paso, tu dispositivo creará una passkey. Guardala en un gestor sincronizado para poder entrar desde otros dispositivos.</p><label>Nombre de la escudería<input name="teamName" maxlength="40" required></label><label>Vehículo inicial<select id="online-initial-car">${available.map((v) => `<option value="${esc(v.id)}" ${v.id === ui.vehicleId ? "selected" : ""} ${!canStart(v) ? "disabled" : ""}>${esc(v.name)} · ${money(v.price)} cr · stock ${v.stock}${v.price > budget - reserve ? " · Fuera del presupuesto inicial" : ""}</option>`).join("")}</select></label><p>${selected ? `Después de comprar: <strong>${money(budget - selected.price)} cr</strong>. Un mes de sueldos y gastos: ${money(reserve)} cr; margen operativo: ${money(budget - selected.price - reserve)} cr.` : "No quedan autos disponibles dentro del presupuesto inicial."}</p><div class="create-identity-preview">${shieldSVG(ui.createShieldId)}<span>${shieldInfo(ui.createShieldId).name}</span></div>${shieldPicker(ui.createShieldId, "choose-start-shield")}<button type="submit" class="button primary" ${selected ? "" : "disabled"}>Crear escudería con passkey</button></form></section></div><p class="intro-note">Reloj compartido de tiempo real. La beta offline utiliza un guardado independiente y no se importa a la competición.</p></main>`;
}
document.addEventListener("change", (e) => {
  if (e.target.id === "online-initial-car") {
    ui.vehicleId = e.target.value;
    const f = $("#online-register");
    if (f) {
      const d = Object.fromEntries(new FormData(f));
      render();
      for (const [name, value] of Object.entries(d))
        document.querySelector(`#online-register [name="${name}"]`).value =
          value;
    }
  }
});
function rankingsPage() {
  return `<div class="page-title"><div><span class="eyebrow">RÉCORDS POR CIRCUITO Y VEHÍCULO</span><h1>Rankings y directores</h1><p>Mejores tiempos de llegada, sin puntos de campeonato. Se actualizan al cerrar cada carrera.</p></div></div><section class="panel"><div class="button-row"><label>Circuito<select id="ranking-circuit">${onlineData.catalog.races.map((e) => `<option value="${esc(e.id)}">${esc(e.name)}</option>`).join("")}</select></label><label>Vehículo<select id="ranking-vehicle"><option value="">Todos los vehículos</option>${onlineData.catalog.vehicles.map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`).join("")}</select></label><button class="button primary" data-action="rankings-search">Consultar</button></div><div id="ranking-output"><p>Elegí los filtros y consultá los resultados.</p></div></section><section class="panel"><h2>Directores</h2>${onlineData.public.directors.map((d) => `<button class="button ghost" data-action="director-profile" data-id="${esc(d.id)}">@${esc(d.director)} · ${esc(d.name)} · Nivel ${d.level}</button>`).join("")}<div id="profile-output"></div></section>`;
}
async function loadRankings() {
  try {
    const d = await api.rankings(
      $("#ranking-circuit").value,
      $("#ranking-vehicle").value,
    );
    $("#ranking-output").innerHTML = d.results.length
      ? `<div class="table-wrap"><table><thead><tr><th>Tiempo</th><th>Director</th><th>Escudería</th><th>Vehículo</th><th>Carrera</th></tr></thead><tbody>${d.results.map((r) => `<tr><td>${duration(r.finish_seconds)}</td><td>@${esc(r.director)}</td><td>${esc(r.team_name)}</td><td>${esc(vehicle(r.vehicle_id).short)}</td><td>${localDate(r.closed_at)}</td></tr>`).join("")}</tbody></table></div>`
      : "<p>Todavía no hay llegadas registradas con esos filtros.</p>";
  } catch (e) {
    toast(e.message);
  }
}
async function loadProfile(id) {
  try {
    const d = await api.request("/api/profile?id=" + encodeURIComponent(id));
    $("#profile-output").innerHTML =
      "<h3>Estadísticas por circuito y modelo</h3>" +
      (d.byCircuitAndVehicle
        .map(
          (r) =>
            `<p>${esc(onlineData.catalog.races.find((e) => e.id === r.circuit_id)?.name || r.circuit_id)} · ${esc(vehicle(r.vehicle_id).short)} · ${r.starts} carreras · ${r.finishes} llegadas · ${r.wins} victorias · ${num(r.km)} km · mejor ${r.best_seconds === null ? "—" : duration(r.best_seconds)}</p>`,
        )
        .join("") || "<p>Este director aún no tiene carreras cerradas.</p>");
  } catch (e) {
    toast(e.message);
  }
}
