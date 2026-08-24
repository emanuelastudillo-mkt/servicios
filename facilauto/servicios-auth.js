/**
 * Cliente mínimo para integrar la web existente con el Worker.
 * Configurar apiBase con el dominio real del Worker/API.
 */
export class ServiciosAutomotoresClient {
  constructor({ apiBase }) {
    this.apiBase = apiBase.replace(/\/$/, '');
  }

  loginWithGoogle() {
    window.location.href = `${this.apiBase}/auth/google`;
  }

  async logout() {
    return this.#request('/auth/logout', { method: 'POST' });
  }

  async me() {
    return this.#request('/api/me');
  }

  async credits() {
    return this.#request('/api/credits');
  }

  async searchVehicles(query) {
    return this.#request(`/api/catalog/search?q=${encodeURIComponent(query)}`);
  }

  async valuate(payload) {
    return this.#request('/api/valuation', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  }

  async createCheckout(productCode) {
    return this.#request('/api/billing/checkout', {
      method: 'POST',
      body: JSON.stringify({ product_code: productCode })
    });
  }

  async #request(path, options = {}) {
    const response = await fetch(`${this.apiBase}${path}`, {
      credentials: 'include',
      headers: {
        'content-type': 'application/json',
        ...(options.headers || {})
      },
      ...options
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.message || data.error || `HTTP ${response.status}`);
      error.status = response.status;
      error.code = data.error;
      throw error;
    }
    return data;
  }
}
