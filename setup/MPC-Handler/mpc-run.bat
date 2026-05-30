@echo off
:: MPC-HC Protocol Handler — strips mpc:// prefix, restores drive letter, launches MPC-HC
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$url = $args[0];" ^
  "$path = $url -replace '(?i)^mpc://', '';" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "if ($path -match '^([A-Za-z])/') { $path = $path -replace '^([A-Za-z])/', '$1:/' };" ^
  "if ($path -match '^([A-Za-z])\\\\') { $path = $path -replace '^([A-Za-z])\\\\', '$1:\\' };" ^
  "if ($path -match '^[A-Za-z]{2,}') { $path = '\\\\' + ($path -replace '/', '\\') };" ^
  "Start-Process 'C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe' -ArgumentList \"`\"$path`\"\"" ^
  "%~1"
