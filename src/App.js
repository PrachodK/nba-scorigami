import React, { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [scorigamiData, setScorigamiData] = useState(null);
  const [selectedScore, setSelectedScore] = useState(null);
  const [maxScore, setMaxScore] = useState(180); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disableLowerScores, setDisableLowerScores] = useState(false); 

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/nba_scorigami.json');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();
        setScorigamiData(data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleScoreClick = (score) => {
    if (score.occurred) {
      setSelectedScore(score);
    }
  };

  const getCellColor = (score) => {
    if (!score.occurred) return 'white';
    if (score.winning_score <= score.losing_score) return 'black';
    return 'green';
  };

  const renderScoreGrid = () => {
    if (!scorigamiData) return null;

    const grid = [];
    const cellSize = 14; 
    const labelIncrement = 10;

    const headerRow = [
      <div key="header-empty" className="grid-cell corner-cell"></div>
    ];
    for (let ws = 50; ws <= maxScore; ws++) {
      if (ws % labelIncrement === 0 || ws === maxScore) {
        headerRow.push(
          <div key={`header-${ws}`} className="grid-cell header-cell">
            {ws}
          </div>
        );
      } else {
        headerRow.push(<div key={`header-${ws}`} className="grid-cell"></div>);
      }
    }
    grid.push(<div key="header-row" className="grid-row">{headerRow}</div>);

    for (let ls = 50; ls <= maxScore; ls++) {
      const rowCells = [];
      
      if (ls % labelIncrement === 0 || ls === maxScore) {
        rowCells.push(
          <div key={`label-${ls}`} className="grid-cell header-cell">
            {ls}
          </div>
        );
      } else {
        rowCells.push(<div key={`label-${ls}`} className="grid-cell"></div>);
      }

      for (let ws = 50; ws <= maxScore; ws++) {
        const score = scorigamiData.scores.find(s => 
          s.winning_score === ws && s.losing_score === ls
        );
        
        const cellColor = score ? getCellColor(score) : 'white';
        const isDisabled = disableLowerScores && ws <= ls;

        rowCells.push(
          <div
            key={`${ws}-${ls}`}
            className={`grid-cell ${cellColor} ${isDisabled ? 'disabled' : ''}`}
            onClick={() => !isDisabled && score && handleScoreClick(score)}
            title={score?.occurred ? `${ws}-${ls}` : ''}
          />
        );
      }

      grid.push(<div key={`row-${ls}`} className="grid-row">{rowCells}</div>);
    }

    return (
      <div className="grid-scroll-container">
        <div className="grid-container">
          <div className="grid-inner">
            {grid}
          </div>
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading">Loading NBA score data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="App">
      <header className="app-header">
        <h1>NBA Scorigami</h1>
        <p className="subtitle">Visualizing every unique score combination in NBA history</p>
      </header>

      <div className="info-box">
        <h3>How to use the NBA Scorigami chart</h3>
        <p>
    This grid shows every possible final score combination in NBA history. The winning team's score runs along the top (x-axis), 
    while the losing team's score runs down the side (y-axis). Each square represents a specific score combination - 
    <span className="green-text"> green squares</span> show scores that have happened, 
    <span className="white-text"> white squares</span> show possible but unrecorded scores, and 
    {<span className="black-text"> black squares</span>} (when toggled) show impossible combinations where the "winning" 
    score would actually be less than or equal to the "losing" score. 
    <br /><br />

    Click any green square to see historical games with that final score.

    <br /><br />
    Last updated: 04/02/2025
  </p>
      </div>

      <div className="controls">
        <div className="control-group">
          <label>
            <input 
              type="checkbox" 
              checked={disableLowerScores} 
              onChange={() => setDisableLowerScores(!disableLowerScores)}
            />
            Disable lower scores
          </label>
        </div>
      </div>


      {renderScoreGrid()}
      
      {selectedScore && (
        <div className="score-details">
          <h3>
            Games with score: {selectedScore.winning_score}-{selectedScore.losing_score}
            <span className="close-btn" onClick={() => setSelectedScore(null)}>×</span>
          </h3>
          <div className="games-list">
            {selectedScore.games.map((game, index) => (
              <div key={`${index}`} className="game-card">
                <div className="game-date">
                  {new Date(game.date).toLocaleDateString()}
                </div>
                <div className="game-teams">
                  <span className="winner">
                    {game.winning_team} {game.winning_score}
                  </span>
                  <span> vs </span>
                  <span>
                    {game.losing_team} {game.losing_score}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
            <div className="about-author">
  <div className="author-card">
    <div className="author-image-container">
      <img 
        src="images/PrachodHeadshot.JPG" 
        alt="Your Photo" 
        className="author-image"
      />
    </div>
    <div className="author-content">
      <h3 className="author-name">Prachod Kakatur</h3>
      <p className="author-bio">
        Hi, I'm a Computer Science student at the University of Illinois at Urbana-Champaign 
        with a passion for software development, robotics, and full-stack development. Feel free to reach out to me at prachodkakatur@gmail.com.
      </p>
      <a 
        href="https://www.linkedin.com/in/prachod-kakatur" 
        target="_blank" 
        rel="noopener noreferrer"
        className="linkedin-button"
      >
        <i className="fab fa-linkedin"></i> Connect on LinkedIn
      </a>
    </div>
  </div>
</div>

    </div>

    
  );
}

export default App;