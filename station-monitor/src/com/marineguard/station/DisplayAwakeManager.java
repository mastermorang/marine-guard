package com.marineguard.station;

import java.io.IOException;

public final class DisplayAwakeManager {
    private static final String KEEP_AWAKE_SCRIPT =
            "$sig='[DllImport(\"kernel32.dll\")] public static extern uint SetThreadExecutionState(uint esFlags);'; "
                    + "Add-Type -Namespace MarineGuard -Name Power -MemberDefinition $sig | Out-Null; "
                    + "while ($true) { [MarineGuard.Power]::SetThreadExecutionState(0x80000003) | Out-Null; Start-Sleep -Seconds 30 }";

    private Process helperProcess;

    public synchronized void start() {
        if (!isWindows() || helperProcess != null && helperProcess.isAlive()) {
            return;
        }
        try {
            helperProcess = new ProcessBuilder(
                    "powershell.exe",
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle",
                    "Hidden",
                    "-ExecutionPolicy",
                    "Bypass",
                    "-Command",
                    KEEP_AWAKE_SCRIPT
            ).start();
        } catch (IOException ignored) {
            helperProcess = null;
        }
    }

    public synchronized void stop() {
        if (helperProcess == null) {
            return;
        }
        helperProcess.destroy();
        helperProcess = null;
    }

    private boolean isWindows() {
        String os = System.getProperty("os.name", "");
        return os.toLowerCase().contains("win");
    }
}
