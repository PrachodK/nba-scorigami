import React, { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet';
import './Home.css';

const Home = () => {
  const [scorigamiData, setScorigamiData] = useState(null);
  const [selectedScore, setSelectedScore] = useState(null);
  const [maxScore] = useState(200);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [disableLowerScores, setDisableLowerScores] = useState(false);
  const [yearRange, setYearRange] = useState([1946, 2025]);
  const [filteredData, setFilteredData] = useState(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/nba_scorigami.json');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();
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
        return gameYear >= yearRange[0] && gameYear <= yearRange[1];
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
    
  }, [scorigamiData, yearRange]);

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
    if (e.target.classList.contains('modal-overlay')) {
      setShowModal(false);
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
    if (disableLowerScores && winningScore <= losingScore) return 'transparent';
    if (!score || !score.occurred) return 'rgba(255, 255, 255, 0.06)';
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

    // Header row with x-axis labels
    const headerRow = [
      <div key="header-empty" className="grid-cell corner-cell"></div>
    ];
    
    // Generate columns from 50 to maxScore
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

    // Generate rows from 50 to maxScore (y-axis)
    for (let ls = 50; ls <= maxScore; ls++) {
      const rowCells = [];
      
      // Y-axis label
      if (ls % labelIncrement === 0 || ls === maxScore) {
        rowCells.push(
          <div key={`label-${ls}`} className="grid-cell header-cell">
            {ls}
          </div>
        );
      } else {
        rowCells.push(<div key={`label-${ls}`} className="grid-cell"></div>);
      }

      // Generate cells for each column
      for (let ws = 50; ws <= maxScore; ws++) {
        const score = filteredData.scores.find(s => 
          s.winning_score === ws && s.losing_score === ls
        );
        
        const isDisabled = disableLowerScores && ws <= ls;
        const cellStyle = {
          backgroundColor: isDisabled ? 'transparent' : getCellColor(score, ws, ls)
        };

        const tooltip = score && score.occurred ? (
          <div className="cell-tooltip">
            <div>{ws}-{ls}: {score.games.length} game{score.games.length !== 1 ? 's' : ''}</div>
            <div>Margin: {ws - ls} pts</div>
            <span className="tooltip-action">Click for details</span>
          </div>
        ) : null;
        
        const cellClass = score && score.occurred && !isDisabled ? 
                          'grid-cell occurred' : 
                          `grid-cell ${isDisabled ? 'black' : 'white'}`;
        
        rowCells.push(
          <div
            key={`${ws}-${ls}`}
            className={cellClass}
            style={cellStyle}
            onClick={() => !isDisabled && score && score.occurred && handleScoreClick(score)}
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
      <div className="color-legend">
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getGreenShade(100, 99) }}></div>
          <span>Close Game</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getGreenShade(100, 80) }}></div>
          <span>Medium Margin</span>
        </div>
        <div className="legend-item">
          <div className="legend-color" style={{ backgroundColor: getGreenShade(150, 80) }}></div>
          <span>Blowout</span>
        </div>
      </div>
    );
  };

  if (loading) return (
    <div className="home-loading">
      <div className="loading-content">
        <div className="loading-spinner-large"></div>
        <h2>Loading NBA History...</h2>
        <p>Crunching 80 years of basketball data</p>
      </div>
    </div>
  );

  if (error) return <div className="error-page">Error: {error}</div>;

  return (
    <div className="home-page">
      <Helmet>
        <title>NBA Scorigami | Every Unique Score in History</title>
        <meta
          name="description"
          content="Explore every unique NBA score ever recorded. An interactive visualization of basketball history."
        />
      </Helmet>

      <section className="hero-section">
        <div className="hero-content">
          <h1 className="hero-title">
            <span className="title-line">Every Score.</span>
            <span className="title-line accent">Every Game.</span>
            <span className="title-line">All Time.</span>
          </h1>
          <p className="hero-subtitle">
            Visualizing every final score combination in NBA history. Find the rare ones.
          </p>
          <div className="hero-stats">
            <div className="stat-item">
              <span className="stat-number">{getUniqueScoresCount().toLocaleString()}</span>
              <span className="stat-label">Unique Scores</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">{getMatchesCount().toLocaleString()}</span>
              <span className="stat-label">Games Played</span>
            </div>
            <div className="stat-divider"></div>
            <div className="stat-item">
              <span className="stat-number">1946</span>
              <span className="stat-label">First Season</span>
            </div>
          </div>
        </div>
      </section>

      <section className="controls-section">
        <div className="controls-container">
          <div className="control-group">
            <label>Season Range</label>
            <div className="year-selectors">
              <select 
                value={yearRange[0]} 
                onChange={(e) => handleYearChange(0, e.target.value)}
              >
                {Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 1946 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <span className="range-divider">to</span>
              <select 
                value={yearRange[1]} 
                onChange={(e) => handleYearChange(1, e.target.value)}
              >
                {Array.from({ length: 2025 - 1946 + 1 }, (_, i) => 1946 + i).map(year => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="control-group toggle-group">
            <label className="toggle-label">
              <input 
                type="checkbox" 
                checked={disableLowerScores} 
                onChange={() => setDisableLowerScores(!disableLowerScores)}
              />
              <span className="toggle-slider"></span>
              <span className="toggle-text">Hide Impossible Scores</span>
            </label>
          </div>
        </div>
      </section>

      {renderColorLegend()}
      
      <section className="grid-section">
        {renderScoreGrid()}
      </section>
      
      <div 
        className={`modal-overlay ${showModal ? 'visible' : ''}`} 
        onClick={handleModalBackgroundClick}
      >
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <div className="modal-header">
            <h2>{selectedScore ? `${selectedScore.winning_score}-${selectedScore.losing_score} Games` : ''}</h2>
            <span className="modal-margin">{selectedScore ? `Margin: ${selectedScore.winning_score - selectedScore.losing_score} pts` : ''}</span>
            <button className="modal-close-btn" onClick={closeModal}>×</button>
          </div>
          <div className="modal-body">
            <div className="games-list">
              {selectedScore && selectedScore.games.map((game, index) => (
                <div key={index} className="game-card">
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
    </div>
  );
};

export default Home;
