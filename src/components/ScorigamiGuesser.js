import React, { useEffect, useState } from 'react';
import Papa from 'papaparse';
import './ScorigamiGuesser.css';
import basketballIcon from '../images/basketball.png';

const ScorigamiGuesser = ({ scorigamiData }) => {
  const [upcomingGames, setUpcomingGames] = useState([]);
  const [showGuesser, setShowGuesser] = useState(false);
  const [guessScores, setGuessScores] = useState({});
  const [submitted, setSubmitted] = useState({});
  const [activeTab, setActiveTab] = useState('guess');

  useEffect(() => {
    fetch('/LeagueSchedule24_25_Updated.csv')
      .then(res => res.text())
      .then(csvText => {
        const parsed = Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          trimHeaders: true,
        });

        const games = parsed.data.map((row, i) => {
          if (!row["Game Date"] || !row["Start (ET)"]) return null;
          const dateStr = row["Game Date"].replace(/"/g, '').trim();
          const timeStr = row["Start (ET)"].trim().toLowerCase().replace('a', ' AM').replace('p', ' PM');
          const fullDateTimeStr = `${dateStr} ${timeStr} GMT-0500`;
          const dateObj = new Date(fullDateTimeStr);
          if (isNaN(dateObj)) return null;

          return {
            id: `${i}_${row["Visitor/Neutral"]}_at_${row["Home/Neutral"]}`,
            date: dateObj,
            team1: row["Visitor/Neutral"],
            team2: row["Home/Neutral"],
            arena: row["Arena"],
            city: row["Notes"] || '',
          };
        }).filter(Boolean);

        setUpcomingGames(games);

        const saved = localStorage.getItem('scorigamiGuesses');
        if (saved) setGuessScores(JSON.parse(saved));

        const savedSubmitted = localStorage.getItem('scorigamiSubmitted');
        if (savedSubmitted) setSubmitted(JSON.parse(savedSubmitted));
      });
  }, []);

  const getNextRelevantDate = (games) => {
    const now = new Date();
    const upcoming = games.map(g => g.date).filter(d => d > now).sort((a, b) => a - b);
    if (upcoming.length === 0) return null;
    const nextGameDate = new Date(upcoming[0]);
    nextGameDate.setHours(0, 0, 0, 0);
    return nextGameDate;
  };

  const nextDate = getNextRelevantDate(upcomingGames);
  const filteredGames = upcomingGames.filter(g => {
    if (!nextDate) return false;
    const gameDate = new Date(g.date);
    return (
      gameDate.getFullYear() === nextDate.getFullYear() &&
      gameDate.getMonth() === nextDate.getMonth() &&
      gameDate.getDate() === nextDate.getDate()
    );
  });

  const saveGuess = (id, team1Score, team2Score) => {
    const updated = {
      ...guessScores,
      [id]: [team1Score, team2Score]
    };
    setGuessScores(updated);
    localStorage.setItem('scorigamiGuesses', JSON.stringify(updated));
  };

  const handleSubmit = (id) => {
    setSubmitted({ ...submitted, [id]: true });
    localStorage.setItem('scorigamiSubmitted', JSON.stringify({ ...submitted, [id]: true }));
  };

  const isScorigamiPotential = (ws, ls) => {
    return !scorigamiData?.scores?.some(s => s.winning_score === ws && s.losing_score === ls);
  };

  const isCorrectGuess = (ws, ls) => {
    return scorigamiData?.scores?.some(s => s.winning_score === ws && s.losing_score === ls);
  };

  return (
    <>
      <button className="guesser-btn" onClick={() => setShowGuesser(true)}>🏀 Scorigami Guesser</button>
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
                filteredGames.length === 0 ? <p>No games left today or tomorrow.</p> : (
                  filteredGames.map((game, idx) => {
                    const [t1, t2] = guessScores[game.id] || ['', ''];
                    const potential = (t1 > t2) && isScorigamiPotential(t1, t2);
                    const showBall = submitted[game.id];

                    return (
                      <div key={idx} className={`game-card ${potential ? 'potential' : ''}`}>
                        <div className="game-date">
                          {game.date.toLocaleString(undefined, {
                            weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true
                          })}
                          <br />{game.team1} @ {game.team2}
                          <br /><small>{game.arena}</small>
                        </div>
                        <div className="game-teams">
                          <input type="number" placeholder={game.team1} value={t1} onChange={e => saveGuess(game.id, parseInt(e.target.value) || 0, t2)} className="score-input" />
                          <span> vs </span>
                          <input type="number" placeholder={game.team2} value={t2} onChange={e => saveGuess(game.id, t1, parseInt(e.target.value) || 0)} className="score-input" />
                        </div>
                        <button className="submit-btn" onClick={() => handleSubmit(game.id)}>
                          Submit
                        </button>
                        {showBall && <img src={basketballIcon} alt="basketball" className="basketball-icon bounce" />}
                        {potential && <div className="scorigami-tag">🔥 Possible Scorigami!</div>}
                      </div>
                    );
                  })
                )
              ) : (
                Object.keys(guessScores).length === 0 ? (
                  <p>No guesses made yet.</p>
                ) : (
                  Object.entries(guessScores).map(([id, [ws, ls]]) => (
                    <div key={id} className="game-card">
                      <div className="game-teams">
                        {id.replace(/\d+_/, '').replaceAll('_at_', ' @ ')} → {ws}-{ls}
                        {submitted[id] && <span className="submitted"> (submitted)</span>}
                        {isCorrectGuess(ws, ls) && <span className="correct"> ✅ Correct!</span>}
                      </div>
                    </div>
                  ))
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ScorigamiGuesser;
