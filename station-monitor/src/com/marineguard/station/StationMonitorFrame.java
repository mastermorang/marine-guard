package com.marineguard.station;

import jssc.SerialPortException;

import javax.swing.*;
import javax.swing.event.ListSelectionEvent;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.BufferedWriter;
import java.io.File;
import java.io.FileWriter;
import java.io.IOException;
import java.util.*;
import java.util.List;

public class StationMonitorFrame extends JFrame implements SerialReceiverService.Listener {
    private final AppConfig config;
    private final SerialReceiverService serialService;
    private final Map<Integer, DeviceTelemetry> devices = new LinkedHashMap<Integer, DeviceTelemetry>();
    private final Map<Integer, Deque<PpgSample>> ppgHistory = new HashMap<Integer, Deque<PpgSample>>();
    private final List<EventEntry> eventEntries = new ArrayList<EventEntry>();
    private final DefaultListModel<DeviceTelemetry> deviceListModel = new DefaultListModel<DeviceTelemetry>();
    private final JList<DeviceTelemetry> deviceList = new JList<DeviceTelemetry>(deviceListModel);
    private final JTextArea eventLogArea = new JTextArea();
    private final JLabel statusLabel = new JLabel("Receiver waiting for data");
    private final JLabel summaryLabel = new JLabel("0 devices online");
    private final JButton connectButton = new JButton("Connect");
    private final JButton disconnectButton = new JButton("Disconnect");
    private final JButton exportButton = new JButton("Export CSV");
    private final JButton fullscreenButton = new JButton("Fullscreen");
    private final JButton settingsButton = new JButton("Settings");
    private final JButton helpButton = new JButton("Help");
    private final JButton assignGuestButton = new JButton("Assign Guest");
    private final JButton ppgMonitorButton = new JButton("PPG Monitor");
    private final JComboBox<String> portComboBox = new JComboBox<String>();
    private final JComboBox<String> baudComboBox = new JComboBox<String>(new String[]{"9600", "57600", "115200"});
    private final JComboBox<String> locationModeComboBox = new JComboBox<String>(new String[]{"Manual", "Auto receiver GPS"});
    private final JTextField refLatField = new JTextField(10);
    private final JTextField refLonField = new JTextField(10);
    private final JLabel selectedTitleLabel = new JLabel("No device selected");
    private final JLabel selectedGuestLabel = new JLabel("-");
    private final JLabel selectedMetaLabel = new JLabel("-");
    private final JLabel receiverRefLabel = new JLabel("-");
    private final JLabel ppgSummaryLabel = new JLabel("min -- / max -- / avg --");
    private final VitalsGaugePanel vitalsGauge = new VitalsGaugePanel();
    private final PpgChartPanel ppgChart = new PpgChartPanel();
    private final MapCanvas mapCanvas;
    private final PpgMonitorFrame ppgMonitorFrame = new PpgMonitorFrame();
    private final JToggleButton allFilterButton = new JToggleButton("All", true);
    private final JToggleButton warningFilterButton = new JToggleButton("Warning");
    private final JToggleButton emergencyFilterButton = new JToggleButton("Emergency");
    private long lastTelemetryAt;
    private int selectedDeviceId = -1;
    private boolean disconnectWarningShown;
    private boolean fullscreen;
    private ReceiverLocation lastReceiverLocation;

    public StationMonitorFrame(AppConfig config) {
        super("Marine Guard Station Monitor");
        this.config = config;
        this.serialService = new SerialReceiverService(this);
        this.mapCanvas = new MapCanvas(config.getRefLat(), config.getRefLon());
        configureUi();
        loadInitialValues();
        refreshPorts();
        attachListeners();
        new javax.swing.Timer(1000, e -> { updateHeaderStatus(); refreshSelectedPanels(); mapCanvas.repaint(); }).start();
        updateHeaderStatus();
        refreshReceiverReferenceLabel();
        refreshSelectedPanels();
        refreshEventLog();
    }

    private void configureUi() {
        setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
        setMinimumSize(new Dimension(1680, 960));
        getContentPane().setLayout(new BorderLayout(12, 12));
        getContentPane().setBackground(AppTheme.BG);
        getContentPane().add(createTopBar(), BorderLayout.NORTH);
        getContentPane().add(createMainBody(), BorderLayout.CENTER);
        getContentPane().add(createBottomLogPanel(), BorderLayout.SOUTH);
    }

