import React, { useState, useEffect } from 'react';
import './App.css';
import ScorigamiGuesser from './components/ScorigamiGuesser';
import { Analytics } from '@vercel/analytics/react';
import { Helmet } from 'react-helmet';

function App() {
  const [scorigamiData, setScorigamiData] = useState(null);
  const [selectedScore, setSelectedScore] = useState(null);
  const [maxScore] = useState(180); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disableLowerScores, setDisableLowerScores] = useState(false);
  
  const [yearRange, setYearRange] = useState([1946, 2025]);
  const [selectedTeam, setSelectedTeam] = useState("All Franchises");
  const [teams, setTeams] = useState([]);
  const [filteredData, setFilteredData] = useState(null);
  const [showModal, setShowModal] = useState(false);


  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/nba_scorigami.json');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();
        
        const allTeams = new Set();
        data.scores.forEach(score => {
          score.games.forEach(game => {
            allTeams.add(game.winning_team);
            allTeams.add(game.losing_team);
          });
        });
        
        setTeams(['All teams', ...Array.from(allTeams).sort()]);
        setScorigamiData(data);
        setFilteredData(data);
        setLoading(false);
      } catch (err) {
        console.error("Error loading data:", err);
        setError(err.message);
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    if (!scorigamiData) return;
    
    const filteredScores = scorigamiData.scores.map(score => {
      const filteredGames = score.games.filter(game => {
        const gameYear = new Date(game.date).getFullYear();
        const yearFilter = gameYear >= yearRange[0] && gameYear <= yearRange[1];
        const teamFilter = selectedTeam === "All Franchises" || 
                           game.winning_team === selectedTeam || 
                           game.losing_team === selectedTeam;
        
        return yearFilter && teamFilter;
      });
      
      return {
        ...score,
        games: filteredGames,
        occurred: filteredGames.length > 0
      };
    });
    
    setFilteredData({
      ...scorigamiData,
      scores: filteredScores
    });
    
    setSelectedScore(null);
    setShowModal(false);
    
  }, [scorigamiData, yearRange, selectedTeam]);

  const handleScoreClick = (score) => {
    if (score.occurred) {
      setSelectedScore(score);
      setShowModal(true);
    }
  };

  const closeModal = () => {
    setShowModal(false);
  };

  const handleModalBackgroundClick = (e) => {
    if (e.target.className === 'modal-overlay') {
      closeModal();
    }
  };

  const getGreenShade = (winningScore, losingScore) => {
    const differential = winningScore - losingScore;
    const maxDiff = 50;
    const intensity = Math.min(100, (differential / maxDiff) * 100);
    const darknessValue = 100 - intensity;
    const r = Math.round(0 + (darknessValue / 100) * (144 - 0));
    const g = Math.round(100 + (darknessValue / 100) * (238 - 100));
    const b = Math.round(0 + (darknessValue / 100) * (144 - 0));
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const getCellColor = (score, winningScore, losingScore) => {
    if (disableLowerScores && winningScore <= losingScore) return 'black';
    if (!score.occurred) return 'white';
    
    return getGreenShade(winningScore, losingScore);
  };

  const handleYearChange = (index, value) => {
    const newYearRange = [...yearRange];
    newYearRange[index] = parseInt(value);
    setYearRange(newYearRange);
  };

  const renderScoreGrid = () => {
    if (!filteredData) return null;

    const grid = [];
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
        const score = filteredData.scores.find(s => 
          s.winning_score === ws && s.losing_score === ls
        );
        
        const isDisabled = disableLowerScores && ws <= ls;
        let cellStyle = {};
        
        if (score && score.occurred && !isDisabled) {
          cellStyle = {
            backgroundColor: getCellColor(score, ws, ls)
          };
        } else {
          cellStyle = {};
        }

        const tooltip = score && score.occurred ? (
          <div className="cell-tooltip">
            <div>{ws}-{ls}: {score.games.length} game{score.games.length !== 1 ? 's' : ''}</div>
            <div>Margin: {ws - ls} points</div>
            <span className="tooltip-action">Click to see games</span>
          </div>
        ) : null;
        
        const cellClass = score && score.occurred && !isDisabled ? 
                          'grid-cell' : 
                          `grid-cell ${isDisabled ? 'black' : 'white'}`;
        
        rowCells.push(
          <div
            key={`${ws}-${ls}`}
            className={cellClass}
            style={cellStyle}
            onClick={() => !isDisabled && score && score.occurred && handleScoreClick(score)}
            title=""
          >
            {tooltip}
          </div>
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

  const getMatchesCount = () => {
    if (!filteredData) return 0;
    let count = 0;
    filteredData.scores.forEach(score => {
      if (score.occurred) {
        count += score.games.length;
      }
    });
    return count;
  };

  const getUniqueScoresCount = () => {
    if (!filteredData) return 0;
    return filteredData.scores.filter(score => score.occurred).length;
  };

  const renderColorLegend = () => {
    return (
      <div className="color-legend" style={{ 
        marginTop: '20px', 
        textAlign: 'center',
        marginBottom: '20px' 
      }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          gap: '10px',
          padding: '10px 0'
        }}>
          <div style={{ width: '20px', height: '20px', backgroundColor: getGreenShade(100, 99) }}></div>
          <span>Close Game</span>
          <div style={{ width: '20px', height: '20px', backgroundColor: getGreenShade(100, 80) }}></div>
          <span>Medium Margin</span>
          <div style={{ width: '20px', height: '20px', backgroundColor: getGreenShade(150, 80) }}></div>
          <span>Blowout</span>
        </div>
      </div>
    );
  };

  if (loading) return <div className="loading">Loading NBA score data...</div>;
  if (error) return <div className="error">Error: {error}</div>;

  return (
    <div className="App">
      <Helmet>
        <title>NBA Scorigami Guesser | Visualize Rare NBA Scores</title>
        <meta
          name="description"
          content="Explore every unique NBA score ever recorded and guess future scorigamis. A fun and interactive way to learn basketball history."
        />
        <meta name="keywords" content="NBA, Scorigami, Basketball, Scores, Guesser, NBA history, NBA scores, Game data" />
        <meta name="author" content="Prachod Kakatur" />
        <meta property="og:title" content="NBA Scorigami Guesser" />
        <meta property="og:description" content="Guess NBA scorigamis, track real-time game outcomes, and explore score history." />
        <meta property="og:image" content="%PUBLIC_URL%/images/social-preview.png" />
        <meta property="og:url" content="https://nbagami.com" />
        <meta name="twitter:card" content="summary_large_image" />
      </Helmet>
      <header className="app-header">
        <h1>NBA Scorigami</h1>
        <p className="subtitle">Visualizing every unique score combination in NBA history</p>
      </header>

      <div className="info-box">
        <h3>How to use the NBA Scorigami chart</h3>
        <p>
          This grid shows every possible final score combination in NBA history. The winning team's score runs along the top (x-axis), 
          while the losing team's score runs down the side (y-axis). Each square represents a specific score combination - 
          <span className="green-text"> green squares</span> show scores that have happened (with darker green showing closer games), 
          <span className="white-text"> white squares</span> show possible but unrecorded scores, and 
          {<span className="black-text"> black squares</span>} (when toggled) show impossible combinations where the "winning" 
          score would actually be less than or equal to the "losing" score. 
          <br /><br />
          Click any green square to see historical games with that final score.
          <br /><br />
        </p>
      </div>

      <div className="controls">
  <div className="control-group" style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <label>Years:</label>
      <select 
        value={yearRange[0]} 
        onChange={(e) => handleYearChange(0, e.target.value)}
      >
        {Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 1946 + i).map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
      {' - '}
      <select 
        value={yearRange[1]} 
        onChange={(e) => handleYearChange(1, e.target.value)}
      >
        {Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 1946 + i).map(year => (
          <option key={year} value={year}>{year}</option>
        ))}
      </select>
    </div>
    
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      <label>Team:</label>
      <select 
        value={selectedTeam} 
        onChange={(e) => setSelectedTeam(e.target.value)}
        style={{ width: '200px' }}
      >
        {teams.map(team => (
          <option key={team} value={team}>{team}</option>
        ))}
      </select>
    </div>
    
    <div>
      <label style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
        <input 
          type="checkbox" 
          checked={disableLowerScores} 
          onChange={() => setDisableLowerScores(!disableLowerScores)}
        />
        Disable lower scores
      </label>
    </div>
  </div>
  
  <div style={{ textAlign: 'center', padding: '10px 0' }}>
    Showing {getUniqueScoresCount()} unique scores from {getMatchesCount()} games
  </div>
</div>

      {renderColorLegend()}
      {renderScoreGrid()}
      
      {/* Modal Dialog */}
      {showModal && selectedScore && (
        <div className="modal-overlay" onClick={handleModalBackgroundClick}>
          <div className="modal-content">
            <div className="modal-header">
              <h2>Games with score: {selectedScore.winning_score}-{selectedScore.losing_score} (Margin: {selectedScore.winning_score - selectedScore.losing_score})</h2>
              <button className="modal-close-btn" onClick={closeModal}>×</button>
            </div>
            <div className="modal-body">
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
          </div>
        </div>
      )}
      
      <div className="about-author">
        <div className="author-card">
          <div className="author-image-container">
            <img 
              src="images/PrachodHeadshot.JPG" 
              alt="Prachod's Headshot" 
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
      <ScorigamiGuesser scorigamiData={scorigamiData} />
      <Analytics />
    </div>
  );
}

export default App;