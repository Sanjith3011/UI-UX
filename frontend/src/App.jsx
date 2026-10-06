// Import routing components from React Router for handling multiple paths in our single-page application
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
// Import the global navigation bar component that appears on (almost) all pages
import Navbar from './components/Navbar';
// Import the main Dashboard page
import Home from './pages/Home';
import HybridUpload from './pages/HybridUpload';
// Import the detail page that shows a specific project
import ProjectDetail from './pages/ProjectDetail';
// Import the user login page
import Login from './pages/Login';
// Import the user registration page
import Register from './pages/Register';
import Privacy from './pages/Privacy';
import Explore from './pages/Explore';
import PublicProfile from './pages/PublicProfile';
import PublicProject from './pages/PublicProject';
import Friends from './pages/Friends';
import Chat from './pages/Chat';
// Import the Context Provider that manages and provides global authentication state
import { AuthProvider } from './context/AuthContext';
// Import a custom wrapper component that prevents unauthenticated users from accessing private routes
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';

// Define the root App component that wraps the entire application
function App() {
  return (
    // Router provides the routing context for all nested Link and Route components
    <Router>
      {/* AuthProvider wraps the application so any component can access the user's login state */}
      <AuthProvider>
        {/* Main wrapper div for global styling (e.g., dark background) */}
        <div className="app-wrapper">
          {/* Render the Navbar permanently at the top of the app */}
          <Navbar />
          {/* The main content area where different pages will be rendered based on the URL */}
          <main className="container" style={{ padding: '40px 24px' }}>
            {/* Routes acts like a switch, rendering only the FIRST Route that matches the current URL */}
            <ErrorBoundary>
            <Routes>
              {/* Public route: Anyone can access the /login page */}
              <Route path="/login" element={<Login />} />
              {/* Public route: Anyone can access the /register page */}
              <Route path="/register" element={<Register />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/explore" element={<Explore />} />
              <Route path="/portfolio/:username" element={<PublicProfile />} />
              <Route path="/portfolio/:username/project/:projectId" element={<PublicProject />} />

              {/* Hybrid Upload - protected */}
<Route
  path="/hybrid-upload"
  element={
    <ProtectedRoute>
      <HybridUpload />
    </ProtectedRoute>
  }
/>
{/* Private route: The root path (/) points to the Home page */}
              {/* It is wrapped in ProtectedRoute, which will redirect to /login if the user isn't logged in */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Home />
                  </ProtectedRoute>
                }
              />

              {/* Private route: Connections & Network */}
              <Route
                path="/friends"
                element={
                  <ProtectedRoute>
                    <Friends />
                  </ProtectedRoute>
                }
              />

              {/* Private route: Direct Messages */}
              <Route
                path="/chat"
                element={
                  <ProtectedRoute>
                    <Chat />
                  </ProtectedRoute>
                }
              />

              {/* Private route: Path containing a dynamic ID parameter (/project/:id) */}
              {/* Also protected so only logged-in users can view project details */}
              <Route
                path="/project/:id"
                element={
                  <ProtectedRoute>
                    <ProjectDetail />
                  </ProtectedRoute>
                }
              />
            </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </AuthProvider>
    </Router>
  );
}

// Export the App component as the default export so it can be mounted in main.jsx
export default App;
