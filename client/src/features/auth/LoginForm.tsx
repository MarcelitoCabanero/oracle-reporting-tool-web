import { useState, useEffect, type FormEvent } from 'react';
import { LockKeyhole, UserRound } from 'lucide-react';
import logo from '../../assets/jco-logo.png';
import { useAuth } from './AuthContext';

export function LoginForm() {
  const { login } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [systemReady, setSystemReady] = useState(false);
  const [systemStatus, setSystemStatus] = useState('Connecting to database...');
  const [checkingSystem, setCheckingSystem] = useState(true);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) throw new Error('API offline');
        return res.json();
      })
      .then((data) => {
        if (data.database === 'connected') {
          setSystemReady(true);
          setSystemStatus('OracleDB Connected • System Ready');
        } else {
          setSystemReady(false);
          setSystemStatus(data.databaseError || 'Database connection offline');
        }
      })
      .catch((err) => {
        setSystemReady(false);
        setSystemStatus((err as Error).message || 'API connection failed');
      })
      .finally(() => {
        setCheckingSystem(false);
      });
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!username.trim() || !password.trim()) {
      setError('Please enter your username and password.');
      return;
    }

    setLoading(true);
    const result = await login(username.trim(), password);
    setLoading(false);

    if (!result.success) {
      setError(result.error ?? 'Invalid username or password.');
    }
  };

  const statusPillClass = checkingSystem
    ? 'saas-status-pill saas-status-checking'
    : systemReady
    ? 'saas-status-pill saas-status-ready'
    : 'saas-status-pill saas-status-offline';

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center p-3 p-md-4 saas-login-backdrop">
      <div className="saas-login-card w-100">
        {/* Brand Header */}
        <div className="saas-login-header d-flex align-items-center gap-3">
          <div className="saas-logo-badge">
            <img
              src={logo}
              alt="Oracle Reporting Tool"
              className="saas-login-logo"
            />
          </div>
          <div>
            <h1 className="saas-brand-title mb-0">Oracle Reporting Tool</h1>
            <p className="saas-brand-subtitle mb-0">Contemporain Foods Inc.</p>
          </div>
        </div>

        {/* Content */}
        <div className="saas-login-body">
          <div className="mb-4">
            <div className="saas-eyebrow mb-1">
              WELCOME BACK
            </div>
            <h2 className="saas-headline mb-0">Sign in to continue</h2>
          </div>

          <form onSubmit={handleSubmit}>
            {/* Username */}
            <div className="mb-3">
              <label htmlFor="username" className="saas-input-label">
                Username
              </label>
              <div className="saas-input-wrapper">
                <UserRound size={18} strokeWidth={2.2} className="saas-input-icon" aria-hidden="true" />
                <input
                  id="username"
                  type="text"
                  className="form-control saas-input-control"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Enter username"
                  autoComplete="username"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-4">
              <label htmlFor="password" className="saas-input-label">
                Password
              </label>
              <div className="saas-input-wrapper">
                <LockKeyhole size={18} strokeWidth={2.2} className="saas-input-icon" aria-hidden="true" />
                <input
                  id="password"
                  type="password"
                  className="form-control saas-input-control"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  autoComplete="current-password"
                  disabled={loading}
                />
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="saas-error-alert mb-3" role="alert">
                {error}
              </div>
            )}

            {/* System Status Indicator Pill */}
            <div className={`${statusPillClass} mb-4`}>
              {checkingSystem ? (
                <span className="spinner-border spinner-border-sm saas-status-spinner" role="status" aria-hidden="true" />
              ) : (
                <span
                  className={`saas-status-dot ${
                    systemReady ? 'saas-status-dot-ready' : 'saas-status-dot-offline'
                  }`}
                />
              )}
              <span>{systemStatus}</span>
            </div>

            {/* Submit */}
            <button
              type="submit"
              className="btn saas-submit-btn w-100"
              disabled={loading || checkingSystem || !systemReady}
            >
              {checkingSystem ? 'Checking system...' : loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        {/* Footer */}
        <div className="saas-login-footer text-center">
          Oracle Reporting Tool <span className="mx-2">•</span> Contemporain Foods Inc.
        </div>
      </div>
    </div>
  );
}
