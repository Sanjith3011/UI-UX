import { Link, useNavigate } from 'react-router-dom';
import { Layers, LogOut, User, Shield, Trash2, Compass, Users, MessageSquare, UploadCloud } from 'lucide-react';
import { useContext, useState, useEffect } from 'react';
import AuthContext from '../context/AuthContext';
import { deleteAllUserData, fetchFriendRequests } from '../api';
import './Navbar.css';

const Navbar = () => {
    const { user, logoutUser } = useContext(AuthContext);
    const navigate = useNavigate();
    const [deleting, setDeleting] = useState(false);
    const [requestsCount, setRequestsCount] = useState(0);

    useEffect(() => {
        if (!user) {
            setRequestsCount(0);
            return;
        }

        const loadRequestsCount = async () => {
            try {
                const reqs = await fetchFriendRequests();
                setRequestsCount(reqs.length);
            } catch (err) {
                console.error('Error loading requests count:', err);
            }
        };

        loadRequestsCount();
        const interval = setInterval(loadRequestsCount, 15000);
        return () => clearInterval(interval);
    }, [user]);

    const handleDeleteAllData = async () => {
        const confirmed = window.confirm(
            'Delete ALL your data?\n\nThis permanently removes every project, screenshot, ZIP analysis, and AI feedback. Your login account will remain.\n\nThis cannot be undone.'
        );
        if (!confirmed) return;

        const typed = window.prompt('Type DELETE to confirm permanent data removal:');
        if (typed !== 'DELETE') {
            alert('Deletion cancelled.');
            return;
        }

        setDeleting(true);
        try {
            await deleteAllUserData();
            alert('All your data has been permanently deleted.');
            navigate('/');
            window.location.reload();
        } catch (err) {
            console.error('Delete all data failed:', err);
            alert(err.response?.data?.detail || 'Failed to delete data. Please try again.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <nav className="navbar glass-panel">
            <div className="navbar-container">
                <Link to="/" className="navbar-brand">
                    <Layers className="navbar-icon" size={28} />
                    <span className="gradient-text navbar-title">UI/UX Analyzer</span>
                </Link>
                <div className="navbar-links">
                    <Link to="/explore" className="navbar-link navbar-privacy-link">
                        <Compass size={16} /> Public Feed
                    </Link>
                    <Link to="/privacy" className="navbar-link navbar-privacy-link">
                        <Shield size={16} /> Privacy
                    </Link>
                    {user ? (
                        <>
                            <Link to="/friends" className="navbar-link navbar-privacy-link navbar-friends-link">
                                <Users size={16} /> Friends
                                {requestsCount > 0 && <span className="navbar-badge">{requestsCount}</span>}
                            </Link>
                            <Link to="/chat" className="navbar-link navbar-privacy-link">
                                <MessageSquare size={16} /> Messages
                            </Link>
                            <Link to="/hybrid-upload" className="navbar-link navbar-privacy-link">
                                <UploadCloud size={16} /> Hybrid Upload
                            </Link>
                            {user.username && (
                                <Link to={`/portfolio/${user.username}`} className="navbar-link navbar-privacy-link">
                                    <User size={16} /> My Portfolio
                                </Link>
                            )}
                            <span className="navbar-user">
                                {user.username || 'Designer'}
                            </span>
                            <button
                                onClick={handleDeleteAllData}
                                disabled={deleting}
                                className="glass-button navbar-delete-btn"
                                title="Delete all my data"
                            >
                                <Trash2 size={16} /> {deleting ? 'Deleting...' : 'Delete All My Data'}
                            </button>
                            <button onClick={logoutUser} className="glass-button navbar-logout-btn">
                                <LogOut size={16} /> Logout
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className="navbar-link">Login</Link>
                    )}
                </div>
            </div>
        </nav>
    );
};

export default Navbar;
