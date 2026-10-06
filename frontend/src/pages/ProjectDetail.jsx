// Import React hooks: useState (local state), useEffect (side effects/lifecycle), useRef (DOM referencing)
import { useState, useEffect, useRef } from 'react';
// Import routing hooks: useParams to get the ID from the URL window, Link for navigation
import { useParams, Link } from 'react-router-dom';
// Import various UI icons from lucide-react
import {
    ChevronLeft, UploadCloud, Image as ImageIcon, Sparkles, Trash2,
    ChevronDown, ChevronUp, Globe, Lock, Heart, MessageCircle,
    FileText, X, Plus, CheckCircle2
} from 'lucide-react';
// Import a library to render Markdown text as HTML elements (used for the AI feedback)
import ReactMarkdown from 'react-markdown';
// Import our custom component for displaying long AI feedback in a collapsible way
import ExpandableFeedback from '../components/ExpandableFeedback';
import CommentsPanel from '../components/CommentsPanel';
import api, {
    downloadProjectReport,
    createHybridSubmission,
    updateProjectVisibility,
    updateDesignVisibility,
    MEDIA_BASE,
} from '../api';
// Import component-specific CSS styles
import './ProjectDetail.css';

// Define the ProjectDetail page component
const ProjectDetail = () => {
    const { id } = useParams();

    const [project, setProject] = useState(null);
    const [minimizedDesigns, setMinimizedDesigns] = useState([]);
    const toggleMinimize = (designId) => {
        setMinimizedDesigns(prev =>
            prev.includes(designId) ? prev.filter(i => i !== designId) : [...prev, designId]
        );
    };

    const [loading, setLoading] = useState(true);
    const [uploadingSingleImage, setUploadingSingleImage] = useState(false);
    const [submittingHybrid, setSubmittingHybrid] = useState(false);
    const [showComments, setShowComments] = useState(false);
    const [showHybridForm, setShowHybridForm] = useState(false);

    // Hybrid upload form states
    const [reportFile, setReportFile] = useState(null);
    const [promptText, setPromptText] = useState('');
    const [screenshots, setScreenshots] = useState([]);
    const [screenshotPreviews, setScreenshotPreviews] = useState([]);
    const [hybridStatus, setHybridStatus] = useState('');

    const reportInputRef = useRef(null);
    const screenshotsInputRef = useRef(null);
    const singleImageInputRef = useRef(null);

    // useEffect hook to fetch project details when the component mounts or the ID changes
    useEffect(() => {
        fetchProject();
        // Poll every 5 seconds while processing
        const interval = setInterval(fetchProject, 5000);
        return () => clearInterval(interval);
    }, [id]);

    const fetchProject = async () => {
        try {
            const response = await api.get(`projects/${id}/`);
            setProject(response.data);
        } catch (error) {
            console.error('Error fetching project details:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleReportChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'txt', 'doc'].includes(ext)) {
            alert('Please select a valid report file (.pdf, .docx, or .txt).');
            return;
        }
        setReportFile(file);
    };

    const handleScreenshotsChange = (event) => {
        const files = Array.from(event.target.files || []);
        if (!files.length) return;
        setScreenshots(prev => [...prev, ...files]);
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setScreenshotPreviews(prev => [...prev, ...newPreviews]);
        if (screenshotsInputRef.current) screenshotsInputRef.current.value = '';
    };

    const removeScreenshot = (index) => {
        setScreenshots(prev => prev.filter((_, i) => i !== index));
        setScreenshotPreviews(prev => {
            URL.revokeObjectURL(prev[index]);
            return prev.filter((_, i) => i !== index);
        });
    };

    const handleHybridSubmit = async (e) => {
        if (e) e.preventDefault();
        if (!reportFile) {
            alert('Please select a Project Report document (.pdf, .docx, or .txt).');
            return;
        }

        setSubmittingHybrid(true);
        setHybridStatus('Submitting report and screenshots...');

        const formData = new FormData();
        formData.append('project', id);
        formData.append('report_file', reportFile);
        if (promptText.trim()) {
            formData.append('prompt', promptText.trim());
        }
        screenshots.forEach((file) => {
            formData.append('screenshots', file);
        });

        try {
            await createHybridSubmission(formData);
            setHybridStatus('Submission received! AI is analyzing your report & screenshots...');
            setReportFile(null);
            setPromptText('');
            setScreenshots([]);
            setScreenshotPreviews([]);
            setShowHybridForm(false);
            if (reportInputRef.current) reportInputRef.current.value = '';
            await fetchProject();
        } catch (error) {
            console.error('Hybrid submission failed:', error);
            const detailMsg = error.response?.data?.detail || error.message || 'Submission failed.';
            alert(`Failed to submit hybrid analysis:\n\n${detailMsg}`);
            setHybridStatus('');
        } finally {
            setSubmittingHybrid(false);
        }
    };

    const handleDeleteFeedback = async () => {
        if (!window.confirm('Delete project feedback? This will allow you to submit a fresh hybrid analysis.')) return;
        try {
            await api.delete(`projects/${id}/feedback/`);
            setProject(prev => ({
                ...prev,
                project_feedback: null,
                archive_status: null,
                archive_error: null,
                archive_progress: null,
            }));
            setShowHybridForm(true);
        } catch (err) {
            console.error('Failed to delete feedback:', err);
            alert('Failed to delete feedback. See console.');
        }
    };

    const handleSingleImageUpload = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;

        setUploadingSingleImage(true);
        const formData = new FormData();
        formData.append('image', file);
        formData.append('project', id);

        try {
            await api.post('designs/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            fetchProject();
        } catch (error) {
            console.error('Error uploading design:', error);
            alert('Failed to upload design. Check console.');
        } finally {
            setUploadingSingleImage(false);
            if (singleImageInputRef.current) singleImageInputRef.current.value = '';
        }
    };

    const isProcessing = project?.archive_status === 'processing' || submittingHybrid;
    const isFailed = project?.archive_status === 'failed';

    const handleProjectVisibility = async () => {
        const currentlyPublic = Boolean(project.is_public);
        const next = !currentlyPublic;

        if (currentlyPublic) {
            const confirmed = window.confirm(
                'Make this project private?\n\nIt will be hidden from the Explore page and public portfolio viewers.'
            );
            if (!confirmed) return;
        }

        try {
            const updated = await updateProjectVisibility(id, next);
            setProject((prev) => ({
                ...prev,
                is_public: updated.is_public,
                designs: prev.designs?.map((d) => ({ ...d, is_public: updated.is_public })),
            }));
        } catch (err) {
            console.error('Failed to update project visibility:', err);
            const msg = err.response?.data?.detail || err.response?.data?.is_public || err.message || 'Failed to update visibility.';
            alert(msg);
        }
    };

    const handleDesignVisibility = async (designId, currentVal) => {
        const next = !currentVal;
        try {
            await updateDesignVisibility(designId, next);
            setProject((prev) => ({
                ...prev,
                designs: prev.designs.map((d) =>
                    d.id === designId ? { ...d, is_public: next } : d
                ),
            }));
        } catch (err) {
            console.error('Failed to update design visibility:', err);
            alert('Failed to update design visibility.');
        }
    };

    const handleDeleteDesign = async (designId) => {
        if (!window.confirm('Delete this design and its AI analysis?')) return;
        try {
            await api.delete(`designs/${designId}/`);
            setProject((prev) => ({
                ...prev,
                designs: prev.designs.filter((d) => d.id !== designId),
            }));
        } catch (error) {
            console.error('Error deleting design:', error);
            alert('Failed to delete design.');
        }
    };

    if (loading && !project) {
        return <div className="loading-state animate-fade-in">Loading project details...</div>;
    }

    if (!project) {
        return <div className="empty-state">Project not found.</div>;
    }

    const canMakePublic = project.archive_status === 'ready' || (project.designs && project.designs.length > 0) || Boolean(project.project_feedback);

    return (
        <div className="project-detail-container animate-fade-in">
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
                        disabled={!canMakePublic}
                        title={!canMakePublic ? 'Submit project for analysis or upload designs before making it public.' : project.is_public ? 'Make Private' : 'Make Public'}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '0.85rem',
                            cursor: !canMakePublic ? 'not-allowed' : 'pointer',
                            opacity: !canMakePublic ? 0.6 : 1
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

                {/* Action buttons if feedback is available */}
                {project.project_feedback && (
                    <div style={{ display: 'flex', gap: '10px', width: '100%', marginTop: '12px', flexWrap: 'wrap' }}>
                        <button
                            className="download-report-button glass-button"
                            onClick={async () => {
                                try {
                                    await downloadProjectReport(id);
                                } catch (err) {
                                    console.error('Error downloading report:', err);
                                    alert('Failed to download project report PDF.');
                                }
                            }}
                            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Sparkles size={16} /> Download Project Report
                        </button>
                        <button
                            className="glass-button"
                            onClick={() => setShowHybridForm(prev => !prev)}
                            style={{ padding: '10px 18px', display: 'flex', alignItems: 'center', gap: '8px' }}
                        >
                            <Plus size={16} /> {showHybridForm ? 'Hide Submission Form' : 'New Hybrid Submission'}
                        </button>
                        <button
                            className="glass-button"
                            onClick={handleDeleteFeedback}
                            style={{ padding: '10px 18px', backgroundColor: 'rgba(239, 68, 68, 0.2)', color: '#fca5a5' }}
                        >
                            Delete Feedback
                        </button>
                    </div>
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
                    {/* Live Processing Card */}
                    {isProcessing && (
                        <div className="project-feedback-section glass-panel archive-progress-panel" style={{ marginBottom: '25px', padding: '24px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                                <Sparkles className="spin-icon" size={24} style={{ color: 'var(--accent)', margin: 0 }} />
                                <h2 className="feed-title" style={{ margin: 0, padding: 0, border: 'none' }}>
                                    AI Hybrid Analysis In Progress
                                </h2>
                            </div>
                            <p className="archive-progress-message" style={{ margin: '0 0 16px 0', color: 'var(--text-muted)' }}>
                                {project.archive_progress?.message || 'AI is evaluating your project documentation and interface screenshots...'}
                            </p>
                            <div className="archive-progress-bar" role="progressbar">
                                <div
                                    className="archive-progress-bar-fill"
                                    style={{ width: `${project.archive_progress?.percent || 65}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Failure Card */}
                    {isFailed && (
                        <div className="project-feedback-section glass-panel" style={{ marginBottom: '20px', padding: '15px', borderColor: 'var(--error)' }}>
                            <h2 className="feed-title" style={{ color: 'var(--error)' }}>Analysis Failed</h2>
                            <p>{project.archive_error || 'An error occurred while analyzing the submission.'}</p>
                            <button className="glass-button" onClick={() => setShowHybridForm(true)} style={{ marginTop: '10px' }}>
                                Try Again
                            </button>
                        </div>
                    )}

                    {/* Project Aggregated Feedback */}
                    {project.project_feedback && (
                        <div className="project-feedback-section glass-panel" style={{ marginBottom: '30px', padding: '24px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px' }}>
                                <div>
                                    <h2 className="feed-title" style={{ margin: 0, padding: 0, border: 'none' }}>Overall Project Feedback</h2>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Synthesized from project report and UI screenshots</span>
                                </div>
                                <div style={{ display: 'flex', gap: '14px' }}>
                                    <div className="score-card ui-score" style={{ padding: '8px 16px', minWidth: '100px', textAlign: 'center' }}>
                                        <span className="score-label" style={{ fontSize: '0.75rem' }}>UI Score</span>
                                        <span className="score-value" style={{ fontSize: '1.4rem' }}>{project.project_feedback.ui_score}<small>/10</small></span>
                                    </div>
                                    <div className="score-card ux-score" style={{ padding: '8px 16px', minWidth: '100px', textAlign: 'center' }}>
                                        <span className="score-label" style={{ fontSize: '0.75rem' }}>UX Score</span>
                                        <span className="score-value" style={{ fontSize: '1.4rem' }}>{project.project_feedback.ux_score}<small>/10</small></span>
                                    </div>
                                </div>
                            </div>
                            <ExpandableFeedback text={project.project_feedback.raw_analysis} />
                        </div>
                    )}

                    {/* Hybrid Upload Section (Rendered when no feedback or user requested new upload) */}
                    {(!project.project_feedback || showHybridForm) && !isProcessing && (
                        <div className="hybrid-upload-card glass-panel" style={{ marginBottom: '32px', padding: '28px', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
                            <div className="hybrid-upload-header" style={{ marginBottom: '24px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
                                    <Sparkles size={24} style={{ color: 'var(--accent)' }} />
                                    <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Hybrid AI Project Analysis</h2>
                                </div>
                                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '0.95rem' }}>
                                    Upload your project report or design requirements documentation (PDF, DOCX, or TXT) along with interface screenshots to generate holistic UI/UX evaluations.
                                </p>
                            </div>

                            <form onSubmit={handleHybridSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '22px' }}>
                                {/* 1. Report Document */}
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                                        1. Project Documentation / Report <span style={{ color: 'var(--accent)' }}>*</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                                            (.pdf, .docx, or .txt)
                                        </span>
                                    </label>

                                    {!reportFile ? (
                                        <div
                                            className="report-dropzone glass-panel"
                                            onClick={() => reportInputRef.current?.click()}
                                            style={{
                                                padding: '28px',
                                                border: '2px dashed rgba(255, 255, 255, 0.25)',
                                                borderRadius: '12px',
                                                textAlign: 'center',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s ease',
                                                background: 'rgba(255, 255, 255, 0.02)'
                                            }}
                                        >
                                            <input
                                                type="file"
                                                ref={reportInputRef}
                                                onChange={handleReportChange}
                                                accept=".pdf,.docx,.txt,.doc"
                                                style={{ display: 'none' }}
                                            />
                                            <FileText size={38} style={{ color: 'var(--accent)', marginBottom: '8px' }} />
                                            <p style={{ margin: 0, fontWeight: 500, fontSize: '1rem' }}>Click or drag project report here</p>
                                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>PDF, Word (.docx), or plain text up to 50MB</span>
                                        </div>
                                    ) : (
                                        <div className="file-badge glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.3)' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <CheckCircle2 size={20} style={{ color: 'var(--success)' }} />
                                                <span style={{ fontWeight: 500 }}>{reportFile.name}</span>
                                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>({(reportFile.size / 1024).toFixed(1)} KB)</span>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => { setReportFile(null); if (reportInputRef.current) reportInputRef.current.value = ''; }}
                                                className="glass-button"
                                                style={{ padding: '6px 10px', fontSize: '0.8rem', background: 'transparent' }}
                                                title="Remove file"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* 2. Custom Prompt */}
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                                        2. Review Focus & Instructions <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                                    </label>
                                    <textarea
                                        value={promptText}
                                        onChange={(e) => setPromptText(e.target.value)}
                                        placeholder="What should the AI prioritize? (e.g., heuristic usability, color contrast, checkout conversion, mobile navigation clarity...)"
                                        rows={3}
                                        style={{
                                            width: '100%',
                                            padding: '12px 14px',
                                            borderRadius: '8px',
                                            background: 'rgba(255, 255, 255, 0.04)',
                                            border: '1px solid rgba(255, 255, 255, 0.15)',
                                            color: '#fff',
                                            fontFamily: 'inherit',
                                            fontSize: '0.9rem',
                                            resize: 'vertical',
                                        }}
                                    />
                                </div>

                                {/* 3. UI Screenshots Multi-upload */}
                                <div className="form-group">
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                                        3. UI Screenshots <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional, select multiple)</span>
                                    </label>
                                    <input
                                        type="file"
                                        ref={screenshotsInputRef}
                                        onChange={handleScreenshotsChange}
                                        accept="image/*"
                                        multiple
                                        style={{ display: 'none' }}
                                    />

                                    {screenshotPreviews.length > 0 && (
                                        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                            {screenshotPreviews.map((previewUrl, idx) => (
                                                <div key={idx} style={{ position: 'relative', width: '110px', height: '85px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
                                                    <img src={previewUrl} alt={`Screenshot ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                    <button
                                                        type="button"
                                                        onClick={() => removeScreenshot(idx)}
                                                        style={{
                                                            position: 'absolute',
                                                            top: '4px',
                                                            right: '4px',
                                                            background: 'rgba(0,0,0,0.7)',
                                                            color: '#fff',
                                                            border: 'none',
                                                            borderRadius: '50%',
                                                            width: '22px',
                                                            height: '22px',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                        title="Remove screenshot"
                                                    >
                                                        <X size={14} />
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => screenshotsInputRef.current?.click()}
                                        className="glass-button"
                                        style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                                    >
                                        <Plus size={16} /> {screenshots.length > 0 ? 'Add More Screenshots' : 'Upload UI Screenshots'}
                                    </button>
                                </div>

                                {/* Submit button */}
                                <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                                    {hybridStatus && <span style={{ color: 'var(--accent)', fontSize: '0.9rem' }}>{hybridStatus}</span>}
                                    <button
                                        type="submit"
                                        disabled={submittingHybrid || !reportFile}
                                        className="glass-button"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                            color: '#fff',
                                            fontWeight: 600,
                                            padding: '12px 26px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: submittingHybrid || !reportFile ? 'not-allowed' : 'pointer',
                                            opacity: submittingHybrid || !reportFile ? 0.6 : 1,
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '0.95rem',
                                        }}
                                    >
                                        {submittingHybrid ? (
                                            <>
                                                <Sparkles className="spin-icon" size={18} style={{ margin: 0 }} />
                                                Analyzing with AI...
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={18} />
                                                Run Hybrid AI Analysis
                                            </>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    {/* Section listing all previously uploaded and analyzed designs */}
                    <div className="designs-feed">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                            <h2 className="feed-title" style={{ margin: 0, paddingBottom: 0, border: 'none' }}>
                                Analyzed UI Designs ({project.designs?.length || 0})
                            </h2>
                            <div style={{ display: 'flex', gap: '10px' }}>
                                <input
                                    type="file"
                                    ref={singleImageInputRef}
                                    onChange={handleSingleImageUpload}
                                    accept="image/*"
                                    style={{ display: 'none' }}
                                />
                                <button
                                    className="glass-button"
                                    onClick={() => singleImageInputRef.current?.click()}
                                    disabled={uploadingSingleImage}
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.85rem' }}
                                >
                                    <Plus size={16} /> {uploadingSingleImage ? 'Uploading Screenshot...' : 'Upload Single Screenshot'}
                                </button>
                            </div>
                        </div>

                        {/* Empty state if project has no designs */}
                        {project.designs?.length === 0 ? (
                            <div className="empty-state glass-panel">
                                <ImageIcon size={48} className="empty-icon" />
                                <p>No UI design screenshots uploaded yet.</p>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Upload screenshots via the Hybrid Analysis form above or click "Upload Single Screenshot".
                                </span>
                            </div>
                        ) : (
                            <div className="designs-list">
                                {project.designs.map((design) => (
                                    <div key={design.id} className="design-card glass-panel">
                                        <div className="design-image-container">
                                            <img src={`${MEDIA_BASE}${design.image}`} alt="Design" className="design-image" />
                                        </div>

                                        <div className="design-feedback">
                                            <div className="feedback-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                                <div>
                                                    <h3>UI Screen Evaluation</h3>
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

                                            {!minimizedDesigns.includes(design.id) && (
                                                <>
                                                    <div className="score-cards">
                                                        <div className="score-card ui-score">
                                                            <span className="score-label">UI Design</span>
                                                            <span className="score-value">
                                                                {design.feedback?.ui_score ?? 'N/A'}<small>/10</small>
                                                            </span>
                                                        </div>
                                                        <div className="score-card ux-score">
                                                            <span className="score-label">UX Usability</span>
                                                            <span className="score-value">
                                                                {design.feedback?.ux_score ?? 'N/A'}<small>/10</small>
                                                            </span>
                                                        </div>
                                                    </div>
                                                    {design.feedback ? (
                                                        <ExpandableFeedback text={design.feedback.raw_analysis} />
                                                    ) : (
                                                        <div className="generating-feedback">
                                                            <span>AI is currently evaluating this screen...</span>
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

export default ProjectDetail;
