# Smartags Android Player

This is the native Android player wrapper for the Smartags Digital Signage system. It uses a WebView to load the player web application and provides native capabilities like:

- **Auto-Start on Boot:** Automatically launches when the device is powered on.
- **Kiosk Mode:** Hides system bars and keeps the screen on (Immersive Mode).
- **Native Interface:** Exposes Android device ID and Toast messages to the web app via `window.Android`.

## Prerequisites

- Android Studio Giraffe or newer
- JDK 17
- Android SDK API 34

## Configuration

Before building, open `app/src/main/java/com/smartags/player/MainActivity.kt` and update the `SERVER_URL` variable to point to your deployed frontend URL:

```kotlin
private val SERVER_URL = "https://your-domain.com/player"
```

For local development with the Android Emulator, use `http://10.0.2.2:5173/player`.

## Building

1. Open this folder in Android Studio.
2. Wait for Gradle sync to complete.
3. Build > Build Bundle(s) / APK(s) > Build APK(s).

## Installation

1. Copy the APK to your Android TV / Box / Tablet.
2. Install the APK.
3. Grant "Display over other apps" if requested (though this app uses standard fullscreen).
4. On first launch, it will load the player URL.

## Features

- **Boot Receiver:** `BootReceiver.kt` listens for `BOOT_COMPLETED` to start the app automatically.
- **Web Interface:** `WebAppInterface` in `MainActivity.kt` allows the web app to call:
  - `window.Android.getDeviceId()`: Returns the unique Android ID.
  - `window.Android.showToast(msg)`: Shows a native Android toast.
  - `window.Android.getAppVersion()`: Returns the app version.

## Troubleshooting

- **White Screen:** Ensure the `SERVER_URL` is reachable from the device network.
- **Not Starting on Boot:** Some devices (Xiaomi, etc.) restrict auto-start. Check device settings > Apps > Smartags Player > Auto-start.
