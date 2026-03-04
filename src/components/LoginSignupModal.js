import React, { useState, useEffect, useRef } from 'react';
import './LoginSignupModal.css';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, addDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase';
import bcrypt from 'bcryptjs';

const LoginSignupModal = ({ onClose }) => {
  const [mode, setMode] = useState('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 4) {
      setError('Password must be at least 4 characters');
      return;
    }

    if (!db) {
      setError('Database not connected. Check Firebase configuration.');
      return;
    }

    setIsLoading(true);

    const timeoutId = setTimeout(() => {
      setIsLoading(false);
      setError('Request timed out. Check your internet connection.');
    }, 10000);

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username.trim().toLowerCase()));
      const snap = await getDocs(q);

      clearTimeout(timeoutId);

      if (mode === 'login') {
        if (snap.empty) {
          setError('User not found');
          setIsLoading(false);
          return;
        }

        const user = snap.docs[0].data();
        const isPasswordCorrect = bcrypt.compareSync(password, user.password);

        if (!isPasswordCorrect) {
          setError('Incorrect password');
          setIsLoading(false);
          return;
        }

        login({ username: user.username });
        onClose();

      } else if (mode === 'signup') {
        if (!snap.empty) {
          setError('Username already taken');
          setIsLoading(false);
          return;
        }

        const hashedPassword = bcrypt.hashSync(password, 10);

        await addDoc(usersRef, { 
          username: username.trim().toLowerCase(), 
          password: hashedPassword,
          createdAt: new Date().toISOString()
        });
        login({ username: username.trim().toLowerCase() });
        onClose();
      }
    } catch (err) {
      clearTimeout(timeoutId);
      console.error('Auth error:', err);
      if (err.code === 'permission-denied') {
        setError('Permission denied. Check Firestore security rules.');
      } else if (err.code === 'unavailable') {
        setError('Firebase unavailable. Check your connection.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const switchMode = () => {
    setMode(mode === 'login' ? 'signup' : 'login');
    setError('');
  };

  return (
    <div className="auth-dropdown" ref={dropdownRef}>
      <button className="auth-dropdown-close" onClick={onClose}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 6L6 18M6 6l12 12" />
        </svg>
      </button>
      
      <div className="auth-dropdown-header">
        <h2>{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>
        <p>{mode === 'login' ? 'Sign in to track your guesses' : 'Join to start guessing scores'}</p>
      </div>

      <form onSubmit={handleSubmit} className="auth-form">
        <div className="input-group">
          <label htmlFor="username">Username</label>
          <input
            id="username"
            type="text"
            placeholder="Enter your username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            disabled={isLoading}
            autoComplete="username"
          />
        </div>
        
        <div className="input-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            disabled={isLoading}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </div>

        {error && (
          <div className="auth-error">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            {error}
          </div>
        )}

        <button type="submit" className="auth-submit-btn" disabled={isLoading}>
          {isLoading ? (
            <span className="btn-loading">
              <span className="spinner"></span>
              Processing...
            </span>
          ) : (
            mode === 'login' ? 'Sign In' : 'Create Account'
          )}
        </button>
      </form>

      <div className="auth-footer">
        <span>{mode === 'login' ? "Don't have an account?" : 'Already have an account?'}</span>
        <button type="button" className="auth-switch-btn" onClick={switchMode}>
          {mode === 'login' ? 'Sign Up' : 'Sign In'}
        </button>
      </div>
    </div>
  );
};

export default LoginSignupModal;
