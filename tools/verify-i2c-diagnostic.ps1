param([ValidateSet('Scanner','Master','Slave')][string]$Target='Scanner')
$ErrorActionPreference='Stop'
$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS=Join-Path $env:ARDUINO_DIRECTORIES_DATA 'staging'
$coresJson = & $cli core list --format json
if ($LASTEXITCODE -ne 0) { throw 'Cannot inspect installed cores; no install/update attempted' }
$cores = ($coresJson | ConvertFrom-Json).platforms
if ($Target -eq 'Slave') {
  if (!($cores | Where-Object { $_.id -eq 'esp32-bluepad32:esp32' -and $_.installed_version -eq '4.1.0' })) { throw 'Expected installed Bluepad32 package 4.1.0' }
  $fqbn='esp32-bluepad32:esp32:esp32'
  $sketch='firmware/diagnostics/i2c_echo_slave_d1'
} else {
  if (!($cores | Where-Object { $_.id -eq 'esp32:esp32' -and $_.installed_version -eq '3.3.7' })) { throw 'Expected installed ESP32 core 3.3.7' }
  # Preserve the existing observed-memory build profile; do not infer board identity.
  $fqbn=node --input-type=module -e "import {getBoardProfile} from './src/boards/profiles.js'; console.log(getBoardProfile('newmania-v1-16m-opi-experimental').build.fqbn)"
  if ($LASTEXITCODE -ne 0) { throw 'Profile lookup failed' }
  $sketch=if($Target -eq 'Scanner') {'firmware/diagnostics/i2c_scanner_s3'} else {'firmware/diagnostics/i2c_echo_master_s3'}
}
$output=Join-Path $sketch 'build-output'
New-Item -ItemType Directory -Force -Path $output | Out-Null
& $cli compile --fqbn $fqbn --library firmware/libraries/CodeLabI2CDiagnostic --build-property 'compiler.cpp.extra_flags=-DCORE_DEBUG_LEVEL=1' --output-dir $output $sketch 2>&1 | Tee-Object (Join-Path $output 'compile.log')
$result=$LASTEXITCODE
if ($result -ne 0) { throw "Compile failed (exit $result); see $output/compile.log" }
$binary=Join-Path $output ((Split-Path $sketch -Leaf)+'.ino.bin')
if (!(Test-Path $binary) -or (Get-Item $binary).Length -eq 0) { throw 'Missing compiled binary' }
Get-FileHash -LiteralPath $binary
# Compile only. Deliberately no upload, serial access, core update or port selection.
