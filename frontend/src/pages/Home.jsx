import { useState, useEffect, useContext, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
    Plus,
    Folder,
    Trash2,
    UploadCloud,
    MessageSquare,
    Heart,
    Sparkles,
    AlertCircle,
    Search,
    Globe,
    Lock,
    ArrowRight,
    SlidersHorizontal,
    CheckCircle,
    FileCheck2,
    Layers,
    Activity,
    ExternalLink,
    X
} from 'lucide-react';
import api, { fetchFeed, toggleDesignLike, MEDIA_BASE } from '../api';
import AuthContext from '../context/AuthContext';
import './Home.css';

const Home = () => {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    // Projects state
    const [projects, setProjects] = useState([]);
    const [loading, setLoading] = useState(true);

    // Filter & search state
    const [searchQuery, setSearchQuery] = useState('');
    const [filterTab, setFilterTab] = useState('all'); // 'all' | 'public' | 'private'

    // Create Project modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newTitle, setNewTitle] = useState('');
    const [newDescription, setNewDescription] = useState('');
    const [creatingProject, setCreatingProject] = useState(false);

    // Delete Project confirmation modal
    const [projectToDelete, setProjectToDelete] = useState(null);
    const [deletingProject, setDeletingProject] = useState(false);

    // Feed / Showcase highlights
    const [feedItems, setFeedItems] = useState([]);
    const [loadingFeed, setLoadingFeed] = useState(true);

    useEffect(() => {
        fetchProjects();
        fetchFeedData();
    }, []);

    const fetchProjects = async () => {
        try {
            const response = await api.get('projects/');
            setProjects(response.data || []);
        } catch (error) {
            console.error('Error fetching projects:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchFeedData = async () => {
        try {
            setLoadingFeed(true);
            const data = await fetchFeed();
            setFeedItems(data || []);
        } catch (error) {
            console.error('Error fetching feed data:', error);
        } finally {
            setLoadingFeed(false);
        }
    };

    const handleCreateProject = async (e) => {
        e.preventDefault();
        if (!newTitle.trim()) return;

        setCreatingProject(true);
        try {
            const response = await api.post('projects/', {
                title: newTitle.trim(),
                description: newDescription.trim()
            });

            setProjects([response.data, ...projects]);
            setIsModalOpen(false);
            setNewTitle('');
            setNewDescription('');
            navigate(`/project/${response.data.id}`);
        } catch (error) {
            console.error('Error creating project:', error);
            alert('Failed to create project. Please try again.');
        } finally {
            setCreatingProject(false);
        }
    };

    const confirmDeleteProject = async () => {
        if (!projectToDelete) return;
        setDeletingProject(true);
        try {
            await api.delete(`projects/${projectToDelete.id}/`);
            setProjects(projects.filter(p => p.id !== projectToDelete.id));
            setProjectToDelete(null);
        } catch (error) {
            console.error('Error deleting project:', error);
            alert('Failed to delete project.');
        } finally {
            setDeletingProject(false);
        }
    };

    const handleToggleLike = async (designId, e) => {
        e.preventDefault();
        e.stopPropagation();

        setFeedItems(prev => prev.map(item => {
            if (item.design_id === designId) {
                const nextLiked = !item.is_liked;
                return {
                    ...item,
                    is_liked: nextLiked,
                    like_count: Math.max(0, (item.like_count || 0) + (nextLiked ? 1 : -1))
                };
            }
            return item;
        }));

        try {
            const res = await toggleDesignLike(designId);
            setFeedItems(prev => prev.map(item => {
                if (item.design_id === designId) {
                    return {
                        ...item,
                        is_liked: res.liked,
                        like_count: res.like_count
                    };
                }
                return item;
            }));
        } catch (err) {
            console.error('Failed to toggle like:', err);
        }
    };

    const getProjectLink = (item) => {
        if (!item.project_id) return '/';
        if (item.owner_username === user?.username) {
            return `/project/${item.project_id}`;
        }
        return `/portfolio/${item.owner_username}/project/${item.project_id}`;
    };

    // Filtered projects
    const filteredProjects = useMemo(() => {
        return projects.filter(p => {
            const matchesQuery = !searchQuery.trim() ||
                p.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase()));

            if (!matchesQuery) return false;

            if (filterTab === 'public') return p.is_public;
            if (filterTab === 'private') return !p.is_public;
            return true;
        });
    }, [projects, searchQuery, filterTab]);

    // Computed metrics
    const totalDesignsCount = useMemo(() => {
        return projects.reduce((acc, p) => acc + (p.designs?.length || 0), 0);
    }, [projects]);

    const publicProjectsCount = useMemo(() => {
        return projects.filter(p => p.is_public).length;
    }, [projects]);

    // Showcase spotlight items (top 3 designs with images)
    const spotlightDesigns = useMemo(() => {
        return feedItems
            .filter(item => item.type === 'design_published' && item.image)
            .slice(0, 3);
    }, [feedItems]);

    return (
        <div className="home-dashboard animate-fade-in">
            {/* Top Executive Header */}
            <header className="workspace-hero">
                <div className="workspace-hero-content">
                    <div className="workspace-hero-greeting">
                        <span className="workspace-badge">
                            <Activity size={13} className="badge-pulse-icon" /> Workspace Active
                        </span>
                        <h1 className="workspace-title">
                            Welcome, <span className="gradient-text">{user?.username || 'Designer'}</span>
                        </h1>
                        <p className="workspace-subtitle">
                            Monitor heuristic audits, design system compliance, and team critique in real time.
                        </p>
                    </div>

                    <div className="workspace-hero-actions">
                        <Link to="/hybrid-upload" className="glass-button hero-audit-cta">
                            <UploadCloud size={18} />
                            Launch Audit Studio
                        </Link>
                        <button
                            className="workspace-secondary-btn"
                            onClick={() => setIsModalOpen(true)}
                        >
                            <Plus size={18} />
                            New Project
                        </button>
                    </div>
                </div>

                {/* Key Metrics Row */}
                <div className="workspace-metrics-row">
                    <div className="metric-card glass-panel">
                        <div className="metric-icon-wrap metric-blue">
                            <Folder size={20} />
                        </div>
                        <div className="metric-data">
                            <span className="metric-label">Total Projects</span>
                            <span className="metric-value">{projects.length}</span>
                        </div>
                    </div>

                    <div className="metric-card glass-panel">
                        <div className="metric-icon-wrap metric-purple">
                            <Layers size={20} />
                        </div>
                        <div className="metric-data">
                            <span className="metric-label">Audited Screens</span>
                            <span className="metric-value">{totalDesignsCount}</span>
                        </div>
                    </div>

                    <div className="metric-card glass-panel">
                        <div className="metric-icon-wrap metric-emerald">
                            <Globe size={20} />
                        </div>
                        <div className="metric-data">
                            <span className="metric-label">Public Portfolios</span>
                            <span className="metric-value">{publicProjectsCount}</span>
                        </div>
                    </div>

                    <div className="metric-card glass-panel">
                        <div className="metric-icon-wrap metric-amber">
                            <Sparkles size={20} />
                        </div>
                        <div className="metric-data">
                            <span className="metric-label">Audit Engine</span>
                            <span className="metric-value-status">
                                <span className="status-dot-pulse" /> Heuristic v2.5
                            </span>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Projects Section */}
            <section className="projects-workspace-section">
                {/* Toolbar */}
                <div className="projects-toolbar">
                    <div className="projects-search-bar glass-panel">
                        <Search size={18} className="search-icon" />
                        <input
                            type="text"
                            placeholder="Filter projects by title or description..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="projects-search-input"
                        />
                        {searchQuery && (
                            <button
                                className="search-clear-btn"
                                onClick={() => setSearchQuery('')}
                                aria-label="Clear search"
                            >
                                <X size={15} />
                            </button>
                        )}
                    </div>

                    <div className="projects-filter-pills">
                        <button
                            className={`filter-pill ${filterTab === 'all' ? 'active' : ''}`}
                            onClick={() => setFilterTab('all')}
                        >
                            All ({projects.length})
                        </button>
                        <button
                            className={`filter-pill ${filterTab === 'public' ? 'active' : ''}`}
                            onClick={() => setFilterTab('public')}
                        >
                            Public ({publicProjectsCount})
                        </button>
                        <button
                            className={`filter-pill ${filterTab === 'private' ? 'active' : ''}`}
                            onClick={() => setFilterTab('private')}
                        >
                            Private ({projects.length - publicProjectsCount})
                        </button>
                    </div>
                </div>

                {/* Projects Grid */}
                {loading ? (
                    <div className="projects-loading-container">
                        <div className="app-loading-spinner" />
                        <p className="loading-hint">Loading your workspace projects...</p>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="projects-empty-card glass-panel animate-scale-in">
                        <div className="empty-card-icon-wrap">
                            <Folder size={36} />
                        </div>
                        <h3>
                            {searchQuery ? 'No matching projects found' : 'Your workspace is empty'}
                        </h3>
                        <p>
                            {searchQuery
                                ? `No projects match "${searchQuery}". Try a different keyword.`
                                : 'Create your first project or run a hybrid audit with design specs & screenshots.'}
                        </p>
                        <div className="empty-card-actions">
                            {searchQuery ? (
                                <button className="glass-button" onClick={() => setSearchQuery('')}>
                                    Clear Filter
                                </button>
                            ) : (
                                <>
                                    <button className="glass-button" onClick={() => setIsModalOpen(true)}>
                                        <Plus size={16} /> Create Project
                                    </button>
                                    <Link to="/hybrid-upload" className="workspace-secondary-btn">
                                        <UploadCloud size={16} /> Run Heuristic Audit
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                ) : (
                    <div className="projects-grid">
                        {filteredProjects.map((project) => (
                            <div key={project.id} className="project-card-container glass-panel">
                                <Link to={`/project/${project.id}`} className="project-card-click-area">
                                    <div className="project-card-top">
                                        <div className="project-card-badge">
                                            <Folder size={20} />
                                        </div>
                                        <span className={`project-visibility-pill ${project.is_public ? 'public' : 'private'}`}>
                                            {project.is_public ? (
                                                <>
                                                    <Globe size={12} /> Public
                                                </>
                                            ) : (
                                                <>
                                                    <Lock size={12} /> Private
                                                </>
                                            )}
                                        </span>
                                    </div>

                                    <h3 className="project-card-title">{project.title}</h3>
                                    <p className="project-card-desc">
                                        {project.description || 'No description provided for this design project.'}
                                    </p>
                                </Link>

                                <div className="project-card-bottom">
                                    <div className="project-meta-info">
                                        <span className="project-date">
                                            {new Date(project.created_at).toLocaleDateString(undefined, {
                                                month: 'short',
                                                day: 'numeric',
                                                year: 'numeric'
                                            })}
                                        </span>
                                        <span className="project-assets-pill">
                                            {project.designs?.length || 0} screens
                                        </span>
                                    </div>

                                    <div className="project-card-actions">
                                        <button
                                            className="project-delete-trigger"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                setProjectToDelete(project);
                                            }}
                                            title="Delete project"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                        <Link
                                            to={`/project/${project.id}`}
                                            className="project-open-link"
                                            title="Open audit project"
                                        >
                                            <span>Open</span>
                                            <ArrowRight size={14} />
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Community Spotlight Section */}
            {spotlightDesigns.length > 0 && (
                <section className="community-spotlight-section">
                    <div className="spotlight-header">
                        <div>
                            <div className="spotlight-badge">
                                <Sparkles size={14} /> Community Highlights
                            </div>
                            <h2 className="spotlight-title">Featured Interface Audits</h2>
                        </div>
                        <Link to="/explore" className="spotlight-view-all">
                            <span>Browse Showcase</span>
                            <ArrowRight size={15} />
                        </Link>
                    </div>

                    <div className="spotlight-grid">
                        {spotlightDesigns.map((item, index) => {
                            const imageUrl = item.image.startsWith('http')
                                ? item.image
                                : `${MEDIA_BASE}${item.image}`;

                            return (
                                <div key={index} className="spotlight-card glass-panel">
                                    <Link to={getProjectLink(item)} className="spotlight-image-wrap">
                                        <img src={imageUrl} alt={item.title || 'Design Screen'} className="spotlight-img" />
                                        {(item.ui_score !== null || item.ux_score !== null) && (
                                            <div className="spotlight-scores-badge">
                                                {item.ui_score !== null && (
                                                    <span className="score-chip ui">UI {item.ui_score}</span>
                                                )}
                                                {item.ux_score !== null && (
                                                    <span className="score-chip ux">UX {item.ux_score}</span>
                                                )}
                                            </div>
                                        )}
                                    </Link>

                                    <div className="spotlight-meta">
                                        <div className="spotlight-user-row">
                                            <span className="spotlight-author">@{item.username}</span>
                                            <button
                                                className={`spotlight-like-btn ${item.is_liked ? 'liked' : ''}`}
                                                onClick={(e) => handleToggleLike(item.design_id, e)}
                                                title="Like design"
                                            >
                                                <Heart size={14} fill={item.is_liked ? 'currentColor' : 'none'} />
                                                <span>{item.like_count || 0}</span>
                                            </button>
                                        </div>
                                        <p className="spotlight-title-text">{item.title || 'Untitled Interface'}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>
            )}

            {/* Create Project Modal */}
            {isModalOpen && (
                <div className="modal-backdrop animate-fade-in" onClick={() => !creatingProject && setIsModalOpen(false)}>
                    <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-icon-badge">
                                <Plus size={22} />
                            </div>
                            <div>
                                <h3 className="modal-title">Create Design Project</h3>
                                <p className="modal-subtitle">Organize audits, assets, and design feedback</p>
                            </div>
                            <button
                                className="modal-close-btn"
                                onClick={() => !creatingProject && setIsModalOpen(false)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleCreateProject} className="create-project-form">
                            <div className="form-field-group">
                                <label className="form-field-label">Project Title *</label>
                                <input
                                    type="text"
                                    value={newTitle}
                                    onChange={(e) => setNewTitle(e.target.value)}
                                    placeholder="e.g. Fintech Mobile App Redesign"
                                    required
                                    autoFocus
                                    className="form-field-input"
                                />
                            </div>

                            <div className="form-field-group">
                                <label className="form-field-label">Project Scope / Description</label>
                                <textarea
                                    value={newDescription}
                                    onChange={(e) => setNewDescription(e.target.value)}
                                    placeholder="Describe design goals, target audience, or usability focal points..."
                                    rows={4}
                                    className="form-field-textarea"
                                />
                            </div>

                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={creatingProject}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="glass-button"
                                    disabled={creatingProject || !newTitle.trim()}
                                >
                                    {creatingProject ? 'Creating...' : 'Create & Open Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Safe Delete Project Modal */}
            {projectToDelete && (
                <div className="modal-backdrop animate-fade-in" onClick={() => !deletingProject && setProjectToDelete(null)}>
                    <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-warning-icon">
                                <Trash2 size={22} />
                            </div>
                            <div>
                                <h3 className="modal-title">Delete Project</h3>
                                <p className="modal-subtitle">Are you sure you want to delete "{projectToDelete.title}"?</p>
                            </div>
                            <button
                                className="modal-close-btn"
                                onClick={() => !deletingProject && setProjectToDelete(null)}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p className="modal-explanation">
                                This will permanently remove this project, all associated screenshots, and AI audit reports. This action cannot be undone.
                            </p>
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    className="btn-cancel"
                                    onClick={() => setProjectToDelete(null)}
                                    disabled={deletingProject}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    className="btn-danger"
                                    onClick={confirmDeleteProject}
                                    disabled={deletingProject}
                                >
                                    {deletingProject ? 'Deleting...' : 'Delete Project'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
