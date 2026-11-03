param([string]$DotnetPath = 'dotnet', [string]$OutputDirectory = '')
$ErrorActionPreference = 'Stop'
$env:DOTNET_CLI_TELEMETRY_OPTOUT = '1'
$taskVersion = (Get-Content (Join-Path $PSScriptRoot '../loop/package.json') -Raw | ConvertFrom-Json).version
[xml]$taskProject = Get-Content (Join-Path $PSScriptRoot 'SEIS.csproj') -Raw
if ($taskProject.Project.PropertyGroup.Version -ne $taskVersion) { throw 'Las versiones web y escritorio deben coincidir.' }
if (-not $OutputDirectory) { $OutputDirectory = Join-Path $PSScriptRoot ('dist/' + $taskVersion + '-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
New-Item -ItemType Directory -Path $OutputDirectory -Force | Out-Null
$taskOutput = (Resolve-Path -LiteralPath $OutputDirectory).Path
Push-Location $PSScriptRoot
try {
    & $DotnetPath restore SEIS.csproj --locked-mode --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Falló la restauración de dependencias.' }
    & $DotnetPath publish SEIS.csproj -c Release --no-restore -o $taskOutput --nologo
    if ($LASTEXITCODE -ne 0) { throw 'Falló la compilación.' }
    $taskName = "SEIS-$taskVersion-Windows-x64.exe"
    Copy-Item -LiteralPath (Join-Path $taskOutput 'SEIS.exe') -Destination (Join-Path $taskOutput $taskName)
    $taskFile = Get-Item -LiteralPath (Join-Path $taskOutput $taskName)
    $taskManifestPath = Join-Path $PSScriptRoot '../loop/desktop-release.json'
    $taskManifest = Get-Content -LiteralPath $taskManifestPath -Raw | ConvertFrom-Json
    if ($taskManifest.version -ne $taskVersion) { throw 'Actualizá la versión del manifiesto de descarga.' }
    $taskManifest | Add-Member -NotePropertyName sha256 -NotePropertyValue ((Get-FileHash -LiteralPath $taskFile.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) -Force
    $taskManifest | Add-Member -NotePropertyName bytes -NotePropertyValue $taskFile.Length -Force
    [IO.File]::WriteAllText($taskManifestPath, ($taskManifest | ConvertTo-Json -Depth 4) + "`n")
    Write-Output "Ejecutable: $($taskFile.FullName)"
    Write-Output "SHA-256: $($taskManifest.sha256)"
} finally { Pop-Location }
