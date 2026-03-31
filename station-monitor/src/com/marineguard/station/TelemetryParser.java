package com.marineguard.station;

public final class TelemetryParser {
    private TelemetryParser() {
    }

    public static DeviceTelemetry parseLine(String line) {
        if (line == null) {
            return null;
        }

        String trimmed = line.trim();
        if (trimmed.isEmpty()) {
            return null;
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
            String guestName = parts.length >= 8 ? parts[7].trim() : "";

            return new DeviceTelemetry(
                    deviceId,
                    latitude,
                    longitude,
                    emergency,
                    finger,
                    bpm,
                    battery,
                    guestName,
                    System.currentTimeMillis()
            );
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
