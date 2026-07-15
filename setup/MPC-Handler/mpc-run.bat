@echo off
:: MPC-HC Protocol Handler — strips mpc:// prefix, restores drive letter, launches MPC-HC
:: Accepts both "W/Movies/x" and "W:/Movies/x" forms; always hands MPC a backslash path.
set "HANDLER_URL=%~1"
powershell -NoProfile -WindowStyle Hidden -Command ^
  "$p = $env:HANDLER_URL -replace '(?i)^mpc://', '';" ^
  "$p = $p -replace '/$', '';" ^
  "$p = [uri]::UnescapeDataString($p);" ^
  "$p = $p -replace '/', '\';" ^
  "if ($p -match '^[A-Za-z]([:\\]|$)') { $p = $p.Substring(0,1) + ':\' + ($p.Substring(1) -replace '^[:\\]+', '') }" ^
  "elseif ($p -match '^[A-Za-z]{2,}') { $p = '\\' + $p };" ^
  "$exe = @('C:\Program Files (x86)\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe','C:\Program Files\K-Lite Codec Pack\MPC-HC64\mpc-hc64.exe','C:\Program Files\MPC-HC\mpc-hc64.exe','C:\Program Files (x86)\MPC-HC\mpc-hc.exe','C:\Program Files\MPC-HC\mpc-hc.exe','C:\Program Files\MPC-BE x64\mpc-be64.exe','C:\Program Files (x86)\MPC-BE\mpc-be.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1;" ^
  "if ($exe) { Start-Process $exe -ArgumentList \"`\"$p`\"\" } else { Start-Process $p }"