    private JPanel createTopBar() {
        JPanel bar = new JPanel(new BorderLayout(16, 10));
        bar.setBackground(AppTheme.PANEL);
        bar.setBorder(BorderFactory.createEmptyBorder(12, 14, 12, 14));
        JLabel title = new JLabel("Marine Guard Station Monitor");
        title.setForeground(AppTheme.TEXT);
        title.setFont(title.getFont().deriveFont(Font.BOLD, 28f));
        statusLabel.setForeground(AppTheme.SUCCESS);
        statusLabel.setFont(statusLabel.getFont().deriveFont(Font.BOLD, 20f));
        summaryLabel.setForeground(AppTheme.TEXT_MUTED);
        summaryLabel.setFont(summaryLabel.getFont().deriveFont(Font.PLAIN, 15f));
        JPanel left = new JPanel(); left.setOpaque(false); left.setLayout(new BoxLayout(left, BoxLayout.Y_AXIS)); left.add(title); left.add(statusLabel); left.add(summaryLabel);
        JPanel right = new JPanel(new FlowLayout(FlowLayout.RIGHT, 10, 4)); right.setOpaque(false);
        for (JButton b : new JButton[]{connectButton, disconnectButton, exportButton, fullscreenButton, settingsButton, helpButton}) { styleButton(b); right.add(b); }
        bar.add(left, BorderLayout.CENTER); bar.add(right, BorderLayout.EAST); return bar;
    }

    private JPanel createMainBody() {
        JPanel body = new JPanel(new BorderLayout(12, 12)); body.setOpaque(false);
        JPanel left = new JPanel(new BorderLayout(10, 10)); left.setBackground(AppTheme.PANEL); left.setBorder(AppTheme.sectionBorder("Devices")); left.setPreferredSize(new Dimension(320, 0));
        deviceList.setSelectionMode(ListSelectionModel.SINGLE_SELECTION); deviceList.setBackground(AppTheme.PANEL); deviceList.setCellRenderer(new DeviceListCellRenderer());
        JScrollPane listScroll = new JScrollPane(deviceList); listScroll.setBorder(null); listScroll.getViewport().setBackground(AppTheme.PANEL);
        JPanel leftBtns = new JPanel(new GridLayout(2, 1, 8, 8)); leftBtns.setOpaque(false); styleButton(assignGuestButton); styleButton(ppgMonitorButton); leftBtns.add(assignGuestButton); leftBtns.add(ppgMonitorButton);
        left.add(listScroll, BorderLayout.CENTER); left.add(leftBtns, BorderLayout.SOUTH);

        JPanel center = new JPanel(new BorderLayout(8, 8)); center.setBackground(AppTheme.PANEL); center.setBorder(AppTheme.sectionBorder("Relative Map"));
        JLabel mapHelp = new JLabel("Wheel: zoom  |  Drag: pan  |  Receiver stays at center"); mapHelp.setForeground(AppTheme.TEXT_MUTED); mapHelp.setHorizontalAlignment(SwingConstants.RIGHT);
        center.add(mapCanvas, BorderLayout.CENTER); center.add(mapHelp, BorderLayout.SOUTH);

        JPanel right = new JPanel(new BorderLayout(10, 10)); right.setOpaque(false); right.setPreferredSize(new Dimension(420, 0));
        JPanel selected = new JPanel(new GridLayout(4, 1, 6, 6)); AppTheme.styleCard(selected); selected.setBorder(AppTheme.sectionBorder("Selected Device"));
        styleInfo(selectedTitleLabel, 22f, true); styleInfo(selectedGuestLabel, 18f, false); styleInfo(selectedMetaLabel, 14f, false); styleInfo(receiverRefLabel, 13f, false);
        selected.add(selectedTitleLabel); selected.add(selectedGuestLabel); selected.add(selectedMetaLabel); selected.add(receiverRefLabel);
        JPanel vitals = new JPanel(new BorderLayout()); vitals.setBorder(AppTheme.sectionBorder("Vitals")); vitals.setBackground(AppTheme.PANEL); vitals.add(vitalsGauge, BorderLayout.CENTER);
        JPanel ppg = new JPanel(new BorderLayout()); ppg.setBorder(AppTheme.sectionBorder("PPG Waveform")); ppg.setBackground(AppTheme.PANEL); ppg.setPreferredSize(new Dimension(0, 220)); ppg.add(ppgChart, BorderLayout.CENTER);
        JPanel summary = new JPanel(new BorderLayout()); summary.setBorder(AppTheme.sectionBorder("PPG Summary")); summary.setBackground(AppTheme.PANEL); summary.setPreferredSize(new Dimension(0, 90)); styleInfo(ppgSummaryLabel, 16f, false); summary.add(ppgSummaryLabel, BorderLayout.CENTER);
        JPanel rightBottom = new JPanel(new BorderLayout(10, 10)); rightBottom.setOpaque(false); rightBottom.add(ppg, BorderLayout.CENTER); rightBottom.add(summary, BorderLayout.SOUTH);
        right.add(selected, BorderLayout.NORTH); right.add(vitals, BorderLayout.CENTER); right.add(rightBottom, BorderLayout.SOUTH);

        body.add(left, BorderLayout.WEST); body.add(center, BorderLayout.CENTER); body.add(right, BorderLayout.EAST); return body;
    }

