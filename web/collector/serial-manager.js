const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");
const EventEmitter = require("events");

class SerialManager extends EventEmitter {
  constructor(onData) {
    super();
    this.port = null;
    this.parser = null;
    this.portName = null;
    this.onData = onData;
    this.connected = false;
    this.connecting = false;
    this.watchTimer = null;
    this.lastPortList = "";
  }

  async start() {
    await this.findAndConnect();

    this.watchTimer = setInterval(async () => {
      try {
        const ports = await SerialPort.list();
        const signature = ports.map((port) => port.path).sort().join(",");

        if (signature !== this.lastPortList) {
          this.lastPortList = signature;

          if (!this.connected && !this.connecting) {
            await this.findAndConnect();
          }
        }

        if (!this.connected && !this.connecting && ports.length > 0) {
          await this.findAndConnect();
        }
      } catch (error) {
        // Ignore polling errors.
      }
    }, 2000);
  }

  stop() {
    if (this.watchTimer) clearInterval(this.watchTimer);
    this.cleanup();
  }

  cleanup() {
    this.connected = false;

    if (this.parser) {
      this.parser.removeAllListeners();
      this.parser = null;
    }

    if (this.port) {
      this.port.removeAllListeners();

      try {
        if (this.port.isOpen) this.port.close();
      } catch (error) {
        // Ignore close errors.
      }

      this.port = null;
    }
  }

  async findAndConnect() {
    if (this.connecting) return;
    this.connecting = true;

    try {
      const ports = await SerialPort.list();
      this.lastPortList = ports.map((port) => port.path).sort().join(",");

      let target =
        ports.find(
          (port) =>
            (port.manufacturer && port.manufacturer.includes("CH340")) ||
            (port.pnpId && port.pnpId.includes("VID_1A86"))
        ) ||
        ports.find(
          (port) =>
            (port.manufacturer &&
              (port.manufacturer.includes("Silicon") || port.manufacturer.includes("FTDI"))) ||
            (port.pnpId &&
              (port.pnpId.includes("VID_10C4") || port.pnpId.includes("VID_0403")))
        ) ||
        ports[0];

      if (!target) {
        this.connecting = false;
        this.emit("statusChange", {
          connected: false,
          port: null,
          message: "사용 가능한 COM 포트가 없습니다."
        });
        return;
      }

      this.cleanup();
      this.portName = target.path;
      this.port = new SerialPort({
        path: this.portName,
        baudRate: 115200,
        autoOpen: false
      });

      this.parser = this.port.pipe(new ReadlineParser({ delimiter: "\n" }));

      this.port.open((error) => {
        this.connecting = false;

        if (error) {
          this.emit("statusChange", {
            connected: false,
            port: this.portName,
            message: `포트 연결 실패: ${error.message}`
          });
          return;
        }

        this.connected = true;
        this.emit("statusChange", {
          connected: true,
          port: this.portName,
          message: `${this.portName} 연결됨`
        });
      });

      this.parser.on("data", (line) => {
        const parsed = this.parseData(line.trim());
        if (parsed && this.onData) {
          this.onData(parsed);
        }
      });

      this.port.on("close", () => {
        this.cleanup();
        this.emit("statusChange", {
          connected: false,
          port: this.portName,
          message: "시리얼 연결이 종료되었습니다."
        });
      });

      this.port.on("error", () => {
        this.cleanup();
      });
    } catch (error) {
      this.connecting = false;
      this.emit("statusChange", {
        connected: false,
        port: null,
        message: error.message
      });
    }
  }

  parseData(line) {
    try {
      if (!line) return null;

      if (line.startsWith("{")) {
        const parsed = JSON.parse(line);
        const id = Number(parsed.id);
        if (!Number.isInteger(id) || id < 1 || id > 1000) return null;

        return {
          id,
          name: parsed.name ? String(parsed.name) : undefined,
          lat: Number(parsed.lat) || 0,
          lon: Number(parsed.lon) || 0,
          emg: Number(parsed.emg) || 0,
          finger: Number(parsed.finger) || 0,
          bpm: Number(parsed.bpm) || 0,
          battery:
            parsed.battery === undefined || parsed.battery === null
              ? undefined
              : Number(parsed.battery) || 0
        };
      }

      if (!line.includes("$M")) return null;

      const parts = line.split(",");
      if (parts.length < 6) return null;

      const id = Number(parts[0]);
      if (!Number.isInteger(id) || id < 1 || id > 1000) return null;

      const latPart = parts[1];
      if (!latPart.startsWith("$M")) return null;

      return {
        id,
        name: parts[7] ? String(parts[7]).trim() : undefined,
        lat: Number(latPart.slice(2)) || 0,
        lon: Number(parts[2]) || 0,
        emg: Number(parts[3]) || 0,
        finger: Number(parts[4]) || 0,
        bpm: Number(parts[5]) || 0,
        battery:
          parts[6] === undefined || parts[6] === ""
            ? undefined
            : Number(parts[6]) || 0
      };
    } catch (error) {
      return null;
    }
  }
}

module.exports = SerialManager;
