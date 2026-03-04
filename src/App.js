import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import Navbar from './components/Navbar';
import LoginSignupModal from './components/LoginSignupModal';
import Home from './pages/Home';
import Guesser from './pages/Guesser';
import Contact from './pages/Contact';
import { useAuth } from './context/AuthContext';
import './App.css';

function App() {
  const [scorigamiData, setScorigamiData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { } = useAuth();

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
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="app-loading">
        <div className="app-loading-content">
          <div className="app-loading-spinner"></div>
          <h1>NBAGami</h1>
          <p>Loading NBA history...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app">
        <Navbar onAuthClick={() => setShowAuthModal(true)} />
        
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/guesser" element={<Guesser scorigamiData={scorigamiData} />} />
            <Route path="/contact" element={<Contact />} />
          </Routes>
        </main>

        {showAuthModal && (
          <LoginSignupModal onClose={() => setShowAuthModal(false)} />
        )}

        <Analytics />
      </div>
    </Router>
  );
}

export default App;
