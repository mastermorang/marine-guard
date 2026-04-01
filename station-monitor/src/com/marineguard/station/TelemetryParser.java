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
            String guestName = "";
            int battery = -1;
            int ppgValue = -1;

            for (int i = 6; i < parts.length; i++) {
                String token = parts[i].trim();
                if (token.isEmpty()) {
                    continue;
                }

                Integer labeledBattery = tryParseLabeledInt(token, "BAT", "BATTERY", "BATT");
                if (labeledBattery != null) {
                    battery = clampBattery(labeledBattery);
                    continue;
                }

                Integer labeledPpg = tryParseLabeledInt(token, "PPG");
                if (labeledPpg != null) {
                    ppgValue = labeledPpg;
                    continue;
                }

                if (!isInteger(token)) {
                    if (guestName.isEmpty()) {
                        guestName = token;
                    }
                    continue;
                }

                int numeric = Integer.parseInt(token);
                if (battery < 0 && numeric >= 0 && numeric <= 100) {
                    battery = numeric;
                } else if (ppgValue < 0) {
                    ppgValue = numeric;
                } else if (guestName.isEmpty()) {
                    guestName = token;
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

    private static Integer tryParseLabeledInt(String token, String... labels) {
        String upper = token.toUpperCase();
        for (String label : labels) {
            if (upper.startsWith(label + "=") || upper.startsWith(label + ":")) {
                String value = token.substring(label.length() + 1).trim().replace("%", "");
                if (isInteger(value)) {
                    return Integer.parseInt(value);
                }
            }
        }
        return null;
    }

    private static int clampBattery(int value) {
        return Math.max(0, Math.min(100, value));
    }
}
