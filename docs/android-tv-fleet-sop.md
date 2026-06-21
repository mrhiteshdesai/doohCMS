# Android TV Fleet SOP

## 1. Provision A New Device

1. Factory-reset the device if it was previously in service.
2. Connect Ethernet or Wi-Fi and confirm internet access.
3. Install the approved signed Smartags APK.
4. Launch the app and wait for the pairing screen.
5. In the CMS, create or choose the target screen and pair using the displayed code.
6. Confirm the dashboard shows the screen online and receiving telemetry.
7. Publish a test playlist and verify playback starts.
8. If the device is intended for managed kiosk deployment, enable Device Owner / kiosk controls and reboot once to verify persistence.

## 2. Re-Pair An Existing Device

Use re-pair only when the token is invalid, the screen identity changed, or the unit is being reassigned.

1. Put the device in recovery mode if kiosk is active.
2. Clear the existing pairing from the player if local UI access is available, or wipe app data if required by policy.
3. Launch the app and wait for a new pairing code.
4. Pair the new code in the CMS.
5. Confirm old and new screen assignments are correct in the dashboard.
6. Publish content and verify the screen receives the correct playlist.

## 3. Standard Recovery Flow

When a screen is blank, stalled, or offline:

1. Check dashboard telemetry:
   - online / offline state
   - playback state
   - download state
   - last successful playback
   - last command result
2. Trigger `SNAPSHOT` if the screen is online.
3. Trigger `EXPORT_SUPPORT_BUNDLE` if the issue is not obvious.
4. Review playback, decoder, and download errors in the dashboard.
5. If the player is online but unhealthy:
   - send `RELOAD`
   - if needed, send `REBOOT_APP`
   - if Device Owner is active and OS allows it, send `REBOOT_DEVICE`
6. If the player is stuck in kiosk and requires local access, send `ENTER_RECOVERY_MODE`.
7. If the device does not recover, collect local evidence and re-provision.

## 4. Update Procedure

1. Confirm the release passed the QA matrix and upgrade validation.
2. Complete `docs/staging-validation-runbook.md`.
3. Roll out to the canary fleet first using `docs/canary-production-launch.md`.
4. Watch telemetry for at least 24 hours.
5. Expand rollout in controlled batches.
6. After update, verify:
   - devices remain paired
   - playlists continue playing
   - support bundle export still succeeds
   - kiosk and boot behavior remain correct

## 5. Support Bundle Workflow

1. Open the screen details page in the CMS.
2. Click `Support Bundle`.
3. Wait for command completion in the command queue.
4. Download the uploaded ZIP from the diagnostics card.
5. Attach the ZIP to the incident or share it with engineering.

Expected contents include:

- telemetry snapshot
- runtime health snapshot
- player state
- redacted preferences
- offline state database
- native operations log

## 6. Local Technician Actions

Use these only when remote recovery fails:

1. Photograph the screen and device state.
2. Record device model, Android version, and network type.
3. Confirm power, HDMI, and network connections.
4. If kiosk prevents action, enter recovery mode or use the technician unlock flow.
5. Reboot the device once.
6. If still broken, reinstall or update the approved APK.
7. If reinstall does not restore service, factory-reset and re-provision.

## 7. Incident Classification

- P1: black screen or crash loop on live production signage
- P2: playback degraded but content still rotates
- P3: remote management issue with local workaround
- P4: cosmetic issue or non-blocking telemetry defect

Escalate P1 and P2 incidents with a support bundle whenever the player is reachable.
