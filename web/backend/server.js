const express = require("express");
const http = require("http");
const path = require("path");
const cors = require("cors");
const { Server } = require("socket.io");
const Store = require("./store");

const app = express();
const server = http.createServer(app);

const frontendOrigins = (process.env.FRONTEND_ORIGIN || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    if (!origin || frontendOrigins.length === 0 || frontendOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error("Not allowed by CORS"));
  }
};

const io = new Server(server, {
  cors: {
    origin: frontendOrigins.length > 0 ? frontendOrigins : true,
    methods: ["GET", "POST", "PATCH"]
  }
});

const store = new Store();
const sensorState = new Map();
let mapCentered = false;
let collectorHeartbeat = 0;
let collectorLabel = process.env.COLLECTOR_LABEL || "현장 수집기";
let lastCollectorStatus = "";

app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));

if (process.env.SERVE_STATIC !== "false") {
  app.use(express.static(path.join(__dirname, "..", "public")));
}

function getSensorStatus({ emg, finger }) {
  if (Number(emg) === 1) return "danger";
  if (Number(finger) === 0) return "warning";
  return "normal";
}

function getCollectorStatus() {
  const connected = Date.now() - collectorHeartbeat < 15000;

  return {
    connected,
    port: collectorLabel,
    message: connected ? `${collectorLabel} 연결됨` : "수집기 데이터 대기 중"
  };
}

function emitCollectorStatus(force = false) {
  const status = getCollectorStatus();
  const snapshot = JSON.stringify(status);

  if (!force && snapshot === lastCollectorStatus) return;

  lastCollectorStatus = snapshot;
  io.emit("serialStatus", status);
}

async function persistIncidentIfNeeded(sensor) {
  if (sensor.emg !== 1) return;

  const count = await store.getIncidentCount(sensor.id);
  const year = new Date().getFullYear();
  const incidentId = `SJ-${year}-${String(count + 1).padStart(3, "0")}`;

  await store.createIncident({
    incidentId,
    sensorId: sensor.id,
    type: "emergency",
    description: `${sensor.name} 비상 신호 감지`
  });
}

async function processSensorPayload(rawPayload = {}) {
  const id = Number(rawPayload.id);
  const lat = Number(rawPayload.lat) || 0;
  const lon = Number(rawPayload.lon) || 0;
  const bpm = Number(rawPayload.bpm) || 0;
  const emg = Number(rawPayload.emg) || 0;
  const finger = Number(rawPayload.finger) || 0;
  const battery =
    rawPayload.battery === undefined || rawPayload.battery === null
      ? null
      : Number(rawPayload.battery);

  if (!Number.isInteger(id) || id < 1 || id > 1000) {
    throw new Error("Invalid sensor id");
  }

  const now = Date.now();
  const existing = sensorState.get(id);
  const name = rawPayload.name || `센서${id}`;

  const nextSensor = {
    id,
    name,
    lat,
    lon,
    bpm,
    emg,
    finger,
    battery,
    lastUpdate: now,
    connected: true,
    status: getSensorStatus({ emg, finger }),
    _lastDbLog: existing?._lastDbLog || 0
  };

  sensorState.set(id, nextSensor);
  collectorHeartbeat = now;
  collectorLabel = rawPayload.collectorLabel || collectorLabel;

  await store.upsertDevice({
    id,
    name,
    lat,
    lon,
    battery
  });

  if (now - nextSensor._lastDbLog > 10000) {
    await store.insertSensorLog(nextSensor);
    nextSensor._lastDbLog = now;
  }

  await persistIncidentIfNeeded(nextSensor);

  if (!mapCentered && lat !== 0 && lon !== 0) {
    mapCentered = true;
    io.emit("autoCenter", { lat, lon });
  }

  if (!existing) {
    io.emit("deviceRegistered", { id, name });
  }

  io.emit("sensorUpdate", {
    id: nextSensor.id,
    name: nextSensor.name,
    lat: nextSensor.lat,
    lon: nextSensor.lon,
    bpm: nextSensor.bpm,
    emg: nextSensor.emg,
    finger: nextSensor.finger,
    battery: nextSensor.battery,
    lastUpdate: nextSensor.lastUpdate,
    connected: nextSensor.connected,
    status: nextSensor.status
  });

  emitCollectorStatus();
  return nextSensor;
}

