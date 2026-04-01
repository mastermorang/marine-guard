package com.marineguard.station;

public class PpgSample {
    private final long timestamp;
    private final int bpm;
    private final int ppgValue;
    private final boolean rawPpgPresent;

    public PpgSample(long timestamp, int bpm, int ppgValue, boolean rawPpgPresent) {
        this.timestamp = timestamp;
        this.bpm = bpm;
        this.ppgValue = ppgValue;
        this.rawPpgPresent = rawPpgPresent;
    }

    public long getTimestamp() {
        return timestamp;
    }

    public int getBpm() {
        return bpm;
    }

    public int getPpgValue() {
        return ppgValue;
    }

    public boolean hasRawPpg() {
        return rawPpgPresent;
    }
}
