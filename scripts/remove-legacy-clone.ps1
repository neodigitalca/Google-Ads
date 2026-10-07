# Permanently delete duplicate NEO Pulse checkout (legacy "Generation defaults" UI).
# Do NOT run until Pipeline agents UI is verified on localhost:8080 from pulse.
#
#   powershell -ExecutionPolicy Bypass -File scripts/verify-pulse-dev-ui.ps1
#   powershell -ExecutionPolicy Bypass -File scripts/remove-legacy-clone.ps1 -AfterVerify

param(
    [switch]$AfterVerify
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$repoFull = [IO.Path]::GetFullPath($repoRoot).TrimEnd('\')
if ((Split-Path $repoFull -Leaf) -ieq 'pulse') {
    $legacyPath = Join-Path (Split-Path $repoFull -Parent) "Google-Ads-main"
} else {
    $legacyPath = Join-Path $repoFull "Google-Ads-main"
}
$verifyStamp = Join-Path $repoRoot ".local-dev-pipeline-ui-verified"
$parentNeo = Split-Path $repoRoot -Parent

function Write-Ok([string]$Message) {
    Write-Host $Message -ForegroundColor Green
}

function Force-RemoveDirectory([string]$Path) {
    if (-not (Test-Path -LiteralPath $Path)) { return $true }
    try {
        Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction Stop
        return -not (Test-Path -LiteralPath $Path)
    } catch {
        Write-Host "Remove-Item failed ($($_.Exception.Message)). Trying robocopy empty mirror..." -ForegroundColor Yellow
    }
    $empty = Join-Path ([IO.Path]::GetTempPath()) ("neo-pulse-empty-" + [guid]::NewGuid().ToString("n"))
    New-Item -ItemType Directory -Path $empty -Force | Out-Null
    & robocopy.exe $empty $Path /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    Remove-Item -LiteralPath $empty -Force -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $Path -Recurse -Force -ErrorAction SilentlyContinue
    return -not (Test-Path -LiteralPath $Path)
}

function Remove-LegacyPathIfPresent([string]$Path, [string]$Label) {
    if (-not (Test-Path -LiteralPath $Path)) { return }
    Write-Host "Removing $Label : $Path" -ForegroundColor Cyan
    if (Force-RemoveDirectory $Path) {
        Write-Ok "Removed $Label"
        return
    }
    $src = Join-Path $Path "src"
    if (-not (Test-Path -LiteralPath $src)) {
        Write-Host "Folder handle still locked but src/ is gone; legacy app code is destroyed." -ForegroundColor Yellow
        return
    }
    throw "Could not remove $Path"
}

if (-not $AfterVerify) {
    Write-Host "Refusing: clone delete runs only after UI verify." -ForegroundColor Red
    Write-Host "  1) Fix localhost:8080 so pulse serves Pipeline agents"
    Write-Host "  2) powershell -File scripts/verify-pulse-dev-ui.ps1"
    Write-Host "  3) powershell -File scripts/remove-legacy-clone.ps1 -AfterVerify"
    exit 1
}

if (-not (Test-Path -LiteralPath $verifyStamp)) {
    Write-Host "Refusing: missing verify stamp. Run scripts/verify-pulse-dev-ui.ps1 first." -ForegroundColor Red
    exit 1
}

$stampText = Get-Content -LiteralPath $verifyStamp -Raw
$expectedRoot = [IO.Path]::GetFullPath($repoRoot).TrimEnd('\')
if ($stampText -notmatch [regex]::Escape($expectedRoot)) {
    Write-Host "Refusing: verify stamp does not match this repo root." -ForegroundColor Red
    exit 1
}

foreach ($port in @(8080, 10000)) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

Remove-LegacyPathIfPresent (Join-Path $parentNeo "_DELETED_Google-Ads-main") "old archive folder"
Remove-LegacyPathIfPresent $legacyPath "legacy clone Google-Ads-main"

if (Test-Path -LiteralPath $legacyPath) {
    $legacySrc = Join-Path $legacyPath "src"
    if (Test-Path -LiteralPath $legacySrc) {
        Write-Host "Legacy clone still has src/. Close Cursor/terminals rooted at Google-Ads-main and retry." -ForegroundColor Red
        exit 1
    }
    Write-Host "Empty Google-Ads-main folder may remain until you close that workspace in Cursor." -ForegroundColor Yellow
}

Remove-Item -LiteralPath $verifyStamp -Force -ErrorAction SilentlyContinue
Write-Ok "Done. Use only b:\Neo Pulse\pulse + start-neopulse-local.bat"
