# Marine Guard Station Monitor

`station-monitor` is a local Java desktop application for the operator laptop or PC
that is physically connected to the Marine Guard receiver.

It is intended to replace the browser-first workflow for field operation.

## What it does

- Connects directly to the receiver over a serial COM port
- Parses live device telemetry from the existing wearable protocol
- Shows receiver connection state and last data time
- Lists connected devices and their vital data
- Draws simple relative positions on a local map canvas
- Stores the preferred COM port, baud rate, and reference coordinates locally

## Supported telemetry lines

Legacy format:

```text
1,$M35.097012,129.994446,0,1,088
```

Extended format:

```text
1,$M35.097012,129.994446,0,1,088,77,Guest 1
```

Fields:

1. Device ID
2. Latitude with `$M` prefix
3. Longitude
4. Emergency flag
5. Finger/contact flag
6. BPM
7. Battery percent (optional)
8. Guest name (optional)

## Build

```powershell
station-monitor\build.bat
```

## Run

```powershell
station-monitor\run.bat
```

The app uses the bundled JDK in the repository and `lib\jssc.jar` for serial access.
