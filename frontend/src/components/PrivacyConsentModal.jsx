import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, AlertTriangle, X } from 'lucide-react';
import './PrivacyConsentModal.css';

const CHECKLIST = [
  'Remove .env, .env.local, and environment config files',
  'Remove API keys, tokens, and passwords from source code',
  'Remove private keys (.pem, .key) and credentials.json files',
  'Exclude database connection strings and cloud secrets',
  'Upload only UI/frontend code you are comfortable sharing with Groq AI',
];

const PrivacyConsentModal = ({ isOpen, onClose, onConfirm, aiProvider = 'Groq' }) => {
  const [consented, setConsented] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = () => {
    if (!consented) return;
    onConfirm();
    setConsented(false);
  };

  const handleClose = () => {
    setConsented(false);
    onClose();
  };

  return (
    <div className="privacy-modal-overlay" onClick={handleClose}>
      <div className="privacy-modal glass-panel" onClick={(e) => e.stopPropagation()}>
        <button className="privacy-modal-close" onClick={handleClose} aria-label="Close">
          <X size={20} />
        </button>

        <div className="privacy-modal-header">
          <Shield size={28} className="privacy-modal-icon" />
          <h2>Privacy Notice Before Upload</h2>
        </div>

        <div className="privacy-modal-warning">
          <AlertTriangle size={18} />
          <p>
            Your code will be sent to <strong>{aiProvider}</strong> for AI analysis.
            Only UI-related source files are transmitted — not your entire ZIP — but
            you should never upload secrets or credentials.
          </p>
        </div>

        <h3 className="privacy-modal-subtitle">Pre-upload checklist</h3>
        <ul className="privacy-checklist">
          {CHECKLIST.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>

        <p className="privacy-modal-link">
          Read our full <Link to="/privacy" onClick={handleClose}>Privacy Policy</Link> for
          details on storage, retention, and your delete rights.
        </p>

        <label className="privacy-consent-label">
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
          />
          <span>
            I understand my code will be sent to {aiProvider} for AI analysis and I have
            removed sensitive files from my ZIP.
          </span>
        </label>

        <div className="privacy-modal-actions">
          <button className="glass-button" onClick={handleClose}>Cancel</button>
          <button
            className="glass-button privacy-confirm-btn"
            disabled={!consented}
            onClick={handleConfirm}
          >
            I Agree &amp; Select ZIP
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyConsentModal;
