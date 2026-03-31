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
import javax.swing.UIManager;
import javax.swing.WindowConstants;
import java.awt.BorderLayout;
import java.awt.Color;
import java.awt.Dimension;
import java.awt.FlowLayout;
import java.awt.Font;
import java.awt.GridLayout;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.IOException;
import java.util.LinkedHashMap;
import java.util.Map;

public class StationMonitorFrame extends JFrame implements SerialReceiverService.Listener {
    private final AppConfig config;
    private final SerialReceiverService serialService;
    private final Map<Integer, DeviceTelemetry> devices = new LinkedHashMap<Integer, DeviceTelemetry>();
    private final DeviceTableModel tableModel = new DeviceTableModel();

    private final JLabel bannerLabel = new JLabel("수신기 데이터 대기 중", SwingConstants.LEFT);
    private final JLabel footerStatusLabel = new JLabel("연결 상태: 대기");
    private final JComboBox<String> portComboBox = new JComboBox<String>();
    private final JComboBox<String> baudComboBox = new JComboBox<String>(new String[]{"9600", "57600", "115200"});
    private final JTextField refLatField = new JTextField(10);
    private final JTextField refLonField = new JTextField(10);
    private final JButton connectButton = new JButton("연결");
    private final JButton disconnectButton = new JButton("해제");
    private final JTable deviceTable = new JTable(tableModel);
    private final JTextArea logArea = new JTextArea();
    private final JLabel detailTitle = new JLabel("선택된 디바이스 없음");
    private final JLabel detailVitals = new JLabel("-");
    private final JLabel detailCoords = new JLabel("-");
    private final JLabel detailState = new JLabel("-");
    private final MapCanvas mapCanvas;

    private long lastTelemetryAt = 0L;
    private int selectedDeviceId = -1;
    private boolean disconnectWarningShown = false;

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
        tableScroll.setBorder(BorderFactory.createTitledBorder("디바이스 목록"));

        JPanel rightPanel = new JPanel(new BorderLayout(12, 12));
        rightPanel.setOpaque(false);
        rightPanel.add(createDetailPanel(), BorderLayout.NORTH);

        JScrollPane mapScroll = new JScrollPane(mapCanvas);
        mapScroll.setBorder(BorderFactory.createTitledBorder("상대 위치 맵"));
        mapCanvas.setPreferredSize(new Dimension(720, 480));
        rightPanel.add(mapScroll, BorderLayout.CENTER);

        logArea.setEditable(false);
        logArea.setLineWrap(true);
        logArea.setWrapStyleWord(true);
        JScrollPane logScroll = new JScrollPane(logArea);
        logScroll.setPreferredSize(new Dimension(720, 170));
        logScroll.setBorder(BorderFactory.createTitledBorder("이벤트 로그"));
        rightPanel.add(logScroll, BorderLayout.SOUTH);

