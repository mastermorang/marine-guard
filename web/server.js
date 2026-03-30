const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const SerialManager = require('./serial');
const Database = require('better-sqlite3');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ─── Static files ───
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ─── Database ───
const db = new Database(path.join(__dirname, 'marineguard.db'));
db.pragma('journal_mode = WAL');

db.exec(`
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
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS devices (
    id INTEGER PRIMARY KEY,
    name TEXT,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_seen DATETIME,
    last_lat REAL,
    last_lon REAL
  );
`);

// ─── Sensor state ───
const sensorState = {};
let mapCentered = false;

function updateSensor(data) {
  const { id, lat, lon, bpm, emg, finger } = data;
  const now = Date.now();
  const isNewDevice = !sensorState[id];
  
  sensorState[id] = {
    id,
    lat,
    lon,
    bpm,
    emg,
    finger,
    lastUpdate: now,
    status: emg === 1 ? 'danger' : (finger === 0 ? 'warning' : 'normal'),
    connected: true
  };

  // ─── Auto-register new device ───
  if (isNewDevice) {
    console.log(`🆕 새 디바이스 자동 등록: 센서${id}`);
    try {
      db.prepare(
        `INSERT OR REPLACE INTO devices (id, name, last_seen, last_lat, last_lon)
         VALUES (?, ?, CURRENT_TIMESTAMP, ?, ?)`
      ).run(id, `센서${id}`, lat, lon);
    } catch (e) { /* ignore */ }
    io.emit('deviceRegistered', { id, name: `센서${id}` });
  } else {
    // Update last seen
    try {
      db.prepare('UPDATE devices SET last_seen = CURRENT_TIMESTAMP, last_lat = ?, last_lon = ? WHERE id = ?')
        .run(lat, lon, id);
    } catch (e) { /* ignore */ }
  }

  // ─── Auto-center map on first GPS data ───
  if (!mapCentered && lat !== 0 && lon !== 0) {
    mapCentered = true;
    console.log(`🗺️ 기준 좌표 자동 설정: ${lat.toFixed(6)}, ${lon.toFixed(6)}`);
    io.emit('autoCenter', { lat, lon });
  }

  // Log to DB periodically (every 10 seconds per sensor)
  const lastLog = sensorState[id]._lastDbLog || 0;
  if (now - lastLog > 10000) {
    try {
      db.prepare(
        'INSERT INTO sensor_logs (sensor_id, lat, lon, bpm, emg, finger) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(id, lat, lon, bpm, emg, finger);
      sensorState[id]._lastDbLog = now;
    } catch (e) { /* ignore */ }
  }

  // Auto-create incident for emergency
  if (emg === 1) {
    const year = new Date().getFullYear();
    const count = db.prepare('SELECT COUNT(*) as cnt FROM incidents WHERE sensor_id = ?').get(id);
    const num = (count?.cnt || 0) + 1;
    const incId = `SJ-${year}-${String(num).padStart(3, '0')}`;
    try {
      db.prepare(
        `INSERT OR IGNORE INTO incidents (incident_id, sensor_id, type, description, status)
         VALUES (?, ?, 'emergency', ?, 'active')`
      ).run(incId, id, `센서${id} 비상 신호 감지`);
    } catch (e) { /* ignore */ }
  }

  // Broadcast to all clients
  io.emit('sensorUpdate', sensorState[id]);
}

// ─── Check for disconnected sensors ───
setInterval(() => {
  const now = Date.now();
  for (const id in sensorState) {
    if (now - sensorState[id].lastUpdate > 10000) {
      sensorState[id].connected = false;
      sensorState[id].status = 'offline';
      io.emit('sensorUpdate', sensorState[id]);
    }
  }
}, 5000);

// ─── Serial communication ───
const serial = new SerialManager((data) => {
  updateSensor(data);
});

// ─── REST API ───
app.get('/api/sensors', (req, res) => {
  res.json(Object.values(sensorState));
});

app.get('/api/devices', (req, res) => {
  const rows = db.prepare('SELECT * FROM devices ORDER BY id').all();
  res.json(rows);
});

app.get('/api/incidents', (req, res) => {
  const rows = db.prepare('SELECT * FROM incidents ORDER BY created_at DESC LIMIT 50').all();
  res.json(rows);
});

app.patch('/api/incidents/:id', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE incidents SET status = ?, resolved_at = CURRENT_TIMESTAMP WHERE incident_id = ?')
    .run(status, req.params.id);
  res.json({ ok: true });
});

app.get('/api/stats', (req, res) => {
  const total = Object.keys(sensorState).length;
  const danger = Object.values(sensorState).filter(s => s.status === 'danger').length;
  const warning = Object.values(sensorState).filter(s => s.status === 'warning').length;
  const normal = Object.values(sensorState).filter(s => s.status === 'normal').length;
  res.json({ total, danger, warning, normal });
});

app.get('/api/serial/status', (req, res) => {
  res.json({ connected: serial.isConnected(), port: serial.getPort() });
});

// ─── WebSocket ───
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  // Send current state to new client
  socket.emit('initialState', Object.values(sensorState));
  socket.emit('serialStatus', { connected: serial.isConnected(), port: serial.getPort() });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Forward serial status changes
serial.on('statusChange', (status) => {
  io.emit('serialStatus', status);
});

// ─── Start server ───
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  const os = require('os');
  const nets = os.networkInterfaces();
  let localIP = 'localhost';
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Marine Guard Monitoring Platform       ║');
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║   Local:   http://localhost:${PORT}         ║`);
  console.log(`║   Network: http://${localIP}:${PORT}    ║`);
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  serial.start();
});
