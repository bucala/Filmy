@echo off
:: MPC-HC Debug — shows what the handler receives and processes
echo ============================================
echo   MPC-HC Protocol Handler DEBUG
echo ============================================
echo.
echo RAW argument: %1
echo Stripped arg:  %~1
echo.
set "HANDLER_URL=%~1"
powershell -NoProfile -Command ^
  "$path = $env:HANDLER_URL;" ^
  "Write-Host 'URL from env:' $path;" ^
  "$path = $path -replace '(?i)^mpc://', '';" ^
  "Write-Host 'After strip mpc://:' $path;" ^
  "$path = $path -replace '/$', '';" ^
  "$path = [uri]::UnescapeDataString($path);" ^
  "Write-Host 'After URL decode:' $path;" ^
  "if ($path -match '^([A-Za-z])/') { $path = $path -replace '^([A-Za-z])/', '$1:/'; Write-Host 'Drive letter restored:' $path };" ^
  "if ($path -match '^([A-Za-z])\\\\') { $path = $path -replace '^([A-Za-z])\\\\', '$1:\\'; Write-Host 'Drive backslash:' $path };" ^
  "if ($path -match '^[A-Za-z]{2,}') { $path = '\\\\' + ($path -replace '/', '\\'); Write-Host 'UNC path:' $path };" ^
  "Write-Host ''; Write-Host 'FINAL PATH:' $path;" ^
  "Write-Host ''; Write-Host 'Launching MPC-HC...';" ^
  "try { Start-Process 'C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe' -ArgumentList \"`\"$path`\"\" ; Write-Host 'OK - MPC-HC launched' } catch { Write-Host 'ERROR:' $_.Exception.Message }"
echo.
echo ============================================
pause
