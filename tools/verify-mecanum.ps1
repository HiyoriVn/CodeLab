$ErrorActionPreference='Stop'
$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS='C:\Users\Admin\AppData\Local\Arduino15\staging'
$log='docs/verification/mecanum_compile.log'
& $cli version 2>&1 | Set-Content $log
if ($LASTEXITCODE -ne 0) { throw 'Arduino CLI unavailable' }
$cores=& $cli core list --format json
if ($LASTEXITCODE -ne 0) { throw 'core list failed' }
$cores | Add-Content $log
if (!(($cores | ConvertFrom-Json).platforms | Where-Object { $_.id -eq 'esp32:esp32' -and $_.installed_version -eq '3.3.7' })) { throw 'Core3.3.7 required; no automatic install' }
# Read the unchanged registry profile; never disable PSRAM or select COM/upload.
$fqbn=node --input-type=module -e "import {getBoardProfile} from './src/boards/profiles.js'; console.log(getBoardProfile('newmania-v1-16m-opi-experimental').build.fqbn)"
if ($LASTEXITCODE -ne 0) { throw 'Profile lookup failed' }
"COMMAND: compile --fqbn $fqbn --library firmware/libraries/CodeLabRobot --output-dir firmware/verification/ps4_mecanum_sim/build-output firmware/verification/ps4_mecanum_sim" | Add-Content $log
& $cli compile --fqbn $fqbn --library firmware/libraries/CodeLabRobot --output-dir firmware/verification/ps4_mecanum_sim/build-output firmware/verification/ps4_mecanum_sim 2>&1 | Tee-Object $log -Append
$result=$LASTEXITCODE
"EXIT_CODE=$result" | Tee-Object $log -Append
if ($result -eq 0) {
  $binary='firmware/verification/ps4_mecanum_sim/build-output/ps4_mecanum_sim.ino.bin'
  if (!(Test-Path $binary) -or (Get-Item $binary).Length -eq 0) { throw 'Missing binary' }
  Get-Item $binary | Select-Object Length | Format-List | Out-String | Tee-Object $log -Append
  Get-FileHash $binary | Format-List | Out-String | Tee-Object $log -Append
}
exit $result
