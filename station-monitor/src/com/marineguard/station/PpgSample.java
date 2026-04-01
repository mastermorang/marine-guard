package com.marineguard.station;

public class PpgSample {
    private final long timestamp;
    private final int bpm;
    private final int ppgValue;

    public PpgSample(long timestamp, int bpm, int ppgValue) {
        this.timestamp = timestamp;
        this.bpm = bpm;
        this.ppgValue = ppgValue;
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
}
