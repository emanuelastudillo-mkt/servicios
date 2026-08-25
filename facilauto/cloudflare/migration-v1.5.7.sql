-- FACIL AUTO v1.5.7
-- Historial permanente de consultas compradas.
-- Ejecutar UNA VEZ en Cloudflare D1 > facilauto > Console.
-- Es idempotente: CREATE TABLE/INDEX usan IF NOT EXISTS.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS credit_purchases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  credits INTEGER NOT NULL CHECK (credits > 0),
  reference TEXT UNIQUE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_user
  ON credit_purchases(user_id);

CREATE INDEX IF NOT EXISTS idx_credit_purchases_created
  ON credit_purchases(created_at);
