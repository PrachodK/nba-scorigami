import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import './ScorigamiGuesser.css';
import basketballIcon from '../images/basketball.png';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import PopupMessage from './PopupMessage';
import { useAuth } from '../context/AuthContext';



const ScorigamiGuesser = ({ scorigamiData }) => {
  const { currentUser } = useAuth();
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [playedGames, setPlayedGames] = useState([]);
  const [showGuesser, setShowGuesser] = useState(false);
  const [guessScores, setGuessScores] = useState({});
  const [userGuesses, setUserGuesses] = useState([]);
  const username = currentUser?.username || '';
  const [activeTab, setActiveTab] = useState('guess');
  const [justSubmitted, setJustSubmitted] = useState({});
  const [popupMessage, setPopupMessage] = useState('');

  useEffect(() => {
    fetch('/LeagueSchedule25_26.csv')
      .then(res => res.text())
      .then(csvText => {
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          trimHeaders: true,
        });

        const games = parsed.data.map((row, i) => {
          if (!row["gameDateTimeEst"] || !row["homeTeamName"]) return null;

          const dateObj = new Date(row["gameDateTimeEst"]);
          if (isNaN(dateObj)) return null;

          // Combine city and team name
          const awayTeam = `${row["awayTeamCity"]} ${row["awayTeamName"]}`;
          const homeTeam = `${row["homeTeamCity"]} ${row["homeTeamName"]}`;

          return {
            id: `${row["gameId"]}_${awayTeam}_at_${homeTeam}`,
            date: dateObj,
            team1: awayTeam,
            team2: homeTeam,
            arena: row["arenaName"] || '',
            city: row["arenaCity"] || '',
          };
        }).filter(Boolean);

        setUpcomingGames(games);
      });

    fetch('/Games.csv')
      .then(res => res.text())
      .then(csv => {
        const parsed = Papa.parse(csv, { header: true });
        setPlayedGames(parsed.data);
      });
  }, []);


  useEffect(() => {
    const fetchUserGuesses = async () => {
      if (!currentUser) return; 
      const q = query(collection(db, 'guesses'), where('username', '==', currentUser.username));
      const snap = await getDocs(q);
      const guesses = [];
      snap.forEach(doc => guesses.push(doc.data()));
      setUserGuesses(guesses);
    };
    fetchUserGuesses();
  }, [currentUser]);

  const getNextRelevantDate = () => {
    const now = new Date();
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    // Filter games to today or future dates (not just future times)
    const todayOrLater = upcomingGames.filter(g => {
      const gameDay = new Date(g.date);
      gameDay.setHours(0, 0, 0, 0);
      return gameDay >= today;
    }).map(g => g.date).sort((a, b) => a - b);

    if (todayOrLater.length === 0) return null;

    const nextGameDate = new Date(todayOrLater[0]);
    nextGameDate.setHours(0, 0, 0, 0);
    return nextGameDate;
  };

  const nextDate = getNextRelevantDate();
  const filteredGames = upcomingGames.filter(g => {
    if (!nextDate) return false;
    const gameDate = new Date(g.date);
    return (
      gameDate.getFullYear() === nextDate.getFullYear() &&
      gameDate.getMonth() === nextDate.getMonth() &&
      gameDate.getDate() === nextDate.getDate()
    );
  });

  const handleSubmit = async (id) => {
    if (!currentUser) {
      alert('Please log in to submit your guess!');
      return;
    }

    const existingGuess = userGuesses.find(g => g.gameId === id);
    if (existingGuess) {
      alert("You've already made a guess for this game!");
      return;
    }
  
    const [team1Score, team2Score] = guessScores[id];
    const game = upcomingGames.find(g => g.id === id);
  
    try {
      await addDoc(collection(db, 'guesses'), {
        username,
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
    }
  };
  

  const checkActualResult = (game, t1, t2) => {
    const result = playedGames.find(g => {
      const home = `${g.hometeamCity} ${g.hometeamName}`.toLowerCase();
      const away = `${g.awayteamCity} ${g.awayteamName}`.toLowerCase();
      return home.includes(game.team2.toLowerCase()) &&
             away.includes(game.team1.toLowerCase()) &&
             Math.abs(new Date(game.guessDate) - new Date(g.gameDate)) < 12 * 60 * 60 * 1000;
    });

    if (!result) return '⏳ Awaiting result';
    const correct = parseInt(result.homeScore) === t2 && parseInt(result.awayScore) === t1;
    return correct ? '✅ Correct!' : '❌ Wrong';
  };

  return (
    <>
      <button
  className="guesser-btn"
  onClick={() => {
    if (!currentUser) {
      setPopupMessage('Please log in or sign up to make guesses!');
      return;
    }
    setShowGuesser(true);
  }}
>
  🏀 Scorigami Guesser
</button>

      {showGuesser && (
        <div className="modal-overlay" onClick={() => setShowGuesser(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Scorigami Guesser</h2>
              <button className="modal-close-btn" onClick={() => setShowGuesser(false)}>×</button>
            </div>
            <div className="guesser-tabs">
              <button className={activeTab === 'guess' ? 'active' : ''} onClick={() => setActiveTab('guess')}>Guess</button>
              <button className={activeTab === 'myGuesses' ? 'active' : ''} onClick={() => setActiveTab('myGuesses')}>My Guesses</button>
            </div>
            <div className="modal-body">
              {activeTab === 'guess' ? (
                <>

                  {filteredGames.map((game, idx) => {
                    const [t1, t2] = guessScores[game.id] || ['', ''];
                    const isScorigami = (t1 > t2) && scorigamiData && !scorigamiData.scores.some(s => s.winning_score === t1 && s.losing_score === t2);

                    return (
                      <div key={idx} className={`game-card ${isScorigami ? 'potential' : ''}`}>
                        <div className="game-date">
                          {game.date.toLocaleString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
                          })}<br />
                          {game.team1} @ {game.team2}<br /><small>{game.arena}</small>
                        </div>
                        <div className="game-teams">
                          <input type="number" placeholder={game.team1} value={t1 || ''} onChange={e => setGuessScores({ ...guessScores, [game.id]: [parseInt(e.target.value) || 0, t2] })} className="score-input" />
                          <span> vs </span>
                          <input type="number" placeholder={game.team2} value={t2 || ''} onChange={e => setGuessScores({ ...guessScores, [game.id]: [t1, parseInt(e.target.value) || 0] })} className="score-input" />
                        </div>
                        {!userGuesses.some(g => g.gameId === game.id) && !justSubmitted[game.id] && (
  <button className="submit-btn" onClick={() => handleSubmit(game.id)}>Submit</button>
)}
{justSubmitted[game.id] && (
  <div className="just-submitted-msg">✅ Submitted!</div>
)}
{userGuesses.some(g => g.gameId === game.id) && !justSubmitted[game.id] && (
  <div className="already-guessed-msg">✅ You already submitted a guess for this game.</div>
)}



{justSubmitted[game.id] && (
  <img src={basketballIcon} alt="Submitted" className="basketball-icon bounce" />
)}
{isScorigami && <div className="scorigami-tag">🔥 Possible Scorigami!</div>}

                      </div>
                    );
                  })}
                </>
              ) : (
                userGuesses.length === 0 ? <p>No guesses yet.</p> : (
                  userGuesses.map((g, i) => (
                    <div key={i} className="game-card">
                      {g.team1} @ {g.team2} → {g.guess[0]}-{g.guess[1]}
                      <span className="correct"> {checkActualResult(g, g.guess[0], g.guess[1])}</span>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
          {popupMessage && (
      <PopupMessage message={popupMessage} onClose={() => setPopupMessage('')} />
    )}
    </>

  );
};

export default ScorigamiGuesser;
