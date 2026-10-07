# Gate: confirm localhost:8080 serves pulse Pipeline agents UI (not legacy Generation defaults).
# On success writes .local-dev-pipeline-ui-verified for remove-legacy-clone.ps1 -AfterVerify.

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path $PSScriptRoot -Parent
$expected = [IO.Path]::GetFullPath($repoRoot).TrimEnd('\')
$verifyStamp = Join-Path $repoRoot ".local-dev-pipeline-ui-verified"
$fail = $false

function Write-Ok([string]$Message) { Write-Host $Message -ForegroundColor Green }
function Write-Bad([string]$Message) { Write-Host $Message -ForegroundColor Red; $script:fail = $true }

Write-Host "Verifying pulse dev UI on http://127.0.0.1:8080 ..." -ForegroundColor Cyan

$metaRaw = curl.exe -s "http://127.0.0.1:8080/__neo-pulse/dev-meta.json" 2>$null
if (-not $metaRaw) {
    Write-Bad "No dev-meta.json. Start Vite from pulse (start-neopulse-local.bat)."
} else {
    $meta = $metaRaw | ConvertFrom-Json
    $served = [IO.Path]::GetFullPath([string]$meta.repoRoot).TrimEnd('\')
    if ($served -ne $expected) {
        Write-Bad "Wrong repo on 8080. Expected: $expected  Actual: $served"
    } else {
        Write-Ok "dev-meta repoRoot is pulse"
    }
}

$uiRaw = curl.exe -s "http://127.0.0.1:8080/__neo-pulse/dev-ui.json" 2>$null
if ($uiRaw) {
    $ui = $uiRaw | ConvertFrom-Json
    if ([string]$ui.aiModelsPanel -ne "pipeline-agents-v3") {
        Write-Bad "dev-ui.json aiModelsPanel is not pipeline-agents-v3"
    } else {
        Write-Ok "dev-ui.json pipeline-agents-v3"
    }
} else {
    Write-Bad "No dev-ui.json"
}

$tsx = (curl.exe -s "http://127.0.0.1:8080/src/components/manager/AiModelsSettingsContent.tsx" 2>$null | Out-String)
if ($tsx -match "Generation defaults" -or $tsx -match "onModelChange") {
    Write-Bad "Served AiModelsSettingsContent.tsx is legacy (Generation defaults / onModelChange)"
} elseif ($tsx -notmatch "LLMSettingsTabContent" -or ($tsx -notmatch "setReportModel" -and $tsx -notmatch "onReportModelChange")) {
    Write-Bad "Served AiModelsSettingsContent.tsx is not the six-agent dashboard UI"
} else {
    Write-Ok "Served AiModelsSettingsContent.tsx is six-agent LLMSettingsTabContent"
}

if ($fail) {
    Write-Host "Verify failed. Fix Vite/cache/wrong checkout before deleting Google-Ads-main." -ForegroundColor Red
    exit 1
}

$stamp = "verifiedAt=$(Get-Date -Format o)`nrepoRoot=$expected`n"
Set-Content -LiteralPath $verifyStamp -Value $stamp -Encoding utf8 -NoNewline
Write-Ok "Verify passed. Stamp written. Safe to run: scripts/remove-legacy-clone.ps1 -AfterVerify"
