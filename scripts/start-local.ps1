# One local path: Docker + WP + Vite; optional browser (optimizer catalog bundled at boot).
param(
    [switch]$OpenBrowser,
    [switch]$SkipDev
)

$ErrorActionPreference = "Stop"

$repoRoot = Split-Path $PSScriptRoot -Parent
$configPath = Join-Path $PSScriptRoot "local-wp-staging.config.json"
$viteLog = Join-Path $repoRoot ".local-dev-vite.log"
$vitePidFile = Join-Path $repoRoot ".local-dev-vite.pid"
$timeoutSec = 120

if (-not (Test-Path $configPath)) {
    Write-Host "Missing scripts/local-wp-staging.config.json" -ForegroundColor Red
    Write-Host "One-time: npm run setup:local-wp"
    exit 1
}

$config = Get-Content $configPath -Raw | ConvertFrom-Json
$siteUrl = ([string]$config.siteUrl).TrimEnd("/")
$wpSiteDir = Split-Path ([string]$config.wpRoot) -Parent
$pluginsDir = [string]$config.pluginsDir
$appUrl = if ($config.viteDevUrl) { [string]$config.viteDevUrl } else { "http://localhost:8080/" }
$appUrl = $appUrl -replace '#.*$', ''
if ($appUrl -notmatch '/$') { $appUrl = "$appUrl/" }

$pluginJunctionsStale = $false
$expectedPlugins = @{
    "neo-pulse-wp"  = Join-Path $repoRoot "wordpress-plugins\neo-pulse-wp"
    "neo-pulse-app" = Join-Path $repoRoot "wordpress-plugins\neo-pulse-app"
}
foreach ($entry in $expectedPlugins.GetEnumerator()) {
    $linkPath = Join-Path $pluginsDir $entry.Key
    if (-not (Test-Path $linkPath)) {
        $pluginJunctionsStale = $true
        break
    }
    $item = Get-Item $linkPath -Force
    if (-not ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) {
        $pluginJunctionsStale = $true
        break
    }
    $target = ($item.Target | Select-Object -First 1)
    if (-not $target -or ([IO.Path]::GetFullPath($target) -ne [IO.Path]::GetFullPath($entry.Value))) {
        $pluginJunctionsStale = $true
        break
    }
}

