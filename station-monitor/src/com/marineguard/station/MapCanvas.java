package com.marineguard.station;

import javax.swing.JPanel;
import java.awt.AlphaComposite;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.Point;
import java.awt.RenderingHints;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.MouseWheelEvent;
import java.awt.event.MouseWheelListener;
import java.util.Collection;

public class MapCanvas extends JPanel {
    private double refLat;
    private double refLon;
    private Collection<DeviceTelemetry> devices;
    private int selectedDeviceId = -1;
    private double zoomFactor = 1.8d;
    private int panX;
    private int panY;
    private Point dragStart;

    public MapCanvas(double refLat, double refLon) {
        this.refLat = refLat;
        this.refLon = refLon;
        this.devices = java.util.Collections.emptyList();
        setBackground(AppTheme.PANEL);
        addMouseWheelListener(new ZoomListener());
        DragHandler dragHandler = new DragHandler();
        addMouseListener(dragHandler);
        addMouseMotionListener(dragHandler);
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
        int centerX = width / 2 + panX;
        int centerY = height / 2 + panY;

        g2.setColor(AppTheme.GRID);
        for (int x = padding; x < width; x += 80) {
            g2.drawLine(x, padding, x, height - padding);
        }
        for (int y = padding; y < height; y += 80) {
            g2.drawLine(padding, y, width - padding, y);
        }

        g2.setColor(AppTheme.ACCENT);
        g2.fillOval(centerX - 8, centerY - 8, 16, 16);
        g2.setFont(getFont().deriveFont(Font.BOLD, 13f));
        g2.setColor(AppTheme.TEXT);
        g2.drawString("Receiver", centerX + 10, centerY - 10);

        g2.setColor(AppTheme.TEXT_MUTED);
        g2.drawString(String.format("Ref %.6f, %.6f", refLat, refLon), padding, height - 12);
        g2.drawString(String.format("Zoom x%.1f", zoomFactor / 1.8d), width - 125, height - 28);
        g2.drawString(String.format("Scale %.0fm", 100d / zoomFactor), width - 125, height - 12);

        for (DeviceTelemetry device : devices) {
            double[] offset = ReceiverLocation.calculateOffsetMeters(refLat, refLon, device.getLatitude(), device.getLongitude());
            int x = centerX + (int) Math.round(offset[0] * zoomFactor);
            int y = centerY - (int) Math.round(offset[1] * zoomFactor);

            boolean selected = device.getDeviceId() == selectedDeviceId;
            Color marker = statusColor(device);
            double distanceMeters = ReceiverLocation.calculateDistance(refLat, refLon, device.getLatitude(), device.getLongitude());

            g2.setColor(marker);
            g2.fillOval(x - 8, y - 8, 16, 16);
            if (device.getEmergency() > 0) {
                float pulse = 18f + (System.currentTimeMillis() % 1200L) / 1200f * 10f;
                g2.setComposite(AlphaComposite.getInstance(AlphaComposite.SRC_OVER, 0.5f));
                g2.setStroke(new BasicStroke(2f));
                g2.drawOval((int) (x - pulse / 2), (int) (y - pulse / 2), (int) pulse, (int) pulse);
                g2.setComposite(AlphaComposite.SrcOver);
            }
            if (selected) {
                g2.setColor(AppTheme.SELECTED);
                g2.setStroke(new BasicStroke(2.2f));
                g2.drawOval(x - 13, y - 13, 26, 26);
            }

            g2.setColor(AppTheme.TEXT);
            String label = "D" + device.getDeviceId();
            if (!device.getGuestName().isEmpty()) {
                label += " " + device.getGuestName();
            }
            g2.drawString(label, x + 12, y - 10);
            g2.setColor(AppTheme.TEXT_MUTED);
            g2.drawString(formatDistance(distanceMeters, device), x + 12, y + 6);
        }

        g2.dispose();
    }

    private Color statusColor(DeviceTelemetry device) {
        long now = System.currentTimeMillis();
        if (device.getEmergency() > 0) {
            return AppTheme.DANGER;
        }
        if (device.isStale(now)) {
            return AppTheme.OFFLINE;
        }
        if (device.getBpm() > 120 || (device.getBpm() > 0 && device.getBpm() < 40)) {
            return AppTheme.WARNING;
        }
        if (device.getFinger() == 0) {
            return new Color(156, 163, 175);
        }
        return AppTheme.SUCCESS;
    }

    private String formatDistance(double distanceMeters, DeviceTelemetry device) {
        if (!ReceiverLocation.hasGpsFix(device.getLatitude(), device.getLongitude())
                || !ReceiverLocation.hasGpsFix(refLat, refLon)
                || distanceMeters > 1000000.0d) {
            return "GPS No Fix";
        }
        return String.format("%.0fm", distanceMeters);
    }

    private final class ZoomListener implements MouseWheelListener {
        @Override
        public void mouseWheelMoved(MouseWheelEvent event) {
            double next = zoomFactor * (event.getWheelRotation() > 0 ? 0.9d : 1.1d);
            zoomFactor = Math.max(0.6d, Math.min(8.5d, next));
            repaint();
        }
    }

    private final class DragHandler extends MouseAdapter {
        @Override
        public void mousePressed(MouseEvent event) {
            dragStart = event.getPoint();
        }

        @Override
        public void mouseDragged(MouseEvent event) {
            if (dragStart == null) {
                return;
            }
            panX += event.getX() - dragStart.x;
            panY += event.getY() - dragStart.y;
            dragStart = event.getPoint();
            repaint();
        }
    }
}
