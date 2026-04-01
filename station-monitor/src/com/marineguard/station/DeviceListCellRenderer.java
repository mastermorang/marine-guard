package com.marineguard.station;

import javax.swing.BorderFactory;
import javax.swing.BoxLayout;
import javax.swing.JLabel;
import javax.swing.JList;
import javax.swing.JPanel;
import javax.swing.ListCellRenderer;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;

public class DeviceListCellRenderer extends JPanel implements ListCellRenderer<DeviceTelemetry> {
    private final JLabel titleLabel = new JLabel();
    private final JLabel guestLabel = new JLabel();
    private final JLabel bpmLabel = new JLabel();
    private final JLabel statusLabel = new JLabel();
    private final JLabel assignHintLabel = new JLabel("Click or double-click to assign guest");

    public DeviceListCellRenderer() {
        setLayout(new BorderLayout(8, 8));
        setOpaque(true);
        setBorder(BorderFactory.createEmptyBorder(12, 12, 12, 12));

        JPanel top = new JPanel();
        top.setOpaque(false);
        top.setLayout(new BoxLayout(top, BoxLayout.Y_AXIS));
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 20f));
        guestLabel.setFont(guestLabel.getFont().deriveFont(Font.PLAIN, 15f));
        top.add(titleLabel);
        top.add(guestLabel);

        JPanel center = new JPanel();
        center.setOpaque(false);
        center.setLayout(new BoxLayout(center, BoxLayout.Y_AXIS));
        bpmLabel.setFont(bpmLabel.getFont().deriveFont(Font.BOLD, 32f));
        statusLabel.setFont(statusLabel.getFont().deriveFont(Font.BOLD, 16f));
        assignHintLabel.setFont(assignHintLabel.getFont().deriveFont(Font.PLAIN, 11f));
        center.add(bpmLabel);
        center.add(statusLabel);
        center.add(assignHintLabel);

        add(top, BorderLayout.NORTH);
        add(center, BorderLayout.CENTER);
    }

    @Override
    public Component getListCellRendererComponent(JList<? extends DeviceTelemetry> list, DeviceTelemetry value, int index, boolean isSelected, boolean cellHasFocus) {
        long now = System.currentTimeMillis();
        String guest = value.getGuestName().isEmpty() ? "Guest: (unassigned)" : "Guest: " + value.getGuestName();
        titleLabel.setText("ID " + value.getDeviceId());
        guestLabel.setText(guest);
        bpmLabel.setText(value.getFinger() == 0 ? "--" : value.getBpm() + " BPM");
        statusLabel.setText("Status " + value.getStatusText(now));

        Color panelColor = AppTheme.PANEL;
        if (value.getEmergency() > 0) {
            panelColor = new Color(94, 24, 36);
        } else if (value.isStale(now)) {
            panelColor = new Color(55, 63, 77);
        } else if (value.getBpm() > 120 || (value.getBpm() > 0 && value.getBpm() < 40)) {
            panelColor = new Color(99, 66, 14);
        }

        if (isSelected) {
            panelColor = new Color(14, 84, 145);
        }

        setBackground(panelColor);
        titleLabel.setForeground(AppTheme.TEXT);
        guestLabel.setForeground(value.getGuestName().isEmpty() ? AppTheme.DANGER : AppTheme.TEXT_MUTED);
        bpmLabel.setForeground(value.getFinger() == 0 ? AppTheme.TEXT_MUTED : value.getEmergency() > 0 ? AppTheme.DANGER : value.getBpm() > 120 ? AppTheme.WARNING : AppTheme.SUCCESS);
        statusLabel.setForeground(AppTheme.TEXT);
        assignHintLabel.setForeground(AppTheme.TEXT_MUTED);
        return this;
    }
}
