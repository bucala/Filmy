@echo off
:: VLC Protocol Handler — strips vlc:// prefix, URL-decodes, launches VLC
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$url = $args[0];" ^
  "$path = $url -replace '(?i)^vlc://', '';" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "Start-Process 'C:\Program Files\VideoLAN\VLC\vlc.exe' -ArgumentList \"`\"$path`\"\"" ^
  "%~1"
