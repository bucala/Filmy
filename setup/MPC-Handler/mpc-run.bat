@echo off
:: MPC-HC Protocol Handler — strips mpc:// prefix, restores drive letter, launches MPC-HC
set "HANDLER_URL=%~1"
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$path = $env:HANDLER_URL -replace '(?i)^mpc://', '';" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "if ($path -match '^([A-Za-z])/') { $path = $path -replace '^([A-Za-z])/', '$1:/' };" ^
  "if ($path -match '^([A-Za-z])\\\\') { $path = $path -replace '^([A-Za-z])\\\\', '$1:\\' };" ^
  "if ($path -match '^[A-Za-z]{2,}') { $path = '\\\\' + ($path -replace '/', '\\') };" ^
  "Start-Process 'C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe' -ArgumentList \"`\"$path`\"\""
