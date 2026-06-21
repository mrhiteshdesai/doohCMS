# Canary Production Launch

## Goal

Roll out Smartags safely to production using a monitored canary process with explicit promotion and rollback gates.

## Rollout Phases

| Phase | Fleet slice | Minimum duration | Promotion gate |
| --- | --- | --- | --- |
| Stage 0 | Internal QA only | Until pass | Staging runbook complete |
| Stage 1 | 3-5 internal/canary screens | 24 hours | No blocker issue, healthy telemetry |
| Stage 2 | 5-10% of fleet | 24 hours | No P1/P2 issue, stable metrics |
| Stage 3 | 25-50% of fleet | 24 hours | No trend regression |
| Stage 4 | 100% fleet | As approved | Release owner signoff |

## Pre-Launch Gate

Before Stage 1:

1. Complete `docs/staging-validation-runbook.md`.
2. Confirm current production backup and rollback artifact exist.
3. Confirm release notes, version, checksums, and change summary are archived.
4. Confirm support/on-call coverage for the canary window.
5. Confirm dashboard access for:
   - heartbeats
   - playback state
   - download state
   - screen logs
   - snapshot requests
   - support bundles

## Canary Cohort Selection

Choose devices that cover:

- oldest supported Android TV version
- at least one certified TV
- at least one operator box
- at least one cheap generic box
- one device on weaker Wi-Fi
- one device with a history of decoder/storage instability

Do not start with premium lab devices only.

## Metrics To Watch

Monitor throughout each rollout stage:

- online screen count versus expected
- heartbeat freshness
- playback state distribution
- download state distribution
- command failure rate
- snapshot success rate
- support-bundle success rate
- backend readiness failures
- 5xx rate and latency on `/api/player/heartbeat`

## Promotion Rules

Promote only if all are true for the full observation window:

- no P1 incident
- no P2 incident without a confirmed workaround
- no increase in crash loops or blank-screen reports
- no meaningful rise in heartbeat latency or failure rate
- no pairing regression
- no support-bundle or snapshot regression

## Rollback Rules

Rollback immediately if any of these happen:

- widespread blank screen
- crash loop or startup failure
- fleet-wide pairing/token regression
- severe backend instability or readiness failures
- upgrade corruption on canary cohort

Rollback steps:

1. Stop further rollout immediately.
2. Revert backend/frontend deployment to prior known-good release if the fault is server-side.
3. Reinstall prior signed Android build for affected canary devices if the fault is player-side.
4. Collect snapshot/support bundle from reachable devices.
5. Open incident record with exact affected cohort and timestamps.

## Production Launch Checklist

### Stage 1

- Deploy backend/frontend release.
- Upgrade or install canary player build on 3-5 selected screens.
- Observe for 24 hours.

### Stage 2

- Expand to 5-10% of fleet.
- Re-run spot checks for pairing, publish, reload, snapshot, and support bundle.
- Observe for 24 hours.

### Stage 3

- Expand to 25-50% of fleet.
- Watch for hardware-specific regressions by device class.
- Observe for 24 hours.

### Stage 4

- Approve full rollout.
- Keep rollback artifacts and operator coverage in place for 48 hours after completion.

## Evidence To Save

- rollout start/end time per stage
- cohort screen IDs and device classes
- heartbeat and latency graphs
- issue log with severity and resolution
- snapshots/support bundles for any incident
- final release signoff note
