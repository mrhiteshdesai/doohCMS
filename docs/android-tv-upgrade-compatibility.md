# Android TV Upgrade Compatibility Strategy

## Compatibility Contract

Every production upgrade must preserve:

- `applicationId`
- signing key continuity
- paired screen identity and auth token
- kiosk preferences and start-on-boot preferences
- offline metadata needed to restore the last known good playlist
- command handling compatibility for existing dashboard actions

## Rules

1. Never change the Android `applicationId` for the production player.
2. Never rotate the production signing key without a separate migration plan.
3. Only increase `versionCode`; never reuse or decrement it for production.
4. Keep preference keys stable or migrate them explicitly on startup.
5. Preserve local offline database compatibility or rebuild it safely during startup health checks.
6. Keep backend command aliases stable so older dashboards and devices do not diverge.

## Upgrade Path

### Supported

- N-1 production to current production
- Current production to next production
- Debug to debug on lab devices only

### Not supported

- Arbitrary downgrade in the field without technician intervention
- Switching between different signing keys on the same installed app

## Pre-Release Upgrade Tests

For each release candidate:

1. Install the last production APK on at least one certified TV and one cheap box.
2. Pair the device and sync media.
3. Upgrade in place to the candidate build.
4. Verify:
   - pairing remains valid
   - heartbeats continue
   - playback resumes automatically
   - cached media metadata remains consistent
   - kiosk and start-on-boot settings remain intact
   - support bundle export still works

## Fallback Strategy

If new content fetch fails after upgrade:

- rely on cached content first
- fall back to the last known good playlist
- re-pair only if auth is invalid and automated recovery cannot restore service

If a new build introduces media decoder regressions:

- quarantine the failing asset
- keep playback moving with the remaining valid playlist items
- collect a support bundle before changing the device state

## Rollout Strategy

1. Internal lab validation
2. Canary fleet deployment
3. Observe 24-hour telemetry and support volume
4. Expand to staged regional batches
5. Complete fleet rollout

Block rollout if any canary device shows:

- crash loop
- persistent blank screen
- pairing loss
- unsupported upgrade behavior
- failed kiosk enforcement after reboot

## Rollback Strategy

- Roll back only to the previous production version signed with the same key.
- Treat rollback as a controlled maintenance action, not an ad hoc field action.
- If rollback cannot preserve app data safely, wipe the device and re-provision using the fleet SOP.
