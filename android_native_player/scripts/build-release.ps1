param(
    [Parameter(Mandatory = $false)]
    [string]$VersionName = "1.0.0",

    [Parameter(Mandatory = $false)]
    [int]$VersionCode = 1,

    [Parameter(Mandatory = $false)]
    [switch]$BundleOnly,

    [Parameter(Mandatory = $false)]
    [switch]$Clean
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$projectRoot = Split-Path -Parent $scriptDir
$gradleWrapper = Join-Path $projectRoot "gradlew.bat"
$keystoreProperties = Join-Path $projectRoot "keystore.properties"

if (-not (Test-Path $gradleWrapper)) {
    throw "gradlew.bat not found at $gradleWrapper"
}

if (-not (Get-Command java -ErrorAction SilentlyContinue)) {
    throw "Java is not on PATH. Set JAVA_HOME and prepend `$env:JAVA_HOME\bin to PATH before running this script."
}

if (-not (Test-Path $keystoreProperties) -and -not $env:SMARTAGS_RELEASE_STORE_FILE) {
    throw "Missing signing config. Copy keystore.properties.example to keystore.properties or set SMARTAGS_RELEASE_* environment variables."
}

$env:SMARTAGS_VERSION_NAME = $VersionName
$env:SMARTAGS_VERSION_CODE = "$VersionCode"

$tasks = @()
if ($Clean) {
    $tasks += "clean"
}
$tasks += ":app:bundleRelease"
if (-not $BundleOnly) {
    $tasks += ":app:assembleRelease"
}

Write-Host "Building Smartags Android TV release..."
Write-Host "VersionName: $VersionName"
Write-Host "VersionCode: $VersionCode"
Write-Host "Tasks: $($tasks -join ', ')"

Push-Location $projectRoot
try {
    & $gradleWrapper $tasks
} finally {
    Pop-Location
}

$apkDir = Join-Path $projectRoot "app\build\outputs\apk\release"
$bundleDir = Join-Path $projectRoot "app\build\outputs\bundle\release"

Write-Host ""
Write-Host "Release artifacts:"
if (Test-Path $apkDir) {
    Get-ChildItem $apkDir | Select-Object FullName, Length, LastWriteTime
}
if (Test-Path $bundleDir) {
    Get-ChildItem $bundleDir | Select-Object FullName, Length, LastWriteTime
}
