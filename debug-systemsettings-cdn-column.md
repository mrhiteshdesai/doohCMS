# Debug Session: systemsettings-cdn-column

- Status: OPEN
- Symptom: `Screen > Add New Screen` fails with `Invalid prisma.systemSettings.findFirst() invocation: The column SystemSettings.cdn does not exist in the current database.`
- Scope: Backend runtime / database schema mismatch
- Initial hypotheses:
  - Production database is missing the `SystemSettings.cdn` column expected by the current Prisma schema.
  - Prisma client was generated from a newer schema than the deployed database.
  - `Add New Screen` triggers a settings read path that now selects the `cdn` field.
  - A migration for `SystemSettings.cdn` exists but was not applied in production.
  - The backend deploy advanced ahead of the Supabase schema again.

## Evidence Log

- Session created. No code logic changes made yet.
- Confirmed `backend/prisma/schema.prisma` defines `SystemSettings.cdn` and `SystemSettings.traffic`.
- Confirmed `backend/src/services/systemSettingsService.ts` calls `prisma.systemSettings.findFirst()` without a field-limited select, so Prisma reads all modeled columns.
- Confirmed `backend/prisma/migrations/0_init/migration.sql` creates `SystemSettings` with only `storage`, `createdAt`, and `updatedAt`.
- Confirmed there was no later migration adding `cdn` or `traffic`.
- Added migration `20260622000000_add_systemsettings_cdn_traffic` to align the database schema with the deployed Prisma model.
