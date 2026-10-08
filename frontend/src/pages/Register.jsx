// Import React hooks for local state and context access
import { useState, useContext } from 'react';
// Import Link for client-side routing between pages without a full refresh
import { Link } from 'react-router-dom';
// Import AuthContext to access the global registerUser function
import AuthContext from '../context/AuthContext';
// Import an icon to use in the registration UI
import { Layers } from 'lucide-react';
// Import the shared styling used by both Auth and Login pages
import './Auth.css';

// Define the Register page component
const Register = () => {
    // Extract the registerUser function from the global authentication context
    const { registerUser } = useContext(AuthContext);

    // State to hold the chosen username
    const [username, setUsername] = useState('');
    // State to hold the optional email address
    const [email, setEmail] = useState('');
    // State to hold the chosen password
    const [password, setPassword] = useState('');
    // State to hold and display any registration error messages
    const [error, setError] = useState('');

    const [loading, setLoading] = useState(false);

    // Async function triggered when the user submits the registration form
    const handleSubmit = async (e) => {
        // Prevent the browser's default behavior of reloading the page on form submit
        e.preventDefault();

        // Reset any existing error messages
        setError('');
        setLoading(true);

        try {
            // Call the registration function with the collected input values
            const result = await registerUser(username, email, password);

            // If the registration failed
            if (!result.success) {
                // Update the UI to show the specific error message returned from the backend
                setError(result.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // The JSX layout rendered by the component
    return (
        // Main wrapper container, styled to center content with a fade-in animation
        <div className="auth-container animate-fade-in">
            {/* The white/glass card that holds the actual form */}
            <div className="auth-card glass-panel">
                {/* Header section with an icon and titles */}
                <div className="auth-header">
                    <Layers className="auth-icon" size={40} />
                    <h2>Create Account</h2>
                    <p>Join to start analyzing designs</p>
                </div>

                {/* Conditional Rendering: Output the error message if the error state is not an empty string */}
                {error && <div className="auth-error">{error}</div>}

                {/* The Registration Form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Username</label>
                        {/* Input bound to the 'username' state */}
                        <input
                            type="text"
                            className="glass-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required // HTML5 validation: field cannot be empty
                            autoComplete="username"
                        />
                        <p className="form-hint">
                            Usernames must be unique. Different capital letters are allowed (e.g. &quot;Alex&quot; and &quot;alex&quot;).
                        </p>
                    </div>
                    <div className="form-group">
                        <label>Email (Optional)</label>
                        {/* Input bound to the 'email' state */}
                        <input
                            type="email" // HTML5 validation: must be a valid email format if filled
                            className="glass-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        {/* Input bound to the 'password' state */}
                        <input
                            type="password"
                            className="glass-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required // HTML5 validation: field cannot be empty
                        />
                    </div>

                    {/* Inline error right above submit button so it's always in view */}
                    {error && (
                        <div className="auth-error" style={{ marginBottom: '16px' }}>
                            {error}
                            {error.toLowerCase().includes('already taken') && (
                                <div style={{ marginTop: '8px' }}>
                                    <Link to="/login" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 'bold' }}>
                                        Click here to Sign In instead →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Form submit button */}
                    <button
                        type="submit"
                        className="glass-button auth-submit"
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}
                    >
                        {loading ? 'Creating Account...' : 'Create Account'}
                    </button>
                </form>

                {/* Footer section providing a link back to the login page for existing users */}
                <div className="auth-footer">
                    <p>Already have an account? <Link to="/login">Sign In</Link></p>
                </div>
            </div>
        </div>
    );
};

// Export the Register component to be used in routing
export default Register;
