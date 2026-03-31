package com.marineguard.station;

import jssc.SerialPort;
import jssc.SerialPortEvent;
import jssc.SerialPortEventListener;
import jssc.SerialPortException;
import jssc.SerialPortList;

import javax.swing.SwingUtilities;

public class SerialReceiverService {
    public interface Listener {
        void onConnected(String portName);

        void onDisconnected(String reason);

        void onTelemetry(DeviceTelemetry telemetry, String rawLine);

        void onMessage(String message);
    }

    private final Listener listener;
    private SerialPort serialPort;
    private final StringBuilder buffer = new StringBuilder();

    public SerialReceiverService(Listener listener) {
        this.listener = listener;
    }

    public static String[] listPorts() {
        return SerialPortList.getPortNames();
    }

    public synchronized boolean isConnected() {
        return serialPort != null && serialPort.isOpened();
    }

    public synchronized String getConnectedPortName() {
        return serialPort == null ? "" : serialPort.getPortName();
    }

    public synchronized void connect(String portName, int baudRate) throws SerialPortException {
        disconnect("reconnect");
        SerialPort port = new SerialPort(portName);
        port.openPort();
        port.setParams(baudRate, 8, 1, 0);
        port.addEventListener(new LineListener());
        serialPort = port;
        emitConnected(portName);
    }

    public synchronized void disconnect(String reason) {
        if (serialPort == null) {
            return;
        }
        try {
            if (serialPort.isOpened()) {
                serialPort.removeEventListener();
                serialPort.closePort();
            }
        } catch (Exception ignored) {
        } finally {
            serialPort = null;
            buffer.setLength(0);
            emitDisconnected(reason);
        }
    }

    private void emitConnected(final String portName) {
        SwingUtilities.invokeLater(() -> listener.onConnected(portName));
    }

    private void emitDisconnected(final String reason) {
        SwingUtilities.invokeLater(() -> listener.onDisconnected(reason));
    }

    private void emitMessage(final String message) {
        SwingUtilities.invokeLater(() -> listener.onMessage(message));
    }

    private void emitTelemetry(final DeviceTelemetry telemetry, final String rawLine) {
        SwingUtilities.invokeLater(() -> listener.onTelemetry(telemetry, rawLine));
    }

    private final class LineListener implements SerialPortEventListener {
        @Override
        public void serialEvent(SerialPortEvent event) {
            if (!event.isRXCHAR()) {
                return;
            }

            try {
                String data;
                synchronized (SerialReceiverService.this) {
                    if (serialPort == null) {
                        return;
                    }
                    data = serialPort.readString(event.getEventValue());
                }
                if (data == null || data.isEmpty()) {
                    return;
                }
                appendData(data);
            } catch (Exception ex) {
                emitMessage("Serial read error: " + ex.getMessage());
                disconnect("serial read error");
            }
        }

        private void appendData(String data) {
            synchronized (buffer) {
                buffer.append(data);
                int newlineIndex;
                while ((newlineIndex = findLineBreak(buffer)) >= 0) {
                    String line = buffer.substring(0, newlineIndex).trim();
                    buffer.delete(0, newlineIndex + 1);
                    if (line.isEmpty()) {
                        continue;
                    }
                    DeviceTelemetry telemetry = TelemetryParser.parseLine(line);
                    if (telemetry != null) {
                        emitTelemetry(telemetry, line);
                    } else {
                        emitMessage("Ignored line: " + line);
                    }
                }
            }
        }

        private int findLineBreak(StringBuilder text) {
            for (int i = 0; i < text.length(); i++) {
                char current = text.charAt(i);
                if (current == '\n') {
                    return i;
                }
            }
            return -1;
        }
    }
}
