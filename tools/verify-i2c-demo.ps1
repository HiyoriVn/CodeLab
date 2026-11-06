param(
  [ValidateSet('D1','S3')][string]$Target='S3',
  [ValidateRange(8,119)][int]$Address=0x30
)
$ErrorActionPreference='Stop'
$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS=Join-Path $env:ARDUINO_DIRECTORIES_DATA 'staging'
$log="docs/verification/ps4_i2c_$($Target.ToLower())_compile.log"
& $cli version 2>&1 | Set-Content $log
if($LASTEXITCODE -ne 0){throw 'CLI unavailable; no automatic install'}
$coreJson=& $cli core list --format json
if($LASTEXITCODE -ne 0){throw 'core list failed'}
$coreJson | Add-Content $log
$cores=($coreJson | ConvertFrom-Json).platforms
$argsList=@('compile','--library','firmware/libraries/CodeLabPs4I2C','--library','firmware/libraries/CodeLabRobot')
if($Target -eq 'D1') {
  if(!($cores|Where-Object {$_.id -eq 'esp32-bluepad32:esp32' -and $_.installed_version -eq '4.1.0'})){throw 'Bluepad32 core4.1.0 required'}
  $zip='C:\Users\Admin\Documents\ps4-esp32-lib-main.zip'
  if((Get-FileHash $zip).Hash -ne '8DF591B12BF9AF181B7EC260A99B14261FBC5C6A445F7C7121108086F30AFF61'){throw 'Library ZIP changed; review first'}
  $external=Join-Path $env:TEMP ('codelab-i2c-ps4-'+[guid]::NewGuid())
  Expand-Archive -LiteralPath $zip -DestinationPath $external
  $argsList+=@('--library',(Join-Path $external 'ps4-esp32-lib-main'))
  $fqbn='esp32-bluepad32:esp32:esp32';$sketch='firmware/ps4_i2c_bridge'
} else {
  if(!($cores|Where-Object {$_.id -eq 'esp32:esp32' -and $_.installed_version -eq '3.3.7'})){throw 'ESP32 core3.3.7 required'}
  $fqbn=node --input-type=module -e "import {getBoardProfile} from './src/boards/profiles.js'; console.log(getBoardProfile('newmania-v1-16m-opi-experimental').build.fqbn)"
  if($LASTEXITCODE -ne 0){throw 'Profile lookup failed'}
  $sketch='firmware/demos/newmania_ps4_i2c'
}
$output=Join-Path $sketch 'build-output'
$argsList+=@('--fqbn',$fqbn,'--output-dir',$output,'--build-property',"compiler.cpp.extra_flags=-DCODELAB_PS4_I2C_ADDRESS=$Address",$sketch)
"TARGET=$Target ADDRESS=$Address; compile only; external library not vendored" | Add-Content $log
"COMMAND: $cli $($argsList -join ' ')" | Add-Content $log
& $cli @argsList 2>&1 | Tee-Object $log -Append
$result=$LASTEXITCODE
"EXIT_CODE=$result" | Tee-Object $log -Append
if($result -eq 0) {
  $name=Split-Path $sketch -Leaf;$bin=Join-Path $output ($name+'.ino.bin')
  if(!(Test-Path $bin) -or (Get-Item $bin).Length -eq 0){throw 'Missing binary'}
  Get-Item $bin | Select-Object Length | Format-List | Out-String | Tee-Object $log -Append
  Get-FileHash $bin | Format-List | Out-String | Tee-Object $log -Append
}
exit $result
