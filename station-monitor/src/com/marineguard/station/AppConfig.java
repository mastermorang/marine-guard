package com.marineguard.station;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.Properties;

public class AppConfig {
    private static final String FILE_NAME = ".marine-guard-station.properties";

    private String portName = "";
    private int baudRate = 115200;
    private double refLat = 35.097012d;
    private double refLon = 129.994446d;
    private boolean autoReceiverLocation = false;

    public static AppConfig load() {
        AppConfig config = new AppConfig();
        File file = config.getConfigFile();
        if (!file.exists()) {
            return config;
        }

        Properties properties = new Properties();
        try (FileInputStream input = new FileInputStream(file)) {
            properties.load(input);
            config.portName = properties.getProperty("portName", config.portName);
            config.baudRate = Integer.parseInt(properties.getProperty("baudRate", String.valueOf(config.baudRate)));
            config.refLat = Double.parseDouble(properties.getProperty("refLat", String.valueOf(config.refLat)));
            config.refLon = Double.parseDouble(properties.getProperty("refLon", String.valueOf(config.refLon)));
            config.autoReceiverLocation = Boolean.parseBoolean(
                    properties.getProperty("autoReceiverLocation", String.valueOf(config.autoReceiverLocation))
            );
        } catch (Exception ignored) {
            return config;
        }
        return config;
    }

    public void save() throws IOException {
        Properties properties = new Properties();
        properties.setProperty("portName", portName == null ? "" : portName);
        properties.setProperty("baudRate", String.valueOf(baudRate));
        properties.setProperty("refLat", String.valueOf(refLat));
        properties.setProperty("refLon", String.valueOf(refLon));
        properties.setProperty("autoReceiverLocation", String.valueOf(autoReceiverLocation));
        try (FileOutputStream output = new FileOutputStream(getConfigFile())) {
            properties.store(output, "Marine Guard Station Monitor");
        }
    }

    private File getConfigFile() {
        return new File(System.getProperty("user.home"), FILE_NAME);
    }

    public String getPortName() {
        return portName;
    }

    public void setPortName(String portName) {
        this.portName = portName == null ? "" : portName;
    }

    public int getBaudRate() {
        return baudRate;
    }

    public void setBaudRate(int baudRate) {
        this.baudRate = baudRate;
    }

    public double getRefLat() {
        return refLat;
    }

    public void setRefLat(double refLat) {
        this.refLat = refLat;
    }

    public double getRefLon() {
        return refLon;
    }

    public void setRefLon(double refLon) {
        this.refLon = refLon;
    }

    public boolean isAutoReceiverLocation() {
        return autoReceiverLocation;
    }

    public void setAutoReceiverLocation(boolean autoReceiverLocation) {
        this.autoReceiverLocation = autoReceiverLocation;
    }
}
