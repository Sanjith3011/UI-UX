import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Send, User, MessageSquare, AlertCircle, ShieldAlert } from 'lucide-react';
import { fetchChatThreads, fetchChatMessages, sendChatMessage } from '../api';
import './Chat.css';

const Chat = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const queryUser = searchParams.get('user');

    const [threads, setThreads] = useState([]);
    const [activeUser, setActiveUser] = useState(null);
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    
    const [loadingThreads, setLoadingThreads] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [error, setError] = useState('');

    const messagesEndRef = useRef(null);
    const pollingIntervalRef = useRef(null);

    // Load threads on mount
    useEffect(() => {
        loadThreads();
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);

    // Set active user when threads are loaded or search param changes
    useEffect(() => {
        if (queryUser) {
            setActiveUser(queryUser);
        } else if (threads.length > 0 && !activeUser) {
            setActiveUser(threads[0].username);
        }
    }, [queryUser, threads]);

    // Poll messages when activeUser changes
    useEffect(() => {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
        }

        if (activeUser) {
            loadMessages(activeUser);
            // Poll for new messages every 3 seconds
            pollingIntervalRef.current = setInterval(() => {
                pollMessages(activeUser);
            }, 3000);
        } else {
            setMessages([]);
        }

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, [activeUser]);

    // Scroll to bottom on new messages
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const loadThreads = async () => {
        try {
            setLoadingThreads(true);
            const data = await fetchChatThreads();
            setThreads(data);
            
            // If queryUser is provided but not in the threads list, add it
            if (queryUser && !data.some(t => t.username === queryUser)) {
                setThreads(prev => [
                    {
                        username: queryUser,
                        last_message: 'Starting new chat...',
                        timestamp: new Date().toISOString(),
                        is_friend: true
                    },
                    ...prev
                ]);
            }
        } catch (err) {
            console.error('Error fetching chat threads:', err);
            setError('Failed to load chat threads.');
        } finally {
            setLoadingThreads(false);
        }
    };

    const loadMessages = async (username) => {
        setLoadingMessages(true);
        setError('');
        try {
            const data = await fetchChatMessages(username);
            setMessages(data);
        } catch (err) {
            console.error('Error fetching messages:', err);
            setError(err.response?.data?.detail || 'Failed to load message history.');
        } finally {
            setLoadingMessages(false);
        }
    };

    const pollMessages = async (username) => {
        try {
            const data = await fetchChatMessages(username);
            // Only update state if length or content changes to prevent layout thrashing
            setMessages(prev => {
                if (JSON.stringify(prev) !== JSON.stringify(data)) {
                    return data;
                }
                return prev;
            });
        } catch (err) {
            console.error('Error polling messages:', err);
        }
    };

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !activeUser) return;

        const messageText = newMessage.trim();
        setNewMessage(''); // Clear input immediately for snappy UX

        try {
            const sentMsg = await sendChatMessage(activeUser, messageText);
            setMessages(prev => [...prev, sentMsg]);
            
            // Update threads list to show latest message
            setThreads(prev => {
                const existing = prev.find(t => t.username === activeUser);
                if (existing) {
                    return [
                        { ...existing, last_message: messageText, timestamp: new Date().toISOString() },
                        ...prev.filter(t => t.username !== activeUser)
                    ];
                }
                return prev;
            });
        } catch (err) {
            console.error('Error sending message:', err);
            setError(err.response?.data?.detail || 'Failed to send message.');
        }
    };

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const activeThread = threads.find(t => t.username === activeUser);
    const isFriend = activeThread ? activeThread.is_friend : true;

    return (
        <div className="chat-container glass-panel animate-fade-in">
            {/* Sidebar Threads */}
            <div className="chat-sidebar">
                <div className="sidebar-header">
                    <h2>Messages</h2>
                </div>
                <div className="threads-list">
                    {loadingThreads ? (
                        <div className="threads-loading">
                            <div className="app-loading-spinner" />
                        </div>
                    ) : threads.length === 0 ? (
                        <div className="no-threads">
                            <MessageSquare size={32} className="text-muted" />
                            <p>No active chats. Start one from your friends page.</p>
                        </div>
                    ) : (
                        threads.map((t) => (
                            <div
                                key={t.username}
                                className={`thread-item ${activeUser === t.username ? 'active' : ''}`}
                                onClick={() => {
                                    setActiveUser(t.username);
                                    navigate(`/chat?user=${t.username}`);
                                }}
                            >
                                <div className="thread-avatar">
                                    <User size={20} />
                                </div>
                                <div className="thread-details">
                                    <div className="thread-meta">
                                        <span className="thread-name">{t.username}</span>
                                        <span className="thread-time">
                                            {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                    <p className="thread-preview">{t.last_message}</p>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Chat Body */}
            <div className="chat-body">
                {activeUser ? (
                    <>
                        {/* Chat Header */}
                        <div className="chat-body-header">
                            <div className="header-user-info">
                                <div className="user-avatar">
                                    <User size={20} />
                                </div>
                                <div>
                                    <h3>{activeUser}</h3>
                                    <span className="user-status-text">
                                        {isFriend ? 'Connected Friend' : 'Not Connected'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Error Indicator */}
                        {error && (
                            <div className="chat-error-bar">
                                <AlertCircle size={16} />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Message Panel */}
                        <div className="messages-panel">
                            {loadingMessages && messages.length === 0 ? (
                                <div className="messages-loading">
                                    <div className="app-loading-spinner" />
                                </div>
                            ) : messages.length === 0 ? (
                                <div className="messages-empty">
                                    <MessageSquare size={40} className="text-muted" />
                                    <h3>Say hello!</h3>
                                    <p>Start your private conversation with {activeUser}.</p>
                                </div>
                            ) : (
                                messages.map((m) => {
                                    const isMe = m.sender !== activeUser;
                                    return (
                                        <div key={m.id} className={`message-bubble-wrapper ${isMe ? 'me' : 'them'}`}>
                                            <div className="message-bubble">
                                                <p className="message-body">{m.body}</p>
                                                <span className="message-time">
                                                    {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                            <div ref={messagesEndRef} />
                        </div>

                        {/* Chat Input */}
                        <div className="chat-input-area">
                            {!isFriend ? (
                                <div className="chat-blocked-notice">
                                    <ShieldAlert size={18} />
                                    <span>You can only message users who are your friends.</span>
                                </div>
                            ) : (
                                <form onSubmit={handleSendMessage} className="chat-form">
                                    <input
                                        type="text"
                                        className="glass-input chat-input"
                                        placeholder="Type your message here..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                    />
                                    <button type="submit" className="glass-button send-btn" disabled={!newMessage.trim()}>
                                        <Send size={16} />
                                    </button>
                                </form>
                            )}
                        </div>
                    </>
                ) : (
                    <div className="chat-placeholder">
                        <MessageSquare size={64} className="text-muted" />
                        <h2>Your Inbox</h2>
                        <p>Select a connection from the sidebar or navigate to the Friends page to start a chat.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Chat;
