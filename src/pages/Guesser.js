import React, { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet';
import Papa from 'papaparse';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import PopupMessage from '../components/PopupMessage';
import Leaderboard from '../components/Leaderboard';
import './Guesser.css';

const Guesser = ({ scorigamiData }) => {
  const { currentUser } = useAuth();
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [playedGames, setPlayedGames] = useState([]);
  const [guessScores, setGuessScores] = useState({});
  const [userGuesses, setUserGuesses] = useState([]);
  const [activeTab, setActiveTab] = useState('guess');
  const [justSubmitted, setJustSubmitted] = useState({});
  const [popupMessage, setPopupMessage] = useState('');
  const [loading, setLoading] = useState(true);

  const parseESTDate = (estString) => {
    return new Date(estString + '-05:00');
  };

  useEffect(() => {
    Promise.all([
      fetch('/LeagueSchedule25_26.csv')
        .then(res => res.text())
        .then(csvText => {
          const parsed = Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            trimHeaders: true,
          });

          const games = parsed.data.map((row) => {
            if (!row["gameDateTimeEst"] || !row["homeTeamName"]) return null;

            const dateObj = parseESTDate(row["gameDateTimeEst"]);
            if (isNaN(dateObj.getTime())) return null;

            const awayTeam = `${row["awayTeamCity"]} ${row["awayTeamName"]}`;
            const homeTeam = `${row["homeTeamCity"]} ${row["homeTeamName"]}`;

            return {
              id: `${row["gameId"]}_${awayTeam}_at_${homeTeam}`,
              date: dateObj,
              team1: awayTeam,
              team2: homeTeam,
            };
          }).filter(Boolean);

          setUpcomingGames(games);
        }),
      fetch('/Games.csv')
        .then(res => res.text())
        .then(csv => {
          const parsed = Papa.parse(csv, { header: true });
          setPlayedGames(parsed.data);
        })
    ]).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const fetchUserGuesses = async () => {
      if (!currentUser) return;
      try {
        const q = query(collection(db, 'guesses'), where('username', '==', currentUser.username));
        const snap = await getDocs(q);
        const guesses = [];
        snap.forEach(doc => guesses.push(doc.data()));
        setUserGuesses(guesses);
      } catch (err) {
        console.error('Error fetching guesses:', err);
      }
    };
    fetchUserGuesses();
  }, [currentUser]);

  const getNextRelevantDate = () => {
    const now = new Date();
    const upcoming = upcomingGames
      .map(g => g.date)
      .filter(d => d > now)
      .sort((a, b) => a - b);
    if (upcoming.length === 0) return null;
    const nextGameDate = new Date(upcoming[0]);
    nextGameDate.setHours(0, 0, 0, 0);
    return nextGameDate;
  };

  const nextDate = getNextRelevantDate();
  
  const filteredGames = upcomingGames.filter(g => {
    if (!nextDate) return false;
    const gameDate = new Date(g.date);
    gameDate.setHours(0, 0, 0, 0);
    return (
      gameDate.getFullYear() === nextDate.getFullYear() &&
      gameDate.getMonth() === nextDate.getMonth() &&
      gameDate.getDate() === nextDate.getDate()
    );
  });

  const guessableGames = filteredGames.filter(g => g.date > new Date());

  const handleSubmit = async (id) => {
    if (!currentUser) {
      setPopupMessage('Please log in or sign up to make guesses!');
      return;
    }

    const game = upcomingGames.find(g => g.id === id);
    if (game.date <= new Date()) {
      setPopupMessage('This game has already started!');
      return;
    }

    const existingGuess = userGuesses.find(g => g.gameId === id);
    if (existingGuess) {
      setPopupMessage("You've already made a guess for this game!");
      return;
    }

    const [team1Score, team2Score] = guessScores[id] || [0, 0];
    
    if (!team1Score || !team2Score) {
      setPopupMessage('Please enter scores for both teams!');
      return;
    }

    try {
      await addDoc(collection(db, 'guesses'), {
        username: currentUser.username,
        gameId: id,
        guess: [team1Score, team2Score],
        team1: game.team1,
        team2: game.team2,
        guessDate: game.date.toISOString(),
        submittedAt: new Date().toISOString(),
      });

      setUserGuesses(prev => [...prev, {
        gameId: id,
        guess: [team1Score, team2Score],
        team1: game.team1,
        team2: game.team2,
        guessDate: game.date.toISOString(),
      }]);

      setJustSubmitted(prev => ({ ...prev, [id]: true }));
      setTimeout(() => {
        setJustSubmitted(prev => ({ ...prev, [id]: false }));
      }, 3000);

    } catch (err) {
      console.error("Error saving guess to Firestore:", err);
      setPopupMessage('Failed to submit guess. Please try again.');
    }
  };

  const checkActualResult = (game, t1, t2) => {
    const result = playedGames.find(g => {
      const home = `${g.hometeamCity} ${g.hometeamName}`.toLowerCase();
      const away = `${g.awayteamCity} ${g.awayteamName}`.toLowerCase();
      return home.includes(game.team2.toLowerCase()) &&
             away.includes(game.team1.toLowerCase()) &&
             Math.abs(new Date(game.guessDate) - new Date(g.gameDateTimeEst)) < 12 * 60 * 60 * 1000;
    });

    if (!result) return { status: 'pending', text: 'Awaiting result' };
    const correct = parseInt(result.homeScore) === t2 && parseInt(result.awayScore) === t1;
    const actualScore = `${result.awayScore}-${result.homeScore}`;
    return correct 
      ? { status: 'correct', text: 'Correct!' } 
      : { status: 'wrong', text: `Wrong (${actualScore})` };
  };

  const getTimeUntil = (date) => {
    const diff = date - new Date();
    if (diff <= 0) return null;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  return (
    <div className="guesser-page">
      <Helmet>
        <title>Score Guesser | NBA Scorigami</title>
        <meta name="description" content="Predict NBA scores and compete on the leaderboard." />
      </Helmet>

      <section className="guesser-hero">
        <h1 className="page-title">Score Guesser</h1>
        <p className="page-subtitle">Predict final scores before tip-off. Climb the leaderboard.</p>
      </section>

      <div className="guesser-tabs">
        <button 
          className={`tab-btn ${activeTab === 'guess' ? 'active' : ''}`}
          onClick={() => setActiveTab('guess')}
        >
          Make Guesses
        </button>
        <button 
          className={`tab-btn ${activeTab === 'myGuesses' ? 'active' : ''}`}
          onClick={() => setActiveTab('myGuesses')}
        >
          My Guesses
        </button>
        <button 
          className={`tab-btn ${activeTab === 'leaderboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('leaderboard')}
        >
          Leaderboard
        </button>
      </div>

      <div className="guesser-content">
        {activeTab === 'guess' && (
          loading ? (
            <div className="loading-state">
              <div className="loading-spinner"></div>
              <p>Loading games...</p>
            </div>
          ) : guessableGames.length === 0 ? (
            <div className="empty-state">
              <h3>No games available</h3>
              <p>Check back closer to game time to make predictions.</p>
            </div>
          ) : (
            <div className="games-grid">
              {guessableGames.map((game) => {
                const [t1, t2] = guessScores[game.id] || ['', ''];
                const isScorigami = (t1 > t2) && scorigamiData && !scorigamiData.scores.some(s => s.winning_score === t1 && s.losing_score === t2);
                const hasGuessed = userGuesses.some(g => g.gameId === game.id);
                const timeUntil = getTimeUntil(game.date);

                return (
                  <div key={game.id} className={`game-card-guesser ${isScorigami ? 'scorigami-potential' : ''}`}>
                    <div className="game-header">
                      <span className="game-time">
                        {game.date.toLocaleString(undefined, {
                          weekday: 'short', 
                          month: 'short', 
                          day: 'numeric', 
                          hour: 'numeric', 
                          minute: '2-digit', 
                          hour12: true
                        })}
                      </span>
                      {timeUntil && <span className="countdown">{timeUntil}</span>}
                    </div>
                    
                    <div className="matchup">
                      <span className="team-name">{game.team1}</span>
                      <span className="at-symbol">@</span>
                      <span className="team-name">{game.team2}</span>
                    </div>
                    
                    {!hasGuessed && !justSubmitted[game.id] && (
                      <>
                        <div className="score-inputs">
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={t1 || ''} 
                            onChange={e => setGuessScores({ ...guessScores, [game.id]: [parseInt(e.target.value) || 0, t2] })} 
                            min="0"
                            max="200"
                          />
                          <span className="vs-badge">-</span>
                          <input 
                            type="number" 
                            placeholder="0" 
                            value={t2 || ''} 
                            onChange={e => setGuessScores({ ...guessScores, [game.id]: [t1, parseInt(e.target.value) || 0] })} 
                            min="0"
                            max="200"
                          />
                        </div>
                        <button className="submit-guess-btn" onClick={() => handleSubmit(game.id)}>
                          Submit
                        </button>
                      </>
                    )}
                    
                    {justSubmitted[game.id] && (
                      <div className="submission-success">Submitted!</div>
                    )}
                    
                    {hasGuessed && !justSubmitted[game.id] && (
                      <div className="already-guessed">Already guessed</div>
                    )}

                    {isScorigami && (
                      <div className="scorigami-badge">Possible Scorigami!</div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'myGuesses' && (
          userGuesses.length === 0 ? (
            <div className="empty-state">
              <h3>No guesses yet</h3>
              <p>Start predicting scores to track your accuracy!</p>
            </div>
          ) : (
            <div className="guesses-list">
              {userGuesses.map((g, i) => {
                const result = checkActualResult(g, g.guess[0], g.guess[1]);
                return (
                  <div key={i} className={`guess-item ${result.status}`}>
                    <div className="guess-info">
                      <div className="guess-matchup">{g.team1} @ {g.team2}</div>
                      <div className="guess-prediction">Predicted: {g.guess[0]}-{g.guess[1]}</div>
                    </div>
                    <span className={`result-badge ${result.status}`}>
                      {result.text}
                    </span>
                  </div>
                );
              })}
            </div>
          )
        )}

        {activeTab === 'leaderboard' && (
          <div className="leaderboard-container">
            <Leaderboard playedGames={playedGames} />
          </div>
        )}
      </div>

      {popupMessage && (
        <PopupMessage message={popupMessage} onClose={() => setPopupMessage('')} />
      )}
    </div>
  );
};

export default Guesser;
