import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { User, Folder, ChevronLeft } from 'lucide-react';
import { fetchPublicProfile } from '../api';
import './PublicProfile.css';

const PublicProfile = () => {
  const { username } = useParams();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    fetchPublicProfile(username)
      .then(setProfile)
      .catch((err) => setError(err.response?.data?.detail || 'Profile not found'))
      .finally(() => setLoading(false));
  }, [username]);

  if (loading) return <div className="loading-state">Loading profile...</div>;
  if (error) return <div className="empty-state">{error}</div>;
  if (!profile) return <div className="empty-state">Profile not found.</div>;

  return (
    <div className="public-profile animate-fade-in">
      <div className="public-back-links">
        <Link to="/explore" className="back-link">
          <ChevronLeft size={20} /> Back to Explore
        </Link>
        <Link to="/" className="back-link">
          <ChevronLeft size={20} /> Back to Dashboard
        </Link>
      </div>

      <div className="profile-header glass-panel">
        <User size={40} className="profile-avatar-icon" />
        <div>
          <h1 className="gradient-text">@{profile.username}</h1>
          <p>{profile.bio || 'UI/UX Designer'}</p>
          <span className="profile-stat">{profile.project_count} public projects</span>
        </div>
      </div>

      <h2 className="section-title">Public Projects</h2>
      {profile.projects?.length === 0 ? (
        <div className="empty-state glass-panel">
          <Folder size={40} />
          <p>No public projects yet.</p>
        </div>
      ) : (
        <div className="public-project-grid">
          {profile.projects.map((project) => (
            <Link
              key={project.id}
              to={`/portfolio/${username}/project/${project.id}`}
              className="public-project-card glass-panel"
            >
              <h3>{project.title}</h3>
              <p>{project.description || 'No description.'}</p>
              <div className="score-row">
                {project.ui_score != null && (
                  <span className="score-pill ui">UI {project.ui_score}/10</span>
                )}
                {project.ux_score != null && (
                  <span className="score-pill ux">UX {project.ux_score}/10</span>
                )}
                <span className="design-count">{project.public_design_count} designs</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default PublicProfile;
