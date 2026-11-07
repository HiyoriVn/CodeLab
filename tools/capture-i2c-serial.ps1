param(
  [Parameter(Mandatory)][ValidatePattern('^COM[0-9]+$')][string]$Port,
  [ValidateRange(1,60)][int]$Seconds=15,
  [Parameter(Mandatory)][string]$Log
)
$ErrorActionPreference='Stop'
"READ ONLY $Port 115200 8N1 DTR/RTS=false; ${Seconds}s; no bytes sent" | Set-Content $Log
$serial=[System.IO.Ports.SerialPort]::new($Port,115200,[System.IO.Ports.Parity]::None,8,[System.IO.Ports.StopBits]::One)
$serial.DtrEnable=$false;$serial.RtsEnable=$false;$serial.ReadTimeout=500
$count=0
try {
  $serial.Open();$serial.DiscardInBuffer();$timer=[Diagnostics.Stopwatch]::StartNew()
  while($timer.Elapsed.TotalSeconds -lt $Seconds) {
    try {
      $line=$serial.ReadLine().TrimEnd("`r")
      "[$($timer.ElapsedMilliseconds)ms] $line" | Tee-Object $Log -Append
      ++$count
    } catch [System.TimeoutException] {}
  }
  "CAPTURE_COMPLETED lines=$count elapsed_ms=$($timer.ElapsedMilliseconds)" | Tee-Object $Log -Append
} finally {
  if($serial.IsOpen){$serial.Close()};$serial.Dispose()
}
