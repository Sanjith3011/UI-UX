import { useState, useEffect } from 'react';
import { ChevronLeft, MessageCircle, Send } from 'lucide-react';
import { fetchOwnerComments, postOwnerReply } from '../api';
import './CommentsPanel.css';

const CommentsPanel = ({ projectId, isOpen, onClose, inline = false }) => {
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !projectId) return;
    setLoading(true);
    fetchOwnerComments(projectId)
      .then(setComments)
      .catch((err) => console.error('Failed to load comments', err))
      .finally(() => setLoading(false));
  }, [isOpen, projectId]);

  useEffect(() => {
    if (!isOpen || inline) return;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, inline, onClose]);

  const handleReply = async (commentId) => {
    if (!replyText.trim()) return;
    setSubmitting(true);
    try {
      await postOwnerReply(projectId, commentId, replyText.trim());
      const updated = await fetchOwnerComments(projectId);
      setComments(updated);
      setReplyText('');
      setReplyingTo(null);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post reply.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const content = (
    <div className={`comments-panel glass-panel ${inline ? 'comments-panel-inline' : ''}`}>
      <div className="comments-panel-header">
        <h2><MessageCircle size={22} /> Project Comments</h2>
        <button type="button" className="glass-button comments-back-btn" onClick={onClose}>
          <ChevronLeft size={16} /> Back to Project
        </button>
      </div>

      {loading ? (
        <p className="comments-loading">Loading comments...</p>
      ) : comments.length === 0 ? (
        <p className="comments-empty">No comments yet. Make your project public to receive feedback from others.</p>
      ) : (
        <div className="comments-list">
          {comments.map((comment) => (
            <div key={comment.id} className="comment-thread">
              <div className="comment-item">
                <strong>@{comment.author_username}</strong>
                <span className="comment-date">{new Date(comment.created_at).toLocaleString()}</span>
                <p>{comment.body}</p>
              </div>

              {comment.replies?.map((reply) => (
                <div key={reply.id} className="comment-reply">
                  <strong>@{reply.author_username}</strong>
                  {reply.is_owner_reply && <span className="owner-badge">Owner</span>}
                  <p>{reply.body}</p>
                </div>
              ))}

              {replyingTo === comment.id ? (
                <div className="reply-form">
                  <textarea
                    className="glass-input"
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Write your reply..."
                    rows={2}
                  />
                  <div className="reply-actions">
                    <button type="button" className="glass-button" onClick={() => { setReplyingTo(null); setReplyText(''); }}>Cancel</button>
                    <button type="button" className="glass-button" disabled={submitting} onClick={() => handleReply(comment.id)}>
                      <Send size={14} /> Reply
                    </button>
                  </div>
                </div>
              ) : (
                <button type="button" className="reply-link" onClick={() => setReplyingTo(comment.id)}>Reply</button>
              )}
            </div>
          ))}
        </div>
      )}

      <button type="button" className="glass-button comments-back-footer" onClick={onClose}>
        <ChevronLeft size={16} /> Back to Feedback &amp; Designs
      </button>
    </div>
  );

  if (inline) return content;

  return (
    <div className="comments-overlay" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
};

export default CommentsPanel;
