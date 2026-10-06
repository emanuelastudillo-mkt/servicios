import { handleRoomRequest } from "./worker.js";
import { readWorld, commit } from "./store.js";
import { syncCatalog } from "./world.js";
import { forecastNext, projectTime, roundTime } from "./schedule.js";
import { DailyCatalog } from "./daily-catalog.js";

// D1 is authoritative. SQLite stores only the alarm; progress between milestones is reproducible.
export class RaceRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = { ...env, ROOM_RUNTIME: this };
    this.tail = Promise.resolve();
    this.cached = null;
    this.forecast = null;
    this.conflicts = 0;
    this.catalog = new DailyCatalog(ctx.storage, env.CATALOG_URL);
  }
  exclusive(work) {
    const task = this.tail.then(work);
    this.tail = task.catch(() => {});
    return task;
  }
  async load(now) {
    if (!this.cached)
      this.cached = await readWorld(this.env.DB, now, this.env.SEASON_EPOCH);
    return this.cached;
  }
  async persist(previous, w, key, extras = []) {
    const ok = await commit(this.env.DB, previous, w, key, extras);
    if (!ok) {
      this.cached = null;
      this.forecast = null;
      if (++this.conflicts >= 4)
        throw Error(
          "La sala no pudo guardar el evento tras cuatro conflictos.",
        );
      return false;
    }
    this.cached = { revision: previous.revision + 1, world: w };
    this.conflicts = 0;
    this.forecast = null;
    await this.plan();
    return true;
  }
  async plan() {
    if (!this.forecast) this.forecast = forecastNext(this.cached.world);
    // An alarm is persisted by Cloudflare, so closing every browser does not stop the race.
    const at = Math.max(Date.now() + 1000, this.forecast.at);
    if ((await this.ctx.storage.getAlarm()) !== at)
      await this.ctx.storage.setAlarm(at);
  }
  async current(now) {
    let data = await this.load(now);
    const catalogChanged = syncCatalog(
      data.world,
      await this.catalog.current(now),
    );
    if (catalogChanged) this.forecast = null;
    if (!this.forecast) this.forecast = forecastNext(data.world);
    if (
      catalogChanged ||
      data.revision < 0 ||
      this.forecast.at <= roundTime(now)
    ) {
      const useForecast = !catalogChanged && this.forecast.at <= roundTime(now);
      const w = structuredClone(useForecast ? this.forecast.world : data.world);
      projectTime(w, now);
      if (!(await this.persist(data, w, crypto.randomUUID())))
        return this.current(now);
      data = this.cached;
    } else projectTime(data.world, now);
    await this.plan();
    return { revision: data.revision, world: structuredClone(data.world) };
  }
  async fetch(request) {
    return this.exclusive(async () => {
      const now = Date.now(),
        data = await this.current(now);
      if (
        data.world.at < roundTime(now) &&
        new URL(request.url).pathname !== "/api/health"
      )
        return Response.json(
          {
            error:
              "La sala está recuperando tiempo pendiente. Reintentá en un minuto.",
          },
          { status: 503, headers: { "Cache-Control": "no-store" } },
        );
      return handleRoomRequest(request, this.env, this.ctx);
    });
  }
  async alarm() {
    return this.exclusive(async () => {
      try {
        const now = Date.now();
        await this.current(now);
        const day = Math.floor(now / 86400000);
        if ((await this.ctx.storage.get("cleanupDay")) !== day) {
          await this.env.DB.batch([
            this.env.DB.prepare(
              "DELETE FROM sessions WHERE expires_at<=?",
            ).bind(now),
            this.env.DB.prepare(
              "DELETE FROM auth_limits WHERE expires_at<=?",
            ).bind(now),
            this.env.DB.prepare(
              "DELETE FROM passkey_challenges WHERE expires_at<=?",
            ).bind(now),
          ]);
          await this.ctx.storage.put("cleanupDay", day);
        }
      } catch (error) {
        this.cached = null;
        this.forecast = null;
        await this.ctx.storage.setAlarm(Date.now() + 60000);
        throw error;
      }
    });
  }
}
