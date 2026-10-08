import { useState, useContext } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Layers, AlertCircle, ArrowRight } from 'lucide-react';
import './Auth.css';

const Login = () => {
    const { loginUser } = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = await loginUser(username, password);
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
                    <h2>Welcome Back</h2>
                    <p>Sign in to your design critique workspace</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            className="glass-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter your designer username"
                            required
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            className="glass-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••••••"
                            required
                        />
                    </div>

                    {error && (
                        <div className="auth-error">
                            <AlertCircle size={18} className="auth-error-icon" />
                            <span>{error}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        className="glass-button auth-submit"
                        disabled={loading}
                    >
                        {loading ? 'Authenticating...' : (
                            <>
                                <span>Sign In to Workspace</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Don't have an account yet?</span>
                    <Link to="/register">Create Account</Link>
                </div>
            </div>
        </div>
    );
};

export default Login;
