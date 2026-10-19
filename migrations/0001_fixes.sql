-- Every distinct GPS fix from both PKSB feeds, kept for longitudinal research.
-- One row per (plate, device fix time): the trackers re-serve a parked bus's
-- last fix for days; INSERT OR IGNORE stores it once.
CREATE TABLE IF NOT EXISTS fixes (
  plate        TEXT    NOT NULL,           -- canonical plate, "10-1230"
  fix_ms       INTEGER NOT NULL,           -- device fix time, epoch ms UTC
  lat          REAL    NOT NULL,
  lng          REAL    NOT NULL,
  speed_kph    REAL,
  heading      REAL,
  odometer_m   INTEGER,                    -- keyless LiCheng; null on the token feed
  online       INTEGER,                    -- 1/0 device link flag; null if unknown
  route_id     TEXT,                       -- token feed's line, null when unsaid
  destination  TEXT,
  pax_on_board INTEGER,
  pax_up       INTEGER,
  pax_down     INTEGER,
  feed         TEXT    NOT NULL,           -- 'keyless' | 'token'
  received_ms  INTEGER NOT NULL,           -- when our collector saw it
  PRIMARY KEY (plate, fix_ms)
) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS fixes_by_time ON fixes (fix_ms);
