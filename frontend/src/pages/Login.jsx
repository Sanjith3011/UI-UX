// Import React hooks: useState for local component state, useContext to access global state
import { useState, useContext } from 'react';
// Import Link to navigate to the Registration page without a full page reload
import { Link } from 'react-router-dom';
// Import the AuthContext to access the loginUser function
import AuthContext from '../context/AuthContext';
// Import an icon for the login UI
import { Layers } from 'lucide-react';
// Import the shared authentication CSS styles
import './Auth.css';

// Define the Login page component
const Login = () => {
    // Extract the loginUser function from the global AuthContext
    const { loginUser } = useContext(AuthContext);

    // State to store the value of the username input field
    const [username, setUsername] = useState('');
    // State to store the value of the password input field
    const [password, setPassword] = useState('');
    // State to store and display any login errors (e.g., "Invalid credentials")
    const [error, setError] = useState('');

    // Async function to handle form submission
    const handleSubmit = async (e) => {
        // Prevent the default browser form submission behavior
        e.preventDefault();

        // Clear any previous error messages before trying again
        setError('');

        // Call the loginUser function from AuthContext with the current input values
        const result = await loginUser(username, password);

        // If the login attempt failed
        if (!result.success) {
            // Update the error state so the message is displayed to the user
            setError(result.message);
        }
        // Note: We don't need a success block here because loginUser automatically
        // redirects the user to the Home page upon success using navigate('/')
    };

    // The JSX layout rendered by the component
    return (
        // Main container with a fade-in animation, centers everything on screen
        <div className="auth-container animate-fade-in">
            {/* The main white/glassmorphism card containing the form */}
            <div className="auth-card glass-panel">
                {/* Header section with icon and title */}
                <div className="auth-header">
                    <Layers className="auth-icon" size={40} />
                    <h2>Welcome Back</h2>
                    <p>Sign in to your account</p>
                </div>

                {/* Conditional Rendering: Only render the error div if the error state is not empty */}
                {error && <div className="auth-error">{error}</div>}

                {/* The login form */}
                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label>Username</label>
                        {/* Username input bound to the 'username' state */}
                        <input
                            type="text"
                            className="glass-input"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required // HTML5 validation: field cannot be empty
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        {/* Password input bound to the 'password' state */}
                        <input
                            type="password"
                            className="glass-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required // HTML5 validation: field cannot be empty
                        />
                    </div>
                    {/* Submit button. Triggers the onSubmit event on the form */}
                    <button type="submit" className="glass-button auth-submit">
                        Sign In
                    </button>
                </form>

                {/* Footer section with a link to the registration page for new users */}
                <div className="auth-footer">
                    <p>Don't have an account? <Link to="/register">Register here</Link></p>
                </div>
            </div>
        </div>
    );
};

// Export the component as default for routing
export default Login;