    private JPanel createBottomLogPanel() {
        JPanel panel = new JPanel(new BorderLayout(8, 8)); panel.setBackground(AppTheme.PANEL); panel.setBorder(AppTheme.sectionBorder("Event Log")); panel.setPreferredSize(new Dimension(0, 150));
        eventLogArea.setEditable(false); eventLogArea.setLineWrap(true); eventLogArea.setWrapStyleWord(true); eventLogArea.setBackground(AppTheme.PANEL_ALT); eventLogArea.setForeground(AppTheme.TEXT); eventLogArea.setCaretColor(AppTheme.TEXT);
        JScrollPane logScroll = new JScrollPane(eventLogArea); logScroll.setBorder(null); logScroll.getViewport().setBackground(AppTheme.PANEL_ALT);
        ButtonGroup group = new ButtonGroup(); group.add(allFilterButton); group.add(warningFilterButton); group.add(emergencyFilterButton); styleToggle(allFilterButton); styleToggle(warningFilterButton); styleToggle(emergencyFilterButton);
        JPanel filters = new JPanel(new FlowLayout(FlowLayout.RIGHT, 8, 0)); filters.setOpaque(false); filters.add(allFilterButton); filters.add(warningFilterButton); filters.add(emergencyFilterButton);
        panel.add(filters, BorderLayout.NORTH); panel.add(logScroll, BorderLayout.CENTER); return panel;
    }

    private void loadInitialValues() {
        refLatField.setText(String.valueOf(config.getRefLat()));
        refLonField.setText(String.valueOf(config.getRefLon()));
        baudComboBox.setSelectedItem(String.valueOf(config.getBaudRate()));
        locationModeComboBox.setSelectedIndex(config.isAutoReceiverLocation() ? 1 : 0);
        styleCombo(portComboBox); styleCombo(baudComboBox); styleCombo(locationModeComboBox); styleField(refLatField); styleField(refLonField);
    }

    private void attachListeners() {
        deviceList.addListSelectionListener((ListSelectionEvent e) -> { if (!e.getValueIsAdjusting() && deviceList.getSelectedValue() != null) selectDevice(deviceList.getSelectedValue().getDeviceId(), false); });
        deviceList.addMouseListener(new MouseAdapter() { @Override public void mouseClicked(MouseEvent e) { if (e.getClickCount() >= 2) assignGuestToSelectedDevice(); } });
        connectButton.addActionListener(e -> connect()); disconnectButton.addActionListener(e -> disconnect("user request")); exportButton.addActionListener(e -> exportLogCsv()); fullscreenButton.addActionListener(e -> toggleFullscreen());
        settingsButton.addActionListener(e -> openSettingsDialog()); helpButton.addActionListener(e -> showHelpDialog()); assignGuestButton.addActionListener(e -> assignGuestToSelectedDevice()); ppgMonitorButton.addActionListener(e -> openPpgMonitor());
        allFilterButton.addActionListener(e -> refreshEventLog()); warningFilterButton.addActionListener(e -> refreshEventLog()); emergencyFilterButton.addActionListener(e -> refreshEventLog());
        addWindowListener(new WindowAdapter() { @Override public void windowClosing(WindowEvent e) { disconnect("window closing"); persistConfig(); dispose(); } });
    }

