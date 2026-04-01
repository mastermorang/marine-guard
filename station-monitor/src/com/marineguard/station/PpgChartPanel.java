package com.marineguard.station;

import javax.swing.JPanel;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.Graphics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.util.ArrayList;
import java.util.List;

public class PpgChartPanel extends JPanel {
    private List<PpgSample> samples = new ArrayList<PpgSample>();
    private boolean showPpg;

    public PpgChartPanel() {
        setBackground(AppTheme.PANEL);
    }

    public void setSamples(List<PpgSample> samples, boolean showPpg) {
        this.samples = samples == null ? new ArrayList<PpgSample>() : new ArrayList<PpgSample>(samples);
        this.showPpg = showPpg;
        repaint();
    }

    @Override
    protected void paintComponent(Graphics graphics) {
        super.paintComponent(graphics);
        Graphics2D g2 = (Graphics2D) graphics.create();
        g2.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);

        int width = getWidth();
        int height = getHeight();
        int left = 52;
        int right = 18;
        int top = 28;
        int bottom = 34;
        int plotWidth = Math.max(1, width - left - right);
        int plotHeight = Math.max(1, height - top - bottom);

        g2.setColor(AppTheme.GRID);
        for (int i = 0; i <= 4; i++) {
            int y = top + (plotHeight * i / 4);
            g2.drawLine(left, y, width - right, y);
        }

        g2.setColor(AppTheme.TEXT_MUTED);
        g2.setFont(getFont().deriveFont(Font.PLAIN, 11f));
        g2.drawString(showPpg ? "PPG raw" : "BPM", 12, 16);
        g2.drawString("60s", 54, 16);

        List<PpgSample> plotSamples = new ArrayList<PpgSample>();
        for (PpgSample sample : samples) {
            if (!sample.hasContact()) {
                continue;
            }
            if (showPpg && !sample.hasRawPpg()) {
                continue;
            }
            plotSamples.add(sample);
        }

        if (plotSamples.size() < 2) {
            g2.setColor(AppTheme.TEXT_MUTED);
            g2.drawString(samples.isEmpty() ? "Waiting for enough samples..." : "No contact detected", left, top + plotHeight / 2);
            g2.dispose();
            return;
        }

        int min = Integer.MAX_VALUE;
        int max = Integer.MIN_VALUE;
        for (PpgSample sample : plotSamples) {
            int value = showPpg ? sample.getPpgValue() : sample.getBpm();
            min = Math.min(min, value);
            max = Math.max(max, value);
        }
        if (min == max) {
            min -= 1;
            max += 1;
        }

        long firstTs = plotSamples.get(0).getTimestamp();
        long lastTs = plotSamples.get(plotSamples.size() - 1).getTimestamp();
        long span = Math.max(1L, lastTs - firstTs);

        g2.setColor(showPpg ? AppTheme.ACCENT : AppTheme.WARNING);
        g2.setStroke(new BasicStroke(2.2f));

        int prevX = -1;
        int prevY = -1;
        for (PpgSample sample : plotSamples) {
            int value = showPpg ? sample.getPpgValue() : sample.getBpm();
            int x = left + (int) ((sample.getTimestamp() - firstTs) * plotWidth / span);
            int y = top + plotHeight - (int) ((long) (value - min) * plotHeight / Math.max(1, max - min));
            if (prevX >= 0) {
                g2.drawLine(prevX, prevY, x, y);
            }
            prevX = x;
            prevY = y;
        }

        g2.setColor(AppTheme.TEXT_MUTED);
        g2.drawString(String.valueOf(max), 12, top + 4);
        g2.drawString(String.valueOf(min), 12, top + plotHeight);
        g2.drawString("-60s", left, height - 10);
        g2.drawString("now", width - right - 22, height - 10);
        g2.dispose();
    }
}
