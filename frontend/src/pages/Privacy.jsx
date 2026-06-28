import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Shield, ExternalLink } from 'lucide-react';
import { fetchPrivacyPolicy } from '../api';
import './Privacy.css';

const Privacy = () => {
  const [policy, setPolicy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPrivacyPolicy()
      .then((data) => setPolicy(data))
      .catch((err) => setError(err.message || 'Failed to load privacy policy'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="privacy-page loading-state">Loading privacy policy...</div>;
  }

  if (error || !policy) {
    return (
      <div className="privacy-page empty-state">
        <p>Could not load privacy policy.</p>
        <Link to="/">Back to home</Link>
      </div>
    );
  }

  return (
    <div className="privacy-page animate-fade-in">
      <div className="privacy-hero glass-panel">
        <Shield size={32} className="privacy-hero-icon" />
        <h1>{policy.title}</h1>
        <p className="privacy-updated">Last updated: {policy.last_updated}</p>
      </div>

      {policy.sections.map((section) => (
        <section key={section.heading} className="privacy-section glass-panel">
          <h2>{section.heading}</h2>
          <ul>
            {section.content.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}

      <section className="privacy-section glass-panel">
        <h2>Groq Zero Data Retention</h2>
        <p>
          Administrators should enable Zero Data Retention (ZDR) in the Groq console to
          minimize data retention by the AI provider.
        </p>
        <a
          href={policy.groq_zdr_url}
          target="_blank"
          rel="noopener noreferrer"
          className="privacy-external-link"
        >
          <ExternalLink size={16} /> Groq Data Controls
        </a>
      </section>

      <p className="privacy-contact">{policy.contact}</p>

      <Link to="/" className="privacy-back-link">← Back to Dashboard</Link>
    </div>
  );
};

export default Privacy;
