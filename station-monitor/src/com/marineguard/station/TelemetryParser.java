package com.marineguard.station;

public final class TelemetryParser {
    public static final class ParsedLine {
        private final DeviceTelemetry telemetry;
        private final ReceiverLocation receiverLocation;

        private ParsedLine(DeviceTelemetry telemetry, ReceiverLocation receiverLocation) {
            this.telemetry = telemetry;
            this.receiverLocation = receiverLocation;
        }

        public static ParsedLine forTelemetry(DeviceTelemetry telemetry) {
            return new ParsedLine(telemetry, null);
        }

        public static ParsedLine forReceiverLocation(ReceiverLocation receiverLocation) {
            return new ParsedLine(null, receiverLocation);
        }

        public DeviceTelemetry getTelemetry() {
            return telemetry;
        }

        public ReceiverLocation getReceiverLocation() {
            return receiverLocation;
        }
    }

    private TelemetryParser() {
    }

    public static ParsedLine parseLine(String line) {
        if (line == null) {
            return null;
        }

        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            return null;
        }

        ParsedLine receiverLocation = parseReceiverLocation(trimmed);
        if (receiverLocation != null) {
            return receiverLocation;
        }

        String[] parts = trimmed.split(",");
        if (parts.length < 6) {
            return null;
        }

        try {
            int deviceId = Integer.parseInt(parts[0].trim());
            String latToken = parts[1].trim();
            if (latToken.startsWith("$M")) {
                latToken = latToken.substring(2);
            }

            double latitude = Double.parseDouble(latToken);
            double longitude = Double.parseDouble(parts[2].trim());
            int emergency = Integer.parseInt(parts[3].trim());
            int finger = Integer.parseInt(parts[4].trim());
            int bpm = Integer.parseInt(parts[5].trim());
            int battery = parts.length >= 7 ? Integer.parseInt(parts[6].trim()) : -1;
            String guestName = "";
            int ppgValue = -1;

            if (parts.length >= 8) {
                String extra = parts[7].trim();
                if (isInteger(extra) && parts.length == 8) {
                    ppgValue = Integer.parseInt(extra);
                } else {
                    guestName = extra;
                }
            }

            if (parts.length >= 9) {
                String maybePpg = parts[8].trim();
                if (isInteger(maybePpg)) {
                    ppgValue = Integer.parseInt(maybePpg);
                }
            }

            return ParsedLine.forTelemetry(new DeviceTelemetry(
                deviceId,
                latitude,
                longitude,
                emergency,
                finger,
                bpm,
                battery,
                guestName,
                ppgValue,
                System.currentTimeMillis()
            ));
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static ParsedLine parseReceiverLocation(String line) {
        String[] parts = line.split(",");
        if (parts.length < 3) {
            return null;
        }

        String header = parts[0].trim().toUpperCase();
        if (!("RX".equals(header) || "RECEIVER".equals(header) || "BASE".equals(header) || "R".equals(header))) {
            return null;
        }

        try {
            String latToken = parts[1].trim();
            if (latToken.startsWith("$M") || latToken.startsWith("$R")) {
                latToken = latToken.substring(2);
            }
            double latitude = Double.parseDouble(latToken);
            double longitude = Double.parseDouble(parts[2].trim());
            String source = parts.length >= 4 ? parts[3].trim() : header;
            return ParsedLine.forReceiverLocation(
                new ReceiverLocation(latitude, longitude, source, System.currentTimeMillis())
            );
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private static boolean isInteger(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        int start = value.charAt(0) == '-' ? 1 : 0;
        if (start == value.length()) {
            return false;
        }
        for (int i = start; i < value.length(); i++) {
            if (!Character.isDigit(value.charAt(i))) {
                return false;
            }
        }
        return true;
    }
}
