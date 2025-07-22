@echo off
setlocal ENABLEDELAYEDEXPANSION

echo 🔎 Kontrola Node.js a npm...

where node >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ Node.js nebyl nalezen.
    echo 👉 Stahni ho rucne z https://nodejs.org/
    pause
    exit /b 1
)

where npm >nul 2>&1
IF ERRORLEVEL 1 (
    echo ❌ npm nebyl nalezen.
    echo 👉 Stahni ho rucne z https://nodejs.org/
    pause
    exit /b 1
)

for /f %%v in ('node -v') do set NODEV=%%v
for /f %%v in ('npm -v') do set NPMV=%%v
echo ✅ Node.js: %NODEV%  npm: %NPMV%

echo 📦 Instalace zavislosti v rootu projektu...
call npm install

REM Absolutní cesta
set "PROJECT_DIR=%cd%"
set "START_SCRIPT=%PROJECT_DIR%\start-tray.bat"

echo 🔧 Vytvarim start-tray.bat...
(
    echo @echo off
    echo cd /d "%PROJECT_DIR%"
    echo npm start
) > "%START_SCRIPT%"

REM Ikona - uprav pokud nemáš
set "ICON_PATH=%PROJECT_DIR%\tray\icon.ico"

REM Vytvoreni zastupce v Startup
set "SHORTCUT_NAME=Kady Print Server Tray"
set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\%SHORTCUT_NAME%.lnk"

REM Vytvoreni zastupce pres powershell
powershell -command ^
 "$s=(New-Object -COM WScript.Shell).CreateShortcut('%SHORTCUT_PATH%'); ^
  $s.TargetPath='%START_SCRIPT%'; ^
  $s.WorkingDirectory='%PROJECT_DIR%'; ^
  $s.WindowStyle=1; ^
  $s.Description='Tray appka pro print server'; ^
  if (Test-Path '%ICON_PATH%') { $s.IconLocation='%ICON_PATH%' }; ^
  $s.Save()"

echo ✅ Zastupce vytvoren: %SHORTCUT_PATH%

echo 📦 Instalace zavislosti v ./app...
cd /d "%PROJECT_DIR%\app"
call npm install --force
cd /d "%PROJECT_DIR%"


echo 🚀 Spoustim Electron tray aplikaci...
start "" npm start

endlocal
