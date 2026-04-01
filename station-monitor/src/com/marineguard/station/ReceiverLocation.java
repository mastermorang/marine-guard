package com.marineguard.station;

public class ReceiverLocation {
    private static final double EARTH_RADIUS_METERS = 6371000.0d;

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

    public static double calculateDistance(double lat1, double lon1, double lat2, double lon2) {
        double latDistance = Math.toRadians(lat2 - lat1);
        double lonDistance = Math.toRadians(lon2 - lon1);
        double a = Math.sin(latDistance / 2.0d) * Math.sin(latDistance / 2.0d)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(lonDistance / 2.0d) * Math.sin(lonDistance / 2.0d);
        double c = 2.0d * Math.atan2(Math.sqrt(a), Math.sqrt(1.0d - a));
        return EARTH_RADIUS_METERS * c;
    }

    public static double[] calculateOffsetMeters(double refLat, double refLon, double lat, double lon) {
        double northMeters = signedNorthDistance(refLat, lat, refLon);
        double eastMeters = signedEastDistance(refLon, lon, refLat);
        return new double[]{eastMeters, northMeters};
    }

    public static boolean hasGpsFix(double latitude, double longitude) {
        return Math.abs(latitude) > 0.000001d || Math.abs(longitude) > 0.000001d;
    }

    private static double signedNorthDistance(double refLat, double lat, double lon) {
        double distance = calculateDistance(refLat, lon, lat, lon);
        return lat >= refLat ? distance : -distance;
    }

    private static double signedEastDistance(double refLon, double lon, double lat) {
        double distance = calculateDistance(lat, refLon, lat, lon);
        return lon >= refLon ? distance : -distance;
    }
}
