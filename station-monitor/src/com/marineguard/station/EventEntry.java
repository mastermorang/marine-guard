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

    public EventEntry(long timestamp, Level level, String message) {
        this.timestamp = timestamp;
        this.level = level;
        this.message = message;
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
}
