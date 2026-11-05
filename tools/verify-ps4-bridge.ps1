# Compile-only candidate, no install/update/COM/upload. Dependency stays outside repository.
$ErrorActionPreference='Stop'
$cli=$env:ARDUINO_CLI_PATH
if(!$cli){$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'}
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS=Join-Path $env:ARDUINO_DIRECTORIES_DATA 'staging'
$zip='C:\Users\Admin\Documents\ps4-esp32-lib-main.zip'
$expected='8DF591B12BF9AF181B7EC260A99B14261FBC5C6A445F7C7121108086F30AFF61'
if((Get-FileHash -LiteralPath $zip).Hash -ne $expected){throw 'Unexpected PS4 library archive hash; review source first'}
$cores=(& $cli core list --format json | ConvertFrom-Json).platforms
if(!($cores | Where-Object {$_.id -eq 'esp32-bluepad32:esp32' -and $_.installed_version -eq '4.1.0'})){throw 'Require installed esp32-bluepad32:esp32@4.1.0; no auto-install'}
$external=Join-Path $env:TEMP ('codelab-ps4-external-'+[guid]::NewGuid())
Expand-Archive -LiteralPath $zip -DestinationPath $external
$lib=Join-Path $external 'ps4-esp32-lib-main'
$log='docs/verification/ps4_fast_track_bridge.log'
"External dependency: $lib; ZIP SHA256=$expected; compile-only ESP32 Classic candidate, pins unassigned/LED off" | Set-Content $log
& $cli version 2>&1 | Tee-Object -FilePath $log -Append
& $cli board details --fqbn esp32-bluepad32:esp32:esp32 2>&1 | Add-Content $log
& $cli compile --fqbn esp32-bluepad32:esp32:esp32 --library $lib --output-dir firmware/ps4_bridge/build-output firmware/ps4_bridge 2>&1 | Tee-Object -FilePath $log -Append
$code=$LASTEXITCODE
"EXIT_CODE=$code" | Tee-Object -FilePath $log -Append
exit $code
