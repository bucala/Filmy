@echo off
setlocal
:: Self-registering vlc:// handler.
:: Points the registry at THIS folder's vlc-run.bat, so it works no matter
:: where you put the setup folder. Registers per-user (HKCU) — no admin needed.
set "HANDLER=%~dp0vlc-run.bat"

echo ============================================
echo   Registering vlc:// protocol handler
echo   Target: "%HANDLER%"
echo ============================================
echo.

if not exist "%HANDLER%" (
  echo ERROR: vlc-run.bat not found next to this installer.
  echo Keep install-vlc.bat and vlc-run.bat in the same folder.
  pause
  exit /b 1
)

reg add "HKCU\Software\Classes\vlc" /ve /d "URL:VLC Protocol" /f >nul
reg add "HKCU\Software\Classes\vlc" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\vlc\shell\open\command" /ve /d "\"%HANDLER%\" \"%%1\"" /f >nul

echo Done. The vlc:// handler is registered for the current user.
echo You can now use "Prehrat film" in the web app (choose VLC).
echo.
echo Tip: to test the handler directly, run:
echo    "%HANDLER%" "vlc://W/Movies/test-handler.mkv"
echo.
pause
