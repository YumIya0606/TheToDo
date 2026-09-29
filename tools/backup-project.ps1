param(
  [string]$Source = "D:\PROJECTS\TheToDo\test",
  [string]$DestRoot = "D:\PROJECTS\TheToDo\backup"
)

# Copies a project, skipping the huge regenerable build trees, then VERIFIES the
# copy before reporting success.
#
# The exclusion test has to look at every path segment, not just the first one or
# two: `src-tauri\target\...` is nested two levels down, and a prefix-only check
# silently copies 11 GB of Rust build output and fills the disk.

$ErrorActionPreference = "Stop"
$excludeDirs = @("node_modules", "target", "dist", ".git", ".vite", ".kilo")

$stamp    = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$target   = Join-Path $DestRoot "test_$stamp"
$srcRoot  = (Resolve-Path $Source).Path

Write-Host "Backing up"
Write-Host "  from : $srcRoot"
Write-Host "  to   : $target"
Write-Host "  skip : $($excludeDirs -join ', ')"
Write-Host ""

$freeBefore = (Get-PSDrive D).Free / 1GB
New-Item -ItemType Directory -Path $target -Force | Out-Null

$copied = 0
$copiedBytes = 0L

Get-ChildItem $srcRoot -Recurse -File -Force -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring($srcRoot.Length).TrimStart('\')
  $segments = $rel -split '\\'

  # Skip if ANY segment is an excluded directory name.
  if ($segments | Where-Object { $excludeDirs -contains $_ }) { return }

  $out = Join-Path $target $rel
  $dir = Split-Path $out -Parent
  if (-not (Test-Path -LiteralPath $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
  }
  Copy-Item -LiteralPath $_.FullName -Destination $out -Force
  $script:copied++
  $script:copiedBytes += $_.Length
}

# Any file that was NOT skipped must exist at the destination, same size.
$expected = Get-ChildItem $srcRoot -Recurse -File -Force -ErrorAction SilentlyContinue |
  Where-Object { $s = $_.FullName.Substring($srcRoot.Length).TrimStart('\') -split '\\'; -not ($s | Where-Object { $excludeDirs -contains $_ }) }

$missing = 0
$mismatch = 0
foreach ($f in $expected) {
  $rel = $f.FullName.Substring($srcRoot.Length).TrimStart('\')
  $out = Join-Path $target $rel
  if (-not (Test-Path -LiteralPath $out)) { $missing++; continue }
  if ((Get-Item -LiteralPath $out).Length -ne $f.Length) { $mismatch++ }
}

$freeAfter = (Get-PSDrive D).Free / 1GB

Write-Host ""
Write-Host "  source files (excluding build trees): $($expected.Count)"
Write-Host "  copied                             : $copied"
Write-Host "  size                               : $([math]::Round($copiedBytes/1MB,2)) MB"
Write-Host "  verify: $missing missing, $mismatch size mismatches"
Write-Host "  disk free: $([math]::Round($freeBefore,2)) GB -> $([math]::Round($freeAfter,2)) GB"

if ($missing -gt 0 -or $mismatch -gt 0) {
  Write-Host ""
  Write-Host "  BACKUP INCOMPLETE - do not trust it" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "  BACKUP VERIFIED" -ForegroundColor Green
Write-Host "  $target"
