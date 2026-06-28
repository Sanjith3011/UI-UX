import { useState, useEffect, useContext } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import { ChevronLeft, Heart, MessageCircle, Send } from 'lucide-react';
import AuthContext from '../context/AuthContext';
import {
  fetchPublicProject,
  fetchPublicComments,
  postPublicComment,
  toggleDesignLike,
  MEDIA_BASE,
} from '../api';
import './PublicProject.css';

const PublicProject = () => {
  const { username, projectId } = useParams();
  const location = useLocation();
  const { user } = useContext(AuthContext);
  const fromProject = location.state?.fromProject;
  const isOwner = user?.username === username;
  const [project, setProject] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const loadData = async () => {
    try {
      const [proj, comms] = await Promise.all([
        fetchPublicProject(username, projectId),
        fetchPublicComments(username, projectId),
      ]);
      setProject(proj);
      setComments(comms);
    } catch (err) {
      setError(err.response?.data?.detail || 'Project not found');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [username, projectId]);

  const handleLike = async (designId) => {
    if (!user) {
      alert('Please log in to like designs.');
      return;
    }
    try {
      const result = await toggleDesignLike(designId);
      setProject((prev) => ({
        ...prev,
        designs: prev.designs.map((d) =>
          d.id === designId
            ? { ...d, like_count: result.like_count, user_has_liked: result.liked }
            : d
        ),
      }));
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to like design.');
    }
  };

  const handleComment = async (e) => {
    e.preventDefault();
    if (!user) {
      alert('Please log in to leave a comment.');
      return;
    }
    if (!commentText.trim()) return;
    setSubmitting(true);
    try {
      await postPublicComment(username, projectId, commentText.trim());
      setCommentText('');
      const comms = await fetchPublicComments(username, projectId);
      setComments(comms);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="loading-state">Loading project...</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!project) return null;

  const scores = project.project_scores;

  const ownerProjectId = fromProject || (isOwner ? projectId : null);

  return (
    <div className="public-project-page animate-fade-in">
      <div className="public-back-links">
        {ownerProjectId && (
          <Link to={`/project/${ownerProjectId}`} className="back-link back-link-primary">
            <ChevronLeft size={20} /> Back to Project
          </Link>
        )}
        <Link to={`/portfolio/${username}`} className="back-link">
          <ChevronLeft size={20} /> Back to @{username}
        </Link>
        {isOwner && (
          <Link to="/" className="back-link">
            <ChevronLeft size={20} /> Back to Dashboard
          </Link>
        )}
      </div>

      <div className="public-project-header glass-panel">
        <h1 className="gradient-text">{project.title}</h1>
        <p className="public-project-meta">
          by @{project.owner_username || username}
          {' · '}
          {new Date(project.created_at).toLocaleDateString()}
        </p>
        <div className="public-project-about">
          <h3>About this project</h3>
          <p className="public-project-description">
            {project.description?.trim() || 'No description provided.'}
          </p>
        </div>
        <div className="score-row">
          {scores?.ui_score != null && <span className="score-pill ui">UI {scores.ui_score}/10</span>}
          {scores?.ux_score != null && <span className="score-pill ux">UX {scores.ux_score}/10</span>}
        </div>
      </div>

      <h2 className="section-title">Designs</h2>
      {project.designs?.length === 0 ? (
        <p className="empty-note">No public designs in this project.</p>
      ) : (
        <div className="public-designs-grid">
          {project.designs.map((design) => (
            <div key={design.id} className="public-design-card glass-panel">
              <img src={`${MEDIA_BASE}${design.image}`} alt="Design" />
              <div className="public-design-meta">
                <div className="score-row">
                  <span className="score-pill ui">UI {design.ui_score}/10</span>
                  <span className="score-pill ux">UX {design.ux_score}/10</span>
                </div>
                <button
                  className={`like-btn ${design.user_has_liked ? 'liked' : ''}`}
                  onClick={() => handleLike(design.id)}
                >
                  <Heart size={16} fill={design.user_has_liked ? 'currentColor' : 'none'} />
                  {design.like_count}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="comments-section glass-panel">
        <h2><MessageCircle size={20} /> Comments ({comments.length})</h2>

        {comments.map((c) => (
          <div key={c.id} className="public-comment">
            <strong>@{c.author_username}</strong>
            <span className="comment-date">{new Date(c.created_at).toLocaleString()}</span>
            <p>{c.body}</p>
            {c.replies?.map((r) => (
              <div key={r.id} className="public-reply">
                <strong>@{r.author_username}</strong>
                {r.is_owner_reply && <span className="owner-badge">Owner</span>}
                <p>{r.body}</p>
              </div>
            ))}
          </div>
        ))}

        {user ? (
          <form onSubmit={handleComment} className="comment-form">
            <textarea
              className="glass-input"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Leave feedback on this project..."
              rows={3}
            />
            <button type="submit" className="glass-button" disabled={submitting}>
              <Send size={14} /> {submitting ? 'Posting...' : 'Post Comment'}
            </button>
          </form>
        ) : (
          <p className="login-prompt"><Link to="/login">Log in</Link> to leave a comment.</p>
        )}
      </div>
    </div>
  );
};

export default PublicProject;
