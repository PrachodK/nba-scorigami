@echo off
cd /d "%~dp0"

REM === Cleanup previous files ===
if exist "Games.csv" del "Games.csv"
if exist "public\Games.csv" del "public\Games.csv"
if exist "LeagueSchedule25_26.csv" del "LeagueSchedule25_26.csv"
if exist "public\LeagueSchedule25_26.csv" del "public\LeagueSchedule25_26.csv"

REM === Download Games.csv ===
echo Downloading latest Games.csv...
kaggle datasets download -d eoinamoore/historical-nba-data-and-player-box-scores -f Games.csv -p . --force
if not exist "Games.csv" (
    echo ERROR: Games.csv download failed
    exit /b 1
)

REM === Download LeagueSchedule25_26.csv ===
echo Downloading latest LeagueSchedule25_26.csv...
kaggle datasets download -d eoinamoore/historical-nba-data-and-player-box-scores -f LeagueSchedule25_26.csv -p . --force
if not exist "LeagueSchedule25_26.csv" (
    echo ERROR: LeagueSchedule25_26.csv download failed
    exit /b 1
)

REM === Move to public folder ===
move /y "Games.csv" "public\Games.csv" > nul
if not exist "public\Games.csv" (
    echo ERROR: Failed to move Games.csv
    exit /b 1
)

move /y "LeagueSchedule25_26.csv" "public\LeagueSchedule25_26.csv" > nul
if not exist "public\LeagueSchedule25_26.csv" (
    echo ERROR: Failed to move LeagueSchedule25_26.csv
    exit /b 1
)

REM === Process data ===
echo Updating nba_scorigami.json...
python "server\nba_data_processor.py"

REM === Verify ===
if errorlevel 0 (
    if exist "public\nba_scorigami.json" (
        echo Update successful!
        dir "public\nba_scorigami.json"
    ) else (
        echo ERROR: JSON file not created
        exit /b 1
    )
) else (
    echo ERROR: Processing failed
    exit /b 1
)

REM === Git commit and push ===
echo Committing and pushing changes to GitHub...

git add public/Games.csv public/LeagueSchedule25_26.csv public/nba_scorigami.json
git commit -m "Auto-update: Refreshed data [%date% %time%]"
git push origin main

if errorlevel 1 (
    echo ERROR: Git push failed
    exit /b 1
) else (
    echo Git push successful!
)

