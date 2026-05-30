@echo off
:: VLC Protocol Handler — strips vlc:// prefix, restores drive letter, launches VLC
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$url = $args[0];" ^
  "$path = $url -replace '(?i)^vlc://', '';" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "if ($path -match '^([A-Za-z])/') { $path = $path -replace '^([A-Za-z])/', '$1:/' };" ^
  "if ($path -match '^([A-Za-z])\\\\') { $path = $path -replace '^([A-Za-z])\\\\', '$1:\\' };" ^
  "Start-Process 'C:\Program Files\VideoLAN\VLC\vlc.exe' -ArgumentList \"`\"$path`\"\"" ^
  "%~1"
