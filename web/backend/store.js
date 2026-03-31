const path = require("path");
const Database = require("better-sqlite3");

class Store {
  constructor() {
    this.mode = process.env.DATABASE_URL ? "postgres" : "sqlite";
    this.sqlite = null;
    this.pg = null;
  }

  async init() {
    if (this.mode === "postgres") {
      const { Pool } = require("pg");

      this.pg = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl:
          process.env.PGSSL === "false"
            ? false
            : process.env.NODE_ENV === "production"
              ? { rejectUnauthorized: false }
              : false
      });

      await this.pg.query(`
        CREATE TABLE IF NOT EXISTS incidents (
          id SERIAL PRIMARY KEY,
          incident_id TEXT UNIQUE NOT NULL,
          sensor_id INTEGER,
          type TEXT,
          description TEXT,
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          resolved_at TIMESTAMPTZ
        );

        CREATE TABLE IF NOT EXISTS sensor_logs (
          id SERIAL PRIMARY KEY,
          sensor_id INTEGER,
          lat DOUBLE PRECISION,
          lon DOUBLE PRECISION,
          bpm INTEGER,
          emg INTEGER,
          finger INTEGER,
          battery INTEGER,
          timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS devices (
          id INTEGER PRIMARY KEY,
          name TEXT,
          registered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          last_seen TIMESTAMPTZ,
          last_lat DOUBLE PRECISION,
          last_lon DOUBLE PRECISION,
          battery INTEGER
        );

        ALTER TABLE devices ADD COLUMN IF NOT EXISTS assigned_guest_id INTEGER;
        ALTER TABLE devices ADD COLUMN IF NOT EXISTS receiver_label TEXT;
        ALTER TABLE devices ADD COLUMN IF NOT EXISTS connected BOOLEAN DEFAULT false;
        ALTER TABLE devices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
        ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_bpm INTEGER;
        ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_emg INTEGER;
        ALTER TABLE devices ADD COLUMN IF NOT EXISTS last_finger INTEGER;
      `);

