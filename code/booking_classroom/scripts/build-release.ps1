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
  $bundleOutput = Join-Path $projectRoot 'android\app\src\main\assets\index.android.bundle'
  $assetsDirectory = Split-Path $bundleOutput -Parent
  $resourcesDirectory = Join-Path $projectRoot 'android\app\src\main\res'
  New-Item -ItemType Directory -Force -Path $assetsDirectory | Out-Null

  Push-Location $projectRoot
  try {
    & node 'node_modules\react-native\cli.js' bundle `
      --platform android `
      --dev false `
      --entry-file index.js `
      --bundle-output $bundleOutput `
      --assets-dest $resourcesDirectory
    if ($LASTEXITCODE -ne 0) {
      throw "React Native bundle failed with exit code $LASTEXITCODE."
    }
  }
  finally {
    Pop-Location
  }

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
  & java -classpath 'gradle\wrapper\gradle-wrapper.jar' org.gradle.wrapper.GradleWrapperMain assembleRelease
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

$apk = Join-Path $projectRoot 'android\app\build\outputs\apk\release\app-release.apk'
Write-Host "Standalone Release APK: $apk"
