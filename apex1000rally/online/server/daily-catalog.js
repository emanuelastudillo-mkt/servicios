import { CATALOG } from "../../data/catalog.js";
import { validateCatalog } from "../../src/catalog-schema.js";

// One public catalog read per UTC day; no requests per viewer and no Cloudflare deploy token in GitHub.
export class DailyCatalog {
  constructor(storage, url, fetcher = fetch) {
    this.storage = storage;
    this.url = url;
    this.fetcher = fetcher;
    this.record = null;
  }
  async current(now) {
    if (!this.url) return CATALOG;
    const day = Math.floor(now / 86400000);
    if (!this.record) this.record = await this.storage.get("dailyCatalog");
    if (!this.record || this.record.build !== CATALOG.revision) {
      // A code rollout adopts its own catalog immediately. The next day resumes Sheets updates.
      this.record = { build: CATALOG.revision, day, catalog: CATALOG };
      await this.storage.put("dailyCatalog", this.record);
    }
    if (this.record.day === day) return this.record.catalog;
    let catalog = this.record.catalog;
    try {
      const url = new URL(this.url);
      if (
        url.origin !== "https://emanuelmkt.com.ar" ||
        url.pathname !== "/apex1000rally/data/catalog.json"
      )
        throw Error("Origen de catálogo no permitido.");
      const response = await this.fetcher(url, {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
      });
      if (!response.ok) throw Error(`Catálogo HTTP ${response.status}`);
      const text = await response.text();
      if (text.length > 500000) throw Error("Catálogo demasiado grande.");
      catalog = validateCatalog(JSON.parse(text));
    } catch (error) {
      // Retain the last validated catalog; a bad spreadsheet cannot stop a race.
      console.warn("Se conserva el catálogo anterior:", error.message);
    }
    this.record = { build: CATALOG.revision, day, catalog };
    await this.storage.put("dailyCatalog", this.record);
    return catalog;
  }
}
