@echo off
setlocal
:: Self-registering mpc:// handler.
:: Points the registry at THIS folder's mpc-run.bat, so it works no matter
:: where you put the setup folder. Registers per-user (HKCU) — no admin needed.
set "HANDLER=%~dp0mpc-run.bat"

echo ============================================
echo   Registering mpc:// protocol handler
echo   Target: "%HANDLER%"
echo ============================================
echo.

if not exist "%HANDLER%" (
  echo ERROR: mpc-run.bat not found next to this installer.
  echo Keep install-mpc.bat and mpc-run.bat in the same folder.
  pause
  exit /b 1
)

reg add "HKCU\Software\Classes\mpc" /ve /d "URL:MPC Protocol" /f >nul
reg add "HKCU\Software\Classes\mpc" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\mpc\shell\open\command" /ve /d "\"%HANDLER%\" \"%%1\"" /f >nul

echo Done. The mpc:// handler is registered for the current user.
echo You can now use "Prehrat film" in the web app (choose MPC-HC).
echo.
echo Tip: to test the handler directly, run:
echo    "%HANDLER%" "mpc://W/Movies/test-handler.mkv"
echo.
pause
