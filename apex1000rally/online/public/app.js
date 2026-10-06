import { ApexAPI } from "./api-client.js";
const api = new ApexAPI(),
  $ = (s) => document.querySelector(s),
  esc = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const number = (n) =>
    Number(n).toLocaleString("es-AR", { maximumFractionDigits: 1 }),
  date = (n) =>
    new Date(n).toLocaleString("es-AR", {
      timeZone: "America/Argentina/Buenos_Aires",
    }),
  metric = (n, label) =>
    `<div class="metric"><strong>${esc(n)}</strong><small>${esc(label)}</small></div>`;
let data = null,
  stop = null;
const message = (text) => {
  $("#message").textContent = text;
};
const table = (head, rows) =>
  `<div class="table-wrap"><table><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((x) => `<td>${esc(x)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
function bots(publicData) {
  if (publicData.vehicles && !$("#initial-model").options.length)
    $("#initial-model").innerHTML = publicData.vehicles
      .map(
        (v) =>
          `<option value="${esc(v.id)}" ${!v.available || v.stock < 1 ? "disabled" : ""} ${v.id === "niva" ? "selected" : ""}>${esc(v.name)} · ${number(v.price)} cr · stock ${v.stock}</option>`,
      )
      .join("");
  $("#bots").innerHTML = publicData.bots
    .map((b) => metric(b.name, `BOT · Nivel ${b.level} · ${b.model}`))
    .join("");
}
function render(d) {
  data = d;
  $("#auth").hidden = true;
  $("#account").hidden = false;
  $("#connection").textContent = "SINCRONIZADO · " + date(d.at);
  $("#director").textContent = "@" + d.user.username;
  $("#team-name").textContent = d.team.name;
  $("#summary").innerHTML = [
    metric(number(d.team.budget) + " cr", "Saldo"),
    metric(number(d.team.debt) + " cr", "Deuda"),
    metric(d.stats.starts, "Carreras cerradas"),
    metric(d.stats.wins, "Victorias"),
    metric(number(d.stats.km) + " km", "Distancia acumulada"),
  ].join("");
  $("#garage").innerHTML =
    "<h2>Vehículos y piezas</h2>" +
    table(
      ["Auto", "Estado", "Performance", "Fiabilidad"],
      d.team.garage.map((c) => [
        d.catalog.vehicles.find((v) => v.id === c.modelId)?.name,
        number(c.condition),
        number(c.performance),
        number(c.reliability),
      ]),
    ) +
    table(
      ["Pieza instalada", "Calidad", "Estado", "Original"],
      Object.values(d.team.parts).map((p) => [
        p.type,
        p.grade,
        number(p.condition),
        number(p.original),
      ]),
    );
  $("#people").innerHTML =
    "<h2>Personal y contratos</h2>" +
    table(
      ["Empleado", "Función", "Sueldo mensual", "Vencimiento"],
      [
        ...d.team.drivers.map((p) => [
          p.name,
          "Piloto",
          number(p.salary) + " cr",
          date(p.contract.expiresAt),
        ]),
        ...d.team.mechanics.map((p) => [
          p.name,
          "Mecánico",
          number(p.salary) + " cr",
          date(p.contract.expiresAt),
        ]),
      ],
    );
  $("#calendar").innerHTML = d.calendar
    .filter((e) => e.start > d.at)
    .slice(0, 8)
    .map((e) => {
      const entry = d.entries.find((x) => x.eventId === e.eventId);
      return `<div class="race-line"><div><strong>${esc(e.name)}</strong><small>${date(e.start)} · ${esc(e.kind)} · máximo ${e.maxHours} h</small></div><button data-event="${esc(e.eventId)}" data-entry="${entry ? "cancel" : "enroll"}">${entry ? "Cancelar inscripción" : "Inscribirme"}</button></div>`;
    })
    .join("");
  $("#races").innerHTML =
    d.public.races
      .filter((r) => r.status === "running")
      .map(
        (r) =>
          `<h3>${esc(r.name)}</h3>${table(
            ["Puesto", "Escudería", "Vehículo", "Distancia", "Velocidad"],
            r.positions.map((p) => [
              p.rank,
              p.name,
              p.vehicleId,
              number(p.totalKm) + " km",
              number(p.speedKmh) + " km/h",
            ]),
          )}`,
      )
      .join("") || "<p>No hay carreras en curso.</p>";
  bots(d.public);
  if (!$("#circuits").options.length) {
    $("#circuits").innerHTML = d.catalog.races
      .map((r) => `<option value="${esc(r.id)}">${esc(r.name)}</option>`)
      .join("");
    $("#models").innerHTML +=
      "" +
      d.catalog.vehicles
        .map((v) => `<option value="${esc(v.id)}">${esc(v.name)}</option>`)
        .join("");
  }
}
function watch(immediate = true) {
  stop?.();
  stop = api.watch(
    render,
    (e) => {
      if (e.status === 401) {
        stop?.();
        $("#account").hidden = true;
        $("#auth").hidden = false;
      } else message(e.message);
    },
    60,
    immediate,
  );
}
for (let i = 1; i <= 48; i++) $("#shield").add(new Option("Escudo " + i, i));
for (const id of ["login", "register"])
  $("#" + id).addEventListener("submit", async (e) => {
    e.preventDefault();
    const button = e.submitter;
    button.disabled = true;
    try {
      const values = Object.fromEntries(new FormData(e.target));
      if (id === "login") await api.login(values.login, values.password);
      else await api.register({ ...values, shieldId: Number(values.shieldId) });
      e.target.reset();
      message("Conectado. El servidor conserva tu escudería.");
      watch();
    } catch (error) {
      message(error.message);
    } finally {
      button.disabled = false;
    }
  });
$("#logout").addEventListener("click", async () => {
  try {
    await api.logout();
    stop?.();
    data = null;
    $("#account").hidden = true;
    $("#auth").hidden = false;
    message("Sesión cerrada.");
  } catch (e) {
    message(e.message);
  }
});
$("#calendar").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-event]");
  if (!b) return;
  b.disabled = true;
  try {
    await api.command({
      type: b.dataset.entry === "cancel" ? "cancel-enrollment" : "enroll",
      eventId: b.dataset.event,
      driverId: data.team.activeDriver,
    });
    render(await api.bootstrap());
    message("Inscripción actualizada.");
  } catch (error) {
    message(error.message);
  } finally {
    b.disabled = false;
  }
});
$("#command").addEventListener("submit", async (e) => {
  e.preventDefault();
  try {
    await api.command(JSON.parse(new FormData(e.target).get("command")));
    render(await api.bootstrap());
    message("Comando confirmado por el servidor.");
  } catch (error) {
    message(error.message);
  }
});
$("#ranking").addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  try {
    const r = await api.rankings(f.get("circuit"), f.get("vehicle"));
    $("#ranking-result").innerHTML = r.results.length
      ? table(
          ["Director", "Escudería", "Vehículo", "Tiempo total", "Fecha"],
          r.results.map((r) => [
            r.director,
            r.team_name,
            r.vehicle_id,
            number(r.finish_seconds / 3600) + " h",
            date(r.closed_at),
          ]),
        )
      : "<p>Todavía no hay llegadas registradas para este filtro.</p>";
  } catch (error) {
    message(error.message);
  }
});
try {
  render(await api.bootstrap());
  watch(false);
} catch (e) {
  if (e.status !== 401) message(e.message);
  try {
    bots(await api.public());
  } catch {}
}
