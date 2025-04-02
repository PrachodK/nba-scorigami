import pandas as pd
import json
from datetime import datetime
import os
from tqdm import tqdm

def download_kaggle_dataset():
    """Download only Games.csv from Kaggle"""
    try:
        from kaggle.api.kaggle_api_extended import KaggleApi
        api = KaggleApi()
        api.authenticate()
        api.dataset_download_file(
            'eoinamoore/historical-nba-data-and-player-box-scores',
            file_name='Games.csv',
            path='./data'
        )
        print("Games.csv downloaded")
    except Exception as e:
        print(f"Download failed: {e}")
        raise

def process_data():
    """Process Games.csv into Scorigami format"""
    try:
        cols = ['gameDate', 'hometeamName', 'awayteamName', 'homeScore', 'awayScore']
        games = pd.read_csv(
            './data/Games.csv',
            usecols=cols,
            parse_dates=['gameDate'],
            low_memory=False
        )
        
        games = games.dropna(subset=['homeScore', 'awayScore'])
        games['homeScore'] = games['homeScore'].astype(int)
        games['awayScore'] = games['awayScore'].astype(int)
        
        scorigami_data = []
        score_combinations = set()
        
        for _, row in tqdm(games.iterrows(), total=len(games), desc="Processing games"):
            home_score = row['homeScore']
            away_score = row['awayScore']
            
            if home_score > away_score:
                winner = row['hometeamName']
                loser = row['awayteamName']
                winning_score = home_score
                losing_score = away_score
            else:
                winner = row['awayteamName']
                loser = row['hometeamName']
                winning_score = away_score
                losing_score = home_score
            
            score_key = (winning_score, losing_score)
            
            if score_key not in score_combinations:
                scorigami_data.append({
                    'winning_score': winning_score,
                    'losing_score': losing_score,
                    'occurred': True,
                    'games': [{
                        'date': row['gameDate'].strftime('%Y-%m-%d'),
                        'winning_team': winner,
                        'losing_team': loser,
                        'score': f"{winning_score}-{losing_score}"
                    }]
                })
                score_combinations.add(score_key)
            else:
                for entry in scorigami_data:
                    if (entry['winning_score'] == winning_score and 
                        entry['losing_score'] == losing_score):
                        entry['games'].append({
                            'date': row['gameDate'].strftime('%Y-%m-%d'),
                            'winning_team': winner,
                            'losing_team': loser,
                            'score': f"{winning_score}-{losing_score}"
                        })
                        break
        
        max_score = max(max(games['homeScore']), max(games['awayScore']))
        full_scorigami = []
        
        for winning_score in tqdm(range(50, max_score + 1), desc="Generating grid"):
            for losing_score in range(50, winning_score):
                found = False
                for entry in scorigami_data:
                    if (entry['winning_score'] == winning_score and 
                        entry['losing_score'] == losing_score):
                        full_scorigami.append(entry)
                        found = True
                        break
                
                if not found:
                    full_scorigami.append({
                        'winning_score': winning_score,
                        'losing_score': losing_score,
                        'occurred': False,
                        'games': []
                    })
        
        output = {
            'last_updated': datetime.now().isoformat(),
            'max_score': max_score,
            'total_games': len(games),
            'unique_scores': len(score_combinations),
            'scores': full_scorigami
        }
        
        os.makedirs('./public', exist_ok=True)
        with open('../public/nba_scorigami.json', 'w') as f:
            json.dump(output, f, indent=2)
            
        print(f"Success! Saved {len(full_scorigami)} score combinations")
        return True
        
    except Exception as e:
        print(f"Processing failed: {e}")
        return False

if __name__ == '__main__':
    download_kaggle_dataset()
    process_data()