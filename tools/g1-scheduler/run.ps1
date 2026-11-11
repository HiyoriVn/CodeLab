$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$exe = Join-Path $env:TEMP 'codelab-g1-scheduler-tests.exe'
$obj = Join-Path $env:TEMP 'codelab-g1-scheduler-core.o'
$log = Join-Path $repo 'docs\verification\G1_SCHEDULER_SPIKE_HOST.log'
$compiler = (& g++ --version | Select-Object -First 1)
$compileCommand = 'g++ -std=c++17 -O2 -Wall -Wextra -Werror -pedantic scheduler.cpp scheduler_test.cpp'
Push-Location $PSScriptRoot
try {
  $lines = @("Host: $([System.Runtime.InteropServices.RuntimeInformation]::OSDescription)", "Compiler: $compiler", "Compile: $compileCommand -o $exe")
  $compileOutput = & g++ -std=c++17 -O2 -Wall -Wextra -Werror -pedantic scheduler.cpp scheduler_test.cpp -o $exe 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Host compile failed: $compileOutput" }
  $runOutput = & $exe 2>&1
  if ($LASTEXITCODE -ne 0) { throw "Host tests failed: $runOutput" }
  $binaryBytes = (Get-Item -LiteralPath $exe).Length
  & g++ -std=c++17 -Os -ffunction-sections -fdata-sections -c scheduler.cpp -o $obj
  if ($LASTEXITCODE -ne 0) { throw 'Core object size build failed.' }
  $sectionSizes = (& size.exe $obj 2>&1) | ForEach-Object { $_.ToString() }
  $lines += $runOutput | ForEach-Object { $_.ToString() }
  $lines += "HOST_EXECUTABLE_BYTES: $binaryBytes (host binary; not ESP32 flash usage)"
  $lines += 'HOST_CORE_OBJECT_SIZE (-Os; host sections, not ESP32 flash usage):'
  $lines += $sectionSizes
  Set-Content -LiteralPath $log -Value $lines -Encoding utf8
  $lines | Write-Output
} finally {
  Pop-Location
}
