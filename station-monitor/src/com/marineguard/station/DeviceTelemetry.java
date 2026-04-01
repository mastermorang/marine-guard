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
    private final int ppgValue;
    private final boolean rawPpgPresent;
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
            int ppgValue,
            boolean rawPpgPresent,
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
        this.ppgValue = ppgValue;
        this.rawPpgPresent = rawPpgPresent;
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

    public int getPpgValue() {
        return ppgValue;
    }

    public boolean hasRawPpg() {
        return rawPpgPresent;
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
        if (bpm > 120 || (bpm > 0 && bpm < 40)) {
            return "warning";
        }
        return "active";
    }
}
