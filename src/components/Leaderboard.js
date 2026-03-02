import React, { useEffect, useState, useMemo, useRef } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import './Leaderboard.css';

const CACHE_KEY = 'leaderboard_cache';
const CACHE_TTL = 5 * 60 * 1000;

const Leaderboard = ({ playedGames }) => {
  const [data, setData] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const isMounted = useRef(true);

  const processedGamesMap = useMemo(() => {
    if (!playedGames || playedGames.length === 0) return new Map();
    
    const map = new Map();
    playedGames.forEach(game => {
      if (!game.gameDateTimeEst) return;
      const date = new Date(game.gameDateTimeEst);
      const dateKey = date.toDateString();
      const home = `${game.hometeamCity} ${game.hometeamName}`.toLowerCase();
      const away = `${game.awayteamCity} ${game.awayteamName}`.toLowerCase();
      const homeScore = parseInt(game.homeScore);
      const awayScore = parseInt(game.awayScore);
      
      if (isNaN(homeScore) || isNaN(awayScore)) return;
      
      if (!map.has(dateKey)) map.set(dateKey, []);
      map.get(dateKey).push({
        home,
        away,
        homeScore,
        awayScore,
        gameDate: date
      });
    });
    return map;
  }, [playedGames]);

  useEffect(() => {
    isMounted.current = true;
    return () => { isMounted.current = false; };
  }, []);

  useEffect(() => {
    if (processedGamesMap.size === 0) {
      setLoading(false);
      return;
    }

    const fetchGuesses = async () => {
      setLoading(true);
      
      try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
          const { data: cachedData, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL && cachedData) {
            const processed = processGuesses(cachedData, processedGamesMap);
            if (isMounted.current) {
              setData(processed);
              setLoading(false);
            }
            return;
          }
        }

        const snap = await getDocs(collection(db, 'guesses'));
        const rawGuesses = [];
        snap.forEach(doc => rawGuesses.push(doc.data()));

        localStorage.setItem(CACHE_KEY, JSON.stringify({
          data: rawGuesses,
          timestamp: Date.now()
        }));

        const processed = processGuesses(rawGuesses, processedGamesMap);
        if (isMounted.current) {
          setData(processed);
        }
      } catch (err) {
        console.error('Error fetching leaderboard:', err);
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    };

    fetchGuesses();
  }, [processedGamesMap]);

  return (
    <div className="leaderboard-container">
      <LeaderboardContent 
        data={data} 
        loading={loading} 
        selectedUser={selectedUser}
        setSelectedUser={setSelectedUser}
      />
    </div>
  );
};

function processGuesses(rawGuesses, gamesMap) {
  const grouped = {};

  rawGuesses.forEach(guess => {
    if (!grouped[guess.username]) {
      grouped[guess.username] = [];
    }
    
    if (!guess.guessDate) return;
    
    const guessDate = new Date(guess.guessDate);
    const guessDateKey = guessDate.toDateString();
    const prevDayKey = new Date(guessDate.getTime() - 12 * 60 * 60 * 1000).toDateString();
    const nextDayKey = new Date(guessDate.getTime() + 12 * 60 * 60 * 1000).toDateString();
    
    const guessedHome = (guess.team2 || '').toLowerCase();
    const guessedAway = (guess.team1 || '').toLowerCase();
    const guessHomeScore = parseInt(guess.guess?.[1]);
    const guessAwayScore = parseInt(guess.guess?.[0]);

    if (isNaN(guessHomeScore) || isNaN(guessAwayScore)) return;

    let gameMatch = null;
    
    for (const dateKey of [guessDateKey, prevDayKey, nextDayKey]) {
      const gamesOnDate = gamesMap.get(dateKey);
      if (!gamesOnDate) continue;
      
      for (const game of gamesOnDate) {
        if (
          game.homeScore === guessHomeScore &&
          game.awayScore === guessAwayScore &&
          game.home.includes(guessedHome) &&
          game.away.includes(guessedAway)
        ) {
          gameMatch = game;
          break;
        }
      }
      if (gameMatch) break;
    }

    if (gameMatch) {
      grouped[guess.username].push({
        ...guess,
        correct: true,
        actual: `${gameMatch.homeScore}-${gameMatch.awayScore}`
      });
    }
  });

  return grouped;
}

const LeaderboardContent = React.memo(({ data, loading, selectedUser, setSelectedUser }) => {
  const sortedUsers = useMemo(() => 
    Object.entries(data).sort((a, b) => b[1].length - a[1].length),
    [data]
  );

  if (loading) {
    return (
      <div className="leaderboard-loading">
        <div className="loading-spinner"></div>
        <p>Loading leaderboard...</p>
      </div>
    );
  }

  if (sortedUsers.length === 0) {
    return (
      <div className="leaderboard-empty">
        <div className="empty-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 15l-2 5l9-11h-6l2-5l-9 11h6z"/>
          </svg>
        </div>
        <h3>No correct guesses yet!</h3>
        <p>Be the first to guess a score correctly and appear on the leaderboard.</p>
      </div>
    );
  }

  return (
    <div className="leaderboard-list">
      {sortedUsers.map(([user, guesses], index) => {
        const rank = index + 1;
        const isExpanded = selectedUser === user;
        
        return (
          <div 
            key={user} 
            className={`leaderboard-user ${isExpanded ? 'expanded' : ''}`}
            style={{ animationDelay: `${index * 0.05}s` }}
          >
            <div 
              className="leaderboard-header"
              onClick={() => setSelectedUser(isExpanded ? null : user)}
            >
              <div className="rank-badge">
                {rank === 1 ? (
                  <span className="rank-gold">1</span>
                ) : rank === 2 ? (
                  <span className="rank-silver">2</span>
                ) : rank === 3 ? (
                  <span className="rank-bronze">3</span>
                ) : (
                  <span className="rank-normal">{rank}</span>
                )}
              </div>
              <div className="user-info-leaderboard">
                <span className="username">{user}</span>
                <span className="guess-count">
                  {guesses.length} correct guess{guesses.length !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className={`expand-icon ${isExpanded ? 'rotated' : ''}`}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M19 9l-7 7-7-7"/>
                </svg>
              </div>
            </div>
            
            {isExpanded && (
              <div className="guess-list-container">
                <ul className="guess-list">
                  {guesses.map((g, i) => (
                    <li key={i} className="guess-item">
                      <div className="guess-teams">
                        <span className="team">{g.team1}</span>
                        <span className="at">@</span>
                        <span className="team">{g.team2}</span>
                      </div>
                      <div className="guess-score">
                        <span className="predicted">Predicted: {g.guess[0]}-{g.guess[1]}</span>
                        <span className="check-icon">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <path d="M20 6L9 17l-5-5"/>
                          </svg>
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
});

export default Leaderboard;
