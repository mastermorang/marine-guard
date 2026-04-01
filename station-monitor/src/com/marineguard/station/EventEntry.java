package com.marineguard.station;

import java.text.SimpleDateFormat;
import java.util.Date;

public class EventEntry {
    public enum Level {
        INFO,
        WARNING,
        EMERGENCY
    }

    private static final SimpleDateFormat FORMAT = new SimpleDateFormat("HH:mm:ss");
    private static final SimpleDateFormat CSV_FORMAT = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss");

    private final long timestamp;
    private final Level level;
    private final String message;
    private final String deviceName;
    private final String status;
    private final String relativeLocation;
    private final String distanceMeters;
    private final String coordinates;
    private final String rssiDbm;
    private final String snrDb;
    private final String prrPercent;

    public EventEntry(long timestamp, Level level, String message) {
        this(timestamp, level, message, "SYSTEM", message, "", "", "", "", "", "");
    }

    public EventEntry(
            long timestamp,
            Level level,
            String message,
            String deviceName,
            String status,
            String relativeLocation,
            String distanceMeters,
            String coordinates,
            String rssiDbm,
            String snrDb,
            String prrPercent
    ) {
        this.timestamp = timestamp;
        this.level = level;
        this.message = message;
        this.deviceName = sanitize(deviceName);
        this.status = sanitize(status);
        this.relativeLocation = sanitize(relativeLocation);
        this.distanceMeters = sanitize(distanceMeters);
        this.coordinates = sanitize(coordinates);
        this.rssiDbm = sanitize(rssiDbm);
        this.snrDb = sanitize(snrDb);
        this.prrPercent = sanitize(prrPercent);
    }

    public long getTimestamp() {
        return timestamp;
    }

    public Level getLevel() {
        return level;
    }

    public String getMessage() {
        return message;
    }

    public String formatLine() {
        return "[" + FORMAT.format(new Date(timestamp)) + "] " + message;
    }

    public String formatCsvTimestamp() {
        return CSV_FORMAT.format(new Date(timestamp));
    }

    public String formatCsvRow() {
        return quote(formatCsvTimestamp()) + ","
                + quote(deviceName) + ","
                + quote(status) + ","
                + quote(relativeLocation) + ","
                + quote(distanceMeters) + ","
                + quote(coordinates) + ","
                + quote(rssiDbm) + ","
                + quote(snrDb) + ","
                + quote(prrPercent);
    }

    private static String sanitize(String value) {
        return value == null ? "" : value;
    }

    private static String quote(String value) {
        return "\"" + sanitize(value).replace("\"", "\"\"") + "\"";
    }
}
