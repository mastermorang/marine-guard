package com.marineguard.station;

import javax.swing.table.AbstractTableModel;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.List;
import java.util.Map;

public class DeviceTableModel extends AbstractTableModel {
    private static final String[] COLUMNS = {
            "ID", "Guest", "Lat", "Lon", "BPM", "Battery", "EMG", "Finger", "Status", "Last Seen"
    };

    private final List<DeviceTelemetry> rows = new ArrayList<DeviceTelemetry>();
    private final SimpleDateFormat timeFormat = new SimpleDateFormat("HH:mm:ss");

    public void setDevices(Map<Integer, DeviceTelemetry> devices) {
        rows.clear();
        rows.addAll(devices.values());
        rows.sort(Comparator.comparingInt(DeviceTelemetry::getDeviceId));
        fireTableDataChanged();
    }

    public DeviceTelemetry getDeviceAt(int rowIndex) {
        if (rowIndex < 0 || rowIndex >= rows.size()) {
            return null;
        }
        return rows.get(rowIndex);
    }

    @Override
    public int getRowCount() {
        return rows.size();
    }

    @Override
    public int getColumnCount() {
        return COLUMNS.length;
    }

    @Override
    public String getColumnName(int column) {
        return COLUMNS[column];
    }

    @Override
    public Object getValueAt(int rowIndex, int columnIndex) {
        DeviceTelemetry device = rows.get(rowIndex);
        long now = System.currentTimeMillis();
        switch (columnIndex) {
            case 0:
                return device.getDeviceId();
            case 1:
                return device.getGuestName().isEmpty() ? "-" : device.getGuestName();
            case 2:
                return String.format("%.6f", device.getLatitude());
            case 3:
                return String.format("%.6f", device.getLongitude());
            case 4:
                return device.getBpm();
            case 5:
                return device.getBattery() >= 0 ? device.getBattery() + "%" : "-";
            case 6:
                return device.getEmergency();
            case 7:
                return device.getFinger();
            case 8:
                return device.getStatusText(now);
            case 9:
                return timeFormat.format(new Date(device.getReceivedAt()));
            default:
                return "";
        }
    }
}
