# TimescaleDB Migration Roadmap

## Overview
This roadmap details the steps to migrate Logs and Proof of Play (PoP) data from standard PostgreSQL to TimescaleDB to leverage hypertable partitioning for better performance and scalability.

## Phase 1: Infrastructure Preparation (Completed)
- **Objective**: Set up TimescaleDB instance.
- **Action**: 
  - Updated `docker-compose.yml` to include `timescale/timescaledb:latest-pg14` image.
  - Mapped TimescaleDB to port `5433` (to allow parallel running with existing Postgres if needed, though we switched backend to it).
  - Verified `timescaledb` extension availability.

## Phase 2: Schema Modification (Completed)
- **Objective**: Prepare Prisma schema for Hypertables and Optimization.
- **Requirement**: TimescaleDB hypertables require the time partitioning column to be part of the primary key.
- **Changes**:
  - Modified `ProofOfPlay`: PK changed from `id` to `(id, startedAt)`.
  - Modified `ScreenHeartbeat`: PK changed from `id` to `(id, timestamp)`.
  - Modified `ScreenLog`: PK changed from `id` to `(id, createdAt)`.
  - Modified `AuditLog`: PK changed from `id` to `(id, createdAt)`.
  - **Refactoring**: Added `@@index` on Foreign Keys (`screenId`, `tenantId`, etc.) for all time-series tables to ensure query performance.

## Phase 3: Migration Execution (Completed)
- **Objective**: Apply schema changes and convert tables.
- **Steps Taken**:
  1. **Schema Push**: Used `prisma db push` to update the database schema with new primary keys and indices.
  2. **Hypertable Conversion**: Executed SQL commands to convert standard tables to hypertables:
     ```sql
     SELECT create_hypertable('"ProofOfPlay"', 'startedAt', if_not_exists => TRUE);
     SELECT create_hypertable('"ScreenHeartbeat"', 'timestamp', if_not_exists => TRUE);
     SELECT create_hypertable('"ScreenLog"', 'createdAt', if_not_exists => TRUE);
     SELECT create_hypertable('"AuditLog"', 'createdAt', if_not_exists => TRUE);
     ```

## Phase 4: Optimization (Completed)
- **Objective**: Enable Compression and Retention Policies.
- **Action**:
  - **Compression Enabled**:
    - `ScreenHeartbeat`: Segment by `screenId`, Compress after 7 days.
    - `ScreenLog`: Segment by `screenId`, Compress after 7 days.
    - `ProofOfPlay`: Segment by `screenId,tenantId`, Compress after 7 days.
    - `AuditLog`: Segment by `tenantId`, Compress after 7 days.
  - **Retention Policies**:
    - `ScreenHeartbeat`: Auto-delete after 30 days.
    - `ScreenLog`: Auto-delete after 30 days.
    - `AuditLog`: Auto-delete after 1 year (Compliance).
    - `ProofOfPlay`: No retention policy (Permanent record).

## Phase 5: Application Update (Completed)
- **Objective**: Ensure Backend connects to TimescaleDB.
- **Action**:
  - Updated `backend/.env` `DATABASE_URL` to point to port `5433`.
  - Regenerated Prisma Client.
  - Bootstrapped admin user in the new database.

## Phase 6: Verification (Completed)
- **Checks**:
  - Verified tables exist and have correct composite primary keys.
  - Verified tables are registered as hypertables in TimescaleDB.
  - Verified Compression and Retention policies are applied.
  - Backend successfully connects and creates data.
