import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Sparkles, FileText, CheckCircle2, X, Plus, ChevronLeft, ArrowRight } from 'lucide-react';
import api, { createHybridSubmission, fetchHybridSubmissions } from '../api';
import ExpandableFeedback from '../components/ExpandableFeedback';
import './HybridUpload.css';

const HybridUpload = () => {
    const navigate = useNavigate();
    const [projects, setProjects] = useState([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [newProjectTitle, setNewProjectTitle] = useState('');
    
    const [reportFile, setReportFile] = useState(null);
    const [prompt, setPrompt] = useState('');
    const [screenshots, setScreenshots] = useState([]);
    const [previews, setPreviews] = useState([]);
    
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [publishToPublicFeed, setPublishToPublicFeed] = useState(true);
    const [statusMessage, setStatusMessage] = useState('');
    const [activeSubmission, setActiveSubmission] = useState(null);

    const reportRef = useRef(null);
    const screenshotsRef = useRef(null);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const res = await api.get('projects/');
                setProjects(res.data);
            } catch (err) {
                console.error('Error fetching projects:', err);
            } finally {
                setLoadingProjects(false);
            }
        };
        loadProjects();
    }, []);

    // Polling active submission if processing
    useEffect(() => {
        if (!activeSubmission || activeSubmission.status === 'done' || activeSubmission.status === 'failed') {
            return;
        }

        const interval = setInterval(async () => {
            try {
                const res = await fetchHybridSubmissions(selectedProjectId || undefined);
                const current = res.find(s => s.id === activeSubmission.id);
                if (current) {
                    setActiveSubmission(current);
                    if (current.status === 'done') {
                        setStatusMessage('AI Analysis completed successfully!');
                    } else if (current.status === 'failed') {
                        setStatusMessage('AI Analysis encountered an error.');
                    }
                }
            } catch (e) {
                console.error('Error polling submission status:', e);
            }
        }, 4000);

        return () => clearInterval(interval);
    }, [activeSubmission, selectedProjectId]);

    const handleReportChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'txt', 'doc'].includes(ext)) {
            alert('Please select a valid report format (.pdf, .docx, or .txt).');
            return;
        }
        setReportFile(file);
    };

    const handleScreenshotsChange = (e) => {
        const files = Array.from(e.target.files || []);
        if (!files.length) return;
        setScreenshots(prev => [...prev, ...files]);
        const newPreviews = files.map(file => URL.createObjectURL(file));
        setPreviews(prev => [...prev, ...newPreviews]);
        if (screenshotsRef.current) screenshotsRef.current.value = '';
    };

    const removeScreenshot = (idx) => {
        setScreenshots(prev => prev.filter((_, i) => i !== idx));
        setPreviews(prev => {
            URL.revokeObjectURL(prev[idx]);
            return prev.filter((_, i) => i !== idx);
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reportFile) {
            alert('Please select a project report document.');
            return;
        }

        setSubmitting(true);
        setStatusMessage('Submitting for hybrid analysis...');

        try {
            let targetProjectId = selectedProjectId;

            // If user wants to create a new project
            if (selectedProjectId === '__NEW__') {
                const title = newProjectTitle.trim() || `Hybrid Project (${new Date().toLocaleDateString()})`;
                const projRes = await api.post('projects/', {
                    title,
                    description: 'Created via Hybrid AI Analysis',
                    is_public: publishToPublicFeed,
                });
                targetProjectId = projRes.data.id;
            } else if (targetProjectId && targetProjectId !== '__STANDALONE__' && publishToPublicFeed) {
                try {
                    await api.patch(`projects/${targetProjectId}/visibility/`, { is_public: true });
                } catch (e) {
                    // Ignore if already public or permission
                }
            }

            const formData = new FormData();
            if (targetProjectId && targetProjectId !== '__STANDALONE__') {
                formData.append('project', targetProjectId);
            }
            formData.append('report_file', reportFile);
            if (prompt.trim()) {
                formData.append('prompt', prompt.trim());
            }
            screenshots.forEach((file) => {
                formData.append('screenshots', file);
            });

            const data = await createHybridSubmission(formData);
            setActiveSubmission(data);
            setStatusMessage('Submitted! AI is now evaluating your documentation and screenshots...');

            // If attached to a project, let user know or offer redirect
            if (targetProjectId && targetProjectId !== '__STANDALONE__') {
                setSelectedProjectId(targetProjectId);
            }
        } catch (err) {
            console.error(err);
            const msg = err.response?.data?.detail || err.message || 'Upload failed.';
            alert(`Submission error: ${msg}`);
            setStatusMessage('Failed to submit.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="hybrid-upload-page animate-fade-in">
            <Link to="/" className="back-link">
                <ChevronLeft size={20} /> Back to Projects
            </Link>

            <div className="hybrid-upload-header glass-panel">
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
                    <Sparkles size={28} style={{ color: 'var(--accent)' }} />
                    <h1 className="gradient-text" style={{ margin: 0, fontSize: '2rem' }}>
                        Hybrid UI/UX Project Analysis
                    </h1>
                </div>
                <p style={{ color: 'var(--text-muted)', margin: 0, fontSize: '1.05rem', lineHeight: 1.5 }}>
                    Combine project reports, design requirements documentation (PDF, DOCX, TXT) and interface screenshots for comprehensive heuristic and visual evaluation.
                </p>
            </div>

            {/* Active Analysis Result */}
            {activeSubmission && activeSubmission.status === 'done' && activeSubmission.result && (
                <div className="hybrid-result-card glass-panel animate-fade-in" style={{ marginBottom: '32px', padding: '28px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '16px', marginBottom: '18px' }}>
                        <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CheckCircle2 size={24} style={{ color: 'var(--success)' }} />
                                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Hybrid AI Evaluation Results</h2>
                            </div>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Submission #{activeSubmission.id}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '14px', alignItems: 'center' }}>
                            <div className="score-card ui-score" style={{ padding: '8px 16px', textAlign: 'center' }}>
                                <span className="score-label" style={{ fontSize: '0.75rem' }}>UI Score</span>
                                <span className="score-value" style={{ fontSize: '1.4rem' }}>{activeSubmission.result.ui_score ?? 'N/A'}<small>/10</small></span>
                            </div>
                            <div className="score-card ux-score" style={{ padding: '8px 16px', textAlign: 'center' }}>
                                <span className="score-label" style={{ fontSize: '0.75rem' }}>UX Score</span>
                                <span className="score-value" style={{ fontSize: '1.4rem' }}>{activeSubmission.result.ux_score ?? 'N/A'}<small>/10</small></span>
                            </div>
                            {activeSubmission.project && (
                                <Link
                                    to={`/project/${activeSubmission.project}`}
                                    className="glass-button"
                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none', marginLeft: '8px' }}
                                >
                                    Open Project <ArrowRight size={16} />
                                </Link>
                            )}
                        </div>
                    </div>
                    <ExpandableFeedback text={activeSubmission.result.raw_analysis} />
                </div>
            )}

            {/* In Progress Status */}
            {activeSubmission && (activeSubmission.status === 'queued' || activeSubmission.status === 'processing') && (
                <div className="hybrid-progress-card glass-panel animate-fade-in" style={{ marginBottom: '32px', padding: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                        <Sparkles className="spin-icon" size={24} style={{ color: 'var(--accent)', margin: 0 }} />
                        <h3 style={{ margin: 0 }}>AI Hybrid Analysis In Progress...</h3>
                    </div>
                    <p style={{ color: 'var(--text-muted)', marginBottom: '16px' }}>
                        The AI is extracting text from your project report and performing heuristic evaluations on your uploaded screenshots. This usually takes 15–30 seconds.
                    </p>
                    <div className="archive-progress-bar">
                        <div className="archive-progress-bar-fill" style={{ width: activeSubmission.status === 'processing' ? '75%' : '35%' }} />
                    </div>
                </div>
            )}

            {/* Upload Form */}
            <div className="hybrid-upload-card glass-panel" style={{ padding: '32px' }}>
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Project Selector */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                            Target Project <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Attach feedback to a project)</span>
                        </label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                background: '#1e1e2f',
                                border: '1px solid rgba(255, 255, 255, 0.2)',
                                color: '#fff',
                                fontSize: '0.95rem'
                            }}
                        >
                            <option value="">-- Standalone Evaluation (No Project) --</option>
                            <option value="__NEW__">+ Create a New Project for This Submission</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedProjectId === '__NEW__' && (
                        <div className="form-group animate-fade-in">
                            <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                                New Project Title
                            </label>
                            <input
                                type="text"
                                value={newProjectTitle}
                                onChange={(e) => setNewProjectTitle(e.target.value)}
                                placeholder="e.g., E-Commerce Mobile App Redesign"
                                style={{
                                    width: '100%',
                                    padding: '12px 14px',
                                    borderRadius: '8px',
                                    background: 'rgba(255, 255, 255, 0.04)',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    color: '#fff',
                                    fontSize: '0.95rem'
                                }}
                            />
                        </div>
                    )}

                    {/* Report File Input */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                            Project Documentation / Report <span style={{ color: 'var(--accent)' }}>*</span>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400, marginLeft: '8px' }}>
                                (PDF, DOCX, or TXT)
                            </span>
                        </label>

                        {!reportFile ? (
                            <div
                                className="report-dropzone glass-panel"
                                onClick={() => reportRef.current?.click()}
                                style={{
                                    padding: '32px',
                                    border: '2px dashed rgba(255, 255, 255, 0.25)',
                                    borderRadius: '12px',
                                    textAlign: 'center',
                                    cursor: 'pointer',
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <input
                                    type="file"
                                    ref={reportRef}
                                    onChange={handleReportChange}
                                    accept=".pdf,.docx,.txt,.doc"
                                    style={{ display: 'none' }}
                                />
                                <FileText size={42} style={{ color: 'var(--accent)', marginBottom: '10px' }} />
                                <p style={{ margin: '0 0 6px 0', fontWeight: 500, fontSize: '1.05rem' }}>
                                    Click or drag project report here
                                </p>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                                    Supports PDF, Word (.docx), or plain text documents
                                </span>
                            </div>
                        ) : (
                            <div className="file-badge glass-panel" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', borderRadius: '10px', background: 'rgba(99, 102, 241, 0.12)', border: '1px solid rgba(99, 102, 241, 0.35)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                    <CheckCircle2 size={22} style={{ color: 'var(--success)' }} />
                                    <div>
                                        <div style={{ fontWeight: 600 }}>{reportFile.name}</div>
                                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{(reportFile.size / 1024).toFixed(1)} KB</div>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => { setReportFile(null); if (reportRef.current) reportRef.current.value = ''; }}
                                    className="glass-button"
                                    style={{ padding: '6px 12px', fontSize: '0.85rem' }}
                                >
                                    <X size={16} /> Remove
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Custom Prompt */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                            Review Focus & Instructions <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional)</span>
                        </label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="What specific aspects should the AI focus on? (e.g. accessibility, visual consistency, information architecture, mobile layout...)"
                            rows={3}
                            style={{
                                width: '100%',
                                padding: '12px 14px',
                                borderRadius: '8px',
                                background: 'rgba(255, 255, 255, 0.04)',
                                border: '1px solid rgba(255, 255, 255, 0.15)',
                                color: '#fff',
                                fontFamily: 'inherit',
                                fontSize: '0.95rem',
                                resize: 'vertical',
                            }}
                        />
                    </div>

                    {/* UI Screenshots Multi-upload */}
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 600 }}>
                            UI Interface Screenshots <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 400 }}>(Optional, select multiple)</span>
                        </label>
                        <input
                            type="file"
                            ref={screenshotsRef}
                            onChange={handleScreenshotsChange}
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                        />

                        {previews.length > 0 && (
                            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                {previews.map((previewUrl, idx) => (
                                    <div key={idx} style={{ position: 'relative', width: '120px', height: '90px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.2)' }}>
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
                                            title="Remove"
                                        >
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        <button
                            type="button"
                            onClick={() => screenshotsRef.current?.click()}
                            className="glass-button"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.9rem' }}
                        >
                            <Plus size={16} /> {screenshots.length > 0 ? 'Add More Screenshots' : 'Upload UI Screenshots'}
                        </button>
                    </div>

                    {/* Public Feed Publish Toggle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '20px', background: 'rgba(99, 102, 241, 0.08)', padding: '12px 16px', borderRadius: '10px', border: '1px solid rgba(99, 102, 241, 0.25)' }}>
                        <input
                            type="checkbox"
                            id="publishToPublicFeed"
                            checked={publishToPublicFeed}
                            onChange={(e) => setPublishToPublicFeed(e.target.checked)}
                            style={{ width: '18px', height: '18px', accentColor: 'var(--primary)', cursor: 'pointer' }}
                        />
                        <label htmlFor="publishToPublicFeed" style={{ color: '#e2e8f0', fontSize: '0.92rem', cursor: 'pointer', margin: 0 }}>
                            <strong>Publish to Public Feed</strong> — share evaluated UI designs publicly for community feedback and likes.
                        </label>
                    </div>

                    {/* Submit Bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '16px', marginTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '20px' }}>
                        {statusMessage && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--accent)', fontSize: '0.95rem' }}>{statusMessage}</span>
                                {activeSubmission?.status === 'done' && (
                                    <Link to="/explore" className="glass-button" style={{ padding: '6px 12px', fontSize: '0.85rem', color: '#fff' }}>
                                        View on Public Feed →
                                    </Link>
                                )}
                            </div>
                        )}
                        <button
                            type="submit"
                            disabled={submitting || !reportFile}
                            className="glass-button"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                color: '#fff',
                                fontWeight: 600,
                                padding: '14px 30px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                cursor: submitting || !reportFile ? 'not-allowed' : 'pointer',
                                opacity: submitting || !reportFile ? 0.6 : 1,
                                border: 'none',
                                borderRadius: '8px',
                                fontSize: '1rem',
                            }}
                        >
                            {submitting ? (
                                <>
                                    <Sparkles className="spin-icon" size={20} style={{ margin: 0 }} />
                                    Submitting to AI...
                                </>
                            ) : (
                                <>
                                    <Sparkles size={20} />
                                    Run Hybrid AI Analysis
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default HybridUpload;
