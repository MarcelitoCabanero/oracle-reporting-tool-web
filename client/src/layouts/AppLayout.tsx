import { useState, type ReactNode } from 'react';
import { Sidebar, type Page, type Theme } from '../components/navigation/Sidebar';
import { TopHeader } from '../components/navigation/TopHeader';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { useAuth } from '../features/auth/AuthContext';

interface AppLayoutProps {
  activePage: Page;
  onNavigate: (page: Page) => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  children: ReactNode;
}

function getPageTitle(page: Page): string {
  switch (page) {
    case 'dashboard':
      return 'Dashboard';
    case 'bom':
      return 'Theoretical BOM Requirements';
    case 'finance-insight':
      return 'Finance Insight';
    case 'hourly-sales':
      return 'Hourly Sales';
    case 'system-sales':
      return 'System Sales (Variance)';
    case 'menu-item':
      return 'Menu Item';
    case 'tender-listing':
      return 'Tender Listing';
    case 'rof':
      return 'Remittance of Funds';
    case 'deposit':
      return 'Deposit Monitoring';
    default:
      return 'Oracle Reporting Tool';
  }
}

export function AppLayout({
  activePage,
  onNavigate,
  theme,
  onThemeChange,
  children,
}: AppLayoutProps) {
  const { user, logout } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((current) => !current)}
        theme={theme}
        onThemeChange={onThemeChange}
        onLogout={() => setShowLogoutDialog(true)}
      />

      <div className="app-main d-flex flex-column flex-grow-1 min-w-0" style={{ height: '100vh', overflow: 'hidden' }}>
        <TopHeader
          title={getPageTitle(activePage)}
          version="v0.1.0"
          userName={user?.username}
          userRole={user?.access}
        />

        <main className="main-content flex-grow-1 overflow-auto p-3 p-lg-4" style={{ background: 'var(--app-bg)' }}>
          {children}
        </main>
      </div>

      <ConfirmDialog
        open={showLogoutDialog}
        title="Sign out?"
        message="Are you sure you want to sign out of Oracle Reporting Tool?"
        cancelText="Cancel"
        confirmText="Sign Out"
        onCancel={() => setShowLogoutDialog(false)}
        onConfirm={() => {
          setShowLogoutDialog(false);
          logout();
        }}
      />
    </div>
  );
}
