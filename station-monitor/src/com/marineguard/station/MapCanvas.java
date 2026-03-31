package com.marineguard.station;

import javax.swing.JPanel;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.util.Collection;

public class MapCanvas extends JPanel {
    private double refLat;
    private double refLon;
    private Collection<DeviceTelemetry> devices;
    private int selectedDeviceId = -1;

    public MapCanvas(double refLat, double refLon) {
        this.refLat = refLat;
        this.refLon = refLon;
        this.devices = java.util.Collections.emptyList();
        setBackground(new Color(243, 247, 252));
    }

    public void setReferencePoint(double refLat, double refLon) {
        this.refLat = refLat;
        this.refLon = refLon;
        repaint();
    }

    public void setDevices(Collection<DeviceTelemetry> devices, int selectedDeviceId) {
        this.devices = devices == null ? java.util.Collections.<DeviceTelemetry>emptyList() : devices;
        this.selectedDeviceId = selectedDeviceId;
        repaint();
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        Graphics2D g2 = (Graphics2D) graphics.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int width = getWidth();
        int height = getHeight();
        int padding = 36;
        int centerX = width / 2;
        int centerY = height / 2;

        g2.setColor(new Color(227, 235, 244));
        for (int x = padding; x < width; x += 80) {
            g2.drawLine(x, padding, x, height - padding);
        }
        for (int y = padding; y < height; y += 80) {
            g2.drawLine(padding, y, width - padding, y);
        }

        g2.setColor(new Color(24, 69, 114));
        g2.fillOval(centerX - 7, centerY - 7, 14, 14);
        g2.setFont(getFont().deriveFont(Font.BOLD, 13f));
        g2.drawString("Receiver", centerX + 10, centerY - 10);

        g2.setColor(new Color(110, 136, 163));
        g2.drawString(String.format("Ref %.6f, %.6f", refLat, refLon), padding, height - 12);

        for (DeviceTelemetry device : devices) {
            double[] offset = toMeters(device.getLatitude(), device.getLongitude());
            int x = centerX + (int) Math.round(offset[0] * 1.8d);
            int y = centerY - (int) Math.round(offset[1] * 1.8d);

            boolean selected = device.getDeviceId() == selectedDeviceId;
            Color marker = device.getEmergency() > 0 ? new Color(220, 53, 69) : new Color(22, 163, 74);

            g2.setColor(marker);
            g2.fillOval(x - 8, y - 8, 16, 16);
            if (selected) {
                g2.setColor(new Color(255, 184, 0));
                g2.setStroke(new BasicStroke(2.2f));
                g2.drawOval(x - 13, y - 13, 26, 26);
            }

            g2.setColor(new Color(15, 23, 42));
            String label = "D" + device.getDeviceId();
            if (!device.getGuestName().isEmpty()) {
                label += " " + device.getGuestName();
            }
            g2.drawString(label, x + 10, y - 10);
        }

        g2.dispose();
    }

    private double[] toMeters(double lat, double lon) {
        double dLat = Math.toRadians(lat - refLat);
        double dLon = Math.toRadians(lon - refLon);
        double meanLat = Math.toRadians((lat + refLat) / 2.0d);
        double earthRadius = 6378137.0d;
        double x = dLon * earthRadius * Math.cos(meanLat);
        double y = dLat * earthRadius;
        return new double[]{x, y};
    }
}
