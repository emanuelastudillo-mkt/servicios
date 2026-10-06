import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
export function database() {
  const sql = new DatabaseSync(":memory:");
  sql.exec(
    readFileSync(
      new URL("../migrations/0001_online.sql", import.meta.url),
      "utf8",
    ),
  );
  let reads = 0,
    writes = 0;
  const db = {
    sql,
    metrics: () => ({ reads, writes }),
    prepare(query) {
      const p = {
        params: [],
        bind(...args) {
          this.params = args;
          return this;
        },
        async first() {
          reads++;
          return sql.prepare(query).get(...this.params) || null;
        },
        async all() {
          reads++;
          return { results: sql.prepare(query).all(...this.params) };
        },
        async run() {
          const result = sql.prepare(query).run(...this.params);
          writes++;
          return { meta: { changes: Number(result.changes) } };
        },
        execute() {
          const stmt = sql.prepare(query);
          let result;
          if (/^SELECT/i.test(query)) {
            reads++;
            return { results: stmt.all(...this.params), meta: { changes: 0 } };
          }
          result = stmt.run(...this.params);
          writes++;
          return { meta: { changes: Number(result.changes) } };
        },
      };
      return p;
    },
    async batch(statements) {
      sql.exec("BEGIN IMMEDIATE");
      try {
        const result = statements.map((s) => s.execute());
        sql.exec("COMMIT");
        return result;
      } catch (e) {
        sql.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return db;
}
