// Import StrictMode from React to highlight potential problems in an application during development
import { StrictMode } from 'react'
// Import createRoot from ReactDOM to render the React element tree into the real DOM
import { createRoot } from 'react-dom/client'
// Import global CSS styles that apply to the entire application
import './index.css'
// Import the root App component which contains our routing and layout
import App from './App.jsx'

// Find the HTML element with the ID 'root' (usually in index.html)
// Create a React root there and render our application tree into it
createRoot(document.getElementById('root')).render(
  // Wrap the App in StrictMode to catch common bugs early in development (e.g., side effects, deprecated lifecycles)
  <StrictMode>
    {/* Render the main App component */}
    <App />
  </StrictMode>,
)
