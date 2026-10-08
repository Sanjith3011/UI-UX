import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
    Sparkles,
    FileText,
    CheckCircle2,
    X,
    Plus,
    ChevronLeft,
    ArrowRight,
    UploadCloud,
    Sliders,
    Layers,
    ShieldCheck,
    Eye,
    Zap,
    AlertCircle,
    Info,
    ExternalLink
} from 'lucide-react';
import api, { createHybridSubmission, fetchHybridSubmissions } from '../api';
import ExpandableFeedback from '../components/ExpandableFeedback';
import './HybridUpload.css';

const FOCUS_PRESETS = [
    { id: 'wcag', label: 'WCAG 2.1 Accessibility', prompt: 'Evaluate color contrast ratios, screen reader accessibility, touch target sizing, and readability.' },
    { id: 'hierarchy', label: 'Visual Hierarchy & Balance', prompt: 'Audit typographic scale, focal points, whitespace balance, and scanning affordances.' },
    { id: 'heuristics', label: 'Nielsen Usability Heuristics', prompt: 'Examine error prevention, system visibility, user control, and consistency standards.' },
    { id: 'copy', label: 'Microcopy & Information Architecture', prompt: 'Review clarity of labels, form microcopy, call-to-action phrasing, and navigational cognitive load.' },
];

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
    const [dragActive, setDragActive] = useState(false);

    const reportRef = useRef(null);
    const screenshotsRef = useRef(null);

    useEffect(() => {
        const loadProjects = async () => {
            try {
                const res = await api.get('projects/');
                setProjects(res.data || []);
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

    const handleReportChange = (file) => {
        if (!file) return;
        const ext = file.name.split('.').pop().toLowerCase();
        if (!['pdf', 'docx', 'txt', 'doc'].includes(ext)) {
            alert('Please select a valid report format (.pdf, .docx, or .txt).');
            return;
        }
        setReportFile(file);
    };

    const handleScreenshotsChange = (filesList) => {
        const files = Array.from(filesList || []);
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

    const togglePreset = (presetPrompt) => {
        if (prompt.includes(presetPrompt)) {
            setPrompt(prompt.replace(presetPrompt, '').trim());
        } else {
            setPrompt(prev => prev ? `${prev}\n\n${presetPrompt}` : presetPrompt);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!reportFile) {
            alert('Please select a project report or PRD document to analyze.');
            return;
        }

        setSubmitting(true);
        setStatusMessage('Submitting for heuristic analysis...');

        try {
            let targetProjectId = selectedProjectId;

            if (selectedProjectId === '__NEW__') {
                const title = newProjectTitle.trim() || `Design Audit (${new Date().toLocaleDateString()})`;
                const projRes = await api.post('projects/', {
                    title,
                    description: 'Generated via Hybrid AI Heuristic Evaluation Studio',
                    is_public: publishToPublicFeed,
                });
                targetProjectId = projRes.data.id;
            } else if (targetProjectId && targetProjectId !== '__STANDALONE__' && publishToPublicFeed) {
                try {
                    await api.patch(`projects/${targetProjectId}/visibility/`, { is_public: true });
                } catch (e) {
                    // Ignore if already public
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
            setStatusMessage('Submitted! AI is evaluating documentation and visual aesthetics...');

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
        <div className="studio-container animate-fade-in">
            {/* Top Navigation & Breadcrumb */}
            <div className="studio-topbar">
                <Link to="/" className="studio-back-link">
                    <ChevronLeft size={18} />
                    <span>Back to Workspace</span>
                </Link>
                <span className="studio-badge">
                    <Zap size={13} /> Heuristic Audit Studio
                </span>
            </div>

            {/* Header */}
            <header className="studio-header glass-panel">
                <div className="studio-header-icon-wrap">
                    <Sparkles size={28} />
                </div>
                <div>
                    <h1 className="studio-title">
                        Hybrid Design & Spec Audit
                    </h1>
                    <p className="studio-subtitle">
                        Cross-correlate interface documentation (PRDs, design tokens, style guides) against visual UI screenshots for multi-modal heuristic analysis.
                    </p>
                </div>
            </header>

            {/* Evaluation Result View */}
            {activeSubmission && activeSubmission.status === 'done' && activeSubmission.result && (
                <div className="studio-result-card glass-panel animate-scale-in">
                    <div className="result-card-header">
                        <div className="result-status-title">
                            <div className="result-check-icon">
                                <CheckCircle2 size={24} />
                            </div>
                            <div>
                                <h2>Audit Findings & Quality Score</h2>
                                <span className="result-subtext">Submission ID #{activeSubmission.id} • Heuristic Benchmark Report</span>
                            </div>
                        </div>

                        <div className="result-scores-group">
                            <div className="studio-score-pill ui-pill">
                                <span className="score-title">UI Aesthetics</span>
                                <span className="score-num">{activeSubmission.result.ui_score ?? 'N/A'}<small>/10</small></span>
                            </div>
                            <div className="studio-score-pill ux-pill">
                                <span className="score-title">UX Flow</span>
                                <span className="score-num">{activeSubmission.result.ux_score ?? 'N/A'}<small>/10</small></span>
                            </div>

                            {activeSubmission.project && (
                                <Link
                                    to={`/project/${activeSubmission.project}`}
                                    className="glass-button open-project-btn"
                                >
                                    <span>Open Project</span>
                                    <ArrowRight size={16} />
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="result-feedback-body">
                        <ExpandableFeedback text={activeSubmission.result.raw_analysis} />
                    </div>
                </div>
            )}

            {/* In-Progress Evaluation Card */}
            {activeSubmission && (activeSubmission.status === 'queued' || activeSubmission.status === 'processing') && (
                <div className="studio-processing-card glass-panel animate-fade-in">
                    <div className="processing-header">
                        <div className="processing-spinner-wrap">
                            <Sparkles size={22} className="spin-icon" />
                        </div>
                        <div>
                            <h3>Evaluating Design Artifacts</h3>
                            <p>Correlating PRD requirements with UI screenshot layouts...</p>
                        </div>
                    </div>

                    <div className="processing-progress-bar">
                        <div
                            className="processing-progress-fill"
                            style={{ width: activeSubmission.status === 'processing' ? '70%' : '30%' }}
                        />
                    </div>

                    <div className="processing-steps-row">
                        <span className="step-indicator done">✓ Document Parser</span>
                        <span className={`step-indicator ${activeSubmission.status === 'processing' ? 'active' : ''}`}>
                            Visual Contrast & Layout Scan
                        </span>
                        <span className="step-indicator">Remediation Matrix</span>
                    </div>
                </div>
            )}

            {/* 3-Step Audit Studio Form */}
            <form onSubmit={handleSubmit} className="studio-form glass-panel">
                {/* Step 1: Document Upload */}
                <div className="studio-step-section">
                    <div className="step-label-row">
                        <span className="step-number">01</span>
                        <div>
                            <h3 className="step-heading">Specification Document (PRD / Guideline) *</h3>
                            <p className="step-desc">Upload design brief, feature specs, or design system tokens (PDF, DOCX, TXT).</p>
                        </div>
                    </div>

                    {!reportFile ? (
                        <div
                            className={`studio-dropzone ${dragActive ? 'drag-active' : ''}`}
                            onClick={() => reportRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                            onDragLeave={() => setDragActive(false)}
                            onDrop={(e) => {
                                e.preventDefault();
                                setDragActive(false);
                                if (e.dataTransfer.files?.[0]) handleReportChange(e.dataTransfer.files[0]);
                            }}
                        >
                            <input
                                type="file"
                                ref={reportRef}
                                onChange={(e) => handleReportChange(e.target.files?.[0])}
                                accept=".pdf,.docx,.txt,.doc"
                                style={{ display: 'none' }}
                            />
                            <div className="dropzone-icon">
                                <FileText size={38} />
                            </div>
                            <span className="dropzone-title">Click to upload specification or drag & drop</span>
                            <span className="dropzone-sub">PDF, DOCX, or TXT up to 25MB</span>
                        </div>
                    ) : (
                        <div className="studio-file-selected glass-panel">
                            <div className="file-info-col">
                                <div className="file-icon-badge">
                                    <FileText size={20} />
                                </div>
                                <div>
                                    <span className="file-name">{reportFile.name}</span>
                                    <span className="file-size">{(reportFile.size / 1024).toFixed(1)} KB • Attached</span>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="file-remove-btn"
                                onClick={() => {
                                    setReportFile(null);
                                    if (reportRef.current) reportRef.current.value = '';
                                }}
                            >
                                <X size={16} />
                                <span>Replace</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Step 2: UI Screenshots */}
                <div className="studio-step-section">
                    <div className="step-label-row">
                        <span className="step-number">02</span>
                        <div>
                            <h3 className="step-heading">UI Interfaces & Screenshots</h3>
                            <p className="step-desc">Figma exports, mockups, or responsive mobile/desktop screenshots.</p>
                        </div>
                    </div>

                    <input
                        type="file"
                        ref={screenshotsRef}
                        onChange={(e) => handleScreenshotsChange(e.target.files)}
                        accept="image/*"
                        multiple
                        style={{ display: 'none' }}
                    />

                    {previews.length > 0 && (
                        <div className="studio-previews-grid">
                            {previews.map((previewUrl, idx) => (
                                <div key={idx} className="preview-card glass-panel">
                                    <img src={previewUrl} alt={`UI Screen ${idx + 1}`} className="preview-img" />
                                    <span className="preview-idx">Screen {idx + 1}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeScreenshot(idx)}
                                        className="preview-remove-btn"
                                        title="Remove screenshot"
                                    >
                                        <X size={14} />
                                    </button>
                                </div>
                            ))}
                            <button
                                type="button"
                                className="preview-add-more glass-panel"
                                onClick={() => screenshotsRef.current?.click()}
                            >
                                <Plus size={22} />
                                <span>Add Screens</span>
                            </button>
                        </div>
                    )}

                    {previews.length === 0 && (
                        <div
                            className="studio-dropzone screenshots-dropzone"
                            onClick={() => screenshotsRef.current?.click()}
                        >
                            <div className="dropzone-icon">
                                <Layers size={36} />
                            </div>
                            <span className="dropzone-title">Upload UI Screens & Mockups</span>
                            <span className="dropzone-sub">Select multiple PNG, JPG, or WebP files</span>
                        </div>
                    )}
                </div>

                {/* Step 3: Audit Parameters & Project Scope */}
                <div className="studio-step-section">
                    <div className="step-label-row">
                        <span className="step-number">03</span>
                        <div>
                            <h3 className="step-heading">Audit Scope & Destination</h3>
                            <p className="step-desc">Configure target project, evaluation guidelines, and showcase visibility.</p>
                        </div>
                    </div>

                    {/* Target project selector */}
                    <div className="studio-field-group">
                        <label className="studio-label">Destination Project</label>
                        <select
                            value={selectedProjectId}
                            onChange={(e) => setSelectedProjectId(e.target.value)}
                            className="studio-select"
                        >
                            <option value="">-- Quick Heuristic Scan (No Dedicated Project) --</option>
                            <option value="__NEW__">+ Create a New Project Workspace for This Audit</option>
                            {projects.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.title}
                                </option>
                            ))}
                        </select>
                    </div>

                    {selectedProjectId === '__NEW__' && (
                        <div className="studio-field-group animate-scale-in">
                            <label className="studio-label">New Project Title</label>
                            <input
                                type="text"
                                value={newProjectTitle}
                                onChange={(e) => setNewProjectTitle(e.target.value)}
                                placeholder="e.g. Design System V2 Redesign Audit"
                                className="studio-input"
                            />
                        </div>
                    )}

                    {/* Presets */}
                    <div className="studio-field-group">
                        <label className="studio-label">Audit Focus Presets</label>
                        <div className="presets-chips-row">
                            {FOCUS_PRESETS.map((preset) => {
                                const isSelected = prompt.includes(preset.prompt);
                                return (
                                    <button
                                        type="button"
                                        key={preset.id}
                                        className={`preset-chip ${isSelected ? 'active' : ''}`}
                                        onClick={() => togglePreset(preset.prompt)}
                                    >
                                        <ShieldCheck size={14} />
                                        <span>{preset.label}</span>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Custom prompt */}
                    <div className="studio-field-group">
                        <label className="studio-label">Custom Audit Directives (Optional)</label>
                        <textarea
                            value={prompt}
                            onChange={(e) => setPrompt(e.target.value)}
                            placeholder="Add any specific design criteria, brand guidelines, or critical user journeys..."
                            rows={3}
                            className="studio-textarea"
                        />
                    </div>

                    {/* Showcase visibility checkbox */}
                    <label className="studio-checkbox-card">
                        <input
                            type="checkbox"
                            checked={publishToPublicFeed}
                            onChange={(e) => setPublishToPublicFeed(e.target.checked)}
                            className="studio-checkbox"
                        />
                        <div className="checkbox-text-col">
                            <strong>Publish to Community Showcase</strong>
                            <span>Allow fellow designers to view the audit findings, like, and leave feedback.</span>
                        </div>
                    </label>
                </div>

                {/* Submit Row */}
                <div className="studio-submit-bar">
                    {statusMessage && (
                        <div className="studio-status-msg">
                            <Info size={16} />
                            <span>{statusMessage}</span>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={submitting || !reportFile}
                        className="glass-button studio-submit-btn"
                    >
                        {submitting ? (
                            <>
                                <Sparkles className="spin-icon" size={18} />
                                <span>Running AI Audit Engine...</span>
                            </>
                        ) : (
                            <>
                                <Sparkles size={18} />
                                <span>Run Comprehensive AI Audit</span>
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default HybridUpload;
