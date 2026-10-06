PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id TEXT PRIMARY KEY, username TEXT NOT NULL, username_key TEXT NOT NULL UNIQUE,
 email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE sessions (
 token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at INTEGER NOT NULL
);
CREATE INDEX sessions_expiry ON sessions(expires_at);
-- Una fila autoritativa para la pequeña sala de 20 jugadores. No se consulta una tabla por pieza.
CREATE TABLE world (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL DEFAULT 0,
 commit_key TEXT NOT NULL, state_json TEXT NOT NULL CHECK(json_valid(state_json)), updated_at INTEGER NOT NULL
);
CREATE TABLE snapshots (
 id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json))
);
CREATE TABLE receipts (
 user_id TEXT NOT NULL REFERENCES users(id), command_key TEXT NOT NULL, request_hash TEXT NOT NULL,
 response_json TEXT NOT NULL CHECK(json_valid(response_json)), created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,command_key)
);
CREATE TABLE results (
 race_id TEXT NOT NULL, circuit_id TEXT NOT NULL, team_id TEXT NOT NULL,
 director TEXT NOT NULL, team_name TEXT NOT NULL, is_bot INTEGER NOT NULL CHECK(is_bot IN (0,1)),
 vehicle_id TEXT NOT NULL, rules_version TEXT NOT NULL, catalog_revision TEXT NOT NULL,
 position INTEGER NOT NULL, finished INTEGER NOT NULL CHECK(finished IN (0,1)),
 finish_seconds REAL, distance_km REAL NOT NULL, driving_seconds REAL NOT NULL,
 prize_cents INTEGER NOT NULL, closed_at INTEGER NOT NULL,
 details_json TEXT NOT NULL CHECK(json_valid(details_json)), PRIMARY KEY(race_id,team_id)
);
CREATE INDEX circuit_records ON results(circuit_id,vehicle_id,rules_version,finished,finish_seconds);
CREATE INDEX director_results ON results(team_id,closed_at);
CREATE TABLE ledger (
 team_id TEXT NOT NULL, sequence INTEGER NOT NULL, at INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL, label TEXT NOT NULL, PRIMARY KEY(team_id,sequence)
);
CREATE INDEX ledger_by_team_date ON ledger(team_id,at);
CREATE TABLE auth_limits (
 bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
