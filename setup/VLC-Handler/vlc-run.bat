@echo off
:: VLC Protocol Handler — strips vlc:// prefix, restores drive letter, launches VLC
set "HANDLER_URL=%~1"
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$p = $env:HANDLER_URL -replace '(?i)^vlc://', '';" ^
  "$p = $p -replace '/$', '';" ^
  "$p = [uri]::UnescapeDataString($p);" ^
  "$p = $p -replace '/', '\';" ^
  "if ($p -match '^[A-Za-z]([:\\]|$)') { $p = $p.Substring(0,1) + ':\' + ($p.Substring(1) -replace '^[:\\]+', '') }" ^
  "elseif ($p -match '^[A-Za-z]{2,}') { $p = '\\' + $p };" ^
  "$exe = @('C:\Program Files\VideoLAN\VLC\vlc.exe','C:\Program Files (x86)\VideoLAN\VLC\vlc.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "if ($exe) { Start-Process $exe -ArgumentList \"`\"$p`\"\" } else { Start-Process $p }"
