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