function getPublicSensors() {
  return Array.from(sensorState.values()).map((sensor) => ({
    id: sensor.id,
    name: sensor.name,
    lat: sensor.lat,
    lon: sensor.lon,
    bpm: sensor.bpm,
    emg: sensor.emg,
    finger: sensor.finger,
    battery: sensor.battery,
    lastUpdate: sensor.lastUpdate,
    connected: sensor.connected,
    status: sensor.status
  }));
}

app.get("/api/health", async (req, res) => {
  res.json({
    ok: true,
    collector: getCollectorStatus(),
    sensors: sensorState.size,
    dbMode: store.mode
  });
});

app.get("/api/sensors", async (req, res) => {
  res.json(getPublicSensors());
});

app.get("/api/devices", async (req, res, next) => {
  try {
    res.json(await store.getDevices());
  } catch (error) {
    next(error);
  }
});

app.get("/api/incidents", async (req, res, next) => {
  try {
    res.json(await store.getIncidents(50));
  } catch (error) {
    next(error);
  }
});

app.patch("/api/incidents/:id", async (req, res, next) => {
  try {
    const { status } = req.body;
    await store.updateIncidentStatus(req.params.id, status || "resolved");
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

app.get("/api/stats", async (req, res) => {
  const list = getPublicSensors();

  res.json({
    total: list.length,
    danger: list.filter((item) => item.status === "danger").length,
    warning: list.filter((item) => item.status === "warning").length,
    normal: list.filter((item) => item.status === "normal").length
  });
});

app.get("/api/collector/status", async (req, res) => {
  res.json(getCollectorStatus());
});

app.post("/api/ingest", async (req, res, next) => {
  try {
    const ingestToken = process.env.INGEST_TOKEN;
    const authHeader = req.headers.authorization || "";

    if (ingestToken && authHeader !== `Bearer ${ingestToken}`) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const payloads = Array.isArray(req.body) ? req.body : [req.body];
    const processed = [];

    for (const payload of payloads) {
      processed.push(await processSensorPayload(payload));
    }

    res.json({ ok: true, count: processed.length });
  } catch (error) {
    next(error);
  }
});

app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ error: error.message || "Internal server error" });
});

io.on("connection", (socket) => {
  socket.emit("initialState", getPublicSensors());
  socket.emit("serialStatus", getCollectorStatus());
});

setInterval(() => {
  const now = Date.now();
  let changed = false;

  sensorState.forEach((sensor) => {
    if (now - sensor.lastUpdate > 10000 && sensor.connected) {
      sensor.connected = false;
      sensor.status = "offline";
      changed = true;
      io.emit("sensorUpdate", {
        id: sensor.id,
        name: sensor.name,
        lat: sensor.lat,
        lon: sensor.lon,
        bpm: sensor.bpm,
        emg: sensor.emg,
        finger: sensor.finger,
        battery: sensor.battery,
        lastUpdate: sensor.lastUpdate,
        connected: false,
        status: "offline"
      });
    }
  });

  if (changed) {
    emitCollectorStatus(true);
  } else {
    emitCollectorStatus();
  }
}, 5000);

async function start() {
  await store.init();

  const port = Number(process.env.PORT) || 3000;
  server.listen(port, "0.0.0.0", () => {
    console.log("");
    console.log("Marine Guard Cloud Backend");
    console.log(`- Port: ${port}`);
    console.log(`- Database: ${store.mode}`);
    console.log(
      `- Frontend Origin: ${frontendOrigins.length > 0 ? frontendOrigins.join(", ") : "all"}`
    );
    console.log("");
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = { app, server, start };
