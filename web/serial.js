const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');
const EventEmitter = require('events');

class SerialManager extends EventEmitter {
  constructor(onData) {
    super();
    this.port = null;
    this.parser = null;
    this.onData = onData;
    this.portName = null;
    this._connected = false;
    this._reconnectTimer = null;
    this._watchTimer = null;
    this._baudScanTimer = null;
    this._lastPortList = '';
    this._connecting = false;
    this._hasValidData = false;
    this._baudRates = [115200, 9600, 38400, 57600];
    this._baudIndex = 0;
  }

  async start() {
    console.log('🔍 시리얼 포트 감시 시작...');
    await this.findAndConnect();

    // ─── USB Hotplug Detection ───
    this._watchTimer = setInterval(async () => {
      try {
        const ports = await SerialPort.list();
        const portListStr = ports.map(p => p.path).sort().join(',');

        if (portListStr !== this._lastPortList) {
          const prevList = this._lastPortList;
          this._lastPortList = portListStr;

          if (!this._connected && !this._connecting) {
            const newPorts = portListStr.split(',').filter(p => p && !prevList.includes(p));
            if (newPorts.length > 0) {
              console.log(`🔌 새 장치 감지: ${newPorts.join(', ')}`);
              this._baudIndex = 0; // Reset baud scan on new plug
              await this.findAndConnect();
            }
          } else if (this._connected) {
            if (!portListStr.includes(this.portName)) {
              console.log(`⚠ 수신기 분리 감지: ${this.portName}`);
              this._cleanup();
              this.emit('statusChange', {
                connected: false,
                port: this.portName,
                message: '수신기가 분리되었습니다. 다시 연결해주세요.'
              });
            }
          }
        }

        if (!this._connected && !this._connecting) {
          const hasPorts = ports.length > 0;
          if (hasPorts) {
            await this.findAndConnect();
          }
        }
      } catch (e) { /* ignore polling errors */ }
    }, 2000);
  }

  _cleanup() {
    this._connected = false;
    this._hasValidData = false;
    if (this._baudScanTimer) { clearTimeout(this._baudScanTimer); this._baudScanTimer = null; }
    if (this.parser) {
      this.parser.removeAllListeners();
      this.parser = null;
    }
    if (this.port) {
      this.port.removeAllListeners();
      try {
        if (this.port.isOpen) this.port.close();
      } catch (e) { /* ignore */ }
      this.port = null;
    }
  }

  async findAndConnect() {
    if (this._connecting) return;
    this._connecting = true;

    try {
      const ports = await SerialPort.list();
      this._lastPortList = ports.map(p => p.path).sort().join(',');

      // Priority: CH340 > FTDI/CP210x > others
      let target = ports.find(p => (p.manufacturer && p.manufacturer.includes('CH340')) || (p.pnpId && p.pnpId.includes('VID_1A86')));
      if (!target) target = ports.find(p => (p.manufacturer && (p.manufacturer.includes('Silicon') || p.manufacturer.includes('FTDI'))) || (p.pnpId && (p.pnpId.includes('VID_10C4') || p.pnpId.includes('VID_0403'))));
      if (!target && ports.length > 0) target = ports[0];

      if (!target) {
        console.log('⚠ COM 포트를 찾을 수 없습니다. 송수신기를 연결해주세요.');
        this._connected = false;
        this.emit('statusChange', { connected: false, port: null, message: '송수신기를 USB에 연결해주세요' });
        this._connecting = false;
        return;
      }

      this._cleanup();
      this.portName = target.path;
      // PCB/Java Code dictates 115200 bps
      const currentBaud = 115200;
      console.log(`🔌 ${this.portName} 고정 속도 연결 시도... (${currentBaud}bps)`);

      this.port = new SerialPort({ path: this.portName, baudRate: currentBaud, autoOpen: false });
      this.parser = this.port.pipe(new ReadlineParser({ delimiter: '\n' }));

      this.port.open((err) => {
        this._connecting = false;
        if (err) {
          console.log('❌ 포트 열기 실패:', err.message);
          this._connected = false;
          this.emit('statusChange', { connected: false, port: this.portName, message: `열기 실패: ${err.message}` });
          return;
        }

        // Just let it open naturally without forcing DTR/RTS toggles that crash ESP32s
        console.log(`✅ ${this.portName} 연결됨 (${currentBaud}bps 고정)`);
        this._connected = true;
        this.emit('statusChange', { connected: true, port: this.portName, message: `${this.portName} 연결됨 (${currentBaud}bps)` });
      });

      this.port.on('data', (buf) => {
        if (!this._hasValidData) console.log(`🔧 [RAW] hex=${buf.toString('hex').substring(0,60)} ascii=${buf.toString('ascii').replace(/[\x00-\x1f]/g, '.')}`);
      });

      this.parser.on('data', (line) => {
        this._hasValidData = true; 
        this.parseData(line.trim());
      });

      this.port.on('close', () => {
        this._connected = false;
        this._cleanup();
        this.emit('statusChange', { connected: false, port: this.portName, message: '연결 끊김. 재연결 대기...' });
      });

      this.port.on('error', (err) => {
        this._connected = false;
        this._cleanup();
      });

    } catch (e) {
      this._connecting = false;
    }
  }



  /**
   * Parse the $M protocol data
   * Format detected: 1,$M0.000000,0.000000,0,0,045,0.
   * Split by comma:
   * [0]: id
   * [1]: $M + lat -> $M0.000000
   * [2]: lon -> 0.000000
   * [3]: emg -> 0
   * [4]: finger -> 0
   * [5]: bpm -> 045
   */
  parseData(line) {
    try {
      if (!line || !line.includes('$M')) return;

      const parts = line.split(',');
      if (parts.length < 6) return;

      const id = parseInt(parts[0], 10);
      if (isNaN(id) || id < 1 || id > 10) return;

      const latPart = parts[1];
      if (!latPart.startsWith('$M')) return;
      
      const lat = parseFloat(latPart.substring(2));
      const lon = parseFloat(parts[2]);
      const emg = parseInt(parts[3], 10);
      const finger = parseInt(parts[4], 10);
      const bpm = parseInt(parts[5], 10);

      const sensorData = { id, lat, lon, bpm, emg, finger };
      console.log(`📡 센서${id}: ${lat.toFixed(6)}, ${lon.toFixed(6)}, bpm=${bpm}, emg=${emg}, finger=${finger}`);

      if (this.onData) this.onData(sensorData);
    } catch (e) {
      // Silently ignore malformed data
    }
  }

  isConnected() { return this._connected; }
  getPort() { return this.portName; }

  destroy() {
    if (this._watchTimer) clearInterval(this._watchTimer);
    if (this._reconnectTimer) clearInterval(this._reconnectTimer);
    this._cleanup();
  }
}

module.exports = SerialManager;
