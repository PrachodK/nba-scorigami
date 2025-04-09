import React from 'react';
import './PopupMessage.css';

const PopupMessage = ({ message, onClose }) => {
  return (
    <div className="popup-overlay" onClick={onClose}>
      <div className="popup-box" onClick={(e) => e.stopPropagation()}>
        <p>{message}</p>
        <button className="popup-close" onClick={onClose}>Okay</button>
      </div>
    </div>
  );
};

export default PopupMessage;
