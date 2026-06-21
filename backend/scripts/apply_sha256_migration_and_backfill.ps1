Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$repoRoot = Resolve-Path (Join-Path $repoRoot "..")

Set-Location $repoRoot

docker compose up -d

Set-Location (Join-Path $repoRoot "backend")

npm run prisma:deploy
npm run prisma:generate
npm run backfill:media-sha256

