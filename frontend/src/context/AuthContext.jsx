// Import necessary React Hooks: createContext to make a global state, useState for local state, and useEffect for side effects
import { createContext, useState, useEffect } from 'react';
// Import useNavigate to programmatically change routes (e.g., redirect after login)
import { useNavigate } from 'react-router-dom';
// Import our custom pre-configured Axios instance for making API calls
import api from '../api';

// Create a Context object. Components matching this context can read its values.
const AuthContext = createContext();

// Create a Provider component that will wrap our app and supply the AuthContext values
export const AuthProvider = ({ children }) => {
    // State to hold user information. Null means not logged in.
    const [user, setUser] = useState(null);

    // State to hold JWT tokens (access and refresh).
    // It initializes either from localStorage (if they were saved previously) or null.
    // The arrow function ensures we only read from localStorage once on initial load.
    const [authTokens, setAuthTokens] = useState(() =>
        localStorage.getItem('authTokens') ? JSON.parse(localStorage.getItem('authTokens')) : null
    );

    // State to act as a flag indicating if the app is still determining the user's login status.
    const [loading, setLoading] = useState(true);

    // Initialize the navigation hook
    const navigate = useNavigate();

    // Async function to handle user login attempts
    const loginUser = async (username, password) => {
        try {
            // Send a POST request to the Django endpoint that issues JWT tokens
            const response = await api.post('token/', { username, password });

            // If successful, update the state with the received tokens
            setAuthTokens(response.data);

            // Persist the tokens in the browser's local storage so the user stays logged in across refreshes
            localStorage.setItem('authTokens', JSON.stringify(response.data));

            // Decode JWT payload for user info in a real app, 
            // but for simplicity we'll just set the basic user state here with the provided username.
            const userData = { username };
            setUser(userData);
            localStorage.setItem('authUser', JSON.stringify(userData));

            navigate('/');

            // Return success flag to the component that called this function
            return { success: true };
        } catch (error) {
            // Log any errors that occurred during the API request
            console.error('Login error:', error);

            // Return failure flag and a generic error message
            return { success: false, message: 'Invalid credentials' };
        }
    };

    // Async function to handle new user registrations
    const registerUser = async (username, email, password) => {
        try {
            // Send a POST request to the Django registration endpoint
            await api.post('register/', { username, email, password });

            // After successful registration, automatically log the user in
            return await loginUser(username, password);
        } catch (error) {
            // Log the registration error
            console.error('Registration error:', error);

            // Default error message
            let message = 'Registration failed.';

            // Try to extract a more specific error message from the Django API response if available
            if (error.response?.data) {
                const data = error.response.data;
                if (typeof data === 'string' && (data.includes('<!DOCTYPE') || data.includes('<html') || data.includes('<title>Error'))) {
                    message = `Backend API endpoint not found (HTTP ${error.response.status}). Please check that VITE_BACKEND_URL in your frontend Render settings points to your actual backend URL.`;
                } else if (Array.isArray(data.username) && data.username.length > 0) {
                    message = data.username[0];
                } else if (Array.isArray(data.password) && data.password.length > 0) {
                    message = data.password[0];
                } else if (Array.isArray(data.email) && data.email.length > 0) {
                    message = data.email[0];
                } else {
                    const values = Object.values(data);
                    if (values.length > 0 && Array.isArray(values[0]) && values[0].length > 0) {
                        message = values[0][0];
                    } else if (typeof data.detail === 'string') {
                        message = data.detail;
                    } else if (typeof data === 'string') {
                        message = data.substring(0, 120);
                    }
                }
            } else if (error.message) {
                message = message + ' (' + error.message + ' - Backend server might not be running)';
            }

            return { success: false, message };
        }
    };

    // Function to handle logging a user out
    const logoutUser = () => {
        // Clear tokens from state
        setAuthTokens(null);
        // Clear user data from state
        setUser(null);
        localStorage.removeItem('authTokens');
        localStorage.removeItem('authUser');
        // Redirect the user back to the login page
        navigate('/login');
    };

    // useEffect hook to setup Axios interceptors whenever the token or navigate function changes
    // Interceptors let us run code automatically before every request or after every response
    useEffect(() => {
        // Intercept all outgoing API requests
        const reqInterceptor = api.interceptors.request.use((config) => {
            // If we have an authentication token, automatically attach it as a Bearer token in the headers
            if (authTokens) {
                config.headers.Authorization = `Bearer ${authTokens.access}`;
            }
            // Return the modified configuration so the request continues
            return config;
        });

        // Intercept all incoming API responses to handle potential errors globally
        const resInterceptor = api.interceptors.response.use(
            // If the response is successful, just pass it along
            (response) => response,
            // If an error occurred...
            (error) => {
                // Check if it's a 401 Unauthorized error (meaning token expired or invalid)
                // Also ensure we aren't already trying to hit the token endpoint itself (prevents infinite loops)
                if (error.response?.status === 401 && !error.config.url.includes('token')) {
                    // Force the user to log out since their session is invalid
                    logoutUser();
                }
                // Reject the promise so the component making the request can still catch the error
                return Promise.reject(error);
            }
        );

        // Cleanup function: remove the interceptors when the component unmounts or dependencies change
        // This prevents memory leaks and overlapping interceptors
        return () => {
            api.interceptors.request.eject(reqInterceptor);
            api.interceptors.response.eject(resInterceptor);
        };
    }, [authTokens, navigate]); // Re-run this effect if authTokens or navigate change

    // useEffect hook to handle initial application load state
    useEffect(() => {
        // Check if we loaded tokens from localStorage initially
        if (authTokens) {
            const storedUser = localStorage.getItem('authUser');
            if (storedUser) {
                try {
                    setUser(JSON.parse(storedUser));
                } catch {
                    setUser({ loggedIn: true });
                }
            } else {
                setUser({ loggedIn: true });
            }
        }
        // Set loading to false once we're done checking so the app can render
        setLoading(false);
    }, [authTokens]); // Run when authTokens change on initial load

    // Bundle all the state and functions we want to expose to other components into one object
    const contextData = {
        user,
        authTokens,
        authLoading: loading,
        loginUser,
        registerUser,
        logoutUser,
    };

    return (
        <AuthContext.Provider value={contextData}>
            {loading ? (
                <div className="app-loading-screen">
                    <div className="app-loading-spinner" />
                    <p>Loading...</p>
                </div>
            ) : (
                children
            )}
        </AuthContext.Provider>
    );
};

// Export the Context object itself so other components can consume it using useContext
export default AuthContext;
