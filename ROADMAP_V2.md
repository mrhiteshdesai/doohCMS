# Smartags v2 Roadmap

## 1. Scalability & Infrastructure
- [ ] **Redis Integration**
  - Implement Redis adapter for Socket.io to support multi-node scaling.
  - Cache playlist generation to reduce DB load.
- [ ] **CDN Integration**
  - Configure CloudFront/Cloudflare for media delivery.
  - Update backend to generate CDN URLs instead of direct S3/local links.
- [ ] **Log Aggregation**
  - Move "Proof of Play" logs to ClickHouse/TimescaleDB.
  - Create a separate microservice for log ingestion.

## 2. Android Player Development (Capacitor)
- [ ] **Core Setup**
  - Initialize Capacitor in frontend project.
  - Configure Android platform.
- [ ] **Native Plugins**
  - `@capacitor/filesystem` for offline media caching.
  - `@capacitor/device` for unique device ID (Mac Address).
  - `capacitor-screenshot` for remote monitoring.
  - Kiosk mode plugin.
- [ ] **Features**
  - "Boot on Startup" receiver.
  - Socket.io listener for remote commands (Reboot, Screenshot, Volume).
  - Native video player overlay for 4K performance.

## 3. Resilience
- [ ] **Offline First**
  - Ensure full playlist download before playback.
  - Local IndexedDB for metadata storage.
- [ ] **Watchdog**
  - Auto-restart app on crash/freeze.
