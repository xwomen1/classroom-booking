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
  # Autolinking stores the temporary subst drive as an absolute path. Remove
  # only generated autolinking output so Gradle recreates it for this build.
  $autolinkingPaths = @(
    (Join-Path $projectRoot 'android\build\generated\autolinking'),
    (Join-Path $projectRoot 'android\app\build\generated\autolinking')
  )
  foreach ($autolinkingPath in $autolinkingPaths) {
    $absoluteAutolinkingPath = [System.IO.Path]::GetFullPath($autolinkingPath)
    if (-not $absoluteAutolinkingPath.StartsWith($projectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
      throw "Refusing to remove generated path outside project: $absoluteAutolinkingPath"
    }
    if (Test-Path -LiteralPath $absoluteAutolinkingPath) {
      Remove-Item -LiteralPath $absoluteAutolinkingPath -Recurse -Force
    }
  }

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
