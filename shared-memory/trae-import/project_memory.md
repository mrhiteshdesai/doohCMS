## Project Context
- Smartags: A DOOH (Digital Out-of-Home) CMS and player ecosystem.
- Backend: Node.js with Prisma and PostgreSQL (Supabase).
- Player: Android Native (Kotlin) using ExoPlayer for media playback.

## User Confirmed
- Native TV Player must function exactly like the Web Player (/player) regarding UI and logic.
- Background Sync: New playlists must download fully in the background before swapping playback to avoid black screens.

## Hard Constraints
- Database schema: `SystemSettings` table must include `cdn` and `traffic` columns (JSONB).
- Android Network: All HTTP calls must run on `Dispatchers.IO` to avoid `NetworkOnMainThreadException`.

## Lessons Learned
- Emulator DNS: Use explicit DNS (8.8.8.8) if the emulator fails to resolve backend domains.
- Checksum Validation: JSON `null` values for sha256 must be handled strictly.
- ExoPlayer Lifecycle: Ensure players are not released during transition periods.
- Build Process: Windows file locking (e.g., `R.jar`) may require building from a temporary directory.
- Crash Recovery: Startup crash loops can occur if cached manifest data is null/invalid when parsed as a `JSONObject` in `MainActivity.kt`.