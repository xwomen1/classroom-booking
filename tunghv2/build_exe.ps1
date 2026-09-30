$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location -LiteralPath $ScriptDir
$env:NUITKA_CACHE_DIR = Join-Path $ScriptDir ".nuitka-cache"
New-Item -ItemType Directory -Force -Path $env:NUITKA_CACHE_DIR | Out-Null

python -m pip install -r requirements.txt
python -m nuitka `
    --onefile `
    --standalone `
    --assume-yes-for-downloads `
    --enable-plugin=tk-inter `
    --windows-console-mode=disable `
    --output-dir=dist `
    --output-filename=SmartLock_Simulator.exe `
    smartlock_simulator.py

if ($LASTEXITCODE -ne 0) {
    throw "Nuitka build failed with exit code $LASTEXITCODE"
}

Write-Host "EXE: $ScriptDir\dist\SmartLock_Simulator.exe"