    private void refreshPorts() {
        String current = String.valueOf(portComboBox.getSelectedItem());
        String[] ports = SerialReceiverService.listPorts();
        portComboBox.setModel(new DefaultComboBoxModel<String>(ports));
        if (config.getPortName() != null && !config.getPortName().isEmpty()) portComboBox.setSelectedItem(config.getPortName()); else if (current != null) portComboBox.setSelectedItem(current);
        if (portComboBox.getSelectedItem() == null && ports.length > 0) portComboBox.setSelectedIndex(0);
    }

    private boolean autoRef() { return locationModeComboBox.getSelectedIndex() == 1; }

    private void connect() {
        String port = String.valueOf(portComboBox.getSelectedItem());
        if (port == null || port.trim().isEmpty() || "null".equals(port)) { JOptionPane.showMessageDialog(this, "Select a COM port first.", "No port", JOptionPane.WARNING_MESSAGE); return; }
        try {
            int baud = Integer.parseInt(String.valueOf(baudComboBox.getSelectedItem()).trim());
            if (!autoRef()) { config.setRefLat(Double.parseDouble(refLatField.getText().trim())); config.setRefLon(Double.parseDouble(refLonField.getText().trim())); mapCanvas.setReferencePoint(config.getRefLat(), config.getRefLon()); }
            config.setPortName(port); config.setBaudRate(baud); config.setAutoReceiverLocation(autoRef()); persistConfig(); serialService.connect(port, baud);
            appendEvent(EventEntry.Level.INFO, "Receiver connected on " + port + " @ " + baud);
        } catch (NumberFormatException ex) {
            JOptionPane.showMessageDialog(this, "Invalid baud rate or reference coordinates.", "Input error", JOptionPane.ERROR_MESSAGE);
        } catch (SerialPortException ex) {
            JOptionPane.showMessageDialog(this, "Serial connect failed: " + ex.getMessage(), "Connect failed", JOptionPane.ERROR_MESSAGE); appendEvent(EventEntry.Level.WARNING, "Connect failed: " + ex.getMessage());
        }
    }

    private void disconnect(String reason) { serialService.disconnect(reason); }

    private void openSettingsDialog() {
        refreshPorts();
        JPanel panel = new JPanel(new GridLayout(0, 2, 8, 8)); panel.setBackground(AppTheme.BG);
        panel.add(new JLabel("COM Port")); panel.add(portComboBox); panel.add(new JLabel("Baud")); panel.add(baudComboBox); panel.add(new JLabel("Reference mode")); panel.add(locationModeComboBox); panel.add(new JLabel("Reference lat")); panel.add(refLatField); panel.add(new JLabel("Reference lon")); panel.add(refLonField);
        int result = JOptionPane.showConfirmDialog(this, panel, "Field Settings", JOptionPane.OK_CANCEL_OPTION, JOptionPane.PLAIN_MESSAGE);
        if (result == JOptionPane.OK_OPTION) try { config.setPortName(String.valueOf(portComboBox.getSelectedItem())); config.setBaudRate(Integer.parseInt(String.valueOf(baudComboBox.getSelectedItem()))); config.setAutoReceiverLocation(autoRef()); if (!config.isAutoReceiverLocation()) { config.setRefLat(Double.parseDouble(refLatField.getText().trim())); config.setRefLon(Double.parseDouble(refLonField.getText().trim())); mapCanvas.setReferencePoint(config.getRefLat(), config.getRefLon()); } persistConfig(); refreshReceiverReferenceLabel(); } catch (NumberFormatException ex) { JOptionPane.showMessageDialog(this, "Invalid settings values.", "Settings", JOptionPane.ERROR_MESSAGE); }
    }

