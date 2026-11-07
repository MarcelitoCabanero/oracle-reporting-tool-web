import { useEffect, useRef } from 'react';
import { Clock, ShieldAlert } from 'lucide-react';
import { useAuth } from '../../features/auth/AuthContext';

function formatRemainingTime(seconds: number): string {
  const mins = Math.max(0, Math.floor(seconds / 60));
  const secs = Math.max(0, seconds % 60);
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function SessionTimeoutModal() {
  const { isExpiringSoon, remainingSeconds, stayLoggedIn, logout } = useAuth();
  const stayBtnRef = useRef<HTMLButtonElement | null>(null);

  // Auto-focus the primary "Stay Logged In" button when modal appears
  useEffect(() => {
    if (isExpiringSoon) {
      stayBtnRef.current?.focus();
    }
  }, [isExpiringSoon]);

  if (!isExpiringSoon) return null;

  return (
    <div
      className="session-timeout-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
    >
      <div className="session-timeout-card">
        <div className="session-timeout-icon-wrapper">
          <Clock size={28} />
        </div>

        <h3 id="session-timeout-title" className="session-timeout-title">
          Session Expiring Soon
        </h3>

        <p className="session-timeout-desc">
          You have been inactive for a while. For your security, your session will automatically end in:
        </p>

        <div className="session-timeout-timer" aria-live="polite">
          {formatRemainingTime(remainingSeconds)}
        </div>

        <div className="session-timeout-actions">
          <button
            ref={stayBtnRef}
            type="button"
            className="btn session-timeout-stay-btn"
            onClick={stayLoggedIn}
          >
            Stay Logged In
          </button>

          <button
            type="button"
            className="btn session-timeout-logout-btn d-inline-flex align-items-center justify-content-center gap-1"
            onClick={() => logout('You signed out of your session.')}
          >
            <ShieldAlert size={15} />
            <span>Log Out Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
