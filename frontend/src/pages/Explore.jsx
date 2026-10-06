import { useState, useEffect, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Search,
  User,
  Heart,
  Sparkles,
  Maximize2,
  X,
  Compass,
  Flame,
  Clock,
  Award,
  ExternalLink,
  LogIn,
} from 'lucide-react';
import AuthContext from '../context/AuthContext';
import { searchProfiles, fetchPublicDesigns, toggleDesignLike, MEDIA_BASE } from '../api';
import './Explore.css';

const Explore = () => {
  const { user } = useContext(AuthContext);
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('feed'); // 'feed' | 'designers'
  
  // Public Feed State
  const [designs, setDesigns] = useState([]);
  const [loadingDesigns, setLoadingDesigns] = useState(true);
  const [sortOrder, setSortOrder] = useState('latest'); // 'latest' | 'likes' | 'top_rated'
  const [designSearch, setDesignSearch] = useState('');
  
  // Lightbox Modal State
  const [selectedDesign, setSelectedDesign] = useState(null);

  // Login Prompt Modal State
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);

  // Designer Search State
  const [designerQuery, setDesignerQuery] = useState('');
  const [designerResults, setDesignerResults] = useState([]);
  const [searchedDesigners, setSearchedDesigners] = useState(false);
  const [loadingDesigners, setLoadingDesigners] = useState(false);

  useEffect(() => {
    loadPublicDesigns();
  }, [sortOrder]);

  const loadPublicDesigns = async (searchOverride) => {
    setLoadingDesigns(true);
    try {
      const q = searchOverride !== undefined ? searchOverride : designSearch;
      const data = await fetchPublicDesigns({ sort: sortOrder, q: q.trim() });
      setDesigns(data);
    } catch (err) {
      console.error('Failed to load public designs:', err);
      setDesigns([]);
    } finally {
      setLoadingDesigns(false);
    }
  };

  const handleDesignSearchSubmit = (e) => {
    e.preventDefault();
    loadPublicDesigns();
  };

  const handleLikeToggle = async (designId, e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!user) {
      setShowLoginPrompt(true);
      return;
    }

    // Optimistic UI update
    setDesigns((prev) =>
      prev.map((d) => {
        if (d.id === designId || d.design_id === designId) {
          const nextLiked = !d.is_liked;
          return {
            ...d,
            is_liked: nextLiked,
            like_count: Math.max(0, (d.like_count || 0) + (nextLiked ? 1 : -1)),
          };
        }
        return d;
      })
    );

    if (selectedDesign && (selectedDesign.id === designId || selectedDesign.design_id === designId)) {
      const nextLiked = !selectedDesign.is_liked;
      setSelectedDesign({
        ...selectedDesign,
        is_liked: nextLiked,
        like_count: Math.max(0, (selectedDesign.like_count || 0) + (nextLiked ? 1 : -1)),
      });
    }

    try {
      const result = await toggleDesignLike(designId);
      // Sync real response
      setDesigns((prev) =>
        prev.map((d) =>
          d.id === designId || d.design_id === designId
            ? { ...d, is_liked: result.liked, like_count: result.like_count }
            : d
        )
      );
      if (selectedDesign && (selectedDesign.id === designId || selectedDesign.design_id === designId)) {
        setSelectedDesign((prev) => ({
          ...prev,
          is_liked: result.liked,
          like_count: result.like_count,
        }));
      }
    } catch (err) {
      console.error('Failed to like design:', err);
      // Rollback on failure
      loadPublicDesigns();
    }
  };

  const handleDesignerSearch = async (e) => {
    e.preventDefault();
    if (!designerQuery.trim()) return;
    setLoadingDesigners(true);
    setSearchedDesigners(true);
    try {
      const data = await searchProfiles(designerQuery.trim());
      setDesignerResults(data);
    } catch (err) {
      console.error('Designer search failed:', err);
      setDesignerResults([]);
    } finally {
      setLoadingDesigners(false);
    }
  };

  const formatImageUrl = (imgPath) => {
    if (!imgPath) return '';
    return imgPath.startsWith('http') ? imgPath : `${MEDIA_BASE}${imgPath}`;
  };

  return (
    <div className="explore-page animate-fade-in">
      {/* Header Banner */}
      <div className="explore-hero glass-panel">
        <div className="explore-hero-badge">
          <Sparkles size={16} /> Community Hub
        </div>
        <h1 className="gradient-text">Public UI Design Feed</h1>
        <p>
          Discover, evaluate, and appreciate stunning UI/UX designs shared by community designers.
        </p>

        {/* Tab Navigation */}
        <div className="explore-tabs">
          <button
            type="button"
            className={`explore-tab-btn ${activeTab === 'feed' ? 'active' : ''}`}
            onClick={() => setActiveTab('feed')}
          >
            <Compass size={18} /> Public Design Feed ({designs.length})
          </button>
          <button
            type="button"
            className={`explore-tab-btn ${activeTab === 'designers' ? 'active' : ''}`}
            onClick={() => setActiveTab('designers')}
          >
            <User size={18} /> Search Designers
          </button>
        </div>
      </div>

      {/* TAB 1: PUBLIC DESIGN FEED */}
      {activeTab === 'feed' && (
        <div className="feed-tab-section animate-fade-in">
          {/* Controls Bar */}
          <div className="feed-controls-bar glass-panel">
            <form onSubmit={handleDesignSearchSubmit} className="feed-search-form">
              <Search size={18} className="search-icon" />
              <input
                type="text"
                className="glass-input feed-search-input"
                placeholder="Filter designs by project or designer..."
                value={designSearch}
                onChange={(e) => setDesignSearch(e.target.value)}
              />
              {designSearch && (
                <button
                  type="button"
                  className="clear-search-btn"
                  onClick={() => {
                    setDesignSearch('');
                    loadPublicDesigns('');
                  }}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {/* Sorting Pills */}
            <div className="sort-pills-group">
              <button
                type="button"
                className={`sort-pill ${sortOrder === 'latest' ? 'active' : ''}`}
                onClick={() => setSortOrder('latest')}
              >
                <Clock size={15} /> Latest
              </button>
              <button
                type="button"
                className={`sort-pill ${sortOrder === 'likes' ? 'active' : ''}`}
                onClick={() => setSortOrder('likes')}
              >
                <Flame size={15} /> Most Liked
              </button>
              <button
                type="button"
                className={`sort-pill ${sortOrder === 'top_rated' ? 'active' : ''}`}
                onClick={() => setSortOrder('top_rated')}
              >
                <Award size={15} /> Top Rated
              </button>
            </div>
          </div>

          {/* Design Grid */}
          {loadingDesigns ? (
            <div className="feed-loading-container">
              <div className="app-loading-spinner" />
              <p>Loading community designs...</p>
            </div>
          ) : designs.length === 0 ? (
            <div className="feed-empty-container glass-panel">
              <Compass size={48} className="empty-icon text-muted" />
              <h3>No Public UI Designs Found</h3>
              <p>
                {designSearch
                  ? `No designs matched "${designSearch}". Try a different search term.`
                  : 'Be the first designer to publish your UI design to the community feed!'}
              </p>
              {user && (
                <Link to="/hybrid-upload" className="glass-button create-btn" style={{ marginTop: '16px', display: 'inline-flex' }}>
                  <Sparkles size={18} /> Upload & Publish Design
                </Link>
              )}
            </div>
          ) : (
            <div className="public-designs-grid">
              {designs.map((design) => {
                const targetId = design.id || design.design_id;
                const imgUrl = formatImageUrl(design.image);
                const projectLink = design.project_id
                  ? `/portfolio/${design.username}/project/${design.project_id}`
                  : '#';

                return (
                  <div key={targetId} className="public-design-card glass-panel">
                    {/* Header info */}
                    <div className="card-top-bar">
                      <Link to={`/portfolio/${design.username}`} className="designer-info-link">
                        <div className="designer-avatar-small">
                          {design.username ? design.username[0].toUpperCase() : 'U'}
                        </div>
                        <span className="designer-username">@{design.username}</span>
                      </Link>
                      <span className="design-date">
                        {design.uploaded_at
                          ? new Date(design.uploaded_at).toLocaleDateString()
                          : 'Recent'}
                      </span>
                    </div>

                    {/* Screenshot Preview */}
                    <div
                      className="design-card-media"
                      onClick={() => setSelectedDesign(design)}
                      title="Click to view full design"
                    >
                      <img
                        src={imgUrl}
                        alt={`UI Design in ${design.project_title}`}
                        className="design-card-img"
                        loading="lazy"
                      />
                      <div className="design-zoom-overlay">
                        <Maximize2 size={24} />
                        <span>Preview Design</span>
                      </div>

                      {/* AI Score Badges */}
                      {(design.ui_score !== null || design.ux_score !== null) && (
                        <div className="card-scores-overlay">
                          {design.ui_score !== null && (
                            <span className="score-pill ui-pill">
                              UI: {design.ui_score}/10
                            </span>
                          )}
                          {design.ux_score !== null && (
                            <span className="score-pill ux-pill">
                              UX: {design.ux_score}/10
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Card Content & Action Bar */}
                    <div className="card-bottom-bar">
                      <div className="project-title-area">
                        <Link to={projectLink} className="project-title-link">
                          {design.project_title}
                        </Link>
                      </div>

                      <div className="card-interactions">
                        {/* Interactive Like Button */}
                        <button
                          type="button"
                          className={`card-like-btn ${design.is_liked ? 'liked' : ''}`}
                          onClick={(e) => handleLikeToggle(targetId, e)}
                          title={
                            user
                              ? design.is_liked
                                ? 'Unlike design'
                                : 'Like this design'
                              : 'Log in to like'
                          }
                        >
                          <Heart
                            size={18}
                            fill={design.is_liked ? '#ef4444' : 'none'}
                            color={design.is_liked ? '#ef4444' : 'currentColor'}
                          />
                          <span className="like-counter">{design.like_count || 0}</span>
                        </button>

                        <Link to={projectLink} className="inspect-project-btn" title="View Full Project">
                          <ExternalLink size={16} /> Details
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: SEARCH DESIGNERS */}
      {activeTab === 'designers' && (
        <div className="designers-tab-section animate-fade-in">
          <form onSubmit={handleDesignerSearch} className="explore-search-form glass-panel" style={{ padding: '16px' }}>
            <Search size={20} className="search-icon" />
            <input
              type="text"
              className="glass-input"
              placeholder="Search designer portfolios by username..."
              value={designerQuery}
              onChange={(e) => setDesignerQuery(e.target.value)}
            />
            <button type="submit" className="glass-button" disabled={loadingDesigners}>
              {loadingDesigners ? 'Searching...' : 'Search'}
            </button>
          </form>

          {searchedDesigners && (
            <div className="explore-results" style={{ marginTop: '20px' }}>
              {designerResults.length === 0 ? (
                <div className="explore-empty glass-panel">
                  <p>No public profiles found matching &ldquo;{designerQuery}&rdquo;.</p>
                </div>
              ) : (
                designerResults.map((profile) => (
                  <Link
                    key={profile.username}
                    to={`/portfolio/${profile.username}`}
                    className="profile-card glass-panel"
                  >
                    <User size={36} className="profile-card-icon" />
                    <div>
                      <h3>@{profile.username}</h3>
                      <p>{profile.bio || 'UI/UX Designer on the platform'}</p>
                      <span className="profile-meta">
                        {profile.public_project_count} public project(s)
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* LIGHTBOX / FULLSCREEN DESIGN MODAL */}
      {selectedDesign && (
        <div className="design-lightbox-backdrop animate-fade-in" onClick={() => setSelectedDesign(null)}>
          <div className="design-lightbox-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className="lightbox-close-btn"
              onClick={() => setSelectedDesign(null)}
              title="Close Preview"
            >
              <X size={20} />
            </button>

            <div className="lightbox-image-container">
              <img
                src={formatImageUrl(selectedDesign.image)}
                alt="UI Design Full Preview"
                className="lightbox-img"
              />
            </div>

            <div className="lightbox-details-panel">
              <div className="lightbox-header">
                <div>
                  <h3 className="lightbox-project-title">{selectedDesign.project_title}</h3>
                  <Link
                    to={`/portfolio/${selectedDesign.username}`}
                    className="lightbox-designer-link"
                  >
                    by @{selectedDesign.username}
                  </Link>
                </div>

                {/* Like Button inside Modal */}
                <button
                  type="button"
                  className={`card-like-btn lightbox-like-btn ${selectedDesign.is_liked ? 'liked' : ''}`}
                  onClick={() => handleLikeToggle(selectedDesign.id || selectedDesign.design_id)}
                >
                  <Heart
                    size={20}
                    fill={selectedDesign.is_liked ? '#ef4444' : 'none'}
                    color={selectedDesign.is_liked ? '#ef4444' : 'currentColor'}
                  />
                  <span>{selectedDesign.like_count || 0} Likes</span>
                </button>
              </div>

              {(selectedDesign.ui_score !== null || selectedDesign.ux_score !== null) && (
                <div className="lightbox-scores-row">
                  {selectedDesign.ui_score !== null && (
                    <div className="score-box ui-box">
                      <span className="score-num">{selectedDesign.ui_score}/10</span>
                      <span className="score-lbl">Visual UI Score</span>
                    </div>
                  )}
                  {selectedDesign.ux_score !== null && (
                    <div className="score-box ux-box">
                      <span className="score-num">{selectedDesign.ux_score}/10</span>
                      <span className="score-lbl">Usability & UX</span>
                    </div>
                  )}
                </div>
              )}

              <div className="lightbox-actions-row">
                {selectedDesign.project_id && (
                  <Link
                    to={`/portfolio/${selectedDesign.username}/project/${selectedDesign.project_id}`}
                    className="glass-button"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
                  >
                    <ExternalLink size={16} /> Open Full Project Portfolio
                  </Link>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LOGIN PROMPT MODAL (for unauthenticated visitors trying to like) */}
      {showLoginPrompt && (
        <div className="design-lightbox-backdrop animate-fade-in" onClick={() => setShowLoginPrompt(false)}>
          <div className="login-prompt-modal glass-panel" onClick={(e) => e.stopPropagation()}>
            <Heart size={44} style={{ color: '#ef4444', marginBottom: '12px' }} />
            <h3>Join the Community to Like</h3>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', lineHeight: 1.5 }}>
              Please log in or create an account to like community UI designs and show appreciation to fellow designers.
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button
                type="button"
                className="glass-button"
                style={{ background: 'var(--primary)', color: '#fff' }}
                onClick={() => navigate('/login')}
              >
                <LogIn size={16} /> Log In
              </button>
              <button
                type="button"
                className="glass-button secondary"
                onClick={() => navigate('/register')}
              >
                Create Account
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Explore;