    private void showHelpDialog() { JOptionPane.showMessageDialog(this, "Mouse wheel: zoom map\nDouble-click device card: assign guest\nPPG Monitor: open larger waveform window\nSettings: COM/baud/reference point", "Marine Guard Help", JOptionPane.INFORMATION_MESSAGE); }

    private void exportLogCsv() {
        JFileChooser chooser = new JFileChooser(); chooser.setSelectedFile(new File("marine-guard-events.csv"));
        if (chooser.showSaveDialog(this) != JFileChooser.APPROVE_OPTION) return;
        try (BufferedWriter writer = new BufferedWriter(new FileWriter(chooser.getSelectedFile()))) {
            writer.write("time,device_name,status,location_relative_to_receiver,satellite_coordinates"); writer.newLine();
            for (EventEntry entry : eventEntries) { writer.write(entry.formatCsvRow()); writer.newLine(); }
            appendEvent(EventEntry.Level.INFO, "Event log exported: " + chooser.getSelectedFile().getAbsolutePath());
        } catch (IOException ex) { JOptionPane.showMessageDialog(this, "Export failed: " + ex.getMessage(), "Export", JOptionPane.ERROR_MESSAGE); }
    }

    private void toggleFullscreen() { fullscreen = !fullscreen; setExtendedState(fullscreen ? JFrame.MAXIMIZED_BOTH : JFrame.NORMAL); }

    private void assignGuestToSelectedDevice() {
        DeviceTelemetry selected = devices.get(selectedDeviceId);
        if (selected == null) { JOptionPane.showMessageDialog(this, "Select a device first.", "No device", JOptionPane.WARNING_MESSAGE); return; }
        String next = JOptionPane.showInputDialog(this, "Assign guest name to D" + selected.getDeviceId(), selected.getGuestName());
        if (next == null) return;
        DeviceTelemetry updated = new DeviceTelemetry(selected.getDeviceId(), selected.getLatitude(), selected.getLongitude(), selected.getEmergency(), selected.getFinger(), selected.getBpm(), selected.getBattery(), next.trim(), selected.getPpgValue(), selected.hasRawPpg(), selected.getReceivedAt());
        devices.put(updated.getDeviceId(), updated); refreshDeviceList(); selectDevice(updated.getDeviceId(), true); appendEvent(EventEntry.Level.INFO, "Assigned guest " + (updated.getGuestName().isEmpty() ? "(unassigned)" : updated.getGuestName()) + " to D" + updated.getDeviceId());
    }

    private void refreshDeviceList() {
        List<DeviceTelemetry> sorted = new ArrayList<DeviceTelemetry>(devices.values());
        sorted.sort(Comparator.comparingInt(this::severityScore).reversed().thenComparingInt(DeviceTelemetry::getDeviceId));
        deviceListModel.clear(); for (DeviceTelemetry t : sorted) deviceListModel.addElement(t); restoreSelectedDeviceSelection();
    }

    private int severityScore(DeviceTelemetry t) {
        long now = System.currentTimeMillis();
        if (t.getEmergency() > 0) return 5;
        if (t.getFinger() > 0 && (t.getBpm() > 120 || (t.getBpm() > 0 && t.getBpm() < 40))) return 4;
        if (t.getFinger() == 0) return 3;
        if (t.isStale(now)) return 2;
        return 0;
    }

    private void restoreSelectedDeviceSelection() {
        if (selectedDeviceId < 0) return;
        for (int i = 0; i < deviceListModel.size(); i++) if (deviceListModel.get(i).getDeviceId() == selectedDeviceId) { deviceList.setSelectedIndex(i); deviceList.ensureIndexIsVisible(i); return; }
    }

    private void selectDevice(int deviceId, boolean updateListSelection) {
        DeviceTelemetry telemetry = devices.get(deviceId); if (telemetry == null) return;
        selectedDeviceId = deviceId; if (updateListSelection) restoreSelectedDeviceSelection();
        refreshSelectedPanels(); mapCanvas.setDevices(devices.values(), selectedDeviceId); ppgMonitorFrame.setSelectedDevice(telemetry);
    }

