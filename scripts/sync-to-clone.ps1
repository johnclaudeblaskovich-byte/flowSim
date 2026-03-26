param(
  [Parameter(Mandatory = $true)]
  [string]$SourceRoot,
  [Parameter(Mandatory = $true)]
  [string]$DestinationRoot
)

$ErrorActionPreference = 'Stop'

$directories = @(
  'src',
  'flowsim-backend',
  'scripts'
)

$files = @(
  'README.md',
  'package.json',
  'package-lock.json',
  'vite.config.ts'
)

foreach ($directory in $directories) {
  $sourcePath = Join-Path $SourceRoot $directory
  if (-not (Test-Path $sourcePath)) {
    continue
  }

  $destinationPath = Join-Path $DestinationRoot $directory
  if (-not (Test-Path $destinationPath)) {
    New-Item -ItemType Directory -Path $destinationPath -Force | Out-Null
  }

  Copy-Item -Path (Join-Path $sourcePath '*') -Destination $destinationPath -Recurse -Force
}

foreach ($file in $files) {
  $sourcePath = Join-Path $SourceRoot $file
  if (-not (Test-Path $sourcePath)) {
    continue
  }

  $destinationPath = Join-Path $DestinationRoot $file
  Copy-Item -Path $sourcePath -Destination $destinationPath -Force
}
