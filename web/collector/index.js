const os = require("os");
const SerialManager = require("./serial-manager");

const backendUrl = (process.env.BACKEND_URL || "http://localhost:3000").replace(/\/$/, "");
const ingestToken = process.env.INGEST_TOKEN || "";
const collectorLabel = process.env.COLLECTOR_LABEL || `${os.hostname()} collector`;

async function postTelemetry(payload) {
  const response = await fetch(`${backendUrl}/api/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ingestToken ? { Authorization: `Bearer ${ingestToken}` } : {})
    },
    body: JSON.stringify({
      ...payload,
      collectorLabel
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Ingest failed: ${response.status} ${body}`);
  }
}

const queue = [];
let flushing = false;

async function flushQueue() {
  if (flushing || queue.length === 0) return;
  flushing = true;

  while (queue.length > 0) {
    const next = queue[0];

    try {
      await postTelemetry(next);
      queue.shift();
    } catch (error) {
      console.error(error.message);
      break;
    }
  }

  flushing = false;
}

function enqueue(payload) {
  queue.push(payload);
  flushQueue();
}

const serial = new SerialManager((payload) => {
  console.log(
    `sensor=${payload.id} lat=${payload.lat.toFixed(6)} lon=${payload.lon.toFixed(6)} bpm=${payload.bpm} emg=${payload.emg} finger=${payload.finger}`
  );
  enqueue(payload);
});

serial.on("statusChange", (status) => {
  console.log(`[collector] ${status.message}`);
});

serial.start().catch((error) => {
  console.error(error);
  process.exit(1);
});

setInterval(() => {
  flushQueue();
}, 3000);
