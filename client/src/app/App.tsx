import { useEffect, useState } from 'react';
import { AppLayout } from '../layouts/AppLayout';
import { LoginForm } from '../features/auth/LoginForm';
import { DashboardPage } from '../pages/DashboardPage';
import { BomReport } from '../features/bom/BomReport';
import { RofReport } from '../features/rof/RofReport';
import { DepositMonitoring } from '../features/deposit/DepositMonitoring';
import { useAuth } from '../features/auth/AuthContext';
import type { Page, Theme } from '../components/navigation/Sidebar';
import logo from '../assets/jco-logo.png';

const themeStorageKey = 'oracle-reporting-tool-theme';
const activePageStorageKey = 'oracle-reporting-active-page';

const validPages: Page[] = [
  'dashboard',
  'bom',
  'finance-insight',
  'hourly-sales',
  'system-sales',
  'menu-item',
  'tender-listing',
  'rof',
  'deposit',
];

function getInitialTheme(): Theme {
  const savedTheme = window.localStorage.getItem(themeStorageKey);
  return savedTheme === 'dark' ? 'dark' : 'light';
}

function getInitialPage(): Page {
  const saved = window.sessionStorage.getItem(activePageStorageKey) as Page | null;
  if (saved && validPages.includes(saved)) {
    return saved;
  }
  return 'bom';
}

function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="system-sales-placeholder">
      <h5 className="fw-bold text-dark">{title}</h5>
      <p className="text-secondary">{description}</p>
    </div>
  );
}

export function App() {
  const [activePage, setActivePage] = useState<Page>(getInitialPage);
  const [visitedPages, setVisitedPages] = useState<Record<string, boolean>>(() => ({
    [getInitialPage()]: true,
  }));
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const { user, isLoading } = useAuth();

  function handleNavigate(nextPage: Page) {
    setActivePage(nextPage);
    setVisitedPages((prev) => (prev[nextPage] ? prev : { ...prev, [nextPage]: true }));
    window.sessionStorage.setItem(activePageStorageKey, nextPage);
  }

  function changeTheme(nextTheme: Theme) {
    setTheme(nextTheme);
    window.localStorage.setItem(themeStorageKey, nextTheme);
  }

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  if (isLoading) {
    return (
      <div
        className="min-vh-100 d-flex flex-column align-items-center justify-content-center gap-3"
        style={{ background: 'var(--app-bg)' }}
      >
        <img
          src={logo}
          alt="Oracle Reporting Tool"
          style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain' }}
        />
        <div className="d-flex align-items-center gap-2 text-secondary small">
          <span className="spinner-border spinner-border-sm text-primary" role="status" aria-hidden="true" />
          <span>Loading Oracle Reporting Tool...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginForm />;
  }

  function renderPlaceholderPage() {
    switch (activePage) {
      case 'system-sales':
        return (
          <PlaceholderPage
            title="Variance Analysis (System Sales)"
            description="Actual consumption scoping is in progress. Theoretical BOM requirements are currently active under the Theoretical BOM module."
          />
        );

      case 'finance-insight':
        return (
          <PlaceholderPage
            title="Finance Insight"
            description="Financial performance and analytical dashboards across store locations."
          />
        );

      case 'hourly-sales':
        return (
          <PlaceholderPage
            title="Hourly Sales"
            description="Hourly store sales breakdown and peak performance analytics."
          />
        );

      case 'menu-item':
        return (
          <PlaceholderPage
            title="Menu Item Sales"
            description="Product and menu item volume performance."
          />
        );

      case 'tender-listing':
        return (
          <PlaceholderPage
            title="Tender Listing"
            description="Payment tender methods, credit/debit collections, and cash reconciliation."
          />
        );

      default:
        return null;
    }
  }

  return (
    <AppLayout
      activePage={activePage}
      onNavigate={handleNavigate}
      theme={theme}
      onThemeChange={changeTheme}
    >
      {/* Keep active report modules mounted once visited so switching pages preserves state & scroll position */}
      {(visitedPages.dashboard || activePage === 'dashboard') && (
        <div style={{ display: activePage === 'dashboard' ? 'block' : 'none' }}>
          <DashboardPage onNavigate={handleNavigate} />
        </div>
      )}

      {(visitedPages.bom || activePage === 'bom') && (
        <div style={{ display: activePage === 'bom' ? 'block' : 'none' }}>
          <BomReport />
        </div>
      )}

      {(visitedPages.rof || activePage === 'rof') && (
        <div style={{ display: activePage === 'rof' ? 'block' : 'none' }}>
          <RofReport />
        </div>
      )}

      {(visitedPages.deposit || activePage === 'deposit') && (
        <div style={{ display: activePage === 'deposit' ? 'block' : 'none' }}>
          <DepositMonitoring />
        </div>
      )}

      {renderPlaceholderPage()}
    </AppLayout>
  );
}

export default App;
