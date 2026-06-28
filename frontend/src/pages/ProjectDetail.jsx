// Import React hooks: useState (local state), useEffect (side effects/lifecycle), useRef (DOM referencing)
import { useState, useEffect, useRef } from 'react';
// Import routing hooks: useParams to get the ID from the URL window, Link for navigation
import { useParams, Link } from 'react-router-dom';
// Import various UI icons from lucide-react
import { ChevronLeft, UploadCloud, Image as ImageIcon, Sparkles, Trash2, ChevronDown, ChevronUp, Globe, Lock, Heart, MessageCircle } from 'lucide-react';
// Import a library to render Markdown text as HTML elements (used for the AI feedback)
import ReactMarkdown from 'react-markdown';
// Import our custom component for displaying long AI feedback in a collapsible way
import ExpandableFeedback from '../components/ExpandableFeedback';
import PrivacyConsentModal from '../components/PrivacyConsentModal';
import CommentsPanel from '../components/CommentsPanel';
import api, {
    downloadProjectReport,
    uploadProjectArchive,
    cancelArchiveUpload,
    MAX_ZIP_UPLOAD_MB,
    updateProjectVisibility,
    updateDesignVisibility,
    MEDIA_BASE,
} from '../api';
// Import component-specific CSS styles
import './ProjectDetail.css';

