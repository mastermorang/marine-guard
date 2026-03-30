/*
 * Decompiled with CFR 0.152.
 * 
 * Could not load the following classes:
 *  controlP5.CallbackEvent
 *  controlP5.CallbackListener
 *  controlP5.ControlFont
 *  controlP5.ControlP5
 *  controlP5.Numberbox
 *  processing.core.PApplet
 *  processing.core.PFont
 *  processing.core.PImage
 *  processing.event.KeyEvent
 *  processing.serial.Serial
 */
import controlP5.CallbackEvent;
import controlP5.CallbackListener;
import controlP5.ControlFont;
import controlP5.ControlP5;
import controlP5.Numberbox;
import java.util.regex.Pattern;
import processing.core.PApplet;
import processing.core.PFont;
import processing.core.PImage;
import processing.event.KeyEvent;
import processing.serial.Serial;

public class Wearable
extends PApplet {
    ControlP5 cp5;
    Serial myPort;
    int a;
    float ref_lat = 35.0967f;
    float ref_lon = 128.9942f;
    float lat_t = 0.0f;
    float lon_t = 0.0f;
    int[] nId = new int[10];
    int[] nEmg = new int[10];
    int[] nFinger = new int[10];
    int[] nBPM = new int[10];
    float[] lat = new float[10];
    float[] lon = new float[10];
    float[] scr_x = new float[10];
    float[] scr_y = new float[10];
    int nAdd = 0;
    float scr_px;
    float scr_py;
    String sDisplay;
    String sBuff;
    int nTimer_1s = 0;
    int nEmg_flash = 0;
    PImage bg;
    float px;
    float py;
    int i;
    PFont myFont;
    String connectedPort = "연결없음";

    public String findSerialPort() {
        String[] ports = Serial.list();
        if (ports.length > 0) {
            println("사용 가능한 포트: " + String.join(", ", ports));
            return ports[0];
        }
        println("사용 가능한 COM 포트가 없습니다.");
        return null;
    }

    public void setup() {
        int i;
        this.frameRate(25.0f);
        this.myFont = this.createFont("\uad74\ub9bc", 35.0f);
        this.textFont(this.myFont);
        String portName = findSerialPort();
        if (portName != null) {
            try {
                this.myPort = new Serial((PApplet)this, portName, 115200);
                this.connectedPort = portName;
                println("Connected to: " + portName);
            } catch (Exception e) {
                println("포트 연결 실패: " + portName + " - " + e.getMessage());
                this.myPort = null;
            }
        } else {
            this.myPort = null;
        }
        Wearable.println((String)"Start");
        String[] lines = this.loadStrings("list.txt");
        if (lines == null) {
            lines = Wearable.split((String)"35.09702 128.99444", (char)' ');
            this.saveStrings("list.txt", lines);
            Wearable.println((String)("there are " + lines.length + " lines"));
            i = 0;
            while (i < lines.length) {
                Wearable.println((String)lines[i]);
                ++i;
            }
        } else {
            Wearable.println((String)("there are " + lines.length + " lines"));
            i = 0;
            while (i < lines.length) {
                Wearable.println((String)lines[i]);
                ++i;
            }
        }
        this.sBuff = this.str_CNT(lines[0], 0, lines[0].length());
        this.ref_lat = (this.sBuff.charAt(0) - 48) * 10 + (this.sBuff.charAt(1) - 48);
        this.ref_lat *= 100000.0f;
        this.ref_lat = this.ref_lat + (float)((this.sBuff.charAt(3) - 48) * 10000) + (float)((this.sBuff.charAt(4) - 48) * 1000) + (float)((this.sBuff.charAt(5) - 48) * 100) + (float)((this.sBuff.charAt(6) - 48) * 10) + (float)((this.sBuff.charAt(7) - 48) * 1);
        this.ref_lat /= 100000.0f;
        Wearable.println((String)("ref_lat " + this.ref_lat));
        this.sBuff = this.str_CNT(lines[1], 0, lines[1].length());
        this.ref_lon = (this.sBuff.charAt(0) - 48) * 100 + (this.sBuff.charAt(1) - 48) * 10 + (this.sBuff.charAt(2) - 48);
        this.ref_lon *= 100000.0f;
        this.ref_lon = this.ref_lon + (float)((this.sBuff.charAt(4) - 48) * 10000) + (float)((this.sBuff.charAt(5) - 48) * 1000) + (float)((this.sBuff.charAt(6) - 48) * 100) + (float)((this.sBuff.charAt(7) - 48) * 10) + (float)((this.sBuff.charAt(8) - 48) * 1);
        this.ref_lon /= 100000.0f;
        Wearable.println((String)("ref_lon " + this.ref_lon));
        this.px = (float)this.width / 1920.0f;
        this.py = (float)this.height / 1080.0f;
        this.cp5 = new ControlP5((PApplet)this);
        PFont pfont = this.createFont("\uad74\ub9bc", 35.0f, true);
        ControlFont font = new ControlFont(pfont, 35);
        Numberbox nlan = (Numberbox)((Numberbox)((Numberbox)((Numberbox)((Numberbox)this.cp5.addNumberbox("numbers_lan").setDecimalPrecision(5)).setFont(font)).setSize(200, 40)).setPosition(100.0f * this.px, 910.0f * this.py)).setValue(this.ref_lat).setLabel("\uc704\ub3c4");
        this.makeEditable(nlan);
        Numberbox nlon = (Numberbox)((Numberbox)((Numberbox)((Numberbox)((Numberbox)this.cp5.addNumberbox("numbers_lon").setDecimalPrecision(5)).setFont(font)).setSize(200, 40)).setPosition(400.0f * this.px, 910.0f * this.py)).setValue(this.ref_lon).setLabel("\uacbd\ub3c4");
        this.makeEditable(nlon);
    }

    public void draw() {
        this.background(0);
        this.display_init();
        if (this.nTimer_1s++ >= 24) {
            this.nTimer_1s = 0;
        }
        while (this.myPort != null && this.myPort.available() > 0) {
            String inByte = this.myPort.readString();
            Wearable.print((String)inByte);
            if (inByte.length() < 36 || !this.str_CMP("$M", inByte, 2, 2) || inByte.charAt(inByte.length() - 1) != '\n') continue;
            this.nAdd = inByte.charAt(0) - 48;
            if (this.nAdd < 1) continue;
            this.nId[this.nAdd - 1] = this.nAdd;
            this.sBuff = this.str_CNT(inByte, 4, inByte.length() - 1);
            this.lat[this.nAdd - 1] = (this.sBuff.charAt(0) - 48) * 10 + (this.sBuff.charAt(1) - 48);
            this.lat[this.nAdd - 1] = this.lat[this.nAdd - 1] * 1000000.0f;
            this.lat[this.nAdd - 1] = this.lat[this.nAdd - 1] + (float)((this.sBuff.charAt(3) - 48) * 100000) + (float)((this.sBuff.charAt(4) - 48) * 10000) + (float)((this.sBuff.charAt(5) - 48) * 1000) + (float)((this.sBuff.charAt(6) - 48) * 100) + (float)((this.sBuff.charAt(7) - 48) * 10) + (float)(this.sBuff.charAt(8) - 48);
            this.lat[this.nAdd - 1] = this.lat[this.nAdd - 1] / 1000000.0f;
            Wearable.print((String)(String.valueOf(this.lat[this.nAdd - 1]) + "\r\n"));
            this.lon[this.nAdd - 1] = (this.sBuff.charAt(10) - 48) * 100 + (this.sBuff.charAt(11) - 48) * 10 + (this.sBuff.charAt(12) - 48);
            this.lon[this.nAdd - 1] = this.lon[this.nAdd - 1] * 1000000.0f;
            this.lon[this.nAdd - 1] = this.lon[this.nAdd - 1] + (float)((this.sBuff.charAt(14) - 48) * 100000) + (float)((this.sBuff.charAt(15) - 48) * 10000) + (float)((this.sBuff.charAt(16) - 48) * 1000) + (float)((this.sBuff.charAt(17) - 48) * 100) + (float)((this.sBuff.charAt(18) - 48) * 10) + (float)(this.sBuff.charAt(19) - 48);
            this.lon[this.nAdd - 1] = this.lon[this.nAdd - 1] / 1000000.0f;
            Wearable.print((String)(String.valueOf(this.lon[this.nAdd - 1]) + "\r\n"));
            this.nEmg[this.nAdd - 1] = this.sBuff.charAt(21) - 48;
            Wearable.print((String)("emg = " + this.nEmg[this.nAdd - 1] + "\r\n"));
            this.nFinger[this.nAdd - 1] = this.sBuff.charAt(23) - 48;
            Wearable.print((String)("emg = " + this.nFinger[this.nAdd - 1] + "\r\n"));
            this.nBPM[this.nAdd - 1] = (this.sBuff.charAt(25) - 48) * 100 + (this.sBuff.charAt(26) - 48) * 10 + (this.sBuff.charAt(27) - 48);
            Wearable.print((String)("bpm = " + this.nBPM[this.nAdd - 1] + "\r\n"));
            this.convertGpsToPixel(this.ref_lon, this.ref_lat, this.lon[this.nAdd - 1], this.lat[this.nAdd - 1]);
            Wearable.print((String)(String.valueOf(this.scr_px) + "  " + this.scr_py + "\r\n"));
            this.scr_x[this.nAdd - 1] = this.scr_px;
            this.scr_y[this.nAdd - 1] = this.scr_py;
        }
        this.Text("\uc13c\uc11c1", 1640.0f * this.px, 200.0f * this.py, 30.0f * this.px, 245, 243, 149);
        if (this.nId[0] == 1) {
            this.sDisplay = String.format("\uc704\ub3c4: %f", Float.valueOf(this.lat[0]));
            this.Text(this.sDisplay, 1640.0f * this.px, 240.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.sDisplay = String.format("\uacbd\ub3c4: %f", Float.valueOf(this.lon[0]));
            this.Text(this.sDisplay, 1640.0f * this.px, 280.0f * this.py, 25.0f * this.px, 245, 243, 149);
            if (this.nFinger[0] == 1) {
                this.sDisplay = String.format("\uc2ec\ubc15\uc218: %03d", this.nBPM[1]);
                this.Text(this.sDisplay, 1640.0f * this.px, 320.0f * this.py, 25.0f * this.px, 245, 243, 149);
            } else {
                this.sDisplay = String.format("\uc2ec\ubc15\uc218: ---", new Object[0]);
                this.Text(this.sDisplay, 1640.0f * this.px, 320.0f * this.py, 25.0f * this.px, 245, 243, 149);
            }
            if (this.nEmg[0] == 1) {
                if (this.nTimer_1s == 0) {
                    this.nEmg_flash = 1 - this.nEmg_flash;
                }
                if (this.nEmg_flash == 0) {
                    this.sDisplay = String.format("\uc0c1\ud0dc: \ube44\uc0c1", new Object[0]);
                    this.Text(this.sDisplay, 1640.0f * this.px, 360.0f * this.py, 25.0f * this.px, 245, 0, 0);
                }
            } else {
                this.sDisplay = String.format("\uc0c1\ud0dc: \uc815\uc0c1", new Object[0]);
                this.Text(this.sDisplay, 1640.0f * this.px, 360.0f * this.py, 25.0f * this.px, 0, 243, 0);
            }
            if (this.scr_y[0] > 390.0f) {
                this.scr_y[0] = 390.0f;
            }
            if (this.scr_y[0] < -390.0f) {
                this.scr_y[0] = -390.0f;
            }
            if (this.scr_x[0] > 790.0f) {
                this.scr_x[0] = 790.0f;
            }
            if (this.scr_x[0] < -790.0f) {
                this.scr_x[0] = -790.0f;
            }
            this.fill(0.0f, 255.0f, 0.0f);
            this.circle((811.0f + this.scr_x[0]) * this.px, (485.0f + this.scr_y[0]) * this.py, 15.0f * this.px);
            this.textAlign(3, 102);
            this.Text1("\uc13c\uc11c1", (811.0f + this.scr_x[0]) * this.px, (485.0f + this.scr_y[0]) * this.py, 15.0f * this.px, 245, 243, 149);
        } else {
            this.Text("\uc704\ub3c4: --.-------", 1640.0f * this.px, 240.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.Text("\uacbd\ub3c4: ---.------", 1640.0f * this.px, 280.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.Text("\uc2ec\ubc15\uc218: ---", 1640.0f * this.px, 320.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.Text("\uc0c1\ud0dc: ---", 1640.0f * this.px, 360.0f * this.py, 25.0f * this.px, 0, 243, 0);
        }
        this.Text("\uc13c\uc11c2", 1640.0f * this.px, 500.0f * this.py, 30.0f * this.px, 245, 243, 149);
        if (this.nId[1] == 2) {
            this.sDisplay = String.format("\uc704\ub3c4: %f", Float.valueOf(this.lat[1]));
            this.Text(this.sDisplay, 1640.0f * this.px, 540.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.sDisplay = String.format("\uacbd\ub3c4: %f", Float.valueOf(this.lon[1]));
            this.Text(this.sDisplay, 1640.0f * this.px, 580.0f * this.py, 25.0f * this.px, 245, 243, 149);
            if (this.nFinger[1] == 1) {
                this.sDisplay = String.format("\uc2ec\ubc15\uc218: %03d", this.nBPM[1]);
                this.Text(this.sDisplay, 1640.0f * this.px, 620.0f * this.py, 25.0f * this.px, 245, 243, 149);
            } else {
                this.sDisplay = String.format("\uc2ec\ubc15\uc218: ---", new Object[0]);
                this.Text(this.sDisplay, 1640.0f * this.px, 620.0f * this.py, 25.0f * this.px, 245, 243, 149);
            }
            if (this.nEmg[1] == 1) {
                if (this.nTimer_1s == 0) {
                    this.nEmg_flash = 1 - this.nEmg_flash;
                }
                if (this.nEmg_flash == 0) {
                    this.sDisplay = String.format("\uc0c1\ud0dc: \ube44\uc0c1", new Object[0]);
                    this.Text(this.sDisplay, 1640.0f * this.px, 660.0f * this.py, 25.0f * this.px, 245, 0, 0);
                }
            } else {
                this.sDisplay = String.format("\uc0c1\ud0dc: \uc815\uc0c1", new Object[0]);
                this.Text(this.sDisplay, 1640.0f * this.px, 660.0f * this.py, 25.0f * this.px, 0, 243, 0);
            }
            if (this.scr_y[1] > 390.0f) {
                this.scr_y[1] = 390.0f;
            }
            if (this.scr_y[1] < -390.0f) {
                this.scr_y[1] = -390.0f;
            }
            if (this.scr_x[1] > 790.0f) {
                this.scr_x[1] = 790.0f;
            }
            if (this.scr_x[1] < -790.0f) {
                this.scr_x[1] = -790.0f;
            }
            this.fill(255.0f, 0.0f, 0.0f);
            this.circle((811.0f + this.scr_x[1]) * this.px, (485.0f + this.scr_y[1]) * this.py, 15.0f * this.px);
            this.textAlign(3, 102);
            this.Text1("\uc13c\uc11c2", (811.0f + this.scr_x[1]) * this.px, (485.0f + this.scr_y[1]) * this.py, 15.0f * this.px, 245, 243, 149);
        } else {
            this.Text("\uc704\ub3c4: --.-------", 1640.0f * this.px, 540.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.Text("\uacbd\ub3c4: ---.------", 1640.0f * this.px, 580.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.Text("\uc2ec\ubc15\uc218: ---", 1640.0f * this.px, 620.0f * this.py, 25.0f * this.px, 245, 243, 149);
            this.Text("\uc0c1\ud0dc: ---", 1640.0f * this.px, 660.0f * this.py, 25.0f * this.px, 0, 243, 0);
        }
    }

    public void convertGpsToPixel(float ref_lon, float ref_lat, float lon, float lat) {
        float EARTH_RADIUS = 6378137.0f;
        float pixels_per_meter = 1.5f;
        float lon_diff = lon - ref_lon;
        float lat_diff = ref_lat - lat;
        float x_meters = lon_diff * Wearable.cos((float)(ref_lat * (float)Math.PI / 180.0f)) * ((float)Math.PI / 180) * EARTH_RADIUS;
        float y_meters = lat_diff * ((float)Math.PI / 180) * EARTH_RADIUS;
        this.scr_px = x_meters * pixels_per_meter;
        this.scr_py = y_meters * pixels_per_meter;
    }

    public boolean str_CMP(String str2, String str1, int st, int len) {
        int j = 0;
        if (str1.length() <= 7) {
            return false;
        }
        int i = st;
        while (i < st + len) {
            if (str1.charAt(i) != str2.charAt(j)) {
                return false;
            }
            ++j;
            ++i;
        }
        return true;
    }

    public String str_CNT(String str, int st, int len) {
        String Str = "";
        int i = st;
        while (i < len) {
            Str = String.valueOf(Str) + str.charAt(i);
            ++i;
        }
        Str = String.valueOf(Str);
        return Str;
    }

    public void numbers_lan(float f) {
        Wearable.println((String)("received " + f + " from Numberbox numbers "));
        this.ref_lat = f;
        String[] lines = this.loadStrings("list.txt");
        this.sDisplay = String.format("%f %f", Float.valueOf(this.ref_lat), Float.valueOf(this.ref_lon));
        lines = Wearable.split((String)this.sDisplay, (char)' ');
        this.saveStrings("list.txt", lines);
    }

    public void numbers_lon(float f) {
        Wearable.println((String)("received " + f + " from Numberbox numbers "));
        this.ref_lon = f;
        String[] lines = this.loadStrings("list.txt");
        this.sDisplay = String.format("%f %f", Float.valueOf(this.ref_lat), Float.valueOf(this.ref_lon));
        lines = Wearable.split((String)this.sDisplay, (char)' ');
        this.saveStrings("list.txt", lines);
    }

    public void makeEditable(Numberbox n) {
        final NumberboxInput nin = new NumberboxInput(n);
        ((Numberbox)n.onClick(new CallbackListener(){

            public void controlEvent(CallbackEvent theEvent) {
                nin.setActive(true);
            }
        })).onLeave(new CallbackListener(){

            public void controlEvent(CallbackEvent theEvent) {
                nin.setActive(false);
                nin.submit();
            }
        });
    }

    public void display_init() {
        this.fill(43.0f, 107.0f, 196.0f);
        this.noStroke();
        this.rect(10.0f * this.px, 10.0f * this.py, 1900.0f * this.px, 70.0f * this.py, 28.0f * this.px);
        this.fill(40.0f, 45.0f, 54.0f);
        this.stroke(184.0f, 99.0f, 2.0f);
        this.strokeWeight(3.0f);
        this.rect(10.0f * this.px, 90.0f * this.py, 1600.0f * this.px, 800.0f * this.py, 28.0f * this.px);
        this.noStroke();
        this.fill(41.0f, 59.0f, 69.0f);
        this.rect(10.0f * this.px, 900.0f * this.py, 1600.0f * this.px, 170.0f * this.py, 28.0f * this.px);
        this.noStroke();
        this.fill(41.0f, 59.0f, 69.0f);
        this.rect(1620.0f * this.px, 90.0f * this.py, 290.0f * this.px, 980.0f * this.py, 28.0f * this.px);
        this.stroke(184.0f, 99.0f, 2.0f);
        this.line(1622.0f * this.px, 150.0f * this.py, 1908.0f * this.px, 150.0f * this.py);
        this.stroke(14.0f, 15.0f, 18.0f);
        this.strokeWeight(1.0f);
        this.i = 1;
        while (this.i < 4) {
            this.line(10.0f * this.px, (float)(this.i * 200 + 90) * this.py, 1610.0f * this.px, (float)(this.i * 200 + 90) * this.py);
            ++this.i;
        }
        this.i = 1;
        while (this.i < 8) {
            this.line((float)(this.i * 200 + 10) * this.px, 90.0f * this.py, (float)(this.i * 200 + 10) * this.px, 890.0f * this.py);
            ++this.i;
        }
        this.textAlign(37, 101);
        this.Text("Wireless Positioning System", 200.0f * this.px, 15.0f * this.py, 50.0f * this.px, 245, 243, 149);
        this.Text("ESC:\ud504\ub85c\uadf8\ub7a8\uc885\ub8cc     \ud1b5\uc2e0\ud3ec\ud2b8:" + this.connectedPort + "(115200bps)", 20.0f * this.px, 1030.0f * this.py, 30.0f * this.px, 245, 243, 149);
        this.Text("\uc2e4\uc2dc\uac04 \uc13c\uc11c \uc815\ubcf4", 1650.0f * this.px, 105.0f * this.py, 30.0f * this.px, 245, 243, 149);
        int d = Wearable.day();
        int m = Wearable.month();
        int y = Wearable.year();
        String s = String.valueOf(String.valueOf(y)) + "\ub144 " + String.valueOf(m) + "\uc6d4 " + String.valueOf(d) + "\uc77c";
        this.Text(s, 1640.0f * this.px, 1030.0f * this.py, 30.0f * this.px, 245, 243, 149);
        s = String.valueOf(String.valueOf(Wearable.hour())) + "\uc2dc " + String.valueOf(Wearable.minute()) + "\ubd84 " + String.valueOf(Wearable.second()) + "\ucd08";
        this.Text(s, 1640.0f * this.px, 980.0f * this.py, 30.0f * this.px, 245, 243, 149);
        this.textAlign(3, 3);
        this.Text1("+", 811.0f * this.px, 485.0f * this.py, 60.0f * this.px, 245, 243, 149);
    }

    public void Text(String st, float x, float y, float nSize, int v1, int v2, int v3) {
        this.textAlign(37, 101);
        this.fill(v1, v2, v3);
        this.textSize(nSize);
        this.text(st, x, y);
    }

    public void Text1(String st, float x, float y, float nSize, int v1, int v2, int v3) {
        this.fill(v1, v2, v3);
        this.textSize(nSize);
        this.text(st, x, y);
    }

    public void settings() {
        this.fullScreen();
    }

    public static void main(String[] passedArgs) {
        String[] appletArgs = new String[]{"Wearable"};
        if (passedArgs != null) {
            PApplet.main((String[])Wearable.concat((String[])appletArgs, (String[])passedArgs));
        } else {
            PApplet.main((String[])appletArgs);
        }
    }

    public class NumberboxInput {
        String text = "";
        Numberbox n;
        boolean active;

        NumberboxInput(Numberbox theNumberbox) {
            this.n = theNumberbox;
            Wearable.this.registerMethod("keyEvent", this);
        }

        public void keyEvent(KeyEvent k) {
            if (k.getAction() == 1 && this.active) {
                String s;
                if (k.getKey() == '\n') {
                    this.submit();
                    return;
                }
                if (k.getKeyCode() == 8) {
                    this.text = this.text.isEmpty() ? "" : this.text.substring(0, this.text.length() - 1);
                } else if (k.getKey() < '\u00ff' && Pattern.matches("\\d+([.]\\d{0,6})?", s = String.valueOf(this.text) + k.getKey())) {
                    this.text = String.valueOf(this.text) + k.getKey();
                }
                this.n.getValueLabel().setText(this.text);
            }
        }

        public void setActive(boolean b) {
            this.active = b;
            if (this.active) {
                this.n.getValueLabel().setText("");
                this.text = "";
            }
        }

        public void submit() {
            if (!this.text.isEmpty()) {
                this.n.setValue(PApplet.parseFloat((String)this.text));
                this.text = "";
            } else {
                this.n.getValueLabel().setText("" + this.n.getValue());
            }
        }
    }
}

