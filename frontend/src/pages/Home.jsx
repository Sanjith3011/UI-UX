// Import React hooks for managing state and side-effects
import { useState, useEffect, useContext } from 'react';
// Import routing components to link between pages and programmatically navigate
import { Link, useNavigate } from 'react-router-dom';
// Import specific icons from the lucide-react library for the UI
import { Plus, Folder, Trash2, UploadCloud, MessageSquare, Heart, Sparkles, AlertCircle } from 'lucide-react';
// Import our custom configured Axios instance to make API calls to the backend
import api, { fetchFeed } from '../api';
import AuthContext from '../context/AuthContext';
// Import the component-specific CSS file for styling
import './Home.css';

// Define the Home component, which serves as the main dashboard for logged-in users
const Home = () => {
    const { user } = useContext(AuthContext);

    // State to hold the list of projects fetched from the backend
    const [projects, setProjects] = useState([]);
    // State to track if data is currently being loaded (used to show a loading spinner/message)
    const [loading, setLoading] = useState(true);
    // State to control the visibility of the "Create Project" modal popup
    const [isModalOpen, setIsModalOpen] = useState(false);
    // State to bind to the "New Project Title" input field in the modal
    const [newTitle, setNewTitle] = useState('');
    // State to bind to the "New Project Description" textarea in the modal
    const [newDescription, setNewDescription] = useState('');

    // Social feed states
    const [feedItems, setFeedItems] = useState([]);
    const [loadingFeed, setLoadingFeed] = useState(true);

    // Initialize the navigation hook to redirect users after creating a project
    const navigate = useNavigate();

    // useEffect hook to run code when the component first mounts (loads on screen)
    useEffect(() => {
        // Call the functions to fetch projects and feed data immediately when the page loads
        fetchProjects();
        fetchFeedData();
    }, []); // The empty dependency array [] means this runs exactly once on mount

    // Async function to request the user's projects from the Django backend
    const fetchProjects = async () => {
        try {
            // Make a GET request to the /api/projects/ endpoint
            const response = await api.get('projects/');
            // Update the projects state with the array of project data returned by the API
            setProjects(response.data);
        } catch (error) {
            // Log any network or server errors to the console
            console.error('Error fetching projects:', error);
        } finally {
            // Regardless of success or failure, stop showing the loading state
            setLoading(false);
        }
    };

    const fetchFeedData = async () => {
        try {
            setLoadingFeed(true);
            const data = await fetchFeed();
            setFeedItems(data);
        } catch (error) {
            console.error('Error fetching feed data:', error);
        } finally {
            setLoadingFeed(false);
        }
    };

    // Async function to handle the submission of the "Create Project" form
    const handleCreateProject = async (e) => {
        // Prevent the default HTML form submission behavior (which refreshes the whole page)
        e.preventDefault();

        // Validation: Ensure the title isn't just empty spaces before sending a request
        if (!newTitle.trim()) return;

        try {
            // Make a POST request to create a new project with the form data
            const response = await api.post('projects/', {
                title: newTitle,
                description: newDescription
            });

            // Optimistically update the local state: add the newly created project to the beginning of the list
            setProjects([response.data, ...projects]);

            // Close the creation modal
            setIsModalOpen(false);

            // Reset the form fields back to empty for the next time the modal is opened
            setNewTitle('');
            setNewDescription('');

            // Automatically redirect the user to the newly created project's detail page
            navigate(`/project/${response.data.id}`);
        } catch (error) {
            // Log any errors that occur during project creation
            console.error('Error creating project:', error);
        }
    };

    // Async function to handle deleting an existing project
    const handleDeleteProject = async (id, e) => {
        // Prevent the click event from "bubbling up" to the parent Link component,
        // which would accidentally navigate the user to the project they're trying to delete
        e.preventDefault();

        // Show a standard browser confirmation dialog before acting
        if (!window.confirm('Are you sure you want to delete this project?')) return;

        try {
            // Make a DELETE request to the specific project's API endpoint
            await api.delete(`projects/${id}/`);

            // Update the local state by filtering out the project that was just deleted,
            // removing it from the UI immediately without needing to refresh the page
            setProjects(projects.filter(p => p.id !== id));
        } catch (error) {
            // Log any errors that occur during deletion
            console.error('Error deleting project:', error);
        }
    };

    // Helper to get matching icons and styling for activity feed items
    const renderFeedIcon = (type) => {
        switch (type) {
            case 'project_created':
                return <Folder size={16} className="feed-item-icon project-icon" />;
            case 'zip_uploaded':
                return <UploadCloud size={16} className="feed-item-icon zip-icon" />;
            case 'comment_added':
                return <MessageSquare size={16} className="feed-item-icon comment-icon" />;
            case 'design_liked':
                return <Heart size={16} className="feed-item-icon like-icon" />;
            default:
                return <Sparkles size={16} className="feed-item-icon default-icon" />;
        }
    };

    const getProjectLink = (item) => {
        if (item.owner_username === user?.username) {
            return `/project/${item.project_id}`;
        } else {
            return `/portfolio/${item.owner_username}/project/${item.project_id}`;
        }
    };

    // The JSX layout rendered by the component
    return (
        // Main container with an animation class for a smooth fade-in effect
        <div className="home-container animate-fade-in">
            {/* Header section containing the title and the "New Project" button */}
            <div className="home-header">
                <div>
                    <h1 className="home-title">Projects Dashboard</h1>
                    <p className="home-subtitle">Manage and analyze your UI/UX designs</p>
                </div>
                {/* Button that opens the modal when clicked */}
                <button className="glass-button create-btn" onClick={() => setIsModalOpen(true)}>
                    <Plus size={20} />
                    New Project
                </button>
            </div>

            {/* Split layout: Dashboard main section and Activity feed */}
            <div className="home-split-layout">
                {/* Left side: user's projects list */}
                <div className="dashboard-main-col">
                    {loading ? (
                        // If currently fetching data, show a loading message
                        <div className="loading-state">Loading projects...</div>
                    ) : projects.length === 0 ? (
                        // If data is loaded but the user has 0 projects, show a friendly empty state
                        <div className="empty-state glass-panel">
                            <Folder size={48} className="empty-icon" />
                            <h3>No projects yet</h3>
                            <p>Create your first project to start analyzing designs.</p>
                        </div>
                    ) : (
                        // If data is loaded and projects exist, render them in a CSS grid
                        <div className="project-grid">
                            {/* Iterate over the projects array and render a card for each one */}
                            {projects.map((project) => (
                                // Each card is a Link, so clicking anywhere on the card navigates to its detail page
                                <Link to={`/project/${project.id}`} key={project.id} className="project-card glass-panel">
                                    {/* Card Header: Title, Date, and Delete Button */}
                                    <div className="project-card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div>
                                            <h3>{project.title}</h3>
                                            {/* Format the raw ISO date string into a readable local date format */}
                                            <span className="project-date">
                                                {new Date(project.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                        {/* Delete button */}
                                        <button
                                            className="glass-button"
                                            style={{ padding: '6px', color: 'var(--error)' }}
                                            onClick={(e) => handleDeleteProject(project.id, e)}
                                            title="Delete Project"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                    {/* Card Body: Show the description or a fallback text if it's empty */}
                                    <p className="project-desc">{project.description || 'No description provided.'}</p>
                                    {/* Card Footer: Show how many designs are inside the project */}
                                    <div className="project-footer">
                                        <span className="design-count">
                                            {/* Use optional chaining (?.) just in case the designs array is missing */}
                                            {project.designs?.length || 0} designs
                                        </span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Right side: General Activity Feed */}
                <div className="dashboard-feed-col glass-panel">
                    <div className="feed-header">
                        <Sparkles size={18} className="feed-header-icon" />
                        <h2>Global Design Feed</h2>
                    </div>

                    <div className="feed-content-scroll">
                        {loadingFeed ? (
                            <div className="feed-loading">
                                <div className="app-loading-spinner" />
                            </div>
                        ) : feedItems.length === 0 ? (
                            <div className="feed-empty-state">
                                <AlertCircle size={28} className="text-muted" />
                                <p>No recent activity. Connect with friends to see updates here!</p>
                            </div>
                        ) : (
                            <div className="feed-items-list">
                                {feedItems.map((item, index) => (
                                    <Link to={getProjectLink(item)} key={index} className="feed-item-card">
                                        <div className="feed-item-header">
                                            {renderFeedIcon(item.type)}
                                            <span className="feed-username">{item.username}</span>
                                            <span className="feed-time">
                                                {new Date(item.timestamp).toLocaleDateString()}
                                            </span>
                                        </div>
                                        <p className="feed-item-title">{item.title}</p>
                                        {item.details && <p className="feed-item-details">{item.details}</p>}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Modal Popup Component (Conditionally rendered only if isModalOpen is true) */}
            {isModalOpen && (
                // The dark overlay behind the modal. Clicking it closes the modal.
                <div className="modal-overlay animate-fade-in" onClick={() => setIsModalOpen(false)}>
                    {/* The actual modal box. e.stopPropagation() prevents clicks inside the white box from closing it */}
                    <div className="modal-content glass-panel" onClick={e => e.stopPropagation()}>
                        <h2>Create New Project</h2>
                        {/* The form bound to our handleCreateProject function */}
                        <form onSubmit={handleCreateProject}>
                            <div className="form-group">
                                <label>Project Title</label>
                                {/* Input bound to the newTitle state */}
                                <input
                                    type="text"
                                    className="glass-input"
                                    value={newTitle}
                                    onChange={e => setNewTitle(e.target.value)}
                                    placeholder="e.g. E-Commerce Redesign"
                                    autoFocus // Automatically highlights this field when the modal opens
                                />
                            </div>
                            <div className="form-group">
                                <label>Description (Optional)</label>
                                {/* Textarea bound to the newDescription state */}
                                <textarea
                                    className="glass-input"
                                    value={newDescription}
                                    onChange={e => setNewDescription(e.target.value)}
                                    rows="3"
                                />
                            </div>
                            {/* Actions area with Cancel and Submit buttons */}
                            <div className="modal-actions">
                                <button type="button" className="glass-button secondary" onClick={() => setIsModalOpen(false)}>
                                    Cancel
                                </button>
                                {/* Submit button is disabled if the title is empty (whitespace trimmed) */}
                                <button type="submit" className="glass-button" disabled={!newTitle.trim()}>
                                    Create
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

// Export the Home component so it can be used in App.jsx routing
export default Home;
