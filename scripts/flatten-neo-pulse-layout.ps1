# One-time: delete Google-Ads-main and lift B:\Neo Pulse\pulse\* to B:\Neo Pulse\
$ErrorActionPreference = "Stop"
$parent = "B:\Neo Pulse"
$inner = Join-Path $parent "pulse"
$legacy = Join-Path $parent "Google-Ads-main"

foreach ($port in @(8080, 10000)) {
    Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
        ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
}

if (Test-Path -LiteralPath $legacy) {
    Write-Host "Removing $legacy ..."
    Remove-Item -LiteralPath $legacy -Recurse -Force -ErrorAction SilentlyContinue
    if (Test-Path -LiteralPath $legacy) {
        $empty = Join-Path $env:TEMP ("neo-empty-" + [guid]::NewGuid().ToString("n"))
        New-Item -ItemType Directory -Path $empty -Force | Out-Null
        & robocopy.exe $empty $legacy /MIR /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
        Remove-Item -LiteralPath $empty -Force -ErrorAction SilentlyContinue
        Remove-Item -LiteralPath $legacy -Recurse -Force -ErrorAction SilentlyContinue
    }
}

if (-not (Test-Path -LiteralPath $inner)) {
    Write-Host "No inner pulse folder; already flat."
    exit 0
}

$gitAtParent = Test-Path -LiteralPath (Join-Path $parent ".git")
$gitAtInner = Test-Path -LiteralPath (Join-Path $inner ".git")
if ($gitAtParent -and $gitAtInner) {
    Write-Host "Refusing: .git exists at both parent and pulse subfolder." -ForegroundColor Red
    exit 1
}

Write-Host "Moving repo from $inner to $parent ..."
Get-ChildItem -LiteralPath $inner -Force | ForEach-Object {
    $dest = Join-Path $parent $_.Name
    if (Test-Path -LiteralPath $dest) {
        Write-Host "Refusing: destination already exists: $dest" -ForegroundColor Red
        exit 1
    }
    Move-Item -LiteralPath $_.FullName -Destination $parent -Force
}

Remove-Item -LiteralPath $inner -Force -ErrorAction SilentlyContinue
Write-Host "Done. Reopen Cursor at B:\Neo Pulse" -ForegroundColor Green
