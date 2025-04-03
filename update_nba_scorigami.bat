@echo off
cd /d "C:\Users\ltbig\nba-scorigami"

REM === Cleanup previous files ===
if exist "data\" rmdir /s /q "data"
if exist "server\data\Games.csv" del "server\data\Games.csv"
if exist "Games.csv" del "Games.csv"

REM === Download CSV ===
echo Downloading latest Games.csv...
kaggle datasets download -d eoinamoore/historical-nba-data-and-player-box-scores -f Games.csv -p . --force
if not exist "Games.csv" (
    echo ERROR: Download failed
    exit /b 1
)

REM === Move to correct location ===
move /y "Games.csv" "server\data\Games.csv" > nul
if not exist "server\data\Games.csv" (
    echo ERROR: Failed to move CSV file
    exit /b 1
)

REM === Process data ===
echo Updating nba_scorigami.json...
python "server\nba_data_processor.py" "C:\Users\ltbig\nba-scorigami\public\nba_scorigami.json" "C:\Users\ltbig\nba-scorigami\server\data\Games.csv"

REM === Verify success ===
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