        JSplitPane splitPane = new JSplitPane(JSplitPane.HORIZONTAL_SPLIT, tableScroll, rightPanel);
        splitPane.setResizeWeight(0.42d);
        splitPane.setBorder(null);
        mainPanel.add(splitPane, BorderLayout.CENTER);
        return mainPanel;
    }

    private JPanel createDetailPanel() {
        JPanel panel = new JPanel(new GridLayout(1, 3, 10, 10));
        panel.setOpaque(false);
        panel.add(createStatCard("선택 디바이스", detailTitle));
        panel.add(createStatCard("생체 데이터", detailVitals));
        panel.add(createStatCard("좌표 / 상태", createTwoLinePanel(detailCoords, detailState)));
        return panel;
    }

    private JPanel createStatCard(String title, java.awt.Component body) {
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

        JButton refreshButton = new JButton("새로고침");
        refreshButton.addActionListener(event -> refreshPorts());
        controls.add(refreshButton);

        controls.add(new JLabel("Baud"));
        baudComboBox.setEditable(true);
        baudComboBox.setPreferredSize(new Dimension(100, 30));
        controls.add(baudComboBox);

        controls.add(new JLabel("기준 위도"));
        controls.add(refLatField);

        controls.add(new JLabel("기준 경도"));
        controls.add(refLonField);

        connectButton.addActionListener(event -> connect());
        disconnectButton.addActionListener(event -> disconnect("user request"));
        disconnectButton.setEnabled(false);
        controls.add(connectButton);
        controls.add(disconnectButton);

        footerStatusLabel.setBorder(BorderFactory.createEmptyBorder(0, 10, 0, 10));

        container.add(controls, BorderLayout.CENTER);
        container.add(footerStatusLabel, BorderLayout.WEST);
        return container;
    }

    private void loadInitialValues() {
        refLatField.setText(String.valueOf(config.getRefLat()));
        refLonField.setText(String.valueOf(config.getRefLon()));
        baudComboBox.setSelectedItem(String.valueOf(config.getBaudRate()));
    }

    private void attachListeners() {
        deviceTable.getSelectionModel().addListSelectionListener(event -> {
            if (event.getValueIsAdjusting()) {
                return;
            }
            int row = deviceTable.getSelectedRow();
            DeviceTelemetry device = tableModel.getDeviceAt(row);
            selectedDeviceId = device == null ? -1 : device.getDeviceId();
            refreshDetailPanel();
            refreshMap();
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
            JOptionPane.showMessageDialog(this, "연결할 COM 포트를 선택하세요.", "포트 없음", JOptionPane.WARNING_MESSAGE);
            return;
        }

        int baudRate;
        double refLat;
        double refLon;
        try {
            baudRate = Integer.parseInt(String.valueOf(baudComboBox.getSelectedItem()).trim());
            refLat = Double.parseDouble(refLatField.getText().trim());
            refLon = Double.parseDouble(refLonField.getText().trim());
        } catch (NumberFormatException ex) {
            JOptionPane.showMessageDialog(this, "Baud rate 또는 기준 좌표 값이 잘못되었습니다.", "입력 오류", JOptionPane.ERROR_MESSAGE);
            return;
        }

        config.setPortName(portName);
        config.setBaudRate(baudRate);
        config.setRefLat(refLat);
        config.setRefLon(refLon);
        mapCanvas.setReferencePoint(refLat, refLon);
        persistConfig();

        try {
            serialService.connect(portName, baudRate);
            appendLog("Connected to " + portName + " @ " + baudRate);
        } catch (SerialPortException ex) {
            JOptionPane.showMessageDialog(this, "시리얼 포트 연결 실패: " + ex.getMessage(), "연결 실패", JOptionPane.ERROR_MESSAGE);
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
            bannerLabel.setText("수신기 연결됨: " + serialService.getConnectedPortName() + " / 실시간 데이터 수신 중");
            bannerLabel.setBackground(new Color(220, 252, 231));
            bannerLabel.setForeground(new Color(22, 101, 52));
            footerStatusLabel.setText("연결 상태: 정상 수신");
        } else if (serialService.isConnected()) {
            bannerLabel.setText("수신기 연결됨: " + serialService.getConnectedPortName() + " / 데이터 대기 중");
            bannerLabel.setBackground(new Color(254, 249, 195));
            bannerLabel.setForeground(new Color(133, 77, 14));
            footerStatusLabel.setText("연결 상태: 포트 연결됨, 데이터 없음");
        } else {
            bannerLabel.setText("수신기 데이터 대기 중");
            bannerLabel.setBackground(new Color(230, 238, 247));
            bannerLabel.setForeground(new Color(18, 52, 86));
            footerStatusLabel.setText("연결 상태: 대기");
        }

        tableModel.fireTableDataChanged();
        refreshDetailPanel();
        refreshMap();
    }

    private void refreshDetailPanel() {
        DeviceTelemetry selected = devices.get(selectedDeviceId);
        if (selected == null) {
            detailTitle.setText("선택된 디바이스 없음");
            detailVitals.setText("-");
            detailCoords.setText("-");
            detailState.setText("-");
            return;
        }

        detailTitle.setText("D" + selected.getDeviceId() + formatGuest(selected.getGuestName()));
        detailVitals.setText("BPM " + selected.getBpm() + " / 배터리 " + (selected.getBattery() >= 0 ? selected.getBattery() + "%" : "-"));
        detailCoords.setText(String.format("%.6f, %.6f", selected.getLatitude(), selected.getLongitude()));
        detailState.setText("상태 " + selected.getStatusText(System.currentTimeMillis()) + " / EMG " + selected.getEmergency() + " / Finger " + selected.getFinger());
    }

    private String formatGuest(String guestName) {
        return guestName == null || guestName.isEmpty() ? "" : " (" + guestName + ")";
    }

    private void refreshMap() {
        mapCanvas.setDevices(devices.values(), selectedDeviceId);
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
                            "수신기 연결이 해제되었습니다.\n사유: " + reason,
                            "연결 끊김",
                            JOptionPane.WARNING_MESSAGE
                    )
            );
        }
    }

    @Override
    public void onTelemetry(DeviceTelemetry telemetry, String rawLine) {
        lastTelemetryAt = telemetry.getReceivedAt();
        devices.put(telemetry.getDeviceId(), telemetry);
        tableModel.setDevices(devices);
        appendLog("RX " + rawLine);

        if (selectedDeviceId == -1) {
            selectedDeviceId = telemetry.getDeviceId();
            deviceTable.getSelectionModel().setSelectionInterval(0, 0);
        }

        refreshDetailPanel();
        refreshMap();
        refreshConnectionStatus();
    }

    @Override
    public void onMessage(String message) {
        appendLog(message);
    }
}
