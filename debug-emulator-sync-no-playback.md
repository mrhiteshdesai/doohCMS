# Debug Session: emulator-sync-no-playback

- Status: OPEN
- Symptom: After screen pairing and content publish, the emulator still shows pairing code, briefly shows "Syncing playlist", then nothing plays.
- Scope: Android TV native player pairing/content/playback runtime path
- Initial hypotheses:
  - The player receives a pairing token, but `/player/content` returns empty or malformed content so playback never starts.
  - The app is stuck between old pairing state and new paired state in device-protected shared preferences.
  - Content is returned, but media URLs are unreachable from the emulator so playback never advances.
  - The backend marks the screen paired, but the active playlist/content payload for that screen is missing or unpublished.
  - The app is encountering a playback/runtime error after fetch and only logging it in native ops / logcat.

## Evidence Log

- Session created. No code logic changes made yet.
- Confirmed emulator is paired and has a persisted `screen_token`.
- Confirmed `/api/player/content` returns a valid playlist with media items for the paired screen.
- Confirmed native logs show repeated `Fetched remote playlist manifest` followed by `stuck_playback`, so the issue is after content fetch.
- Instrumentation proved incoming media metadata contains `sha256: "null"` on device, even though the backend payload field is JSON null.
- Confirmed the offline sync path treats non-null `sha256` as authoritative and can raise `Checksum mismatch`, blocking playback while the player stays in `SYNCING`.
- Applied a minimal fix to normalize JSON null-like strings to real nulls in parsing and checksum handling so offline validation ignores absent checksums instead of treating `"null"` as a real hash.
