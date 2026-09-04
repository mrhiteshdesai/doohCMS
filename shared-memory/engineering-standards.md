# Engineering Standards — Smartags

## Stack
- Backend: Node + Prisma + PostgreSQL/Timescale (compose port 5433)
- Frontend: React CMS
- Web player: `player/`
- **TV/Android player: Kotlin + ExoPlayer** (`android_native_player/`)

## Player parity rule
Native player must match web player UI and logic. Background-download playlist fully before swap.

## Android
- HTTP on `Dispatchers.IO` only
- Strict sha256 null handling
- ExoPlayer lifecycle: do not release during transitions
- Windows build locks: may need temp build dir (see Trae lessons)

## SystemSettings
Must include `cdn` and `traffic` JSONB columns.
