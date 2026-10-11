import { useState, useContext, useMemo } from 'react';
import { Link } from 'react-router-dom';
import AuthContext from '../context/AuthContext';
import { Layers, AlertCircle, ArrowRight, Check, X, ShieldCheck, Lock, Mail, User } from 'lucide-react';
import './Auth.css';

const Register = () => {
    const { registerUser } = useContext(AuthContext);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Real-time Credential Validation Calculations
    const usernameValidation = useMemo(() => {
        const clean = username.trim();
        if (!clean) return { valid: false, message: 'Username is required' };
        if (clean.length < 3) return { valid: false, message: 'Minimum 3 characters' };
        if (clean.length > 30) return { valid: false, message: 'Max 30 characters' };
        if (!/^[a-zA-Z0-9_.-]+$/.test(clean)) {
            return { valid: false, message: 'Only letters, numbers, underscores, and hyphens' };
        }
        return { valid: true, message: 'Valid username handle' };
    }, [username]);

    const emailValidation = useMemo(() => {
        const clean = email.trim().toLowerCase();
        if (!clean) return { valid: false, message: 'Compulsory email required' };
        const emailRegex = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$/;
        if (!emailRegex.test(clean)) {
            return { valid: false, message: 'Enter a valid email address' };
        }
        return { valid: true, message: 'Valid email format' };
    }, [email]);

    const passwordCriteria = useMemo(() => {
        return {
            hasLength: password.length >= 8,
            hasUpper: /[A-Z]/.test(password),
            hasLower: /[a-z]/.test(password),
            hasNumber: /[0-9]/.test(password),
            hasSpecial: /[^a-zA-Z0-9]/.test(password),
        };
    }, [password]);

    const passwordScore = useMemo(() => {
        let score = 0;
        if (passwordCriteria.hasLength) score += 1;
        if (passwordCriteria.hasUpper) score += 1;
        if (passwordCriteria.hasLower) score += 1;
        if (passwordCriteria.hasNumber) score += 1;
        if (passwordCriteria.hasSpecial) score += 1;
        return score;
    }, [passwordCriteria]);

    const passwordsMatch = useMemo(() => {
        if (!confirmPassword) return false;
        return password === confirmPassword;
    }, [password, confirmPassword]);

    const strengthLevel = useMemo(() => {
        if (passwordScore <= 2) return 'weak';
        if (passwordScore <= 4) return 'medium';
        return 'strong';
    }, [passwordScore]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!usernameValidation.valid) {
            setError(usernameValidation.message);
            return;
        }

        if (!emailValidation.valid) {
            setError(emailValidation.message);
            return;
        }

        if (passwordScore < 5) {
            setError('Please fulfill all password security criteria (8+ characters, uppercase, lowercase, number, symbol).');
            return;
        }

        if (!passwordsMatch) {
            setError('Passwords do not match. Please verify your confirmation password.');
            return;
        }

        setLoading(true);

        try {
            const result = await registerUser(username.trim(), email.trim(), password);
            if (!result.success) {
                setError(result.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container animate-fade-in">
            <div className="auth-card glass-panel">
                <div className="auth-header">
                    <div className="auth-brand-badge">
                        <Layers className="auth-icon" size={26} />
                    </div>
                    <h2>Create Account</h2>
                    <p>Secured with token authorization and heuristic evaluation</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form" noValidate>
                    {/* Username Input */}
                    <div className="form-group">
                        <label>
                            Username <span className="required-star">*</span>
                        </label>
                        <div style={{ position: 'relative' }}>
                            <input
                                type="text"
                                className="glass-input"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="e.g. sarah_design"
                                required
                                autoComplete="username"
                                autoFocus
                            />
                        </div>
                        <p className="form-hint">
                            Letters, numbers, underscores, and hyphens (3-30 chars).
                        </p>
                    </div>

                    {/* Email Input (Compulsory) */}
                    <div className="form-group">
                        <label>
                            Email Address <span className="required-star">*</span>
                        </label>
                        <input
                            type="email"
                            className="glass-input"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="designer@company.com"
                            required
                            autoComplete="email"
                        />
                        <p className="form-hint">
                            Compulsory for account verification, password resets, and portfolio notifications.
                        </p>
                    </div>

                    {/* Password Input */}
                    <div className="form-group">
                        <label>
                            Password <span className="required-star">*</span>
                        </label>
                        <input
                            type="password"
                            className="glass-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Create a strong password"
                            required
                            autoComplete="new-password"
                        />

                        {/* Real-time Password Strength Meter */}
                        {password.length > 0 && (
                            <div className="password-strength-container animate-fade-in">
                                <div className="strength-label">
                                    <span>Security Strength</span>
                                    <span className={`strength-label ${strengthLevel}`}>
                                        {strengthLevel.toUpperCase()}
                                    </span>
                                </div>
                                <div className="strength-bar-track">
                                    <div className={`strength-bar-fill ${strengthLevel}`} />
                                </div>

                                {/* Criteria Checklist */}
                                <div className="credential-checklist">
                                    <div className={`check-item ${passwordCriteria.hasLength ? 'valid' : 'invalid'}`}>
                                        {passwordCriteria.hasLength ? <Check size={12} /> : <X size={12} />}
                                        <span>8+ characters</span>
                                    </div>
                                    <div className={`check-item ${passwordCriteria.hasUpper ? 'valid' : 'invalid'}`}>
                                        {passwordCriteria.hasUpper ? <Check size={12} /> : <X size={12} />}
                                        <span>Uppercase (A-Z)</span>
                                    </div>
                                    <div className={`check-item ${passwordCriteria.hasLower ? 'valid' : 'invalid'}`}>
                                        {passwordCriteria.hasLower ? <Check size={12} /> : <X size={12} />}
                                        <span>Lowercase (a-z)</span>
                                    </div>
                                    <div className={`check-item ${passwordCriteria.hasNumber ? 'valid' : 'invalid'}`}>
                                        {passwordCriteria.hasNumber ? <Check size={12} /> : <X size={12} />}
                                        <span>Number (0-9)</span>
                                    </div>
                                    <div className={`check-item ${passwordCriteria.hasSpecial ? 'valid' : 'invalid'}`}>
                                        {passwordCriteria.hasSpecial ? <Check size={12} /> : <X size={12} />}
                                        <span>Special symbol</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Confirm Password Input */}
                    <div className="form-group">
                        <label>
                            Confirm Password <span className="required-star">*</span>
                        </label>
                        <input
                            type="password"
                            className="glass-input"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Re-enter password"
                            required
                            autoComplete="new-password"
                        />
                        {confirmPassword && (
                            <p className="form-hint" style={{ color: passwordsMatch ? '#34d399' : '#fca5a5' }}>
                                {passwordsMatch ? '✓ Passwords match' : '✗ Passwords do not match'}
                            </p>
                        )}
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="auth-error">
                            <AlertCircle size={18} className="auth-error-icon" />
                            <div>
                                <span>{error}</span>
                            </div>
                        </div>
                    )}

                    {/* Submit Button */}
                    <button
                        type="submit"
                        className="glass-button auth-submit"
                        disabled={loading}
                    >
                        {loading ? 'Creating Encrypted Account...' : (
                            <>
                                <span>Register & Access Workspace</span>
                                <ArrowRight size={16} />
                            </>
                        )}
                    </button>
                </form>

                <div className="auth-footer">
                    <span>Already have an account?</span>
                    <Link to="/login">Sign In</Link>
                </div>
            </div>
        </div>
    );
};

export default Register;
