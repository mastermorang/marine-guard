package com.marineguard.station;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;

public final class StationMonitorMain {
    private StationMonitorMain() {
    }

    public static void main(String[] args) {
        AppTheme.install();

        SwingUtilities.invokeLater(() -> {
            AppConfig config = AppConfig.load();
            StationMonitorFrame frame = new StationMonitorFrame(config);
            frame.setLocationRelativeTo(null);
            frame.setVisible(true);
        });
    }
}
