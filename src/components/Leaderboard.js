import React, { useEffect, useState } from 'react';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import './Leaderboard.css';

const Leaderboard = ({ playedGames }) => {
  const [data, setData] = useState({});
  const [selectedUser, setSelectedUser] = useState(null);

  useEffect(() => {
    const fetchGuesses = async () => {
      const snap = await getDocs(collection(db, 'guesses'));
      const rawGuesses = [];
      snap.forEach(doc => rawGuesses.push(doc.data()));

      const grouped = {};

      rawGuesses.forEach(guess => {
        const gameMatch = playedGames.find(game => {
          const home = `${game.hometeamCity} ${game.hometeamName}`.toLowerCase();
          const away = `${game.awayteamCity} ${game.awayteamName}`.toLowerCase();

          const guessedHome = guess.team2.toLowerCase();
          const guessedAway = guess.team1.toLowerCase();

          const dateMatch = Math.abs(new Date(guess.guessDate) - new Date(game.gameDate)) < 12 * 60 * 60 * 1000;

          const isCorrect = 
            game.homeScore === guess.guess[1] &&
            game.awayScore === guess.guess[0] &&
            home.includes(guessedHome) &&
            away.includes(guessedAway) &&
            dateMatch;

          return isCorrect;
        });

        if (!grouped[guess.username]) grouped[guess.username] = [];

        if (gameMatch) {
          grouped[guess.username].push({
            ...guess,
            correct: true,
            actual: `${gameMatch.homeScore}-${gameMatch.awayScore}`
          });
        }
      });

      setData(grouped);
    };

    fetchGuesses();
  }, [playedGames]);

  return (
    <div className="leaderboard-container">
      {Object.entries(data)
        .sort((a, b) => b[1].length - a[1].length)
        .map(([user, guesses]) => (
          <div key={user} className="leaderboard-user">
            <div className="leaderboard-header" onClick={() => setSelectedUser(user === selectedUser ? null : user)}>
              <strong>{user}</strong> — {guesses.length} correct guess{guesses.length !== 1 ? 'es' : ''}
            </div>
            {selectedUser === user && (
              <ul className="guess-list">
                {guesses.map((g, i) => (
                  <li key={i}>
                    {g.team1} @ {g.team2} — You guessed: {g.guess[0]}-{g.guess[1]} ✅
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
    </div>
  );
};

export default Leaderboard;
