# Copy this repo's project skills into the user-global Claude Code skills dir
# (~/.claude/skills). Run after merging a monthly refresh PR and `git pull`.
#
#   pwsh tools/sync-skills.ps1

$ErrorActionPreference = 'Stop'
$src = Join-Path $PSScriptRoot '..\.claude\skills'
$dst = Join-Path $HOME '.claude\skills'

if (-not (Test-Path $src)) { Write-Error "no skills dir at $src"; exit 1 }
New-Item -ItemType Directory -Force -Path $dst | Out-Null

$count = 0
Get-ChildItem -Path $src -Directory | ForEach-Object {
    $target = Join-Path $dst $_.Name
    New-Item -ItemType Directory -Force -Path $target | Out-Null
    Copy-Item -Path (Join-Path $_.FullName '*') -Destination $target -Recurse -Force
    Write-Host "synced $($_.Name)"
    $count++
}
Write-Host "$count skill(s) synced to $dst"
