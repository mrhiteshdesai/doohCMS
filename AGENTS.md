# Project Context

## Project
- **Name:** Smartags
- **Type:** DOOH CMS
- **Description:** Digital Out-of-Home CMS + web player + **Android native TV player** (Kotlin / ExoPlayer). Canonical working copy: `C:\Projects\Smartags`.

## Requirements
- **Status:** IN_PROGRESS (brownfield)
- **Frozen date:** —
- **Source:** Codebase + Trae memory + debug/QA docs in repo

## Important — wrong folder corrected
- Previously onboarded by mistake: `C:\Projects\Smartags-V2` (from backup `Smartags V2`)
- **Use this project instead:** `C:\Projects\Smartags` (from backup `Smartags`)
- See `C:\Projects\Smartags-V2\SUPERSEDED.md`

## Stack overrides
- **Web / CMS:** React (frontend)
- **Web player:** `player/` and/or frontend `/player` route — native must match this behavior
- **Backend:** Node.js + Prisma + PostgreSQL (Supabase historically; local Timescale via docker-compose on **5433**)
- **Mobile / TV player:** **Android Native (Kotlin) + ExoPlayer** in `android_native_player/` (also `android/`)
- **Not** Capacitor-first for this canonical tree — native Kotlin player is the real player track

## Current state
- **Migration:** Copied 2026-07-31 from `C:\Files\ManualTraeMigrationBackup\projects\trae_projects\Smartags`
- **Git:** Yes
- **Excluded from copy:** `node_modules`, android `*_tmp` build folders, `_backup*`

## Ports
- Timescale/Postgres (compose): host **5433** → DB `smartags` (user/pass per `docker-compose.yml`)

## Active expertise packs
- [x] DOOH CMS / broadcast
- [x] Offline / edge / sync (native offline media)
- [x] Observability (PoP, heartbeats, snapshots)
- [x] SaaS multi-tenancy (if Tenant in schema)

## Hard constraints (Trae memory — mandatory)
1. Native TV player UI/logic must match **Web Player** (`/player`).
2. Background sync: full playlist download before playback swap (no black screens).
3. `SystemSettings` must include `cdn` and `traffic` JSONB columns.
4. Android: all HTTP on `Dispatchers.IO` (no NetworkOnMainThreadException).
5. Handle `sha256` JSON nulls strictly; careful ExoPlayer lifecycle; kiosk/watchdog present in native code.

## Key folders
| Path | Purpose |
|------|---------|
| `backend/` | CMS API |
| `frontend/` | Admin CMS UI |
| `player/` | Web player |
| `android_native_player/` | **Kotlin/ExoPlayer native player** (primary) |
| `android/` | Related Android project |
| `TIMESCALEDB_MIGRATION_ROADMAP.md` | Logs/DB roadmap |
| Debug `debug-*.md` | Known issues (emulator sync, snapshot crash, CDN column) |

## Module-wise delivery
- Module-by-module with local review
- Player work: always verify web player + native parity

## Where we left off
Correct Smartags tree onboarded with Android native player. Next: open `C:\Projects\Smartags` in Cursor, npm install, docker compose, inventory CMS vs native player modules.