function Invoke-DockerCli {
    param(
        [Parameter(Mandatory = $true, ValueFromRemainingArguments = $true)]
        [string[]]$Args
    )
    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        & docker @Args 2>&1 | Out-Null
        return $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

function Test-DockerReady {
    return (Invoke-DockerCli info --format "{{.ServerVersion}}") -eq 0
}

function Start-DockerDesktopEngine {
    $dockerDesktop = @(
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe",
        "$env:LOCALAPPDATA\Programs\Docker\Docker\Docker Desktop.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if (-not $dockerDesktop) {
        Write-Host "Docker Desktop is not installed or could not be found." -ForegroundColor Red
        Write-Host "Install Docker Desktop, start it once, then run this script again."
        exit 1
    }

    Write-Host "Docker engine is offline. Starting Docker Desktop..." -ForegroundColor Cyan

    $prevEap = $ErrorActionPreference
    $ErrorActionPreference = "SilentlyContinue"
    try {
        $desktopStart = & docker desktop start 2>&1
        foreach ($line in @($desktopStart)) {
            if ($line) { Write-Host $line }
        }
        if ($LASTEXITCODE -ne 0) {
            Write-Host "docker desktop start unavailable; launching Docker Desktop app..." -ForegroundColor Yellow
            Start-Process -FilePath $dockerDesktop | Out-Null
        }
    } finally {
        $ErrorActionPreference = $prevEap
    }
}

function Wait-DockerReady([int]$MaxSeconds) {
    $deadline = (Get-Date).AddSeconds($MaxSeconds)
    $waitStarted = Get-Date
    while ((Get-Date) -lt $deadline) {
        if (Test-DockerReady) { return $true }
        $elapsed = [int](((Get-Date) - $waitStarted).TotalSeconds)
        Write-Host "  Waiting for Docker engine... ${elapsed}s (finish starting Docker Desktop if it is open)" -ForegroundColor DarkGray
        Start-Sleep -Seconds 5
    }
    return (Test-DockerReady)
}

function Wait-HttpOk([string]$Url, [int]$Sec) {
    $deadline = (Get-Date).AddSeconds($Sec)
    while ((Get-Date) -lt $deadline) {
        $code = curl.exe -k -s -o NUL -w "%{http_code}" $Url 2>$null
        if ($code -match "^(200|301|302)$") { return $true }
        Start-Sleep -Seconds 2
    }
    return $false
}

function Test-PortListen([int]$Port) {
    return [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1)
}

function Clear-ViteDepCache {
    $viteCache = Join-Path $repoRoot "node_modules\.vite"
    if (Test-Path $viteCache) {
        Remove-Item $viteCache -Recurse -Force -ErrorAction SilentlyContinue
    }
}

function Start-ViteDevServer {
    Clear-ViteDepCache
    if (Test-PortListen 8080) {
        Write-Host "Port 8080 is in use by another process. Close it and run start-neopulse-local.bat again." -ForegroundColor Red
        exit 1
    }

    Push-Location $repoRoot
    try {
        node scripts/bundle-automation-recipes-catalog.mjs
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    } finally {
        Pop-Location
    }

    "" | Set-Content -Path $viteLog -Encoding utf8
    $viteErrLog = Join-Path $repoRoot ".local-dev-vite.err.log"
    if (Test-Path $viteErrLog) {
        Remove-Item $viteErrLog -Force -ErrorAction SilentlyContinue
    }

    $env:LOCAL_DEV_VITE_FORCE = "1"
    $viteProc = Start-Process `
        -FilePath "node" `
        -ArgumentList @("scripts/dev-local.cjs") `
        -WorkingDirectory $repoRoot `
        -PassThru `
        -WindowStyle Minimized `
        -RedirectStandardOutput $viteLog `
        -RedirectStandardError $viteErrLog

    Set-Content -Path $vitePidFile -Value $viteProc.Id -NoNewline
}

function Stop-PreviousVite {
    if (Test-Path $vitePidFile) {
        $oldPid = (Get-Content $vitePidFile -Raw).Trim()
        if ($oldPid -match '^\d+$') {
            Stop-Process -Id ([int]$oldPid) -Force -ErrorAction SilentlyContinue
        }
        Remove-Item $vitePidFile -Force -ErrorAction SilentlyContinue
    }
    Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { $_.OwningProcess } |
        Select-Object -Unique |
        ForEach-Object {
            $p = Get-Process -Id $_ -ErrorAction SilentlyContinue
            if ($p -and ($p.ProcessName -eq "node" -or $p.ProcessName -eq "powershell")) {
                Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue
            }
        }
    Start-Sleep -Seconds 1
}

if (-not (Test-DockerReady)) {
    Start-DockerDesktopEngine
    if (-not (Wait-DockerReady 360)) {
        Write-Host "Docker did not become ready in 6 minutes." -ForegroundColor Red
        Write-Host "Open Docker Desktop manually, wait until it says Running, then run this script again."
        exit 1
    }
    Write-Host "Docker engine is ready." -ForegroundColor Green
}

if (-not (Test-Path (Join-Path $wpSiteDir "docker-compose.yml"))) {
    Write-Host "Missing docker-compose.yml in $wpSiteDir" -ForegroundColor Red
    exit 1
}

Write-Host "Starting neopulse.local containers..." -ForegroundColor Cyan
Write-Host "(MariaDB/nginx can take 30-90s; compose progress appears below.)" -ForegroundColor DarkGray
Push-Location $wpSiteDir
try {
    & docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Host "docker compose up failed (exit $LASTEXITCODE). Is Docker Desktop running?" -ForegroundColor Red
        exit 1
    }
} finally {
    Pop-Location
}
Write-Host "Containers up. Checking $siteUrl/ ..." -ForegroundColor Green

Write-Host "Waiting for $siteUrl/ ..." -ForegroundColor Cyan
if (-not (Wait-HttpOk "$siteUrl/" $timeoutSec)) {
    Write-Host "$siteUrl did not respond." -ForegroundColor Red
    exit 1
}

if ($pluginJunctionsStale) {
    Write-Host "Plugin junctions do not match this repo path. Re-syncing..." -ForegroundColor Yellow
    & (Join-Path $PSScriptRoot "sync-local-wp-plugins.ps1")
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

if (-not $SkipDev) {
    Write-Host "Starting Vite on port 8080..." -ForegroundColor Cyan
    Stop-PreviousVite
    Start-ViteDevServer

    if (-not (Wait-HttpOk "http://127.0.0.1:8080/" $timeoutSec)) {
        Write-Host "Vite did not start on 8080. See .local-dev-vite.log and .local-dev-vite.err.log" -ForegroundColor Red
        exit 1
    }

    if (-not (Wait-HttpOk "http://127.0.0.1:8080/node_modules/.vite/deps/react.js" $timeoutSec)) {
        Write-Host "Vite dependency prebundle did not finish. See .local-dev-vite.log" -ForegroundColor Red
        exit 1
    }
}

if ($OpenBrowser) {
    $chrome = @(
        "$env:ProgramFiles\Google\Chrome\Application\chrome.exe",
        "${env:ProgramFiles(x86)}\Google\Chrome\Application\chrome.exe",
        "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
    ) | Where-Object { Test-Path $_ } | Select-Object -First 1

    if ($chrome) {
        Start-Process -FilePath $chrome -ArgumentList $appUrl
    } else {
        Start-Process $appUrl
    }
}

if (-not $SkipDev) {
    Write-Host "Local ready: $appUrl" -ForegroundColor Green
} else {
    Write-Host "WordPress stack ready (Vite skipped)." -ForegroundColor Green
}
Write-Host "WordPress: $siteUrl/"
