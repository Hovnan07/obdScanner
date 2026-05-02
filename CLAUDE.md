# OBD Scanner — Claude Code Guide

## Project Overview
React Native (iOS-first) OBD-II diagnostic app that connects to car OBD adapters via Bluetooth Classic. Supports real-time engine data, DTC fault code scanning, and VIN decoding. UI is in English, Armenian (hy), and Russian (ru).

## Architecture

### State Management
- **Zustand store** at `src/store/obdStore.ts` — single store for all app state (connection, vehicle info, live data, UI flags, user profile)

### Screens
- `App.tsx` — root router: ProfileSetupScreen → DashboardScreen (or ProfileEditScreen overlay)
- `src/screens/ProfileSetupScreen.tsx` — first-launch name/photo setup
- `src/screens/ProfileEditScreen.tsx` — edit profile from dashboard
- `src/screens/DashboardScreen.tsx` — main screen (tabs, connection, live data)

### Tab Components (`src/components/tabs/`)
| Tab | File | What it shows |
|-----|------|---------------|
| Engine | `EngineTab.tsx` | RPM + Speed gauges, live polling, read buttons |
| Battery | `BatteryTab.tsx` | Stub (not yet implemented) |
| Error Log | `ErrorLogTab.tsx` | DTC fault codes list + scan button |
| Brake Pad | `BrakePadTab.tsx` | Stub |
| ABS | `ABSTab.tsx` | Stub |
| AC | `ACTab.tsx` | Stub |

### Shared Components
- `ProfileAvatar.tsx` — initials fallback avatar + image
- `DInput.tsx` — react-hook-form controlled TextInput
- `NotificationModal.tsx` — success/error/info overlay
- `LanguageSelector.tsx` — bottom sheet language picker

### Services & Utilities
- `src/services/carImageService.ts` — VIN decode via external API
- `src/i18n/` — i18next setup; locales at `src/i18n/locales/{en,hy,ru}.json`
- `src/validation/profileSchema.ts` — Yup schema for profile form
- `codes.json` (root) — DTC fault code lookup table

## Bluetooth / OBD Flow
1. `startBleScan()` — calls `RNBluetoothClassic.getBondedDevices()` (paired devices only)
2. User selects device → `handleObdConnect()` → `RNBluetoothClassic.connectToDevice()`
3. `obdInit()` sends AT commands (ATZ, ATE0, ATL0, ATS0, ATH0, ATSP0)
4. `readVehicleInfo()` sends `0902` to get VIN, decodes via `scanVin()`
5. Live polling: `setInterval` every 1s polling `010C` (RPM) and `010D` (speed)
6. DTC scan: sends `03` command, parses hex response via `parseDTCs()`

## Key Dependencies
- `react-native-bluetooth-classic` — Bluetooth Classic serial communication
- `react-native-image-picker` — profile photo selection
- `zustand` — state management
- `react-hook-form` + `yup` — form validation
- `react-i18next` — internationalization

## Dev Notes
- iOS only tested (android BLE permission code exists but untested)
- Connection settings panel toggled by the "+" button in header (`showSettings` state)
- VIN decoding uses an external API via `carImageService.ts`
- `bleDeviceId` stores the device MAC address/ID; needs to be selected from bonded list
- `activeTab` defaults to `'Engine'` (hardcoded string, not translated key — translation applied at render only)