    private void refreshSelectedPanels() {
        DeviceTelemetry selected = devices.get(selectedDeviceId);
        if (selected == null) { selectedTitleLabel.setText("No device selected"); selectedGuestLabel.setText("-"); selectedMetaLabel.setText("-"); ppgSummaryLabel.setText("min -- / max -- / avg --"); receiverRefLabel.setText(referenceText()); vitalsGauge.setTelemetry(null); ppgChart.setSamples(new ArrayList<PpgSample>(), false); return; }
        selectedTitleLabel.setText("Device D" + selected.getDeviceId());
        selectedGuestLabel.setText(selected.getGuestName().isEmpty() ? "(unassigned)" : selected.getGuestName());
        selectedMetaLabel.setText(selected.getFinger() == 0 ? "No contact | " + selected.getStatusText(System.currentTimeMillis()) : "BPM " + selected.getBpm() + " | " + selected.getStatusText(System.currentTimeMillis()));
        receiverRefLabel.setText(referenceText()); vitalsGauge.setTelemetry(selected);
        List<PpgSample> samples = samplesForDevice(selectedDeviceId); boolean raw = hasRawPpg(samples); ppgChart.setSamples(samples, raw); ppgSummaryLabel.setText(buildPpgSummary(samples, raw));
    }

    private String referenceText() { return config.isAutoReceiverLocation() && lastReceiverLocation != null ? String.format("Receiver ref auto %.6f, %.6f", lastReceiverLocation.getLatitude(), lastReceiverLocation.getLongitude()) : String.format("Receiver ref %.6f, %.6f", config.getRefLat(), config.getRefLon()); }
    private List<PpgSample> samplesForDevice(int id) { Deque<PpgSample> h = ppgHistory.get(id); return h == null ? new ArrayList<PpgSample>() : new ArrayList<PpgSample>(h); }
    private boolean hasRawPpg(List<PpgSample> s) { for (PpgSample p : s) if (p.hasContact() && p.hasRawPpg()) return true; return false; }
    private String buildPpgSummary(List<PpgSample> s, boolean raw) { if (s.isEmpty()) return "min -- / max -- / avg --"; int min = Integer.MAX_VALUE, max = Integer.MIN_VALUE; long sum = 0; int count = 0; for (PpgSample p : s) { if (!p.hasContact()) continue; int v = raw && p.hasRawPpg() ? p.getPpgValue() : p.getBpm(); min = Math.min(min, v); max = Math.max(max, v); sum += v; count++; } return count == 0 ? "no contact" : "min " + min + " / max " + max + " / avg " + (sum / count); }

    private void rememberPpgSample(DeviceTelemetry telemetry) {
        Deque<PpgSample> h = ppgHistory.get(telemetry.getDeviceId()); if (h == null) { h = new ArrayDeque<PpgSample>(); ppgHistory.put(telemetry.getDeviceId(), h); }
        h.addLast(new PpgSample(telemetry.getReceivedAt(), telemetry.getBpm(), telemetry.getPpgValue(), telemetry.hasRawPpg(), telemetry.getFinger() > 0)); long cutoff = telemetry.getReceivedAt() - 60000L; while (!h.isEmpty() && h.peekFirst().getTimestamp() < cutoff) h.removeFirst();
    }

    private void updateHeaderStatus() {
        boolean connected = serialService.isConnected(); long now = System.currentTimeMillis(); int online = 0;
        for (DeviceTelemetry d : devices.values()) { if (!d.isStale(now)) online++; }
        if (connected && now - lastTelemetryAt <= 15000L) { statusLabel.setForeground(AppTheme.SUCCESS); statusLabel.setText("CONNECTED " + serialService.getConnectedPortName()); }
        else if (connected) { statusLabel.setForeground(AppTheme.WARNING); statusLabel.setText("CONNECTED " + serialService.getConnectedPortName() + " | waiting"); }
        else { statusLabel.setForeground(AppTheme.DANGER); statusLabel.setText("DISCONNECTED"); }
        summaryLabel.setText(online + " devices online"); connectButton.setEnabled(!connected); disconnectButton.setEnabled(connected);
    }

