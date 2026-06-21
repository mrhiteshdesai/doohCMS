# Android TV QA Matrix

## Goal

Validate the native Smartags player on Android TV 9 through current Android TV / Google TV releases across emulator, consumer TVs, and low-cost Android boxes before each production release.

## Mandatory Coverage

| Class | Android versions | Example hardware | Chipsets / decoder focus | Release gate |
| --- | --- | --- | --- | --- |
| Emulator | 12, 14 | Android Studio TV emulator | Software decode, x86_64 | Smoke on every release candidate |
| Certified consumer TV | 9, 10, 11, 12+ | Sony, TCL, Philips, Chromecast with Google TV | MediaTek, Amlogic, AV1/H.265 | Full regression on every release candidate |
| Operator box | 9, 10, 11 | Walmart Onn, Xiaomi TV Box, Mecool | Amlogic S905X, S905Y, older H.264/H.265 stacks | Full regression on every release candidate |
| Cheap Android box | 9, 10, 12 | Rockchip / Allwinner generic boxes | Rockchip, Allwinner, unstable vendor firmware | Targeted recovery and codec regression on every release candidate |
| Existing fleet sample | Oldest supported live devices | 3-5 screens from production | Mixed Wi-Fi, mixed storage pressure | Canary before broad rollout |

## Codec Matrix

| Asset type | Variants to test | Expected result |
| --- | --- | --- |
| MP4 H.264 | 720p, 1080p, 4K, high bitrate | Plays or is skipped cleanly with telemetry |
| MP4 H.265 / HEVC | 1080p, 4K | Plays on supported devices, quarantines unsupported assets |
| WebM VP9 | 1080p | Plays on supported devices or reports decoder failure |
| AV1 | 1080p | Plays on newer devices, safe failure on unsupported boxes |
| AAC audio | stereo | No crash, audio route remains stable |
| PNG / JPG | small and very large | Renders without memory leak or ANR |
| HTML/widget content | weather/news widgets | Widget zone recovers after reload and reboot |

## Required Test Scenarios

| Area | Test | Pass criteria |
| --- | --- | --- |
| Pairing | Fresh install and first pairing | Device registers, receives token, starts playback |
| Content sync | Pull playlist with mixed assets | All supported assets cache locally and play |
| Offline mode | Disconnect network after sync | Last good playlist continues without blank screen |
| Manifest refresh | Publish playlist update | Device fetches new manifest and switches cleanly |
| Watchdog | Simulate stuck download | Self-healing triggers and playback recovers |
| Playback recovery | Simulate unsupported codec / corrupt file | Asset is skipped or quarantined, app remains alive |
| App recovery | Force app crash | App restarts and returns to content or recovery mode |
| Device owner | Enable kiosk and reboot | Kiosk remains enforced after boot |
| Recovery mode | Enter and clear recovery mode from dashboard | Launcher unlock behavior matches command state |
| Snapshot | Trigger `SNAPSHOT` command | Snapshot uploads and is visible in dashboard |
| Support bundle | Trigger `EXPORT_SUPPORT_BUNDLE` | ZIP uploads and download link appears in dashboard |
| Upgrade | Install over previous version | Pairing, prefs, cache metadata, and playback survive upgrade |
| Downgrade safety | Attempt unsupported downgrade path | SOP blocks downgrade or full re-provision is used |

## Execution Rhythm

### Per pull request

- Build backend, frontend, and Android debug APK.
- Run emulator smoke tests for pairing, playback, and snapshot.
- Verify no regressions in command handling, telemetry, or support bundle export.

### Per release candidate

- Execute full matrix on at least:
  - 1 emulator
  - 2 certified Android TV / Google TV devices
  - 2 low-cost operator boxes
  - 1 cheap generic Android box
- Run at least one network-loss test, one reboot test, one crash-recovery test, and one upgrade test.

### Per production rollout

- Deploy to internal canary fleet first.
- Observe heartbeat, playback state, download state, decoder errors, and support-bundle requests for 24 hours.
- Proceed to full fleet only if no blocker or high-severity issue appears.

## Evidence To Capture

- APK / AAB filename, version name, and version code.
- Device model, Android version, SoC, and screen resolution.
- Test result per scenario with pass / fail.
- Snapshot or support bundle for every failure.
- Dashboard screenshot showing final health state for each tested device class.

## Release Exit Criteria

- No blocker issues on Android TV 9+ coverage.
- No crash loop, blank-screen regression, or pairing regression.
- Upgrade from previous production version succeeds on at least one device per major class.
- Support bundle export works on at least one certified TV and one cheap box.
- Signed release artifacts are produced from the documented release pipeline.
