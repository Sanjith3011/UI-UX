import { useState, useEffect } from 'react';
import { Search, UserPlus, UserCheck, UserMinus, Clock, MessageSquare, AlertCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
    fetchFriends,
    sendFriendRequest,
    fetchFriendRequests,
    respondToFriendRequest,
    removeFriend,
    searchProfiles
} from '../api';
import './Friends.css';

const Friends = () => {
    const [activeTab, setActiveTab] = useState('my-friends'); // 'my-friends', 'requests', 'search'
    
    const [friends, setFriends] = useState([]);
    const [incomingRequests, setIncomingRequests] = useState([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    useEffect(() => {
        loadFriendsData();
    }, [activeTab]);

    const loadFriendsData = async () => {
        setLoading(true);
        setError('');
        try {
            if (activeTab === 'my-friends') {
                const data = await fetchFriends();
                setFriends(data);
            } else if (activeTab === 'requests') {
                const data = await fetchFriendRequests();
                setIncomingRequests(data);
            }
        } catch (err) {
            console.error('Error loading friends data:', err);
            setError('Failed to load friends/requests data.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearchSubmit = async (e) => {
        e.preventDefault();
        if (!searchQuery.trim()) return;

        setLoading(true);
        setError('');
        try {
            const results = await searchProfiles(searchQuery.trim());
            setSearchResults(results);
            if (results.length === 0) {
                setError('No users found matching that username.');
            }
        } catch (err) {
            console.error('Error searching profiles:', err);
            setError('Error performing search.');
        } finally {
            setLoading(false);
        }
    };

    const handleSendRequest = async (username) => {
        setError('');
        setSuccessMessage('');
        try {
            await sendFriendRequest(username);
            setSuccessMessage(`Friend request sent to ${username}!`);
            // Remove from search results or change status visually
            setSearchResults(prev =>
                prev.map(u => u.username === username ? { ...u, requestSent: true } : u)
            );
        } catch (err) {
            console.error('Error sending friend request:', err);
            setError(err.response?.data?.detail || 'Failed to send friend request.');
        }
    };

    const handleRespond = async (requestId, action) => {
        setError('');
        try {
            await respondToFriendRequest(requestId, action);
            setIncomingRequests(prev => prev.filter(r => r.id !== requestId));
            setSuccessMessage(action === 'accept' ? 'Friend request accepted!' : 'Friend request rejected.');
        } catch (err) {
            console.error('Error responding to request:', err);
            setError(err.response?.data?.detail || 'Failed to respond to request.');
        }
    };

    const handleRemoveFriend = async (username) => {
        if (!window.confirm(`Are you sure you want to remove ${username} from your friends?`)) return;
        setError('');
        try {
            await removeFriend(username);
            setFriends(prev => prev.filter(f => f.username !== username));
            setSuccessMessage(`Removed friendship with ${username}.`);
        } catch (err) {
            console.error('Error removing friend:', err);
            setError(err.response?.data?.detail || 'Failed to remove friend.');
        }
    };

    return (
        <div className="friends-container animate-fade-in">
            <h1 className="friends-title gradient-text">Connections & Network</h1>
            <p className="friends-subtitle">Connect with other designers, view their updates, and chat in private.</p>

            {/* Notification Messages */}
            {error && (
                <div className="alert-message error-message">
                    <AlertCircle size={18} />
                    <span>{error}</span>
                </div>
            )}
            {successMessage && (
                <div className="alert-message success-message">
                    <UserCheck size={18} />
                    <span>{successMessage}</span>
                </div>
            )}

            {/* Tabs */}
            <div className="friends-tabs">
                <button
                    className={`tab-btn ${activeTab === 'my-friends' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('my-friends'); setSuccessMessage(''); setError(''); }}
                >
                    My Friends ({friends.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'requests' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('requests'); setSuccessMessage(''); setError(''); }}
                >
                    Pending Requests ({incomingRequests.length})
                </button>
                <button
                    className={`tab-btn ${activeTab === 'search' ? 'active' : ''}`}
                    onClick={() => { setActiveTab('search'); setSuccessMessage(''); setError(''); }}
                >
                    Find Designers
                </button>
            </div>

            {/* Content Areas */}
            <div className="tab-content glass-panel">
                {loading && (
                    <div className="loading-state">
                        <div className="app-loading-spinner"></div>
                        <p style={{ marginTop: '12px' }}>Loading data...</p>
                    </div>
                )}

                {!loading && activeTab === 'my-friends' && (
                    <div className="friends-list-wrapper">
                        {friends.length === 0 ? (
                            <div className="empty-state">
                                <UserMinus size={48} className="empty-icon" />
                                <h3>No friends yet</h3>
                                <p>Search for designers or public profiles to build your network.</p>
                            </div>
                        ) : (
                            <div className="friends-grid">
                                {friends.map((friend) => (
                                    <div key={friend.username} className="friend-card glass-panel">
                                        <div className="friend-info">
                                            <h3>{friend.username}</h3>
                                            <p className="friend-bio">{friend.bio || 'No bio provided.'}</p>
                                        </div>
                                        <div className="friend-actions">
                                            <Link to={`/portfolio/${friend.username}`} className="glass-button secondary-btn link-btn">
                                                Portfolio
                                            </Link>
                                            <Link to={`/chat?user=${friend.username}`} className="glass-button chat-btn">
                                                <MessageSquare size={16} /> Chat
                                            </Link>
                                            <button
                                                className="glass-button remove-btn"
                                                onClick={() => handleRemoveFriend(friend.username)}
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!loading && activeTab === 'requests' && (
                    <div className="requests-list-wrapper">
                        {incomingRequests.length === 0 ? (
                            <div className="empty-state">
                                <Clock size={48} className="empty-icon" />
                                <h3>No pending requests</h3>
                                <p>When other designers add you, their request will show up here.</p>
                            </div>
                        ) : (
                            <div className="requests-grid">
                                {incomingRequests.map((req) => (
                                    <div key={req.id} className="request-card glass-panel">
                                        <div className="request-info">
                                            <h3>{req.sender}</h3>
                                            <span className="request-date">Received {new Date(req.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <div className="request-actions">
                                            <button
                                                className="glass-button accept-btn"
                                                onClick={() => handleRespond(req.id, 'accept')}
                                            >
                                                Accept
                                            </button>
                                            <button
                                                className="glass-button reject-btn"
                                                onClick={() => handleRespond(req.id, 'reject')}
                                            >
                                                Reject
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {!loading && activeTab === 'search' && (
                    <div className="search-wrapper">
                        <form onSubmit={handleSearchSubmit} className="search-form">
                            <div className="search-input-group">
                                <Search className="search-icon" size={20} />
                                <input
                                    type="text"
                                    className="glass-input search-input"
                                    placeholder="Search by username..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                                <button type="submit" className="glass-button">Search</button>
                            </div>
                        </form>

                        <div className="search-results">
                            {searchResults.length > 0 && (
                                <div className="friends-grid">
                                    {searchResults.map((result) => {
                                        // Is this result already our friend?
                                        const isAlreadyFriend = friends.some(f => f.username === result.username);
                                        return (
                                            <div key={result.username} className="friend-card glass-panel">
                                                <div className="friend-info">
                                                    <h3>{result.username}</h3>
                                                    <p className="friend-bio">{result.bio || 'No bio.'}</p>
                                                    <span className="project-badge">{result.public_project_count} public projects</span>
                                                </div>
                                                <div className="friend-actions">
                                                    <Link to={`/portfolio/${result.username}`} className="glass-button secondary-btn link-btn">
                                                        Portfolio
                                                    </Link>
                                                    {isAlreadyFriend ? (
                                                        <span className="friendship-status"><UserCheck size={16} /> Friends</span>
                                                    ) : result.requestSent ? (
                                                        <span className="friendship-status text-muted"><Clock size={16} /> Request Sent</span>
                                                    ) : (
                                                        <button
                                                            className="glass-button add-btn"
                                                            onClick={() => handleSendRequest(result.username)}
                                                        >
                                                            <UserPlus size={16} /> Connect
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Friends;
