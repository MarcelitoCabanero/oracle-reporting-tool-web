import { Bell, UserRound } from 'lucide-react';

interface TopHeaderProps {
  title: string;
  version?: string;
  userName?: string;
  userRole?: string;
}

export function TopHeader({
  title,
  version = 'v0.1.0',
  userName = 'User',
  userRole = 'System User',
}: TopHeaderProps) {
  return (
    <header className="top-header-minimal bg-white border-bottom px-3 px-lg-4 py-2">
      <div className="d-flex align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-2">
          <h1 className="h6 fw-semibold mb-0">{title}</h1>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="header-version">{version}</span>

          <button
            type="button"
            className="btn header-notification header-minimal-icon d-flex align-items-center justify-content-center"
            aria-label="Notifications"
            title="Notifications"
          >
            <Bell size={18} />
          </button>

          <button
            type="button"
            className="btn header-user-button d-flex align-items-center gap-2 px-1 px-lg-2"
            title={userName}
          >
            <span className="user-avatar d-flex align-items-center justify-content-center rounded-circle">
              <UserRound size={17} />
            </span>
            <span className="d-none d-md-flex flex-column text-start lh-sm">
              <span className="fw-semibold small">{userName}</span>
              <small className="text-secondary">{userRole}</small>
            </span>
          </button>
        </div>
      </div>
    </header>
  );
}
