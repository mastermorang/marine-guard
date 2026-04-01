package com.marineguard.station;

import javax.swing.JTable;
import javax.swing.SwingConstants;
import javax.swing.table.DefaultTableCellRenderer;
import java.awt.Color;
import java.awt.Component;

public class DeviceTableCellRenderer extends DefaultTableCellRenderer {
    @Override
    public Component getTableCellRendererComponent(JTable table, Object value, boolean isSelected, boolean hasFocus, int row, int column) {
        super.getTableCellRendererComponent(table, value, isSelected, hasFocus, row, column);

        DeviceTableModel model = (DeviceTableModel) table.getModel();
        DeviceTelemetry device = model.getDeviceAt(table.convertRowIndexToModel(row));
        long now = System.currentTimeMillis();

        setHorizontalAlignment(column == 0 || column >= 4 ? SwingConstants.CENTER : SwingConstants.LEFT);
        setBorder(noFocusBorder);

        Color fg = AppTheme.TEXT;
        Color bg = (row % 2 == 0) ? AppTheme.PANEL : AppTheme.PANEL_ALT;

        if (device != null) {
            if (device.getEmergency() > 0) {
                bg = new Color(95, 24, 32);
            } else if (device.isStale(now)) {
                bg = new Color(48, 58, 71);
                fg = AppTheme.TEXT_MUTED;
            } else if (device.getBattery() >= 0 && device.getBattery() < 20) {
                bg = new Color(94, 47, 22);
            } else if (device.getBpm() > 120 || (device.getBpm() > 0 && device.getBpm() < 40)) {
                bg = new Color(100, 61, 9);
            } else if (device.getFinger() == 0) {
                bg = new Color(55, 63, 77);
            }

            if (column == 1 && device.getGuestName().isEmpty()) {
                bg = new Color(86, 33, 39);
            }
        }

        if (isSelected) {
            bg = new Color(18, 88, 146);
            fg = AppTheme.TEXT;
        }

        setBackground(bg);
        setForeground(fg);
        return this;
    }
}
