import React, { useState } from 'react';
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
  const { login } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      const usersRef = collection(db, 'users');
      const q = query(usersRef, where('username', '==', username));
      const snap = await getDocs(q);

      if (mode === 'login') {
        if (snap.empty) {
          setError('User not found');
          return;
        }

        const user = snap.docs[0].data();
        const isPasswordCorrect = bcrypt.compareSync(password, user.password); // Compare the hashed password

        if (!isPasswordCorrect) {
          setError('Incorrect password');
          return;
        }

        login({ username });
        onClose();

      } else if (mode === 'signup') {
        if (!snap.empty) {
          setError('Username already taken');
          return;
        }

        const hashedPassword = bcrypt.hashSync(password, 10); 

        await addDoc(usersRef, { username, password: hashedPassword }); 
        login({ username });
        onClose();
      }
    } catch (err) {
      setError('Something went wrong. Try again.');
      console.error(err);
    }
  };

  return (
    <div className="login-signup-modal-overlay" onClick={onClose}>
      <div className="login-signup-modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{mode === 'login' ? 'Login' : 'Sign Up'}</h2>
          <button className="modal-close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
          />
          <button type="submit">
            {mode === 'login' ? 'Login' : 'Sign Up'}
          </button>
        </form>

        {error && <div style={{ color: 'red', marginTop: 10 }}>{error}</div>}

        <div
          className="auth-toggle"
          onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        >
          {mode === 'login'
            ? 'No account? Sign up here'
            : 'Already have an account? Login'}
        </div>
      </div>
    </div>
  );
};

export default LoginSignupModal;
