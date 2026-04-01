package com.marineguard.station;

public class ReceiverLocation {
    private final double latitude;
    private final double longitude;
    private final String source;
    private final long receivedAt;

    public ReceiverLocation(double latitude, double longitude, String source, long receivedAt) {
        this.latitude = latitude;
        this.longitude = longitude;
        this.source = source == null ? "" : source;
        this.receivedAt = receivedAt;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public String getSource() {
        return source;
    }

    public long getReceivedAt() {
        return receivedAt;
    }
}
