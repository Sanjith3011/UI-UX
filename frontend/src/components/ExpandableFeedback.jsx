import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ChevronDown, ChevronUp } from 'lucide-react';
import './ExpandableFeedback.css';

const ExpandableFeedback = ({ text }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  // Determine if the feedback is long enough to need a "Read More" button
  const safeText = typeof text === 'string' ? text : '';
  const isLong = safeText.split('\n').length > 5;

  return (
    <div className="expandable-feedback">
      <div className={`feedback-content markdown-body ${!isExpanded ? 'collapsed' : ''}`}>
        <ReactMarkdown remarkPlugins={[remarkGfm]}>
          {safeText}
        </ReactMarkdown>
      </div>
      {isLong && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="glass-button expand-toggle-btn"
          style={{
            alignItems: 'center',
            gap: '6px',
            marginTop: '12px',
            padding: '8px 16px',
            width: '100%',
            justifyContent: 'center',
          }}
        >
          {isExpanded ? (
            <>
              <ChevronUp size={18} /> Show Less
            </>
          ) : (
            <>
              <ChevronDown size={18} /> Read Full Analysis
            </>
          )}
        </button>
      )}
    </div>
  );
};

export default ExpandableFeedback;


