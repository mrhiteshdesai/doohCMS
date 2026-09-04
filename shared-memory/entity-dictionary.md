# Entity Dictionary

Source: `backend/prisma/schema.prisma` (canonical Smartags)

| Entity | Description | Module | PII |
|--------|-------------|--------|-----|
| Tenant | Multi-tenant org | Tenancy | No |
| User / Role / UserRole | Auth & RBAC | Auth | Yes |
| Layout / LayoutZone / Widget | Layouts | Layouts | No |
| Playlist / PlaylistZone / PlaylistZoneItem | Playlists | Playlists | No |
| Screen / ScreenGroup / ScreenGroupMember | Screens | Screens | No |
| ScreenPairingCode / Heartbeat / Log / Snapshot | Device ops | Device ops | Partial |
| MediaFolder / MediaFile | Media library | Media | No |
| ProofOfPlay | Playback proofs | PoP | No |
| Schedule | Scheduling | Schedules | No |
| SystemSettings | Includes **cdn** + **traffic** JSONB | Settings | No |
| AuditLog / ApiKey | Audit & keys | Security | Partial |
