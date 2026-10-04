-- Diseño inicial SQLite para un futuro servidor. No lo consume el prototipo.
PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, display_name TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE races (
 id TEXT PRIMARY KEY, starts_at TEXT NOT NULL, engine_version TEXT NOT NULL,
 route_version TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('scheduled','running','finished')),
 last_tick INTEGER NOT NULL DEFAULT 0, revision INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE entries (
 id TEXT PRIMARY KEY, race_id TEXT NOT NULL REFERENCES races(id), user_id TEXT NOT NULL REFERENCES users(id),
 team_name TEXT NOT NULL, vehicle_id TEXT NOT NULL, budget_cents INTEGER NOT NULL CHECK(budget_cents>=0),
 debt_cents INTEGER NOT NULL DEFAULT 0 CHECK(debt_cents>=0), finish_seconds REAL,
 prize_settled INTEGER NOT NULL DEFAULT 0 CHECK(prize_settled IN (0,1)), revision INTEGER NOT NULL DEFAULT 0,
 UNIQUE(race_id,user_id)
);
CREATE TABLE stage_plans (
 entry_id TEXT NOT NULL REFERENCES entries(id), stage_index INTEGER NOT NULL CHECK(stage_index BETWEEN 0 AND 14),
 plan_json TEXT NOT NULL CHECK(json_valid(plan_json)), revision INTEGER NOT NULL,
 submitted_at TEXT NOT NULL, locked_at TEXT, PRIMARY KEY(entry_id,stage_index)
);
CREATE TABLE part_instances (
 id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES entries(id),
 part_type TEXT NOT NULL CHECK(part_type IN ('engine','transmission','suspension','tyres','cooling','brakes')),
 grade TEXT NOT NULL CHECK(grade IN ('reserve','endurance','standard','racing')),
 condition REAL NOT NULL CHECK(condition BETWEEN 0 AND 100), broken INTEGER NOT NULL CHECK(broken IN (0,1)),
 installed INTEGER NOT NULL CHECK(installed IN (0,1)), CHECK(grade!='reserve' OR broken=0)
);
CREATE UNIQUE INDEX one_installed_per_slot ON part_instances(entry_id,part_type) WHERE installed=1;
CREATE UNIQUE INDEX one_reserve_per_slot ON part_instances(entry_id,part_type) WHERE grade='reserve';
-- La inscripción crea las seis reservas; índices garantizan como máximo una, la transacción garantiza su existencia.
CREATE TABLE driver_states (
 entry_id TEXT NOT NULL REFERENCES entries(id), profile_id TEXT NOT NULL,
 energy REAL NOT NULL CHECK(energy BETWEEN 0 AND 100), PRIMARY KEY(entry_id,profile_id)
);
CREATE TABLE entry_checkpoints (
 entry_id TEXT PRIMARY KEY REFERENCES entries(id), tick INTEGER NOT NULL, engine_version TEXT NOT NULL,
 state_json TEXT NOT NULL CHECK(json_valid(state_json)), revision INTEGER NOT NULL
);
CREATE TABLE public_positions (
 entry_id TEXT PRIMARY KEY REFERENCES entries(id), phase TEXT NOT NULL,
 stage_index INTEGER NOT NULL CHECK(stage_index BETWEEN 0 AND 15), total_km REAL NOT NULL CHECK(total_km>=0),
 stage_km REAL NOT NULL CHECK(stage_km>=0), speed_kmh REAL NOT NULL CHECK(speed_kmh BETWEEN 0 AND 250),
 lon REAL NOT NULL, lat REAL NOT NULL, tick INTEGER NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE ledger (
 id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES entries(id), tick INTEGER NOT NULL,
 amount_cents INTEGER NOT NULL, label TEXT NOT NULL, operation_key TEXT NOT NULL,
 UNIQUE(entry_id,operation_key)
);
CREATE TABLE race_events (
 id TEXT PRIMARY KEY, entry_id TEXT NOT NULL REFERENCES entries(id), tick INTEGER NOT NULL,
 event_type TEXT NOT NULL, payload_json TEXT NOT NULL CHECK(json_valid(payload_json)),
 visibility TEXT NOT NULL CHECK(visibility IN ('private','public'))
);
CREATE INDEX events_by_entry_tick ON race_events(entry_id,tick);
CREATE TABLE command_receipts (
 entry_id TEXT NOT NULL REFERENCES entries(id), command_key TEXT NOT NULL,
 request_hash TEXT NOT NULL, response_json TEXT NOT NULL CHECK(json_valid(response_json)),
 created_at TEXT NOT NULL, PRIMARY KEY(entry_id,command_key)
);
