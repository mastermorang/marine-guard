package com.marineguard.station;

public class DeviceTrackPoint {
    private final int deviceId;
    private final double latitude;
    private final double longitude;
    private final long timestamp;

    public DeviceTrackPoint(int deviceId, double latitude, double longitude, long timestamp) {
        this.deviceId = deviceId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.timestamp = timestamp;
    }

    public int getDeviceId() {
        return deviceId;
    }

    public double getLatitude() {
        return latitude;
    }

    public double getLongitude() {
        return longitude;
    }

    public long getTimestamp() {
        return timestamp;
    }
}