    private void refreshReceiverReferenceLabel() { receiverRefLabel.setText(referenceText()); }
    private void appendEvent(EventEntry.Level level, String message) { eventEntries.add(new EventEntry(System.currentTimeMillis(), level, message)); while (eventEntries.size() > 500) eventEntries.remove(0); refreshEventLog(); }
    private void appendTelemetryEvent(DeviceTelemetry telemetry, EventEntry.Level level, String message) {
        String deviceName = telemetry.getGuestName().isEmpty() ? "D" + telemetry.getDeviceId() : telemetry.getGuestName();
        String status = telemetry.getEmergency() > 0 ? "EMERGENCY" : telemetry.getStatusText(System.currentTimeMillis());
        double distanceMeters = ReceiverLocation.calculateDistance(config.getRefLat(), config.getRefLon(), telemetry.getLatitude(), telemetry.getLongitude());
        boolean gpsWeak = !ReceiverLocation.hasGpsFix(config.getRefLat(), config.getRefLon())
                || !ReceiverLocation.hasGpsFix(telemetry.getLatitude(), telemetry.getLongitude())
                || distanceMeters > 1000000.0d;
        String relativeLocation = gpsWeak ? "GPS No Fix" : String.format("%.0fm", distanceMeters);
        String coordinates = String.format("%.6f, %.6f", telemetry.getLatitude(), telemetry.getLongitude());
        eventEntries.add(new EventEntry(System.currentTimeMillis(), level, message, deviceName, status, relativeLocation, coordinates));
        while (eventEntries.size() > 500) eventEntries.remove(0);
        refreshEventLog();
    }
    private void refreshEventLog() { StringBuilder b = new StringBuilder(); for (EventEntry e : eventEntries) if (allFilterButton.isSelected() || warningFilterButton.isSelected() && e.getLevel() == EventEntry.Level.WARNING || emergencyFilterButton.isSelected() && e.getLevel() == EventEntry.Level.EMERGENCY) b.append(e.formatLine()).append('\n'); eventLogArea.setText(b.toString()); eventLogArea.setCaretPosition(eventLogArea.getDocument().getLength()); }
    private EventEntry.Level classify(DeviceTelemetry telemetry) {
        long now = System.currentTimeMillis();
        double distanceMeters = ReceiverLocation.calculateDistance(config.getRefLat(), config.getRefLon(), telemetry.getLatitude(), telemetry.getLongitude());
        boolean gpsWeak = !ReceiverLocation.hasGpsFix(config.getRefLat(), config.getRefLon())
                || !ReceiverLocation.hasGpsFix(telemetry.getLatitude(), telemetry.getLongitude())
                || distanceMeters > 1000000.0d;
        if (telemetry.getEmergency() > 0) return EventEntry.Level.EMERGENCY;
        if (telemetry.isStale(now)
                || telemetry.getFinger() == 0
                || telemetry.getFinger() > 0 && telemetry.getBpm() > 120
                || telemetry.getFinger() > 0 && telemetry.getBpm() > 0 && telemetry.getBpm() < 40
                || gpsWeak) return EventEntry.Level.WARNING;
        return EventEntry.Level.INFO;
    }
    private String describe(DeviceTelemetry telemetry) {
        String guest = telemetry.getGuestName().isEmpty() ? "Unassigned guest" : telemetry.getGuestName();
        double distanceMeters = ReceiverLocation.calculateDistance(config.getRefLat(), config.getRefLon(), telemetry.getLatitude(), telemetry.getLongitude());
        boolean gpsWeak = !ReceiverLocation.hasGpsFix(config.getRefLat(), config.getRefLon())
                || !ReceiverLocation.hasGpsFix(telemetry.getLatitude(), telemetry.getLongitude())
                || distanceMeters > 1000000.0d;

        String distanceText = gpsWeak ? "GPS No Fix" : String.format("%.0fm", distanceMeters);
        String status = telemetry.getEmergency() > 0 ? "EMERGENCY" : telemetry.getStatusText(System.currentTimeMillis());

        StringBuilder warning = new StringBuilder();
        if (gpsWeak) {
            warning.append(" (GPS signal weak)");
        }

        return guest + " - " + (telemetry.getFinger() == 0 ? "No contact" : "BPM " + telemetry.getBpm())
                + ", " + distanceText
                + ", " + status
                + warning;
    }
    private void persistConfig() { try { config.save(); } catch (IOException ex) { appendEvent(EventEntry.Level.WARNING, "Config save failed: " + ex.getMessage()); } }
    private void styleButton(JButton b) { b.setBackground(AppTheme.PANEL_ALT); b.setForeground(AppTheme.TEXT); b.setFocusPainted(false); }
    private void styleToggle(JToggleButton b) { b.setBackground(AppTheme.PANEL_ALT); b.setForeground(AppTheme.TEXT); b.setFocusPainted(false); }
    private void styleCombo(JComboBox<String> c) { c.setBackground(AppTheme.PANEL_ALT); c.setForeground(AppTheme.TEXT); }
    private void styleField(JTextField f) { f.setBackground(AppTheme.PANEL_ALT); f.setForeground(AppTheme.TEXT); f.setCaretColor(AppTheme.TEXT); }
    private void styleInfo(JLabel l, float size, boolean bold) { l.setForeground(AppTheme.TEXT); l.setFont(l.getFont().deriveFont(bold ? Font.BOLD : Font.PLAIN, size)); }
    private void openPpgMonitor() { ppgMonitorFrame.setSelectedDevice(devices.get(selectedDeviceId)); ppgMonitorFrame.setLocationRelativeTo(this); ppgMonitorFrame.setVisible(true); ppgMonitorFrame.toFront(); }

