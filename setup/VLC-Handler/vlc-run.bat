@echo off
:: VLC Protocol Handler — strips vlc:// prefix, restores drive letter, launches VLC
set "HANDLER_URL=%~1"
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$path = $env:HANDLER_URL -replace '(?i)^vlc://', '';" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "if ($path -match '^([A-Za-z])/') { $path = $path -replace '^([A-Za-z])/', '$1:/' };" ^
  "if ($path -match '^([A-Za-z])\\\\') { $path = $path -replace '^([A-Za-z])\\\\', '$1:\\' };" ^
  "if ($path -match '^[A-Za-z]{2,}') { $path = '\\\\' + ($path -replace '/', '\\') };" ^
  "Start-Process 'C:\Program Files\VideoLAN\VLC\vlc.exe' -ArgumentList \"`\"$path`\"\""
