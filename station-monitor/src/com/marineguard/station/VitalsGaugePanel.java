package com.marineguard.station;

import javax.swing.JPanel;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;

public class VitalsGaugePanel extends JPanel {
    private DeviceTelemetry telemetry;

    public VitalsGaugePanel() {
        setOpaque(true);
        setBackground(AppTheme.PANEL);
    }

    public void setTelemetry(DeviceTelemetry telemetry) {
        this.telemetry = telemetry;
        repaint();
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        Graphics2D g2 = (Graphics2D) graphics.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int width = getWidth();
        int height = getHeight();
        int topPadding = 18;
        int bottomPadding = 54;
        int sidePadding = 22;
        int size = Math.min(width - sidePadding * 2, height - topPadding - bottomPadding);
        size = Math.max(90, size);
        int x = (width - size) / 2;
        int y = topPadding;

        g2.setStroke(new BasicStroke(16f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        g2.setColor(new Color(52, 67, 88));
        g2.drawArc(x, y, size, size, 135, 270);

        boolean hasContact = telemetry != null && telemetry.getFinger() > 0;
        int bpm = !hasContact ? 0 : telemetry.getBpm();
        double normalized = Math.max(0d, Math.min(1d, (bpm - 40d) / 100d));
        int arc = (int) Math.round(270 * normalized);
        g2.setColor(statusColor());
        g2.drawArc(x, y, size, size, 135, arc);

        g2.setColor(AppTheme.TEXT_MUTED);
        g2.setFont(getFont().deriveFont(Font.BOLD, 13f));
        g2.drawString("BPM", width / 2 - 17, y + size / 2 - 10);

        g2.setColor(AppTheme.TEXT);
        g2.setFont(getFont().deriveFont(Font.BOLD, 36f));
        String value = telemetry == null || !hasContact ? "--" : String.valueOf(telemetry.getBpm());
        int strWidth = g2.getFontMetrics().stringWidth(value);
        g2.drawString(value, width / 2 - strWidth / 2, y + size / 2 + 28);

        g2.setColor(AppTheme.TEXT_MUTED);
        g2.setFont(getFont().deriveFont(Font.PLAIN, 12f));
        String label = telemetry == null ? "No signal" : hasContact ? telemetry.getStatusText(System.currentTimeMillis()) : "No contact";
        int labelWidth = g2.getFontMetrics().stringWidth(label);
        int labelY = Math.min(height - 14, y + size + 26);
        g2.drawString(label, width / 2 - labelWidth / 2, labelY);
        g2.dispose();
    }

    private Color statusColor() {
        if (telemetry == null) {
            return AppTheme.OFFLINE;
        }
        if (telemetry.getEmergency() > 0) {
            return AppTheme.DANGER;
        }
        if (telemetry.getFinger() == 0) {
            return AppTheme.OFFLINE;
        }
        if (telemetry.getBpm() > 120 || (telemetry.getBpm() > 0 && telemetry.getBpm() < 40)) {
            return AppTheme.WARNING;
        }
        return AppTheme.SUCCESS;
    }
}
