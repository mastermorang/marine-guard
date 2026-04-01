# Marine Guard Station Monitor

`station-monitor` is a local Java desktop application for the operator laptop or PC
that is physically connected to the Marine Guard receiver.

It is intended to replace the browser-first workflow for field operation.

## What it does

- Connects directly to the receiver over a serial COM port
- Parses live device telemetry from the existing wearable protocol
- Supports both manual receiver coordinates and automatic receiver GPS tracking
- Shows receiver connection state and last data time
- Lists connected devices and their vital data
- Shows a live PPG/BPM preview panel in the main screen
- Opens a dedicated PPG monitor window with a larger live trend graph
- Draws high-visibility relative positions on a local map canvas
- Supports operator-side guest assignment for the selected device
- Uses a dark, high-contrast field UI for outdoor readability
- Stores the preferred COM port, baud rate, and reference coordinates locally

## Field layout

The current field UI is organized as:

- Top status bar with receiver state, online count, and quick actions
- Left device sidebar with card-based device list
- Center large relative map with zoom and pan
- Right sidebar for selected device, vitals gauge, and PPG panels
- Bottom operator log with All / Warning / Emergency filters

## Supported telemetry lines

Legacy format:

```text
1,$M35.097012,129.994446,0,1,088
```

Extended format:

```text
1,$M35.097012,129.994446,0,1,088,77,Guest 1
```

Extended format with PPG raw value:

```text
1,$M35.097012,129.994446,0,1,088,77,Guest 1,512
```

Receiver reference line for automatic tracking:

```text
RX,$M35.097500,129.994900,receiver-gps
```

Also accepted:

```text
RECEIVER,$M35.097500,129.994900
BASE,$M35.097500,129.994900
R,$M35.097500,129.994900
```

Fields:

1. Device ID
2. Latitude with `$M` prefix
3. Longitude
4. Emergency flag
5. Finger/contact flag
6. BPM
7. Battery percent (optional, currently not shown in UI)
8. Guest name (optional)
9. PPG raw value (optional)

Receiver GPS fields:

1. Receiver header: `RX`, `RECEIVER`, `BASE`, or `R`
2. Receiver latitude with optional `$M` or `$R` prefix
3. Receiver longitude
4. Source label (optional)

## Reference point modes

- `Manual`: the operator enters and saves the receiver reference coordinates
- `Auto receiver GPS`: the app waits for receiver GPS lines and updates the map
  reference automatically

If automatic GPS data is missing, the last saved coordinates remain as the fallback.

## PPG monitor window

The main station window now includes:

- an embedded live PPG/BPM preview panel for the selected device
- a `PPG Monitor` button for a larger dedicated graph window
- color-coded device rows for BPM, emergency, stale, and no-contact states
- a guest assignment action for the selected device
- receiver-centered relative map labels with live distance and mouse-wheel zoom

- The embedded panel updates with the selected device in real time
- The button opens a dedicated live graph window for the selected device
- It always shows current BPM, last PPG raw value, min/max/average
- If raw PPG values are present, the graph can switch to raw PPG mode
- If raw PPG values are not present yet, the graph falls back to BPM trend mode

## Build

```powershell
station-monitor\build.bat
```

## Run

```powershell
station-monitor\run.bat
```

The app uses the bundled JDK in the repository and `lib\jssc.jar` for serial access.
