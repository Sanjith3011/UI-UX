import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Layers, AlertCircle, ArrowRight } from 'lucide-react';
import './Auth.css';

const Register = () => {
    const { registerUser } = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await registerUser(username, email, password);
            if (!result.success) {
                setError(result.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-fade-in">
            <div className="auth-card glass-panel">
                <div className="auth-header">
                    <div className="auth-brand-badge">
                        <Layers className="auth-icon" size={26} />
                    </div>
                    <h2>Create Account</h2>
                    <p>Start evaluating UI/UX interfaces with heuristic AI</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="glass-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="e.g. sarah_design"
                            required
                            autoComplete="username"
                            autoFocus
                        />
                        <p className="form-hint">
                            Unique handle for your public portfolio and team network.
                        </p>
                    </div>

                    <div className="form-group">
                        <label>Email (Optional)</label>
                        <input
                            type="email"
                            className="glass-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="sarah@designteam.io"
                            autoComplete="email"
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="glass-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="At least 6 characters"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    {error && (
                        <div className="auth-error">
                            <AlertCircle size={18} className="auth-error-icon" />
                            <div>
                                <span>{error}</span>
                                {error.toLowerCase().includes('already taken') && (
                                    <div style={{ marginTop: '4px', fontSize: '0.82rem' }}>
                                        Tip: Try appending numbers or initials (e.g. {username}_ui)
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="glass-button auth-submit"
                        disabled={loading}
                    >
                        {loading ? 'Creating Workspace Account...' : (
                            <>
                                <span>Get Started Free</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Already have an account?</span>
                    <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
