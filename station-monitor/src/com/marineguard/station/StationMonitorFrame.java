package com.marineguard.station;

import jssc.SerialPortException;

import javax.swing.BorderFactory;
import javax.swing.DefaultComboBoxModel;
import javax.swing.JButton;
import javax.swing.JComboBox;
import javax.swing.JFrame;
import javax.swing.JLabel;
import javax.swing.JOptionPane;
import javax.swing.JPanel;
import javax.swing.JScrollPane;
import javax.swing.JSplitPane;
import javax.swing.JTable;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.ListSelectionModel;
import javax.swing.SwingConstants;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Component;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

public class StationMonitorFrame extends JFrame implements SerialReceiverService.Listener {
    private final AppConfig config;
    private final SerialReceiverService serialService;
    private final Map<Integer, DeviceTelemetry> devices = new LinkedHashMap<Integer, DeviceTelemetry>();
    private final Map<Integer, Deque<PpgSample>> ppgHistoryByDevice = new HashMap<Integer, Deque<PpgSample>>();
    private final DeviceTableModel tableModel = new DeviceTableModel();

    private final JLabel bannerLabel = new JLabel("Receiver waiting for data", SwingConstants.LEFT);
    private final JLabel footerStatusLabel = new JLabel("Link status: idle");
    private final JComboBox<String> portComboBox = new JComboBox<String>();
    private final JComboBox<String> baudComboBox = new JComboBox<String>(new String[]{"9600", "57600", "115200"});
    private final JComboBox<String> locationModeComboBox = new JComboBox<String>(new String[]{"Manual", "Auto receiver GPS"});
    private final JTextField refLatField = new JTextField(10);
    private final JTextField refLonField = new JTextField(10);
    private final JButton connectButton = new JButton("Connect");
    private final JButton disconnectButton = new JButton("Disconnect");
    private final JButton ppgMonitorButton = new JButton("PPG Monitor");
    private final JTable deviceTable = new JTable(tableModel);
    private final JTextArea logArea = new JTextArea();
    private final JLabel detailTitle = new JLabel("No device selected");
    private final JLabel detailVitals = new JLabel("-");
    private final JLabel detailCoords = new JLabel("-");
    private final JLabel detailState = new JLabel("-");
    private final JLabel receiverSourceLabel = new JLabel("Receiver ref: manual");
    private final JLabel receiverCoordsLabel = new JLabel("-");
    private final JLabel ppgPreviewTitleLabel = new JLabel("No device selected");
    private final JLabel ppgPreviewBpmLabel = new JLabel("--");
    private final JLabel ppgPreviewRawLabel = new JLabel("--");
    private final JLabel ppgPreviewModeLabel = new JLabel("Graph: BPM trend");
    private final JLabel ppgPreviewStatsLabel = new JLabel("min -- / max -- / avg --");
    private final PpgChartPanel ppgPreviewChart = new PpgChartPanel();
    private final MapCanvas mapCanvas;
    private final PpgMonitorFrame ppgMonitorFrame = new PpgMonitorFrame();

