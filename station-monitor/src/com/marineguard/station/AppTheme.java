package com.marineguard.station;

import javax.swing.BorderFactory;
import javax.swing.JComponent;
import javax.swing.JLabel;
import javax.swing.JPanel;
import javax.swing.UIManager;
import javax.swing.UnsupportedLookAndFeelException;
import javax.swing.border.Border;
import java.awt.Color;
import java.awt.Component;
import java.awt.Font;

public final class AppTheme {
    public static final Color BG = new Color(10, 19, 31);
    public static final Color PANEL = new Color(18, 31, 48);
    public static final Color PANEL_ALT = new Color(25, 42, 63);
    public static final Color PANEL_BORDER = new Color(39, 62, 90);
    public static final Color TEXT = new Color(232, 241, 248);
    public static final Color TEXT_MUTED = new Color(150, 174, 196);
    public static final Color GRID = new Color(34, 51, 74);
    public static final Color ACCENT = new Color(0, 176, 255);
    public static final Color SUCCESS = new Color(45, 211, 111);
    public static final Color WARNING = new Color(251, 191, 36);
    public static final Color DANGER = new Color(248, 113, 113);
    public static final Color OFFLINE = new Color(107, 114, 128);
    public static final Color SELECTED = new Color(255, 184, 0);

    private AppTheme() {
    }

    public static void install() {
        try {
            UIManager.setLookAndFeel(UIManager.getCrossPlatformLookAndFeelClassName());
        } catch (ClassNotFoundException | InstantiationException | IllegalAccessException | UnsupportedLookAndFeelException ignored) {
        }

        UIManager.put("control", PANEL);
        UIManager.put("info", PANEL);
        UIManager.put("nimbusBase", PANEL_ALT);
        UIManager.put("nimbusBlueGrey", PANEL_ALT);
        UIManager.put("nimbusLightBackground", BG);
        UIManager.put("text", TEXT);
        UIManager.put("Panel.background", BG);
        UIManager.put("Viewport.background", BG);
        UIManager.put("ScrollPane.background", BG);
        UIManager.put("OptionPane.background", BG);
        UIManager.put("OptionPane.messageForeground", TEXT);
        UIManager.put("Label.foreground", TEXT);
        UIManager.put("Button.background", PANEL_ALT);
        UIManager.put("Button.foreground", TEXT);
        UIManager.put("Button.select", PANEL_BORDER);
        UIManager.put("ComboBox.background", PANEL_ALT);
        UIManager.put("ComboBox.foreground", TEXT);
        UIManager.put("TextField.background", PANEL_ALT);
        UIManager.put("TextField.foreground", TEXT);
        UIManager.put("TextField.caretForeground", TEXT);
        UIManager.put("Table.background", PANEL);
        UIManager.put("Table.foreground", TEXT);
        UIManager.put("Table.selectionBackground", new Color(20, 54, 92));
        UIManager.put("Table.selectionForeground", TEXT);
        UIManager.put("Table.gridColor", GRID);
        UIManager.put("TableHeader.background", PANEL_ALT);
        UIManager.put("TableHeader.foreground", TEXT);
        UIManager.put("TextArea.background", PANEL);
        UIManager.put("TextArea.foreground", TEXT);
        UIManager.put("TextArea.caretForeground", TEXT);
    }

    public static Border cardBorder() {
        return BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(PANEL_BORDER),
            BorderFactory.createEmptyBorder(14, 14, 14, 14)
        );
    }

    public static void styleCard(JPanel card) {
        card.setOpaque(true);
        card.setBackground(PANEL);
        card.setBorder(cardBorder());
    }

    public static void styleTitle(JLabel label) {
        label.setForeground(TEXT);
        label.setFont(label.getFont().deriveFont(Font.BOLD, 14f));
    }

    public static void styleValue(Component component) {
        component.setForeground(TEXT);
        if (component instanceof JComponent) {
            ((JComponent) component).setOpaque(false);
        }
    }
}
