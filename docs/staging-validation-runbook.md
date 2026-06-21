# Staging Validation Runbook

## Goal

Validate the Smartags CMS and native player in a production-like staging environment before any canary or production rollout.

## Staging Requirements

- Separate staging database and object storage from production.
- Staging backend deployed with the same image/build process as production.
- Staging frontend deployed behind the same proxy/TLS pattern as production.
- At least:
  - 1 Android TV emulator
  - 2 certified Android TV / Google TV devices
  - 2 operator boxes
  - 1 cheap generic Android box
- Staging admin credentials and at least one seeded tenant.

## Environment Checklist

1. Set backend env from `backend/.env.example` with staging secrets and staging CORS origins.
2. Confirm `/health/live` and `/health/ready` return `200`.
3. Confirm storage writes succeed for snapshots and support bundles.
4. Confirm release APK/AAB are signed with the production signing key or staging-equivalent key accepted by upgrade policy.
5. Confirm previous production APK is available for upgrade testing.

## Pre-QA Build Gate

1. Build backend:

```powershell
cd backend
npm run build
```

2. Build frontend:

```powershell
cd frontend
npm run build
```

3. Build Android release candidate:

```powershell
cd android_native_player
.\scripts\build-release.ps1 -VersionName 1.0.0-rcX -VersionCode 10000
```

## Synthetic Staging Checks

### Functional QA Script

Run the repo QA workflow against staging:

```powershell
cd backend
$env:SMARTAGS_BASE_URL="https://staging.example.com/api"
$env:SMARTAGS_ADMIN_EMAIL="admin@example.com"
$env:SMARTAGS_ADMIN_PASSWORD="replace-me"
npm run qa:staging
```

Expected outcomes:

- pairing succeeds
- screen token is issued
- protected CMS routes reject unauthenticated access
- snapshot and heartbeat flows remain healthy

### Heartbeat Load Test

Run staged heartbeat/load validation:

```powershell
cd backend
$env:SMARTAGS_BASE_URL="https://staging.example.com/api"
$env:SMARTAGS_ADMIN_EMAIL="admin@example.com"
$env:SMARTAGS_ADMIN_PASSWORD="replace-me"
$env:SMARTAGS_LOAD_STAGES="25,50,100,200"
$env:SMARTAGS_REQUESTS_PER_STAGE="200"
$env:SMARTAGS_WARN_P95_MS="1000"
$env:SMARTAGS_FAIL_ERROR_RATE_PCT="2"
npm run load:heartbeat
```

Pass gate:

- error rate stays below `2%`
- p95 latency stays below `1000ms`
- no readiness failures or restart loops during the run

## Real-Device QA

Execute `docs/android-tv-qa-matrix.md` in full and capture evidence for:

- fresh pairing
- mixed-asset playback
- offline continuation
- manifest refresh
- stuck-download recovery
- stuck-playback recovery
- crash recovery
- snapshot upload
- support-bundle export
- upgrade install over current production version

## Staging Exit Criteria

- Backend and frontend builds are green.
- Android signed release candidate is green.
- `npm run qa:staging` passes.
- `npm run load:heartbeat` passes at agreed fleet target for staging.
- Android TV QA matrix passes on all required device classes.
- No blocker or high-severity issue remains open.
- Snapshot and support-bundle flows succeed end-to-end.

## Evidence Package

Archive:

- backend/frontend build logs
- Android release artifact filenames and checksums
- QA script output
- load test output
- device QA matrix with pass/fail status
- screenshots of staging observability metrics
- snapshots/support bundles for any failures
