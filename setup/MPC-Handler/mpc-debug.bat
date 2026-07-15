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
  "$path = $path -replace '/', '\'; Write-Host 'Slashes to backslash:' $path;" ^
  "if ($path -match '^[A-Za-z]([:\\]|$)') { $path = $path.Substring(0,1) + ':\' + ($path.Substring(1) -replace '^[:\\]+', ''); Write-Host 'Drive restored:' $path } elseif ($path -match '^[A-Za-z]{2,}') { $path = '\\' + $path; Write-Host 'UNC path:' $path };" ^
  "Write-Host ''; Write-Host 'FINAL PATH:' $path;" ^
  "Write-Host 'File exists:' (Test-Path $path);" ^
  "$exe = @('C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe','C:\Program Files\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe','C:\Program Files\MPC-HC\mpc-hc64.exe','C:\Program Files (x86)\MPC-HC\mpc-hc.exe','C:\Program Files\MPC-HC\mpc-hc.exe','C:\Program Files\MPC-BE x64\mpc-be64.exe','C:\Program Files (x86)\MPC-BE\mpc-be.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "Write-Host 'Player found:' $exe;" ^
  "Write-Host ''; Write-Host 'Launching player...';" ^
  "try { if ($exe) { Start-Process $exe -ArgumentList \"`\"$path`\"\" } else { Write-Host 'No MPC found - opening with default association'; Start-Process $path } ; Write-Host 'OK - launched' } catch { Write-Host 'ERROR:' $_.Exception.Message }"
echo.
echo ============================================
pause
