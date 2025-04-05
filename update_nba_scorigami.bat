@echo off
cd /d "C:\Users\ltbig\nba-scorigami"

REM === Cleanup previous files ===
if exist "Games.csv" del "Games.csv"
if exist "public\Games.csv" del "public\Games.csv"

REM === Download CSV ===
echo Downloading latest Games.csv...
kaggle datasets download -d eoinamoore/historical-nba-data-and-player-box-scores -f Games.csv -p . --force
if not exist "Games.csv" (
    echo ERROR: Download failed
    exit /b 1
)

REM === Move to public folder ===
move /y "Games.csv" "public\Games.csv" > nul
if not exist "public\Games.csv" (
    echo ERROR: Failed to move CSV file
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
