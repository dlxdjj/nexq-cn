param(
    [ValidateSet('test','build','probe')][string]$Action = 'test',
    [string]$VcVarsPath = $env:NEXQ_VCVARS_PATH,
    [switch]$Offline,
    [switch]$AllowNetworkProbes
)
$ErrorActionPreference = 'Stop'
if ($Action -eq 'probe' -and -not $AllowNetworkProbes) {
    throw 'Real service probes send fixed samples using your saved API credentials and may incur fees. Pass -AllowNetworkProbes only when intended.'
}
$repoPath = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $repoPath
if ($VcVarsPath) {
    $resolvedVcVars = (Resolve-Path -LiteralPath $VcVarsPath).Path
    if ($resolvedVcVars.Contains('"') -or $resolvedVcVars.Contains('%')) { throw 'Unsupported characters in vcvars path' }
    $envLines = & cmd.exe /d /s /c ('"' + $resolvedVcVars + '" >nul && set')
    if ($LASTEXITCODE -ne 0) { throw 'Visual C++ environment initialization failed' }
    foreach ($line in $envLines) {
        if ($line -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($matches[1], $matches[2], 'Process') }
    }
}
foreach ($tool in @('cargo', 'node')) { Get-Command $tool -ErrorAction Stop | Out-Null }
$cargoNetworkArgs = @()
if ($Offline) { $cargoNetworkArgs += '--offline' }
if ($Action -in @('test','probe')) {
    Get-Command mt.exe -ErrorAction Stop | Out-Null
    $metadataText = & cargo metadata --manifest-path src-tauri/Cargo.toml --format-version 1 --no-deps @cargoNetworkArgs
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    $targetPath = ($metadataText | ConvertFrom-Json).target_directory
    $releasePath = Join-Path $targetPath 'release'
    # Test executables live in deps; use the same DirectML runtime as the app,
    # not the older Windows system copy (which lacks required entry points).
    $testArtifacts = & cargo test --manifest-path src-tauri/Cargo.toml --release --lib @cargoNetworkArgs --no-run --message-format=json | ForEach-Object {
        $buildMessage = $_ | ConvertFrom-Json
        if ($buildMessage.reason -eq 'compiler-message') { Write-Host $buildMessage.message.rendered }
        if ($buildMessage.reason -eq 'compiler-artifact' -and $buildMessage.profile.test -and $buildMessage.executable) { $buildMessage.executable }
    }
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    if (-not $testArtifacts) { throw 'No Rust test executable was produced' }
    foreach ($testExe in $testArtifacts) {
        $directML = Join-Path $releasePath 'DirectML.dll'
        if (Test-Path -LiteralPath $directML) {
            Copy-Item -LiteralPath $directML -Destination (Join-Path (Split-Path -Parent $testExe) 'DirectML.dll') -Force
        }
        # Unit-test binaries do not inherit Tauri's application manifest. rfd's
        # TaskDialogIndirect import needs Common Controls v6 before tests start.
        & mt.exe -nologo -manifest (Join-Path $PSScriptRoot 'test-windows.manifest') "-outputresource:$testExe;#1"
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
        if ($Action -eq 'probe') { & $testExe live_service_ --ignored --nocapture --test-threads=1 }
        else { & $testExe }
        if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    }
} else {
    $buildArgs = @('node_modules/@tauri-apps/cli/tauri.js', 'build', '--bundles', 'nsis')
    if ($Offline) { $buildArgs += @('--', '--offline') }
    & node @buildArgs
}
exit $LASTEXITCODE
