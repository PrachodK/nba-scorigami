#!/bin/bash
set -e

cd "$(dirname "$0")"

echo "=== NBA Scorigami Data Update ==="
echo ""

echo "[1/3] Cleaning up old files..."
rm -f public/Games.csv

echo "[2/3] Downloading latest Games.csv..."
kaggle datasets download -d eoinamoore/historical-nba-data-and-player-box-scores -f Games.csv -p public --force --unzip
if [ ! -f "public/Games.csv" ]; then
    echo "ERROR: Games.csv download failed"
    exit 1
fi

echo "[3/3] Processing data and generating nba_scorigami.json..."
python3 server/nba_data_processor.py
if [ ! -f "public/nba_scorigami.json" ]; then
    echo "ERROR: JSON file not created"
    exit 1
fi

echo ""
echo "Summary: $(wc -l < public/Games.csv | tr -d ' ') games in database"

echo ""
echo "Committing and pushing to GitHub..."
git add public/Games.csv public/nba_scorigami.json
git commit -m "Auto-update: Refreshed data $(date '+%Y-%m-%d %H:%M')"
git push origin main

echo ""
echo "=== Update complete! ==="
