import React, { useEffect, useState } from 'react';
import './ScorigamiGuesser.css';
import basketballIcon from '../images/basketball.png';
import { db } from '../firebase';
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore';
import PopupMessage from './PopupMessage';
import { useAuth } from '../context/AuthContext';
import { fetchScoreboard } from '../services/nbaApi';



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

  // Fetch upcoming games and scores from NBA API
  useEffect(() => {
    const fetchGames = async () => {
      try {
        // Fetch today's and upcoming games
        const today = new Date();
        const allGames = [];

        // Fetch games sequentially to avoid rate limiting (not in parallel)
        for (let i = 0; i < 3; i++) { // Only fetch 3 days instead of 7
          const date = new Date(today);
          date.setDate(date.getDate() + i);

          const dayGames = await fetchScoreboard(date);
          allGames.push(...dayGames);

          // Add delay between requests to avoid rate limiting
          if (i < 2) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }

        // Transform to match existing format
        const transformedGames = allGames.map(game => ({
          id: game.gameId,
          date: game.gameDate,
          team1: `${game.awayTeamCity} ${game.awayTeam}`,
          team2: `${game.homeTeamCity} ${game.homeTeam}`,
          arena: game.arena,
          gameStatus: game.gameStatus,
          awayScore: game.awayScore,
          homeScore: game.homeScore,
        }));

        // Separate upcoming and played games
        const upcoming = transformedGames.filter(g => g.gameStatus === 1); // Scheduled
        const played = transformedGames.filter(g => g.gameStatus === 3); // Final

        setUpcomingGames(upcoming);

        // For played games, transform to match old CSV format
        const playedFormatted = played.map(g => ({
          gameDate: g.date.toISOString(),
          hometeamCity: g.team2.split(' ')[0],
          hometeamName: g.team2.split(' ').slice(1).join(' '),
          awayteamCity: g.team1.split(' ')[0],
          awayteamName: g.team1.split(' ').slice(1).join(' '),
          homeScore: g.homeScore,
          awayScore: g.awayScore,
        }));

        setPlayedGames(playedFormatted);
      } catch (error) {
        console.error('Error fetching NBA games:', error);
      }
    };

    fetchGames();

    // Set up auto-refresh every 5 minutes for live updates
    const interval = setInterval(fetchGames, 5 * 60 * 1000);
    return () => clearInterval(interval);
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
    const upcoming = upcomingGames.map(g => g.date).filter(d => d > now).sort((a, b) => a - b);
    if (upcoming.length === 0) return null;
    const nextGameDate = new Date(upcoming[0]);
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
