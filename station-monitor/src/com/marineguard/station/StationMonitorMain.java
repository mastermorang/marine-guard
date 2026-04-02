package com.marineguard.station;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;

public final class StationMonitorMain {
    private StationMonitorMain() {
    }

    public static void main(String[] args) {
        AppTheme.install();
        DisplayAwakeManager displayAwakeManager = new DisplayAwakeManager();
        displayAwakeManager.start();
        Runtime.getRuntime().addShutdownHook(new Thread(displayAwakeManager::stop, "display-awake-stop"));

        SwingUtilities.invokeLater(() -> {
            AppConfig config = AppConfig.load();
            StationMonitorFrame frame = new StationMonitorFrame(config, displayAwakeManager);
            frame.setLocationRelativeTo(null);
            frame.setVisible(true);
        });
    }
}