    private long lastTelemetryAt = 0L;
    private int selectedDeviceId = -1;
    private boolean disconnectWarningShown = false;
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
        startHeartbeat();
        applyLocationMode();
        refreshReceiverReferenceLabels();
    }

    private void configureUi() {
        setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
        setMinimumSize(new Dimension(1360, 860));
        getContentPane().setLayout(new BorderLayout(12, 12));
        getContentPane().setBackground(new Color(241, 245, 249));

        bannerLabel.setOpaque(true);
        bannerLabel.setBackground(new Color(230, 238, 247));
        bannerLabel.setForeground(new Color(18, 52, 86));
        bannerLabel.setBorder(BorderFactory.createEmptyBorder(14, 18, 14, 18));
        bannerLabel.setFont(bannerLabel.getFont().deriveFont(Font.BOLD, 18f));
        getContentPane().add(bannerLabel, BorderLayout.NORTH);

        getContentPane().add(createControlPanel(), BorderLayout.SOUTH);
        getContentPane().add(createMainPanel(), BorderLayout.CENTER);
    }

    private JPanel createMainPanel() {
        JPanel mainPanel = new JPanel(new BorderLayout(12, 12));
        mainPanel.setOpaque(false);

        deviceTable.setSelectionMode(ListSelectionModel.SINGLE_SELECTION);
        deviceTable.setRowHeight(28);
        JScrollPane tableScroll = new JScrollPane(deviceTable);
        tableScroll.setBorder(BorderFactory.createTitledBorder("Devices"));

        JPanel rightPanel = new JPanel(new BorderLayout(12, 12));
        rightPanel.setOpaque(false);
        JPanel topPanel = new JPanel(new BorderLayout(12, 12));
        topPanel.setOpaque(false);
        topPanel.add(createDetailPanel(), BorderLayout.NORTH);
        topPanel.add(createPpgPreviewPanel(), BorderLayout.CENTER);
        rightPanel.add(topPanel, BorderLayout.NORTH);

        JScrollPane mapScroll = new JScrollPane(mapCanvas);
        mapScroll.setBorder(BorderFactory.createTitledBorder("Relative map"));
        mapCanvas.setPreferredSize(new Dimension(720, 480));
        rightPanel.add(mapScroll, BorderLayout.CENTER);

        logArea.setEditable(false);
        logArea.setLineWrap(true);
        logArea.setWrapStyleWord(true);
        JScrollPane logScroll = new JScrollPane(logArea);
        logScroll.setPreferredSize(new Dimension(720, 170));
        logScroll.setBorder(BorderFactory.createTitledBorder("Event log"));
        rightPanel.add(logScroll, BorderLayout.SOUTH);

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, tableScroll, rightPanel);
        splitPane.setResizeWeight(0.42d);
        splitPane.setBorder(null);
        mainPanel.add(splitPane, BorderLayout.CENTER);
        return mainPanel;
    }

    private JPanel createDetailPanel() {
        JPanel panel = new JPanel(new GridLayout(1, 4, 10, 10));
        panel.setOpaque(false);
        panel.add(createStatCard("Selected device", detailTitle));
        panel.add(createStatCard("Vitals", detailVitals));
        panel.add(createStatCard("Coords / status", createTwoLinePanel(detailCoords, detailState)));
        panel.add(createStatCard("Receiver reference", createTwoLinePanel(receiverSourceLabel, receiverCoordsLabel)));
        return panel;
    }

    private JPanel createPpgPreviewPanel() {
        JPanel panel = new JPanel(new BorderLayout(10, 10));
        panel.setOpaque(false);
        panel.setPreferredSize(new Dimension(0, 260));

        JPanel statsGrid = new JPanel(new GridLayout(1, 4, 10, 10));
        statsGrid.setOpaque(false);
        statsGrid.add(createStatCard("PPG target", ppgPreviewTitleLabel));
        statsGrid.add(createStatCard("Current BPM", ppgPreviewBpmLabel));
        statsGrid.add(createStatCard("Current raw PPG", ppgPreviewRawLabel));
        statsGrid.add(createStatCard("PPG summary", createTwoLinePanel(ppgPreviewModeLabel, ppgPreviewStatsLabel)));

        ppgPreviewChart.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(221, 229, 239)),
                BorderFactory.createEmptyBorder(8, 8, 8, 8)
        ));
        ppgPreviewChart.setPreferredSize(new Dimension(0, 170));

        panel.add(statsGrid, BorderLayout.NORTH);
        panel.add(ppgPreviewChart, BorderLayout.CENTER);
        return panel;
    }

    private JPanel createStatCard(String title, Component body) {
        JPanel card = new JPanel(new BorderLayout(6, 6));
        card.setBackground(Color.WHITE);
        card.setBorder(BorderFactory.createCompoundBorder(
                BorderFactory.createLineBorder(new Color(221, 229, 239)),
                BorderFactory.createEmptyBorder(14, 14, 14, 14)
        ));

        JLabel titleLabel = new JLabel(title);
        titleLabel.setFont(titleLabel.getFont().deriveFont(Font.BOLD, 14f));
        card.add(titleLabel, BorderLayout.NORTH);
        card.add(body, BorderLayout.CENTER);
        return card;
    }

    private JPanel createTwoLinePanel(JLabel first, JLabel second) {
        JPanel panel = new JPanel(new GridLayout(2, 1, 0, 6));
        panel.setOpaque(false);
        panel.add(first);
        panel.add(second);
        return panel;
    }

    private JPanel createControlPanel() {
        JPanel container = new JPanel(new BorderLayout());
        container.setOpaque(false);

        JPanel controls = new JPanel(new FlowLayout(FlowLayout.LEFT, 8, 8));
        controls.setOpaque(false);

        controls.add(new JLabel("COM"));
        portComboBox.setPreferredSize(new Dimension(130, 30));
        controls.add(portComboBox);

        JButton refreshButton = new JButton("Refresh");
        refreshButton.addActionListener(event -> refreshPorts());
        controls.add(refreshButton);

        controls.add(new JLabel("Baud"));
        baudComboBox.setEditable(true);
        baudComboBox.setPreferredSize(new Dimension(100, 30));
        controls.add(baudComboBox);

        controls.add(new JLabel("Ref mode"));
        locationModeComboBox.setPreferredSize(new Dimension(150, 30));
        controls.add(locationModeComboBox);

        controls.add(new JLabel("Ref lat"));
        controls.add(refLatField);

        controls.add(new JLabel("Ref lon"));
        controls.add(refLonField);

        connectButton.addActionListener(event -> connect());
        disconnectButton.addActionListener(event -> disconnect("user request"));
        disconnectButton.setEnabled(false);
        ppgMonitorButton.addActionListener(event -> openPpgMonitor());
        controls.add(connectButton);
        controls.add(disconnectButton);
        controls.add(ppgMonitorButton);

        footerStatusLabel.setBorder(BorderFactory.createEmptyBorder(0, 10, 0, 10));

        container.add(controls, BorderLayout.CENTER);
        container.add(footerStatusLabel, BorderLayout.WEST);
        return container;
    }

    private void loadInitialValues() {
        refLatField.setText(String.valueOf(config.getRefLat()));
        refLonField.setText(String.valueOf(config.getRefLon()));
        baudComboBox.setSelectedItem(String.valueOf(config.getBaudRate()));
        locationModeComboBox.setSelectedIndex(config.isAutoReceiverLocation() ? 1 : 0);
    }

    private void attachListeners() {
        deviceTable.getSelectionModel().addListSelectionListener(event -> {
            if (event.getValueIsAdjusting()) {
                return;
            }
            int row = deviceTable.getSelectedRow();
            if (row < 0) {
                return;
            }
            DeviceTelemetry device = tableModel.getDeviceAt(row);
            if (device == null) {
                return;
            }
            selectedDeviceId = device.getDeviceId();
            refreshDetailPanel();
            refreshMap();
            refreshPpgPreview();
            ppgMonitorFrame.setSelectedDevice(device);
        });

        locationModeComboBox.addActionListener(event -> {
            config.setAutoReceiverLocation(isAutoReceiverLocationEnabled());
            applyLocationMode();
            persistConfig();
            refreshReceiverReferenceLabels();
        });

        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent event) {
                disconnect("window closing");
                persistConfig();
                dispose();
            }
        });
    }

    private void startHeartbeat() {
        Timer timer = new Timer(1000, event -> refreshConnectionStatus());
        timer.start();
    }

    private boolean isAutoReceiverLocationEnabled() {
        return locationModeComboBox.getSelectedIndex() == 1;
    }

    private void applyLocationMode() {
        boolean autoMode = isAutoReceiverLocationEnabled();
        refLatField.setEnabled(!autoMode);
        refLonField.setEnabled(!autoMode);
    }

    private void refreshPorts() {
        String current = String.valueOf(portComboBox.getSelectedItem());
        String[] ports = SerialReceiverService.listPorts();
        portComboBox.setModel(new DefaultComboBoxModel<String>(ports));

        if (config.getPortName() != null && !config.getPortName().isEmpty()) {
            portComboBox.setSelectedItem(config.getPortName());
        } else if (current != null) {
            portComboBox.setSelectedItem(current);
        }

        if (portComboBox.getSelectedItem() == null && ports.length > 0) {
            portComboBox.setSelectedIndex(0);
        }
    }

    private void connect() {
        String portName = String.valueOf(portComboBox.getSelectedItem());
        if (portName == null || portName.trim().isEmpty() || "null".equals(portName)) {
            JOptionPane.showMessageDialog(this, "Select a COM port first.", "No port", JOptionPane.WARNING_MESSAGE);
            return;
        }

        int baudRate;
        try {
            baudRate = Integer.parseInt(String.valueOf(baudComboBox.getSelectedItem()).trim());
            if (!isAutoReceiverLocationEnabled()) {
                double refLat = Double.parseDouble(refLatField.getText().trim());
                double refLon = Double.parseDouble(refLonField.getText().trim());
                config.setRefLat(refLat);
                config.setRefLon(refLon);
                mapCanvas.setReferencePoint(refLat, refLon);
            }
        } catch (NumberFormatException ex) {
            JOptionPane.showMessageDialog(this, "Invalid baud rate or reference coordinates.", "Input error", JOptionPane.ERROR_MESSAGE);
            return;
        }

        config.setPortName(portName);
        config.setBaudRate(baudRate);
        config.setAutoReceiverLocation(isAutoReceiverLocationEnabled());
        persistConfig();

        try {
            serialService.connect(portName, baudRate);
            appendLog("Connected to " + portName + " @ " + baudRate);
            if (isAutoReceiverLocationEnabled()) {
                appendLog("Waiting for receiver GPS lines to update reference point.");
            }
        } catch (SerialPortException ex) {
            JOptionPane.showMessageDialog(this, "Serial connect failed: " + ex.getMessage(), "Connect failed", JOptionPane.ERROR_MESSAGE);
            appendLog("Connect failed: " + ex.getMessage());
        }
    }

    private void disconnect(String reason) {
        serialService.disconnect(reason);
    }

    private void persistConfig() {
        try {
            config.save();
        } catch (IOException ex) {
            appendLog("Config save failed: " + ex.getMessage());
        }
    }

    private void refreshConnectionStatus() {
        long now = System.currentTimeMillis();
        boolean recentData = now - lastTelemetryAt <= 15000L;

        if (serialService.isConnected() && recentData) {
            disconnectWarningShown = false;
            bannerLabel.setText("Receiver connected: " + serialService.getConnectedPortName() + " / live telemetry");
            bannerLabel.setBackground(new Color(220, 252, 231));
            bannerLabel.setForeground(new Color(22, 101, 52));
            footerStatusLabel.setText("Link status: live");
        } else if (serialService.isConnected()) {
            bannerLabel.setText("Receiver connected: " + serialService.getConnectedPortName() + " / waiting for telemetry");
            bannerLabel.setBackground(new Color(254, 249, 195));
            bannerLabel.setForeground(new Color(133, 77, 14));
            footerStatusLabel.setText("Link status: port open, no telemetry");
        } else {
            bannerLabel.setText("Receiver waiting for data");
            bannerLabel.setBackground(new Color(230, 238, 247));
            bannerLabel.setForeground(new Color(18, 52, 86));
            footerStatusLabel.setText("Link status: idle");
        }

        tableModel.fireTableDataChanged();
        refreshDetailPanel();
        refreshMap();
        refreshReceiverReferenceLabels();
    }

    private void refreshDetailPanel() {
        DeviceTelemetry selected = devices.get(selectedDeviceId);
        if (selected == null) {
            detailTitle.setText("No device selected");
            detailVitals.setText("-");
            detailCoords.setText("-");
            detailState.setText("-");
            return;
        }

        detailTitle.setText("D" + selected.getDeviceId() + formatGuest(selected.getGuestName()));
        detailVitals.setText("BPM " + selected.getBpm() + " / Battery " + (selected.getBattery() >= 0 ? selected.getBattery() + "%" : "-"));
        detailCoords.setText(String.format("%.6f, %.6f", selected.getLatitude(), selected.getLongitude()));
        detailState.setText("State " + selected.getStatusText(System.currentTimeMillis()) + " / EMG " + selected.getEmergency() + " / Finger " + selected.getFinger());
    }

    private void refreshReceiverReferenceLabels() {
        if (isAutoReceiverLocationEnabled()) {
            if (lastReceiverLocation == null) {
                receiverSourceLabel.setText("Receiver ref: auto / waiting");
                receiverCoordsLabel.setText(String.format("Fallback %.6f, %.6f", config.getRefLat(), config.getRefLon()));
            } else {
                String source = lastReceiverLocation.getSource().isEmpty() ? "auto" : lastReceiverLocation.getSource();
                receiverSourceLabel.setText("Receiver ref: auto / " + source);
                receiverCoordsLabel.setText(String.format("%.6f, %.6f", lastReceiverLocation.getLatitude(), lastReceiverLocation.getLongitude()));
            }
        } else {
            receiverSourceLabel.setText("Receiver ref: manual");
            receiverCoordsLabel.setText(String.format("%.6f, %.6f", config.getRefLat(), config.getRefLon()));
        }
    }

    private String formatGuest(String guestName) {
        return guestName == null || guestName.isEmpty() ? "" : " (" + guestName + ")";
    }

    private void refreshMap() {
        mapCanvas.setDevices(devices.values(), selectedDeviceId);
    }

    private void rememberPpgSample(DeviceTelemetry telemetry) {
        Deque<PpgSample> history = ppgHistoryByDevice.get(telemetry.getDeviceId());
        if (history == null) {
            history = new ArrayDeque<PpgSample>();
            ppgHistoryByDevice.put(telemetry.getDeviceId(), history);
        }
        history.addLast(new PpgSample(telemetry.getReceivedAt(), telemetry.getBpm(), telemetry.getPpgValue()));
        long cutoff = telemetry.getReceivedAt() - 60000L;
        while (!history.isEmpty() && history.peekFirst().getTimestamp() < cutoff) {
            history.removeFirst();
        }
    }

    private void restoreSelectedDeviceRow() {
        if (selectedDeviceId < 0) {
            return;
        }
        for (int row = 0; row < tableModel.getRowCount(); row++) {
            DeviceTelemetry device = tableModel.getDeviceAt(row);
            if (device != null && device.getDeviceId() == selectedDeviceId) {
                deviceTable.getSelectionModel().setSelectionInterval(row, row);
                deviceTable.scrollRectToVisible(deviceTable.getCellRect(row, 0, true));
                return;
            }
        }
    }

    private void refreshPpgPreview() {
        DeviceTelemetry selected = devices.get(selectedDeviceId);
        if (selected == null) {
            ppgPreviewTitleLabel.setText("No device selected");
            ppgPreviewBpmLabel.setText("--");
            ppgPreviewRawLabel.setText("--");
            ppgPreviewModeLabel.setText("Graph: BPM trend");
            ppgPreviewStatsLabel.setText("min -- / max -- / avg --");
            ppgPreviewChart.setSamples(new ArrayList<PpgSample>(), false);
            return;
        }

        String suffix = selected.getGuestName().isEmpty() ? "" : " (" + selected.getGuestName() + ")";
        ppgPreviewTitleLabel.setText("D" + selected.getDeviceId() + suffix);

        Deque<PpgSample> history = ppgHistoryByDevice.get(selectedDeviceId);
        List<PpgSample> samples = history == null ? new ArrayList<PpgSample>() : new ArrayList<PpgSample>(history);
        boolean showRawPpg = hasRawPpg(samples);

        ppgPreviewBpmLabel.setText(selected.getBpm() + " bpm");
        ppgPreviewRawLabel.setText(selected.getPpgValue() >= 0 ? String.valueOf(selected.getPpgValue()) : "n/a");
        ppgPreviewModeLabel.setText(showRawPpg ? "Graph: raw PPG" : "Graph: BPM trend");

        if (samples.isEmpty()) {
            ppgPreviewStatsLabel.setText("min -- / max -- / avg --");
            ppgPreviewChart.setSamples(samples, showRawPpg);
            return;
        }

        int min = Integer.MAX_VALUE;
        int max = Integer.MIN_VALUE;
        long sum = 0L;
        int count = 0;
        for (PpgSample sample : samples) {
            int value = showRawPpg && sample.getPpgValue() >= 0 ? sample.getPpgValue() : sample.getBpm();
            min = Math.min(min, value);
            max = Math.max(max, value);
            sum += value;
            count++;
        }
        ppgPreviewStatsLabel.setText("min " + min + " / max " + max + " / avg " + (count == 0 ? "--" : sum / count));
        ppgPreviewChart.setSamples(samples, showRawPpg);
    }

    private boolean hasRawPpg(List<PpgSample> samples) {
        for (PpgSample sample : samples) {
            if (sample.getPpgValue() >= 0) {
                return true;
            }
        }
        return false;
    }

    private void openPpgMonitor() {
        DeviceTelemetry selected = devices.get(selectedDeviceId);
        ppgMonitorFrame.setSelectedDevice(selected);
        ppgMonitorFrame.setLocationRelativeTo(this);
        ppgMonitorFrame.setVisible(true);
        ppgMonitorFrame.toFront();
    }

    private void appendLog(String message) {
        logArea.append(message + "\n");
        logArea.setCaretPosition(logArea.getDocument().getLength());
    }

    @Override
    public void onConnected(String portName) {
        connectButton.setEnabled(false);
        disconnectButton.setEnabled(true);
        appendLog("Receiver connected on " + portName);
        refreshConnectionStatus();
    }

    @Override
    public void onDisconnected(String reason) {
        connectButton.setEnabled(true);
        disconnectButton.setEnabled(false);
        appendLog("Receiver disconnected: " + reason);
        refreshConnectionStatus();

        if (!"user request".equals(reason) && !"window closing".equals(reason) && !"reconnect".equals(reason) && !disconnectWarningShown) {
            disconnectWarningShown = true;
            SwingUtilities.invokeLater(() ->
                JOptionPane.showMessageDialog(
                    this,
                    "Receiver link dropped.\nReason: " + reason,
                    "Disconnected",
                    JOptionPane.WARNING_MESSAGE
                )
            );
        }
    }

    @Override
    public void onTelemetry(DeviceTelemetry telemetry, String rawLine) {
        lastTelemetryAt = telemetry.getReceivedAt();
        DeviceTelemetry previous = devices.get(telemetry.getDeviceId());
        if (previous != null) {
            telemetry = new DeviceTelemetry(
                telemetry.getDeviceId(),
                telemetry.getLatitude(),
                telemetry.getLongitude(),
                telemetry.getEmergency(),
                telemetry.getFinger(),
                telemetry.getBpm(),
                telemetry.getBattery() >= 0 ? telemetry.getBattery() : previous.getBattery(),
                telemetry.getGuestName().isEmpty() ? previous.getGuestName() : telemetry.getGuestName(),
                telemetry.getPpgValue() >= 0 ? telemetry.getPpgValue() : previous.getPpgValue(),
                telemetry.getReceivedAt()
            );
        }
        devices.put(telemetry.getDeviceId(), telemetry);
        rememberPpgSample(telemetry);
        tableModel.setDevices(devices);
        restoreSelectedDeviceRow();
        appendLog("RX " + rawLine);
        ppgMonitorFrame.addTelemetry(telemetry);

        if (selectedDeviceId == -1) {
            selectedDeviceId = telemetry.getDeviceId();
            deviceTable.getSelectionModel().setSelectionInterval(0, 0);
        }

        refreshDetailPanel();
        refreshMap();
        refreshPpgPreview();
        ppgMonitorFrame.setSelectedDevice(devices.get(selectedDeviceId));
        refreshConnectionStatus();
    }

    @Override
    public void onReceiverLocation(ReceiverLocation receiverLocation, String rawLine) {
        lastReceiverLocation = receiverLocation;
        appendLog("RX-REF " + rawLine);

        if (isAutoReceiverLocationEnabled()) {
            config.setRefLat(receiverLocation.getLatitude());
            config.setRefLon(receiverLocation.getLongitude());
            refLatField.setText(String.valueOf(receiverLocation.getLatitude()));
            refLonField.setText(String.valueOf(receiverLocation.getLongitude()));
            mapCanvas.setReferencePoint(receiverLocation.getLatitude(), receiverLocation.getLongitude());
            persistConfig();
        }

        refreshReceiverReferenceLabels();
        refreshMap();
    }

    @Override
    public void onMessage(String message) {
        appendLog(message);
    }
}