    @Override public void onConnected(String portName) { disconnectWarningShown = false; appendEvent(EventEntry.Level.INFO, "Receiver connected on " + portName); updateHeaderStatus(); }
    @Override public void onDisconnected(String reason) { appendEvent(EventEntry.Level.WARNING, "Receiver disconnected: " + reason); updateHeaderStatus(); if (!"user request".equals(reason) && !"window closing".equals(reason) && !"reconnect".equals(reason) && !disconnectWarningShown) { disconnectWarningShown = true; SwingUtilities.invokeLater(() -> JOptionPane.showMessageDialog(this, "Receiver link dropped.\nReason: " + reason, "Disconnected", JOptionPane.WARNING_MESSAGE)); } }
    @Override public void onTelemetry(DeviceTelemetry telemetry, String rawLine) { lastTelemetryAt = telemetry.getReceivedAt(); DeviceTelemetry prev = devices.get(telemetry.getDeviceId()); if (prev != null) telemetry = new DeviceTelemetry(telemetry.getDeviceId(), telemetry.getLatitude(), telemetry.getLongitude(), telemetry.getEmergency(), telemetry.getFinger(), telemetry.getBpm(), telemetry.getBattery() >= 0 ? telemetry.getBattery() : prev.getBattery(), telemetry.getGuestName().isEmpty() ? prev.getGuestName() : telemetry.getGuestName(), telemetry.getPpgValue(), telemetry.hasRawPpg(), telemetry.getReceivedAt()); devices.put(telemetry.getDeviceId(), telemetry); rememberPpgSample(telemetry); refreshDeviceList(); if (selectedDeviceId < 0 || !devices.containsKey(selectedDeviceId)) selectedDeviceId = telemetry.getDeviceId(); selectDevice(selectedDeviceId, true); mapCanvas.setDevices(devices.values(), selectedDeviceId); ppgMonitorFrame.addTelemetry(telemetry); EventEntry.Level level = classify(telemetry); String message = describe(telemetry); appendTelemetryEvent(telemetry, level, message); updateHeaderStatus(); }
    @Override public void onReceiverLocation(ReceiverLocation r, String rawLine) { lastReceiverLocation = r; appendEvent(EventEntry.Level.INFO, "Receiver GPS updated: " + r.getSource()); if (config.isAutoReceiverLocation()) { config.setRefLat(r.getLatitude()); config.setRefLon(r.getLongitude()); refLatField.setText(String.valueOf(r.getLatitude())); refLonField.setText(String.valueOf(r.getLongitude())); mapCanvas.setReferencePoint(r.getLatitude(), r.getLongitude()); persistConfig(); } refreshReceiverReferenceLabel(); }
    @Override public void onMessage(String message) { appendEvent(EventEntry.Level.INFO, message); }
}
