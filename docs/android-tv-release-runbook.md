# Android TV Release Runbook

## Goal

Produce signed Smartags Android TV release artifacts that are versioned, repeatable, and safe to deploy to the fleet.

## Signing Inputs

Use one of these methods:

1. Create `android_native_player/keystore.properties` from `android_native_player/keystore.properties.example`.
2. Or set these environment variables in CI or the PowerShell session:
   - `SMARTAGS_RELEASE_STORE_FILE`
   - `SMARTAGS_RELEASE_STORE_PASSWORD`
   - `SMARTAGS_RELEASE_KEY_ALIAS`
   - `SMARTAGS_RELEASE_KEY_PASSWORD`

`release` builds now fail if signing input is missing. This prevents accidental debug-signed production artifacts.

## Versioning Inputs

The Android build accepts:

- `SMARTAGS_VERSION_NAME`
- `SMARTAGS_VERSION_CODE`

If these are not provided, the build defaults to `1.0.0` and `1`.

## Windows Release Command

From `android_native_player`:

```powershell
.\scripts\build-release.ps1 -VersionName 1.2.0 -VersionCode 120 -Clean
```

Bundle-only build:

```powershell
.\scripts\build-release.ps1 -VersionName 1.2.0 -VersionCode 120 -BundleOnly
```

## Manual Gradle Commands

```powershell
$env:SMARTAGS_VERSION_NAME="1.2.0"
$env:SMARTAGS_VERSION_CODE="120"
.\gradlew.bat :app:bundleRelease :app:assembleRelease
```

## Artifact Locations

- APK: `android_native_player/app/build/outputs/apk/release`
- AAB: `android_native_player/app/build/outputs/bundle/release`

APK filenames include variant, version name, and version code for traceability.

## Release Checklist

1. Confirm backend and frontend builds are green.
2. Confirm Android debug build is green before creating release artifacts.
3. Generate signed APK and AAB.
4. Run the release-candidate QA matrix in `docs/android-tv-qa-matrix.md`.
5. Complete staging validation in `docs/staging-validation-runbook.md`.
6. Validate upgrade install over the currently deployed production version.
7. Archive release notes, QA evidence, and final artifact checksums.
8. Roll out to canary fleet using `docs/canary-production-launch.md` before broad deployment.

## CI Recommendations

- Inject signing secrets via environment variables, not committed files.
- Run `:app:assembleDebug` on every change.
- Run `:app:assembleRelease` and `:app:bundleRelease` on tagged releases only.
- Publish artifact metadata with version, commit SHA, build timestamp, and checksum.

## Rollback Rule

- Keep the previous production-signed APK / AAB and release notes.
- If a rollback is required, reinstall the prior production build with the same signing key.
- If data schema or preference compatibility changed, follow `docs/android-tv-upgrade-compatibility.md` before any rollback.
