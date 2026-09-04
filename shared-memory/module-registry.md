# Module Registry

Canonical Smartags (with Android native player).

| Module ID | Name | Status | Notes |
|-----------|------|--------|-------|
| M01 | Tenancy, Auth & RBAC | Planned | |
| M02 | Screens, pairing, heartbeats | Planned | |
| M03 | Media library | Planned | |
| M04 | Layouts & widgets | Planned | |
| M05 | Playlists | Planned | |
| M06 | Schedules | Planned | |
| M07 | Web player (`player/` + `/player`) | Planned | Source of truth for native |
| M08 | **Android native player** (Kotlin/ExoPlayer) | Planned | `android_native_player/` — parity with M07; OTA UPDATE_APP + Device Owner silent install |
| M09 | Proof of Play / Timescale | Planned | See TIMESCALEDB_MIGRATION_ROADMAP.md |
| M10 | SystemSettings CDN/traffic | Planned | Hard constraint |
| M11 | Kiosk / watchdog / offline sync | Planned | Native: OfflineMediaManager, Kiosk* |
| M12 | App OTA releases | In Progress | `/api/app-releases`, CMS App Releases page, native `AppUpdateManager` |
| M13 | VAST ad slots | In Progress | Playlist `AD_SLOT` + vastUrl + fallback media; native/web fill; AdImpression |

Brownfield: inventory code before treating as greenfield.