// Define the ProjectDetail page component
const ProjectDetail = () => {
    // Extract the 'id' parameter from the current URL route (e.g., from /project/[id])
    const { id } = useParams();

    // State to store all the details of the currently viewed project (including nested designs)
    const [project, setProject] = useState(null);
    // State to show a loading screen while initially fetching the project data
    const [minimizedDesigns, setMinimizedDesigns] = useState([]);
    const toggleMinimize = (id) => {
      setMinimizedDesigns(prev =>
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    };    // State to show a spinner/overlay while a new image is being uploaded to the backend
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadingZip, setUploadingZip] = useState(false);
    const [showPrivacyModal, setShowPrivacyModal] = useState(false);
    const [showComments, setShowComments] = useState(false);

    // Create a reference to the hidden file <input> element so we can trigger it programmatically
    const fileInputRef = useRef(null);
    const zipInputRef = useRef(null);

    // useEffect hook to fetch project details when the component mounts or the ID changes
    useEffect(() => {
        // Fetch the data immediately
        fetchProject();

        // Since AI feedback generation happens asynchronously in the background,
        // we set up a polling interval to re-fetch the project data every 5 seconds.
        // This ensures the UI updates automatically once the AI finishes analyzing a new design.
        const interval = setInterval(fetchProject, 5000);

        // Cleanup function: Clear the interval when the user navigates away from this page
        return () => clearInterval(interval);
    }, [id]); // This effect depends on the URL 'id'. If the ID changes, it restarts.

    // Async function to request the full project data from the API
    const fetchProject = async () => {
        try {
            // Make a GET request to the specific project's endpoint
            const response = await api.get(`projects/${id}/`);
            // Update the state with the received data
            setProject(response.data);
        } catch (error) {
            // Log any errors if the request fails
            console.error('Error fetching project details:', error);
        } finally {
            // Turn off the initial loading spinner regardless of success/failure
            setLoading(false);
        }
    };

    // Async function triggered when the user selects a file from the upload dialog
    const handleFileUpload = async (event) => {
        // Extract the first file from the input element
        const file = event.target.files[0];
        // If no file was selected (user cancelled), do nothing
        if (!file) return;

        // Set the uploading state to true to show the UI spinner
        setUploading(true);

        // Use FormData instead of standard JSON because we are sending an actual file binary
        const formData = new FormData();
        // Append the image file
        formData.append('image', file);
        // Append the ID of the project this design belongs to
        formData.append('project', id);

        try {
            // Make a POST request to the designs endpoint, specifically setting the content-type
            // so Django knows to expect a multipart file upload instead of JSON
            await api.post('designs/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            // Re-fetch the project immediately so the user sees the new design card show up.
            // Note: the backend handles the AI analysis in a separate thread, so the design
            // will likely show "Generating Feedback..." initially.
            fetchProject();
        } catch (error) {
            // Log errors and alert the user if the upload failed
            console.error('Error uploading design:', error);
            alert('Failed to upload design. Check console.');
        } finally {
            // Turn off the uploading spinner
            setUploading(false);
            // Reset the value of the hidden file input. If we don't do this, 
            // the user couldn't upload the exact same file twice in a row because the onChange wouldn't fire.
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const handleZipUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        const ext = file.name.split('.').pop().toLowerCase();
        if (ext !== 'zip') {
            alert('Invalid file format. Please upload a valid .zip file containing your project designs and source code.');
            if (zipInputRef.current) zipInputRef.current.value = '';
            return;
        }

        const maxBytes = MAX_ZIP_UPLOAD_MB * 1024 * 1024;
        if (file.size > maxBytes) {
            alert(`ZIP file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is ${MAX_ZIP_UPLOAD_MB} MB.`);
            if (zipInputRef.current) zipInputRef.current.value = '';
            return;
        }

        setUploadingZip(true);
        try {
            const response = await uploadProjectArchive(id, file);
            if (response.status === 202) {
                alert('ZIP uploaded successfully. AI analysis is running — this may take several minutes for large projects.');
            } else {
                alert('ZIP archive uploaded and analyzed successfully! Overall project feedback has been updated.');
            }
            fetchProject();
        } catch (error) {
            console.error('Error uploading ZIP archive:', error);
            const data = error.response?.data;
            let detailMsg = data?.detail || data?.error_message || error.message || 'Unknown error occurred.';
            if (data?.secret_scan?.findings?.length) {
                const findings = data.secret_scan.findings
                    .slice(0, 5)
                    .map((f) => `• ${f.file}: ${f.details}`)
                    .join('\n');
                detailMsg = `${detailMsg}\n\n${findings}`;
            }
            alert(`Failed to upload ZIP archive:\n\n${detailMsg}`);
        } finally {
            setUploadingZip(false);
            if (zipInputRef.current) zipInputRef.current.value = '';
        }
    };

    const [cancelling, setCancelling] = useState(false);

    const handleCancelUpload = async () => {
        if (!project?.latest_archive_id) {
            alert('No active upload found to cancel.');
            return;
        }
        if (!window.confirm('Are you sure you want to cancel the project analysis?')) return;
        setCancelling(true);
        try {
            await cancelArchiveUpload(project.latest_archive_id);
            alert('Cancellation request sent successfully.');
            fetchProject();
        } catch (error) {
            console.error('Error cancelling upload:', error);
            alert(error.response?.data?.detail || 'Failed to cancel the upload.');
        } finally {
            setCancelling(false);
        }
    };

    const isArchiveProcessing = project?.archive_status === 'processing' || uploadingZip;
    const archiveFailed = project?.archive_status === 'failed';
    const openZipPicker = () => zipInputRef.current?.click();

    const handleProjectVisibility = async () => {
        const currentlyPublic = Boolean(project.is_public);
        const next = !currentlyPublic;

        if (currentlyPublic) {
            const confirmed = window.confirm(
                'Make this project private?\n\nIt will be removed from your public portfolio and all designs in this project will be set to private.'
            );
            if (!confirmed) return;
        }

        try {
            const updated = await updateProjectVisibility(id, next);
            setProject(updated);
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to update project visibility.');
        }
    };

    const handleDesignVisibility = async (designId, current) => {
        try {
            await updateDesignVisibility(designId, !current);
            setProject((prev) => ({
                ...prev,
                designs: prev.designs.map((d) =>
                    d.id === designId ? { ...d, is_public: !current } : d
                ),
            }));
        } catch (err) {
            alert(err.response?.data?.detail || 'Failed to update design visibility.');
        }
    };

    // Async function to handle deleting a specific design within the project
    const handleDeleteDesign = async (designId) => {
        // Show a confirmation dialog before proceeding
        if (!window.confirm('Are you sure you want to delete this design analysis?')) return;

        try {
            // Send a DELETE request to the specific design endpoint
            await api.delete(`designs/${designId}/`);

            // Optimistically update the UI by removing the deleted design from the local state
            // without waiting to re-fetch the entire project from the server.
            setProject(prev => ({
                ...prev, // Keep all existing project properties
                // Filter out the design that matches the ID we just deleted
                designs: prev.designs.filter(d => d.id !== designId)
            }));
        } catch (error) {
            // Handle and display error if deletion fails
            console.error('Error deleting design:', error);
            alert('Failed to delete design.');
        }
    };

    // Conditional render: If we don't have data yet and are still making the initial fetch
    if (loading && !project) {
        return <div className="loading-state animate-fade-in">Loading project details...</div>;
    }

    // Conditional render: If loading finished but project is still null (e.g., deleted or invalid ID)
    if (!project) {
        return <div className="empty-state">Project not found.</div>;
    }



    return (
        <div className="project-detail-container animate-fade-in">
            <PrivacyConsentModal
                isOpen={showPrivacyModal}
                onClose={() => setShowPrivacyModal(false)}
                onConfirm={() => {
                    setShowPrivacyModal(false);
                    openZipPicker();
                }}
            />
            {/* Navigation link to go back to the dashboard */}
            <Link to="/" className="back-link">
                <ChevronLeft size={20} /> Back to Projects
            </Link>

            {/* Header displaying project title, description, and creation date */}
            <div className="project-header glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
  <div style={{ flex: 1, minWidth: '250px' }}>
    <h1 className="gradient-text">{project.title}</h1>
    <p className="project-desc">{project.description}</p>
    <span className="project-date">Created {new Date(project.created_at).toLocaleDateString()}</span>
    <span className={`visibility-badge ${project.is_public ? 'public' : 'private'}`}>
      {project.is_public ? 'Portfolio: Public' : 'Portfolio: Private'}
    </span>
  </div>
  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
    <button
      className={`glass-button visibility-toggle ${project.is_public ? 'is-public' : 'is-private'}`}
      onClick={handleProjectVisibility}
      disabled={project.archive_status !== 'ready'}
      title={project.archive_status !== 'ready' ? 'Upload and process a project ZIP archive before making it public.' : project.is_public ? 'Make Private' : 'Make Public'}
      style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '0.85rem',
          cursor: project.archive_status !== 'ready' ? 'not-allowed' : 'pointer',
          opacity: project.archive_status !== 'ready' ? 0.6 : 1
      }}
    >
      {project.is_public ? <Lock size={16} /> : <Globe size={16} />}
      {project.is_public ? 'Make Private' : 'Make Public'}
    </button>
    <button
      className="glass-button"
      onClick={() => setShowComments((prev) => !prev)}
      style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem' }}
    >
      {showComments ? <ChevronLeft size={16} /> : <MessageCircle size={16} />}
      {showComments
        ? 'Back to Overview'
        : `Comments${(project.comment_count ?? 0) > 0 ? ` (${project.comment_count})` : ''}`}
    </button>
    {project.is_public && (
      <Link
        to={`/portfolio/${project.user}/project/${project.id}`}
        state={{ fromProject: project.id }}
        className="glass-button"
        style={{ fontSize: '0.85rem', textDecoration: 'none' }}
      >
        View Public Page
      </Link>
    )}
  </div>
  {/* Download full project PDF report - only if feedback is available */}
  {project.project_feedback && (
    <button 
      className="download-report-button glass-button" 
      onClick={async () => {
        try {
          await downloadProjectReport(id);
        } catch (err) {
          console.error('Error downloading report:', err);
          alert('Failed to download project report. Please try again.');
        }
      }}
      style={{ padding: '10px 20px', display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <Sparkles size={16} /> Download Project Report
    </button>
  )}
  {/* Delete overall project feedback */}
  {project.project_feedback && (
    <button
      className="delete-feedback-button glass-button"
      onClick={async () => {
        if (!window.confirm('Delete overall project feedback? This will also delete the report PDF.')) return;
        try {
          await api.delete(`projects/${id}/feedback/`);
          // Optimistically clear feedback in UI
          setProject(prev => ({ ...prev, project_feedback: null }));
        } catch (err) {
          console.error('Failed to delete feedback', err);
          alert('Error deleting feedback. See console for details.');
        }
      }}
      style={{ marginLeft: '12px', backgroundColor: 'var(--error)', color: '#fff' }}
    >
      Delete Feedback
    </button>
  )}
</div>

            {showComments && (
              <CommentsPanel
                projectId={id}
                isOpen={showComments}
                inline
                onClose={() => setShowComments(false)}
              />
            )}

            {!showComments && (
            <>
            {isArchiveProcessing && !project.project_feedback && (
              <div className="project-feedback-section glass-panel archive-progress-panel">
                <h2 className="feed-title">Analyzing Project Archive</h2>
                <p className="archive-progress-message">
                  {project.archive_progress?.message || 'AI is reviewing your ZIP contents. Large projects may take several minutes.'}
                </p>
                {project.archive_progress?.current_batch > 0 && project.archive_progress?.total_batches > 0 && (
                  <p className="archive-progress-batch">
                    Batch {project.archive_progress.current_batch} of {project.archive_progress.total_batches}
                  </p>
                )}
                {project.archive_progress?.files_selected > 0 && (
                  <p className="archive-progress-meta">
                    {project.archive_progress.files_selected} files selected
                    {project.archive_progress.files_discovered
                      ? ` from ${project.archive_progress.files_discovered} discovered`
                      : ''}
                  </p>
                )}
                <div className="archive-progress-bar" role="progressbar" aria-valuenow={project.archive_progress?.percent || 0} aria-valuemin="0" aria-valuemax="100">
                  <div
                    className="archive-progress-bar-fill"
                    style={{ width: `${project.archive_progress?.percent || 5}%` }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <p className="archive-progress-percent" style={{ margin: 0 }}>{project.archive_progress?.percent ?? 5}%</p>
                  {project.latest_archive_id && (
                    <button
                      className="glass-button"
                      onClick={handleCancelUpload}
                      disabled={cancelling}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--error)', color: '#fff', border: 'none' }}
                    >
                      {cancelling ? 'Cancelling...' : 'Cancel Upload'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {archiveFailed && (
              <div className="project-feedback-section glass-panel" style={{ marginBottom: '20px', padding: '15px', borderColor: 'var(--error)' }}>
                <h2 className="feed-title">Archive Analysis Failed</h2>
                <p>{project.archive_error || 'An unknown error occurred while processing the ZIP archive.'}</p>
              </div>
            )}

            {/* Project aggregated feedback */}
            {project.project_feedback && (
              <div className="project-feedback-section glass-panel" style={{marginBottom: '20px', padding: '15px'}}>
                <h2 className="feed-title">Overall Project Feedback</h2>
                <p><strong>UI Score:</strong> {project.project_feedback.ui_score}</p>
                <p><strong>UX Score:</strong> {project.project_feedback.ux_score}</p>
                <ExpandableFeedback text={project.project_feedback.raw_analysis} />
              </div>
            )}


            {/* Section containing the upload dropzone / button */}
            <div className="upload-section" style={{ display: 'flex', gap: '20px', flexWrap: 'wrap', marginBottom: '30px' }}>
                {/* ZIP Project Upload */}
                {!project.project_feedback && !isArchiveProcessing ? (
                    <div
                        className={`upload-dropzone glass-panel ${uploadingZip ? 'uploading' : ''}`}
                        style={{ flex: 1, minWidth: '280px', cursor: 'pointer' }}
                        onClick={() => !uploadingZip && setShowPrivacyModal(true)}
                    >
                        {/* Hidden file input controlled by React refs */}
                        <input
                            type="file"
                            ref={zipInputRef}
                            onChange={handleZipUpload}
                            accept=".zip" // Restrict file picker to ZIP archives only
                            style={{ display: 'none' }}
                        />

                        {/* Conditional rendering inside the dropzone based on upload state */}
                        {uploadingZip ? (
                            <div className="upload-content">
                                <Sparkles className="spin-icon" size={48} style={{ color: 'var(--accent)' }} />
                                <h3>Extracting ZIP...</h3>
                                <p>Scanning project with Groq AI</p>
                            </div>
                        ) : (
                            <div className="upload-content">
                                <UploadCloud size={48} className="upload-icon" style={{ color: 'var(--accent)' }} />
                                <h3>Upload Project ZIP</h3>
                                <p>Click or drag a ZIP archive (up to {MAX_ZIP_UPLOAD_MB} MB) to analyze your project and auto-generate design pages</p>
                            </div>
                        )}
                    </div>
                ) : (
                    <div
                        className="upload-dropzone glass-panel disabled"
                        style={{ flex: 1, minWidth: '280px', cursor: 'not-allowed', opacity: 0.6 }}
                    >
                        <div className="upload-content">
                            <UploadCloud size={48} className="upload-icon" style={{ color: 'var(--text-muted)' }} />
                            <h3>{isArchiveProcessing ? 'ZIP Archive Processing' : 'ZIP Archive Already Uploaded'}</h3>
                            <p>{isArchiveProcessing ? 'Please wait while AI analyzes your project files' : 'Delete overall project feedback to upload a new one'}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Section listing all previously uploaded and analyzed designs */}
            <div className="designs-feed">
                <h2 className="feed-title">Analyzed Designs ({project.designs?.length || 0})</h2>

                {/* Conditional rendering if the project has no designs yet */}
                {project.designs?.length === 0 ? (
                    <div className="empty-state glass-panel">
                        <ImageIcon size={48} className="empty-icon" />
                        <p>No designs uploaded yet.</p>
                    </div>
                ) : (
                    <div className="designs-list">
                        {/* List of designs */}
                        {project.designs.map((design) => (

                            <div key={design.id} className="design-card glass-panel">
                                {/* Left side: The uploaded image */}
                                <div className="design-image-container">
                                    {/* Prepend the backend URL since Django serializers return relative media paths */}
                                    <img src={`${MEDIA_BASE}${design.image}`} alt="Design" className="design-image" />
                                </div>

                                {/* Right side: Details and AI Feedback */}
                                <div className="design-feedback">
                                    {/* Header for the specific design with timestamp and delete/minimize buttons */}
                                    <div className="feedback-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                      <div>
                                        <h3>AI Analysis</h3>
                                        <span className="upload-time">{new Date(design.uploaded_at).toLocaleString()}</span>
                                      </div>
                                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button
                                          className="glass-button"
                                          onClick={() => handleDesignVisibility(design.id, design.is_public)}
                                          title={design.is_public ? 'Make design private' : 'Make design public'}
                                          style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                                        >
                                          {design.is_public ? <Globe size={14} /> : <Lock size={14} />}
                                        </button>
                                        {(design.like_count ?? 0) > 0 && (
                                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Heart size={14} /> {design.like_count}
                                          </span>
                                        )}
                                        <button className="glass-button" onClick={() => toggleMinimize(design.id)} title="Toggle Feedback">
                                          {minimizedDesigns.includes(design.id) ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
                                        </button>
                                        <button
                                          className="glass-button"
                                          style={{ padding: '6px', color: 'var(--error)' }}
                                          onClick={() => handleDeleteDesign(design.id)}
                                          title="Delete Design"
                                        >
                                          <Trash2 size={16} />
                                        </button>
                                      </div>
                                    </div>

                                    {/* Feedback content – hidden when minimized */}
                                    {!minimizedDesigns.includes(design.id) && (
                                      <>
                                        <div className="score-cards">
                                          <div className="score-card ui-score">
                                            <span className="score-label">UI Design</span>
                                            <span className="score-value">
                                              {design.feedback?.ui_score}<small>/10</small>
                                            </span>
                                          </div>
                                          <div className="score-card ux-score">
                                            <span className="score-label">UX Usability</span>
                                            <span className="score-value">
                                              {design.feedback?.ux_score}<small>/10</small>
                                            </span>
                                          </div>
                                        </div>
                                        {design.feedback ? (
                                          <ExpandableFeedback text={design.feedback.raw_analysis} />
                                        ) : (
                                          <div className="generating-feedback">
                                            <span>AI is currently generating feedback...</span>
                                          </div>
                                        )}
                                      </>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
            </>
            )}
        </div>
    );
};

// Export the component as default
export default ProjectDetail;
