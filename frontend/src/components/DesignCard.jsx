// DesignCard component – renders a single design with collapse/minimize toggle
import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ExpandableFeedback from './ExpandableFeedback';
import './DesignCard.css';

const DesignCard = ({ design, onDelete }) => {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="design-card glass-panel">
      {/* Left side: image */}
      <div className="design-image-container">
        <img
          src={`http://127.0.0.1:8000${design.image}`}
          alt="Design"
          className="design-image"
        />
      </div>

      {/* Right side: details */}
      <div className="design-feedback">
        {/* Header with timestamp, delete and minimize buttons */}
        <div
          className="feedback-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <h3>AI Analysis</h3>
            <span className="upload-time">
              {new Date(design.uploaded_at).toLocaleString()}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="glass-button"
              style={{ padding: '6px', color: 'var(--error)' }}
              onClick={() => onDelete(design.id)}
              title="Delete Design"
            >
              <Trash2 size={16} />
            </button>
            <button
              className="glass-button"
              style={{ padding: '6px' }}
              onClick={() => setCollapsed(!collapsed)}
              title={collapsed ? 'Show Feedback' : 'Minimize Feedback'}
            >
              {collapsed ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
            </button>
          </div>
        </div>

        {/* Feedback content – hidden when collapsed */}
        {!collapsed && (
          <>
            {/* Scores */}
            <div className="score-cards">
              <div className="score-card ui-score">
                <span className="score-label">UI Design</span>
                <span className="score-value">
                  {design.feedback?.ui_score}
                  <small>/10</small>
                </span>
              </div>
              <div className="score-card ux-score">
                <span className="score-label">UX Usability</span>
                <span className="score-value">
                  {design.feedback?.ux_score}
                  <small>/10</small>
                </span>
              </div>
            </div>
            {/* Expandable AI raw analysis */}
            {design.feedback ? (
              <ExpandableFeedback text={design.feedback.raw_analysis} />
            ) : (
              <div className="generating-feedback">
                <span>AI is currently generating feedback...</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default DesignCard;
