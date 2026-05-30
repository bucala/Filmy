@echo off
:: MPC-HC Protocol Handler — strips mpc:// prefix, URL-decodes, launches MPC-HC
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$url = $args[0];" ^
  "$path = $url -replace '(?i)^mpc://', '';" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "Start-Process 'C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe' -ArgumentList \"`\"$path`\"\"" ^
  "%~1"
