@echo off
cd /d "%~dp0"

echo === NBA Scorigami Data Update ===
echo.

echo [1/3] Cleaning up old files...
if exist "public\Games.csv" del "public\Games.csv"

echo [2/3] Downloading latest Games.csv...
kaggle datasets download -d eoinamoore/historical-nba-data-and-player-box-scores -f Games.csv -p public --force
if exist "public\Games.csv.zip" (
    powershell -Command "Expand-Archive -Path 'public\Games.csv.zip' -DestinationPath 'public' -Force"
    del "public\Games.csv.zip"
)
if not exist "public\Games.csv" (
    echo ERROR: Games.csv download failed
    exit /b 1
)

echo [3/3] Processing data and generating nba_scorigami.json...
python "server\nba_data_processor.py"
if not exist "public\nba_scorigami.json" (
    echo ERROR: JSON file not created
    exit /b 1
)

echo.
echo Committing and pushing to GitHub...
git add public/Games.csv public/nba_scorigami.json
git commit -m "Auto-update: Refreshed data %date% %time%"
git push origin main

echo.
echo === Update complete! ===
