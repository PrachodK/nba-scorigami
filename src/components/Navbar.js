import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './Navbar.css';

const Navbar = ({ onAuthClick }) => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { currentUser, logout } = useAuth();

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  const isActive = (path) => location.pathname === path;

  return (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-container">
        <Link to="/" className="navbar-logo">
          <span className="logo-text">NBAGami</span>
        </Link>

        <div className={`navbar-menu ${menuOpen ? 'open' : ''}`}>
          <Link 
            to="/" 
            className={`nav-link ${isActive('/') ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="nav-link-text">Scorigami</span>
            <span className="nav-link-bg"></span>
          </Link>
          <Link 
            to="/guesser" 
            className={`nav-link ${isActive('/guesser') ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="nav-link-text">Guesser</span>
            <span className="nav-link-bg"></span>
          </Link>
          <Link 
            to="/contact" 
            className={`nav-link ${isActive('/contact') ? 'active' : ''}`}
            onClick={() => setMenuOpen(false)}
          >
            <span className="nav-link-text">Contact</span>
            <span className="nav-link-bg"></span>
          </Link>
        </div>

        <button 
          className={`hamburger ${menuOpen ? 'open' : ''}`}
          onClick={() => setMenuOpen(!menuOpen)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <div className={`navbar-auth ${menuOpen ? 'mobile-visible' : ''}`}>
          {currentUser ? (
            <div className="user-section">
              <span className="username-display">{currentUser.username}</span>
              <button className="logout-btn" onClick={logout}>
                <span>Logout</span>
              </button>
            </div>
          ) : (
            <button className="auth-btn" onClick={() => { setMenuOpen(false); onAuthClick(); }}>
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