      return;
    }

    const dbPath =
      process.env.SQLITE_PATH || path.join(__dirname, "..", "marineguard.db");

    this.sqlite = new Database(dbPath);
    this.sqlite.pragma("journal_mode = WAL");
    this.sqlite.exec(`
      CREATE TABLE IF NOT EXISTS incidents (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        incident_id TEXT UNIQUE,
        sensor_id INTEGER,
        type TEXT,
        description TEXT,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME
      );

      CREATE TABLE IF NOT EXISTS sensor_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sensor_id INTEGER,
        lat REAL,
        lon REAL,
        bpm INTEGER,
        emg INTEGER,
        finger INTEGER,
        battery INTEGER,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS devices (
        id INTEGER PRIMARY KEY,
        name TEXT,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME,
        last_lat REAL,
        last_lon REAL,
        battery INTEGER
      );
    `);

    const alterStatements = [
      "ALTER TABLE sensor_logs ADD COLUMN battery INTEGER",
      "ALTER TABLE devices ADD COLUMN battery INTEGER",
      "ALTER TABLE devices ADD COLUMN assigned_guest_id INTEGER",
      "ALTER TABLE devices ADD COLUMN receiver_label TEXT",
      "ALTER TABLE devices ADD COLUMN connected INTEGER DEFAULT 0",
      "ALTER TABLE devices ADD COLUMN status TEXT DEFAULT 'available'",
      "ALTER TABLE devices ADD COLUMN last_bpm INTEGER",
      "ALTER TABLE devices ADD COLUMN last_emg INTEGER",
      "ALTER TABLE devices ADD COLUMN last_finger INTEGER"
    ];

    for (const statement of alterStatements) {
      try {
        this.sqlite.exec(statement);
      } catch (error) {
        if (!String(error.message).includes("duplicate column")) throw error;
      }
    }
  }

  async upsertDevice(device) {
    const {
      id,
      name,
      lat,
      lon,
      battery,
      assignedGuestId,
      receiverLabel,
      connected,
      status,
      bpm,
      emg,
      finger
    } = device;

    if (this.mode === "postgres") {
      await this.pg.query(
        `
          INSERT INTO devices (
            id, name, registered_at, last_seen, last_lat, last_lon, battery,
            assigned_guest_id, receiver_label, connected, status, last_bpm, last_emg, last_finger
          )
          VALUES ($1, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            last_seen = CURRENT_TIMESTAMP,
            last_lat = EXCLUDED.last_lat,
            last_lon = EXCLUDED.last_lon,
            battery = EXCLUDED.battery,
            assigned_guest_id = COALESCE(EXCLUDED.assigned_guest_id, devices.assigned_guest_id),
            receiver_label = COALESCE(EXCLUDED.receiver_label, devices.receiver_label),
            connected = COALESCE(EXCLUDED.connected, devices.connected),
            status = COALESCE(EXCLUDED.status, devices.status),
            last_bpm = COALESCE(EXCLUDED.last_bpm, devices.last_bpm),
            last_emg = COALESCE(EXCLUDED.last_emg, devices.last_emg),
            last_finger = COALESCE(EXCLUDED.last_finger, devices.last_finger)
        `,
        [
          id,
          name,
          lat,
          lon,
          battery ?? null,
          assignedGuestId ?? null,
          receiverLabel ?? null,
          connected ?? null,
          status ?? null,
          bpm ?? null,
          emg ?? null,
          finger ?? null
        ]
      );
      return;
    }

    this.sqlite
      .prepare(
        `
          INSERT INTO devices (
            id, name, registered_at, last_seen, last_lat, last_lon, battery,
            assigned_guest_id, receiver_label, connected, status, last_bpm, last_emg, last_finger
          )
          VALUES (?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(id) DO UPDATE SET
            name = excluded.name,
            last_seen = CURRENT_TIMESTAMP,
            last_lat = excluded.last_lat,
            last_lon = excluded.last_lon,
            battery = excluded.battery,
            assigned_guest_id = COALESCE(excluded.assigned_guest_id, devices.assigned_guest_id),
            receiver_label = COALESCE(excluded.receiver_label, devices.receiver_label),
            connected = COALESCE(excluded.connected, devices.connected),
            status = COALESCE(excluded.status, devices.status),
            last_bpm = COALESCE(excluded.last_bpm, devices.last_bpm),
            last_emg = COALESCE(excluded.last_emg, devices.last_emg),
            last_finger = COALESCE(excluded.last_finger, devices.last_finger)
        `
      )
      .run(
        id,
        name,
        lat,
        lon,
        battery ?? null,
        assignedGuestId ?? null,
        receiverLabel ?? null,
        connected === undefined ? null : connected ? 1 : 0,
        status ?? null,
        bpm ?? null,
        emg ?? null,
        finger ?? null
      );
  }

  async updateDeviceAssignment(id, assignedGuestId) {
    if (this.mode === "postgres") {
      await this.pg.query(
        `
          UPDATE devices
          SET assigned_guest_id = $1
          WHERE id = $2
        `,
        [assignedGuestId ?? null, id]
      );
      return;
    }

    this.sqlite
      .prepare(
        `
          UPDATE devices
          SET assigned_guest_id = ?
          WHERE id = ?
        `
      )
      .run(assignedGuestId ?? null, id);
  }

  async insertSensorLog(entry) {
    const { id, lat, lon, bpm, emg, finger, battery } = entry;

    if (this.mode === "postgres") {
      await this.pg.query(
        `
          INSERT INTO sensor_logs (sensor_id, lat, lon, bpm, emg, finger, battery)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `,
        [id, lat, lon, bpm, emg, finger, battery ?? null]
      );
      return;
    }

    this.sqlite
      .prepare(
        `
          INSERT INTO sensor_logs (sensor_id, lat, lon, bpm, emg, finger, battery)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `
      )
      .run(id, lat, lon, bpm, emg, finger, battery ?? null);
  }

  async getIncidentCount(sensorId) {
    if (this.mode === "postgres") {
      const result = await this.pg.query(
        "SELECT COUNT(*)::int AS count FROM incidents WHERE sensor_id = $1",
        [sensorId]
      );
      return result.rows[0]?.count || 0;
    }

    const row = this.sqlite
      .prepare("SELECT COUNT(*) AS count FROM incidents WHERE sensor_id = ?")
      .get(sensorId);
    return row?.count || 0;
  }

  async createIncident(incident) {
    const { incidentId, sensorId, type, description } = incident;

    if (this.mode === "postgres") {
      await this.pg.query(
        `
          INSERT INTO incidents (incident_id, sensor_id, type, description, status)
          VALUES ($1, $2, $3, $4, 'active')
          ON CONFLICT (incident_id) DO NOTHING
        `,
        [incidentId, sensorId, type, description]
      );
      return;
    }

    this.sqlite
      .prepare(
        `
          INSERT OR IGNORE INTO incidents (incident_id, sensor_id, type, description, status)
          VALUES (?, ?, ?, ?, 'active')
        `
      )
      .run(incidentId, sensorId, type, description);
  }

  async getDevices() {
    if (this.mode === "postgres") {
      const result = await this.pg.query("SELECT * FROM devices ORDER BY id");
      return result.rows;
    }

    return this.sqlite.prepare("SELECT * FROM devices ORDER BY id").all();
  }

  async getIncidents(limit = 50) {
    if (this.mode === "postgres") {
      const result = await this.pg.query(
        "SELECT * FROM incidents ORDER BY created_at DESC LIMIT $1",
        [limit]
      );
      return result.rows;
    }

    return this.sqlite
      .prepare("SELECT * FROM incidents ORDER BY created_at DESC LIMIT ?")
      .all(limit);
  }

  async updateIncidentStatus(incidentId, status) {
    if (this.mode === "postgres") {
      await this.pg.query(
        `
          UPDATE incidents
          SET status = $1, resolved_at = CURRENT_TIMESTAMP
          WHERE incident_id = $2
        `,
        [status, incidentId]
      );
      return;
    }

    this.sqlite
      .prepare(
        `
          UPDATE incidents
          SET status = ?, resolved_at = CURRENT_TIMESTAMP
          WHERE incident_id = ?
        `
      )
      .run(status, incidentId);
  }

  async close() {
    if (this.mode === "postgres") {
      await this.pg?.end();
      return;
    }

    this.sqlite?.close();
  }
}

module.exports = Store;
