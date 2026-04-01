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
            ParsedTelemetryFields fields = extractTelemetryFields(parts);
            if (fields == null) {
                return null;
            }

            double latitude = fields.latitude;
            double longitude = fields.longitude;
            int emergency = fields.emergency;
            int finger = fields.finger;
            int bpm = fields.bpm;
            String guestName = "";
            int battery = -1;
            int ppgValue = -1;
            boolean rawPpgPresent = false;
            int rssiDbm = DeviceTelemetry.UNKNOWN_RSSI;
            double snrDb = Double.NaN;
            long sequence = DeviceTelemetry.UNKNOWN_SEQUENCE;
            int unlabeledNumericCount = 0;

            for (int i = fields.extraStartIndex; i < parts.length; i++) {
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
                    rawPpgPresent = true;
                    continue;
                }

                Integer labeledRssi = tryParseLabeledInt(token, "RSSI");
                if (labeledRssi != null) {
                    rssiDbm = labeledRssi;
                    continue;
                }

                Double labeledSnr = tryParseLabeledDouble(token, "SNR");
                if (labeledSnr != null) {
                    snrDb = labeledSnr;
                    continue;
                }

                Long labeledSeq = tryParseLabeledLong(token, "SEQ", "SEQUENCE");
                if (labeledSeq != null) {
                    sequence = labeledSeq;
                    continue;
                }

                if (!isInteger(token)) {
                    if (Double.isNaN(snrDb) && isLikelySnrValue(token)) {
                        snrDb = Double.parseDouble(token);
                        continue;
                    }
                    if (guestName.isEmpty()) {
                        guestName = token;
                    }
                    continue;
                }

                int numeric = Integer.parseInt(token);
                if (battery < 0 && isLikelyBatteryValue(numeric, unlabeledNumericCount)) {
                    battery = clampBattery(numeric);
                    unlabeledNumericCount++;
                } else if (rssiDbm == DeviceTelemetry.UNKNOWN_RSSI && isLikelyRssiValue(numeric)) {
                    rssiDbm = numeric;
                    unlabeledNumericCount++;
                } else if (sequence == DeviceTelemetry.UNKNOWN_SEQUENCE && isLikelySequenceValue(numeric, unlabeledNumericCount)) {
                    sequence = numeric;
                    unlabeledNumericCount++;
                } else if (ppgValue < 0 && isLikelyRawPpgValue(numeric)) {
                    ppgValue = numeric;
                    rawPpgPresent = true;
                    unlabeledNumericCount++;
                } else if (battery < 0 && numeric >= 0 && numeric <= 100) {
                    battery = clampBattery(numeric);
                    unlabeledNumericCount++;
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
                rawPpgPresent,
                rssiDbm,
                snrDb,
                sequence,
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

    private static Long tryParseLabeledLong(String token, String... labels) {
        String upper = token.toUpperCase();
        for (String label : labels) {
            if (upper.startsWith(label + "=") || upper.startsWith(label + ":")) {
                String value = token.substring(label.length() + 1).trim();
                if (isInteger(value)) {
                    return Long.parseLong(value);
                }
            }
        }
        return null;
    }

    private static Double tryParseLabeledDouble(String token, String... labels) {
        String upper = token.toUpperCase();
        for (String label : labels) {
            if (upper.startsWith(label + "=") || upper.startsWith(label + ":")) {
                String value = token.substring(label.length() + 1).trim();
                if (isDouble(value)) {
                    return Double.parseDouble(value);
                }
            }
        }
        return null;
    }

    private static boolean isDouble(String value) {
        if (value == null || value.isEmpty()) {
            return false;
        }
        try {
            Double.parseDouble(value);
            return true;
        } catch (NumberFormatException ex) {
            return false;
        }
    }

    private static int clampBattery(int value) {
        return Math.max(0, Math.min(100, value));
    }

    private static ParsedTelemetryFields extractTelemetryFields(String[] parts) {
        if (parts.length < 6) {
            return null;
        }
        int latIndex = 1;
        if ("$M".equalsIgnoreCase(parts[1].trim()) || "$R".equalsIgnoreCase(parts[1].trim())) {
            latIndex = 2;
        }
        int lonIndex = latIndex + 1;
        int emergencyIndex = latIndex + 2;
        int fingerIndex = latIndex + 3;
        int bpmIndex = latIndex + 4;
        if (bpmIndex >= parts.length) {
            return null;
        }

        String latToken = parts[latIndex].trim();
        if (latToken.startsWith("$M") || latToken.startsWith("$R")) {
            latToken = latToken.substring(2);
        }
        if (latToken.isEmpty()) {
            return null;
        }

        return new ParsedTelemetryFields(
                Double.parseDouble(latToken),
                Double.parseDouble(parts[lonIndex].trim()),
                Integer.parseInt(parts[emergencyIndex].trim()),
                Integer.parseInt(parts[fingerIndex].trim()),
                Integer.parseInt(parts[bpmIndex].trim()),
                bpmIndex + 1
        );
    }

    private static boolean isLikelyBatteryValue(int numeric, int unlabeledNumericCount) {
        return unlabeledNumericCount == 0 && numeric >= 0 && numeric <= 100;
    }

    private static boolean isLikelyRawPpgValue(int numeric) {
        return numeric > 100;
    }

    private static boolean isLikelyRssiValue(int numeric) {
        return numeric <= -20 && numeric >= -160;
    }

    private static boolean isLikelySnrValue(String token) {
        if (!isDouble(token)) {
            return false;
        }
        double value = Double.parseDouble(token);
        return value >= -30.0d && value <= 30.0d;
    }

    private static boolean isLikelySequenceValue(int numeric, int unlabeledNumericCount) {
        return unlabeledNumericCount > 0 && numeric >= 0;
    }

    private static final class ParsedTelemetryFields {
        private final double latitude;
        private final double longitude;
        private final int emergency;
        private final int finger;
        private final int bpm;
        private final int extraStartIndex;

        private ParsedTelemetryFields(double latitude, double longitude, int emergency, int finger, int bpm, int extraStartIndex) {
            this.latitude = latitude;
            this.longitude = longitude;
            this.emergency = emergency;
            this.finger = finger;
            this.bpm = bpm;
            this.extraStartIndex = extraStartIndex;
        }
    }
}
