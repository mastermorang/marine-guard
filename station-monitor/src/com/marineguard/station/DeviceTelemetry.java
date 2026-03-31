package com.marineguard.station;

public class DeviceTelemetry {
    private final int deviceId;
    private final double latitude;
    private final double longitude;
    private final int emergency;
    private final int finger;
    private final int bpm;
    private final int battery;
    private final String guestName;
    private final long receivedAt;

    public DeviceTelemetry(
            int deviceId,
            double latitude,
            double longitude,
            int emergency,
            int finger,
            int bpm,
            int battery,
            String guestName,
            long receivedAt
    ) {
        this.deviceId = deviceId;
        this.latitude = latitude;
        this.longitude = longitude;
        this.emergency = emergency;
        this.finger = finger;
        this.bpm = bpm;
        this.battery = battery;
        this.guestName = guestName == null ? "" : guestName;
        this.receivedAt = receivedAt;
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

    public int getEmergency() {
        return emergency;
    }

    public int getFinger() {
        return finger;
    }

    public int getBpm() {
        return bpm;
    }

    public int getBattery() {
        return battery;
    }

    public String getGuestName() {
        return guestName;
    }

    public long getReceivedAt() {
        return receivedAt;
    }

    public boolean isStale(long now) {
        return now - receivedAt > 15000L;
    }

    public String getStatusText(long now) {
        if (isStale(now)) {
            return "offline";
        }
        if (emergency > 0) {
            return "emergency";
        }
        if (finger == 0) {
            return "no-contact";
        }
        return "active";
    }
}
