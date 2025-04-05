import pandas as pd
import json
from datetime import datetime
import os
import sys
from tqdm import tqdm

if len(sys.argv) > 1:
    output_path = sys.argv[1]
    csv_path = sys.argv[2] if len(sys.argv) > 2 else 'public/Games.csv'
else:
    script_dir = os.path.dirname(os.path.abspath(__file__))
    public_dir = os.path.normpath(os.path.join(script_dir, '../../public'))
    output_path = os.path.join(public_dir, 'nba_scorigami.json')
    csv_path = os.path.join(public_dir, 'Games.csv')

print(f"Reading CSV from: {csv_path}")
print(f"Writing JSON to: {output_path}")

os.makedirs(os.path.dirname(output_path), exist_ok=True)

def process_data(csv_path, output_path):
    """Process Games.csv into Scorigami format"""
    try:
        cols = ['gameDate', 'hometeamName', 'awayteamName', 'homeScore', 'awayScore']
        games = pd.read_csv(
            csv_path,
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
        
        with open(output_path, 'w') as f:
            json.dump(output, f, indent=2)
            
        print(f"Success! Saved to {output_path}")
        return True
        
    except Exception as e:
        print(f"Processing failed: {e}")
        return False

if __name__ == '__main__':
    process_data(csv_path, output_path)
