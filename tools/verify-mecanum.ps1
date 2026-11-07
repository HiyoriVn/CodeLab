param(
  [string]$Sketch='firmware/verification/ps4_mecanum_sim',
  [string]$Log='docs/verification/mecanum_compile.log',
  [switch]$CompileUartCandidate
)
$ErrorActionPreference='Stop'
$cli='C:\Users\Admin\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe'
$env:ARDUINO_DIRECTORIES_DATA='C:\Users\Admin\AppData\Local\Arduino15'
$env:ARDUINO_DIRECTORIES_DOWNLOADS='C:\Users\Admin\AppData\Local\Arduino15\staging'
$log=$Log
& $cli version 2>&1 | Set-Content $log
if ($LASTEXITCODE -ne 0) { throw 'Arduino CLI unavailable' }
$cores=& $cli core list --format json
if ($LASTEXITCODE -ne 0) { throw 'core list failed' }
$cores | Add-Content $log
if (!(($cores | ConvertFrom-Json).platforms | Where-Object { $_.id -eq 'esp32:esp32' -and $_.installed_version -eq '3.3.7' })) { throw 'Core3.3.7 required; no automatic install' }
# Read the unchanged registry profile; never disable PSRAM or select COM/upload.
$fqbn=node --input-type=module -e "import {getBoardProfile} from './src/boards/profiles.js'; console.log(getBoardProfile('newmania-v1-16m-opi-experimental').build.fqbn)"
if ($LASTEXITCODE -ne 0) { throw 'Profile lookup failed' }
$output=Join-Path $Sketch 'build-output'
if($CompileUartCandidate) {
  if($Sketch -ne 'firmware/demos/newmania_ps4_mecanum') { throw 'UART candidate only valid for integrated demo' }
  $output=Join-Path $output 'uart_candidate'
}
"COMMAND: compile --fqbn $fqbn --library firmware/libraries/CodeLabRobot --output-dir $output $Sketch" | Add-Content $log
$compileArgs=@('compile','--fqbn',$fqbn,'--library','firmware/libraries/CodeLabRobot','--output-dir',$output)
if($CompileUartCandidate) {
  'COMPILE-ONLY UART candidate for proposed rewire; physical wiring/upload NOT verified' | Add-Content $log
  $compileArgs+=@('--build-property','compiler.cpp.extra_flags=-DCODELAB_DEMO_UART_WIRING_CONFIRMED=1')
}
"ARGS: $($compileArgs -join ' ') $Sketch" | Add-Content $log
& $cli @compileArgs $Sketch 2>&1 | Tee-Object $log -Append
$result=$LASTEXITCODE
"EXIT_CODE=$result" | Tee-Object $log -Append
if ($result -eq 0) {
  $name=Split-Path $Sketch -Leaf
  $binary=Join-Path $output ($name+'.ino.bin')
  if (!(Test-Path $binary) -or (Get-Item $binary).Length -eq 0) { throw 'Missing binary' }
  Get-Item $binary | Select-Object Length | Format-List | Out-String | Tee-Object $log -Append
  Get-FileHash $binary | Format-List | Out-String | Tee-Object $log -Append
}
exit $result
