package com.marineguard.station;

import javax.swing.BorderFactory;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.JToggleButton;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.Font;
import java.awt.GridLayout;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class PpgMonitorFrame extends JFrame {
    private final JLabel targetLabel = new JLabel("No device selected");
    private final JLabel modeLabel = new JLabel("Graph: BPM trend");
    private final JLabel currentValueLabel = new JLabel("--");
    private final JLabel currentPpgLabel = new JLabel("--");
    private final JLabel statsLabel = new JLabel("min -- / max -- / avg --");
    private final JToggleButton graphModeToggle = new JToggleButton("Show raw PPG");
    private final PpgChartPanel chartPanel = new PpgChartPanel();
    private final Map<Integer, Deque<PpgSample>> historyByDevice = new HashMap<Integer, Deque<PpgSample>>();
    private int selectedDeviceId = -1;
    private String selectedGuestName = "";

    public PpgMonitorFrame() {
        super("Marine Guard PPG Monitor");
        setDefaultCloseOperation(WindowConstants.HIDE_ON_CLOSE);
        setMinimumSize(new Dimension(900, 520));
        getContentPane().setLayout(new BorderLayout(12, 12));
        getContentPane().setBackground(AppTheme.BG);

        JPanel top = new JPanel(new BorderLayout(8, 8));
        top.setOpaque(false);
        targetLabel.setFont(targetLabel.getFont().deriveFont(Font.BOLD, 18f));
        targetLabel.setForeground(AppTheme.TEXT);
        top.add(targetLabel, BorderLayout.WEST);
        graphModeToggle.addActionListener(event -> refreshView());
        graphModeToggle.setBackground(AppTheme.PANEL_ALT);
        graphModeToggle.setForeground(AppTheme.TEXT);
        top.add(graphModeToggle, BorderLayout.EAST);

        JPanel statsPanel = new JPanel(new GridLayout(1, 4, 10, 10));
        statsPanel.setOpaque(false);
        statsPanel.add(createCard("Current BPM", currentValueLabel));
        statsPanel.add(createCard("Current PPG", currentPpgLabel));
        statsPanel.add(createCard("Graph mode", modeLabel));
        statsPanel.add(createCard("Summary", statsLabel));

        JPanel north = new JPanel(new BorderLayout(10, 10));
        north.setOpaque(false);
        north.add(top, BorderLayout.NORTH);
        north.add(statsPanel, BorderLayout.CENTER);

        chartPanel.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(221, 229, 239)),
                BorderFactory.createEmptyBorder(8, 8, 8, 8)
        ));

        getContentPane().add(north, BorderLayout.NORTH);
        getContentPane().add(chartPanel, BorderLayout.CENTER);
    }

    private JPanel createCard(String title, JLabel valueLabel) {
        JPanel card = new JPanel(new BorderLayout(6, 6));
        AppTheme.styleCard(card);
        JLabel titleLabel = new JLabel(title);
        AppTheme.styleTitle(titleLabel);
        valueLabel.setFont(valueLabel.getFont().deriveFont(Font.BOLD, 18f));
        valueLabel.setForeground(AppTheme.TEXT);
        card.add(titleLabel, BorderLayout.NORTH);
        card.add(valueLabel, BorderLayout.CENTER);
        return card;
    }

    public void addTelemetry(DeviceTelemetry telemetry) {
        Deque<PpgSample> history = historyByDevice.get(telemetry.getDeviceId());
        if (history == null) {
            history = new ArrayDeque<PpgSample>();
            historyByDevice.put(telemetry.getDeviceId(), history);
        }
        history.addLast(new PpgSample(telemetry.getReceivedAt(), telemetry.getBpm(), telemetry.getPpgValue()));
        long cutoff = telemetry.getReceivedAt() - 60000L;
        while (!history.isEmpty() && history.peekFirst().getTimestamp() < cutoff) {
            history.removeFirst();
        }

        if (selectedDeviceId == telemetry.getDeviceId()) {
            selectedGuestName = telemetry.getGuestName();
            refreshView();
        }
    }

    public void setSelectedDevice(DeviceTelemetry telemetry) {
        if (telemetry == null) {
            selectedDeviceId = -1;
            selectedGuestName = "";
        } else {
            selectedDeviceId = telemetry.getDeviceId();
            selectedGuestName = telemetry.getGuestName();
        }
        refreshView();
    }

    private void refreshView() {
        if (selectedDeviceId < 0) {
            targetLabel.setText("No device selected");
            currentValueLabel.setText("--");
            currentPpgLabel.setText("--");
            modeLabel.setText(graphModeToggle.isSelected() ? "Graph: raw PPG" : "Graph: BPM trend");
            statsLabel.setText("min -- / max -- / avg --");
            chartPanel.setSamples(new ArrayList<PpgSample>(), graphModeToggle.isSelected());
            return;
        }

        String suffix = selectedGuestName == null || selectedGuestName.isEmpty() ? "" : " (" + selectedGuestName + ")";
        targetLabel.setText("Device D" + selectedDeviceId + suffix);

        Deque<PpgSample> history = historyByDevice.get(selectedDeviceId);
        List<PpgSample> samples = history == null ? new ArrayList<PpgSample>() : new ArrayList<PpgSample>(history);
        boolean showPpg = graphModeToggle.isSelected() && hasRawPpg(samples);
        modeLabel.setText(showPpg ? "Graph: raw PPG" : "Graph: BPM trend");

        if (samples.isEmpty()) {
            currentValueLabel.setText("--");
            currentPpgLabel.setText("--");
            statsLabel.setText("min -- / max -- / avg --");
            chartPanel.setSamples(samples, showPpg);
            return;
        }

        PpgSample latest = samples.get(samples.size() - 1);
        currentValueLabel.setText(latest.getBpm() + " bpm");
        currentPpgLabel.setText(latest.getPpgValue() >= 0 ? String.valueOf(latest.getPpgValue()) : "n/a");

        int min = Integer.MAX_VALUE;
        int max = Integer.MIN_VALUE;
        long sum = 0L;
        int count = 0;
        for (PpgSample sample : samples) {
            int value = showPpg && sample.getPpgValue() >= 0 ? sample.getPpgValue() : sample.getBpm();
            min = Math.min(min, value);
            max = Math.max(max, value);
            sum += value;
            count++;
        }
        statsLabel.setText("min " + min + " / max " + max + " / avg " + (count == 0 ? "--" : sum / count));
        chartPanel.setSamples(samples, showPpg);
    }

    private boolean hasRawPpg(List<PpgSample> samples) {
        for (PpgSample sample : samples) {
            if (sample.getPpgValue() >= 0) {
                return true;
            }
        }
        return false;
    }
}
