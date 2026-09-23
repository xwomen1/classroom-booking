$ErrorActionPreference = 'Stop'

$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$driveLetter = @('R', 'S', 'T', 'U') |
  Where-Object { -not (Test-Path ("{0}:\" -f $_)) } |
  Select-Object -First 1

if (-not $driveLetter) {
  throw 'No free temporary drive letter was found in R:, S:, T:, or U:.'
}

$drive = "${driveLetter}:"

try {
  & subst $drive $projectRoot
  if ($LASTEXITCODE -ne 0) {
    throw "Could not map $drive to the project directory."
  }

  Push-Location "$drive\android"
  & java -classpath 'gradle\wrapper\gradle-wrapper.jar' org.gradle.wrapper.GradleWrapperMain assembleDebug
  if ($LASTEXITCODE -ne 0) {
    throw "Gradle build failed with exit code $LASTEXITCODE."
  }
}
finally {
  if ((Get-Location).Path -like "$drive*") {
    Pop-Location
  }
  & subst $drive /d | Out-Null
}

$apk = Join-Path $projectRoot 'android\app\build\outputs\apk\debug\app-debug.apk'
Write-Host "Debug APK: $apk"
