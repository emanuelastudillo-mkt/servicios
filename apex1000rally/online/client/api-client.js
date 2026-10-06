export class ApexAPI {
  constructor(base = "") {
    this.base = base.replace(/\/$/, "");
    this.race = "";
    this.tokenKey = 'apex-online-session:' + (this.base || location.origin);
    this.token = sessionStorage.getItem(this.tokenKey) || '';
  }
  async request(path, options = {}) {
    const response = await fetch(this.base + path, {
      credentials: "same-origin",
      ...options,
      headers: { ...(options.body ? {"Content-Type": "application/json"} : {}), ...(this.token ? {Authorization: `Bearer ${this.token}`} : {}), ...options.headers },
    });
    const data = await response.json().catch(() => ({error: 'El servidor no respondió correctamente. Reintentá la misma acción.'}));
    if (!response.ok) {
      const error = Error(data.error || "No se pudo completar la solicitud.");
      error.status = response.status;
      throw error;
    }
    if (data.token) { this.token = data.token; sessionStorage.setItem(this.tokenKey, data.token); }
    return data;
  }
  register(data) {
    return this.request("/api/register", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }
  login(login, password) {
    return this.request("/api/login", {
      method: "POST",
      body: JSON.stringify({ login, password }),
    });
  }
  async logout() {
    const result = await this.request("/api/logout", { method: "POST" });
    this.token = ''; sessionStorage.removeItem(this.tokenKey); return result;
  }
  bootstrap() {
    return this.request("/api/bootstrap" + (this.race ? '?race=' + encodeURIComponent(this.race) : ''));
  }
  public() {
    return this.request("/api/public");
  }
  // Keep this key for retries of the SAME action. Generate another key only for a new action.
  command(data, key = crypto.randomUUID()) {
    return this.request("/api/command", {
      method: "POST",
      headers: { "Idempotency-Key": key },
      body: JSON.stringify(data),
    });
  }
  rankings(circuit, vehicle = "") {
    return this.request(
      "/api/rankings?" +
        new URLSearchParams({ circuit, ...(vehicle ? { vehicle } : {}) }),
    );
  }
  watch(callback, onError, seconds = 60, immediate = true) {
    let stopped = false,
      timer = null,
      busy = false;
    const poll = async () => {
      if (stopped || busy) return;
      busy = true;
      if (!document.hidden) {
        try {
          const d = await this.bootstrap();
          if (!stopped) callback(d);
        } catch (e) {
          if (!stopped) onError?.(e);
        }
      }
      busy = false;
      if (!stopped) timer = setTimeout(poll, Math.max(60, seconds) * 1000);
    };
    const visible = () => {
      if (!document.hidden && !stopped) {
        clearTimeout(timer);
        poll();
      }
    };
    document.addEventListener("visibilitychange", visible);
    if (immediate) poll();
    else timer = setTimeout(poll, Math.max(60, seconds) * 1000);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", visible);
    };
  }
}
