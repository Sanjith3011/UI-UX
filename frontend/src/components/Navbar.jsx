import { Link, NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
    Layers,
    LogOut,
    User,
    Shield,
    Trash2,
    Compass,
    Users,
    MessageSquare,
    UploadCloud,
    LayoutDashboard,
    ChevronDown,
    Sparkles,
    AlertTriangle,
    X,
    ExternalLink
} from 'lucide-react';
import { useContext, useState, useEffect, useRef } from 'react';
import AuthContext from '../context/AuthContext';
import { deleteAllUserData, fetchFriendRequests } from '../api';
import './Navbar.css';

const Navbar = () => {
    const { user, logoutUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const location = useLocation();

    const [requestsCount, setRequestsCount] = useState(0);
    const [dropdownOpen, setDropdownOpen] = useState(false);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');
    const [deleting, setDeleting] = useState(false);

    const dropdownRef = useRef(null);

    // Close dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Close dropdown on route change
    useEffect(() => {
        setDropdownOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        if (!user) {
            setRequestsCount(0);
            return;
        }

        const loadRequestsCount = async () => {
            try {
                const reqs = await fetchFriendRequests();
                setRequestsCount(reqs?.length || 0);
            } catch (err) {
                console.error('Error loading requests count:', err);
            }
        };

        loadRequestsCount();
        const interval = setInterval(loadRequestsCount, 20000);
        return () => clearInterval(interval);
    }, [user]);

    const handleConfirmDelete = async (e) => {
        e.preventDefault();
        if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
            alert('Please type "DELETE" exactly to confirm.');
            return;
        }

        setDeleting(true);
        try {
            await deleteAllUserData();
            setShowDeleteModal(false);
            setDeleteConfirmText('');
            alert('All your workspace data has been permanently cleared.');
            navigate('/');
            window.location.reload();
        } catch (err) {
            console.error('Delete all data failed:', err);
            alert(err.response?.data?.detail || 'Failed to clear data. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    const userInitial = (user?.username || 'D').charAt(0).toUpperCase();

    return (
        <>
            <header className="navbar-wrapper">
                <nav className="navbar-pill glass-panel">
                    {/* Brand */}
                    <div className="navbar-brand-section">
                        <Link to="/" className="navbar-brand">
                            <div className="navbar-logo-icon">
                                <Layers size={20} />
                            </div>
                            <div className="navbar-brand-text">
                                <span className="navbar-brand-title">CritiqueAI</span>
                                <span className="navbar-badge-pro">STUDIO</span>
                            </div>
                        </Link>
                    </div>

                    {/* Navigation Items */}
                    <div className="navbar-center-nav">
                        <NavLink
                            to="/"
                            end
                            className={({ isActive }) => `navbar-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <LayoutDashboard size={16} />
                            <span>Workspace</span>
                        </NavLink>

                        <NavLink
                            to="/hybrid-upload"
                            className={({ isActive }) => `navbar-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <UploadCloud size={16} />
                            <span>Audit Studio</span>
                        </NavLink>

                        <NavLink
                            to="/explore"
                            className={({ isActive }) => `navbar-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Compass size={16} />
                            <span>Showcase</span>
                        </NavLink>

                        {user && (
                            <>
                                <NavLink
                                    to="/friends"
                                    className={({ isActive }) => `navbar-nav-item ${isActive ? 'active' : ''}`}
                                >
                                    <Users size={16} />
                                    <span>Network</span>
                                    {requestsCount > 0 && (
                                        <span className="navbar-counter-badge">{requestsCount}</span>
                                    )}
                                </NavLink>

                                <NavLink
                                    to="/chat"
                                    className={({ isActive }) => `navbar-nav-item ${isActive ? 'active' : ''}`}
                                >
                                    <MessageSquare size={16} />
                                    <span>Messages</span>
                                </NavLink>
                            </>
                        )}
                    </div>

                    {/* Right User / Auth Section */}
                    <div className="navbar-right-section">
                        {user ? (
                            <div className="navbar-user-dropdown-container" ref={dropdownRef}>
                                <button
                                    className={`navbar-user-pill-btn ${dropdownOpen ? 'open' : ''}`}
                                    onClick={() => setDropdownOpen(!dropdownOpen)}
                                    aria-expanded={dropdownOpen}
                                >
                                    <div className="navbar-avatar-circle">{userInitial}</div>
                                    <span className="navbar-avatar-name">{user.username}</span>
                                    <ChevronDown size={14} className={`navbar-chevron ${dropdownOpen ? 'rotate' : ''}`} />
                                </button>

                                {dropdownOpen && (
                                    <div className="navbar-dropdown-menu glass-panel animate-scale-in">
                                        <div className="dropdown-user-header">
                                            <div className="dropdown-user-avatar">{userInitial}</div>
                                            <div className="dropdown-user-meta">
                                                <span className="dropdown-user-name">{user.username}</span>
                                                <span className="dropdown-user-status">Verified Designer</span>
                                            </div>
                                        </div>

                                        <div className="dropdown-divider" />

                                        {user.username && (
                                            <Link
                                                to={`/portfolio/${user.username}`}
                                                className="dropdown-item"
                                                onClick={() => setDropdownOpen(false)}
                                            >
                                                <User size={16} />
                                                <span>My Public Portfolio</span>
                                                <ExternalLink size={13} className="dropdown-item-arrow" />
                                            </Link>
                                        )}

                                        <Link
                                            to="/privacy"
                                            className="dropdown-item"
                                            onClick={() => setDropdownOpen(false)}
                                        >
                                            <Shield size={16} />
                                            <span>Privacy & Compliance</span>
                                        </Link>

                                        <div className="dropdown-divider" />

                                        <button
                                            className="dropdown-item danger-item"
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                setShowDeleteModal(true);
                                            }}
                                        >
                                            <Trash2 size={16} />
                                            <span>Clear Workspace Data</span>
                                        </button>

                                        <button
                                            className="dropdown-item signout-item"
                                            onClick={() => {
                                                setDropdownOpen(false);
                                                logoutUser();
                                            }}
                                        >
                                            <LogOut size={16} />
                                            <span>Sign Out</span>
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="navbar-guest-actions">
                                <Link to="/login" className="navbar-signin-link">Sign In</Link>
                                <Link to="/register" className="glass-button navbar-signup-btn">Get Started</Link>
                            </div>
                        )}
                    </div>
                </nav>
            </header>

            {/* Clear Workspace Data Safe Modal */}
            {showDeleteModal && (
                <div className="modal-backdrop animate-fade-in" onClick={() => !deleting && setShowDeleteModal(false)}>
                    <div className="modal-card glass-panel" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <div className="modal-warning-icon">
                                <AlertTriangle size={24} />
                            </div>
                            <div>
                                <h3 className="modal-title">Clear Workspace Data</h3>
                                <p className="modal-subtitle">Permanently delete all designs, reports, and AI feedback</p>
                            </div>
                            <button
                                className="modal-close-btn"
                                onClick={() => !deleting && setShowDeleteModal(false)}
                                disabled={deleting}
                            >
                                <X size={18} />
                            </button>
                        </div>

                        <div className="modal-body">
                            <p className="modal-explanation">
                                This will permanently remove all your uploaded design screenshots, PRD reports, and heuristic AI audits.
                                Your account and username will remain intact, but all project assets will be cleared.
                            </p>
                            <form onSubmit={handleConfirmDelete} className="modal-delete-form">
                                <label className="modal-input-label">
                                    Type <strong>DELETE</strong> to confirm:
                                </label>
                                <input
                                    type="text"
                                    value={deleteConfirmText}
                                    onChange={(e) => setDeleteConfirmText(e.target.value)}
                                    placeholder="DELETE"
                                    disabled={deleting}
                                    className="modal-delete-input"
                                    autoFocus
                                />
                                <div className="modal-actions">
                                    <button
                                        type="button"
                                        className="btn-cancel"
                                        onClick={() => setShowDeleteModal(false)}
                                        disabled={deleting}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="btn-danger"
                                        disabled={deleting || deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                                    >
                                        {deleting ? 'Clearing Data...' : 'Permanently Delete'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default Navbar;
