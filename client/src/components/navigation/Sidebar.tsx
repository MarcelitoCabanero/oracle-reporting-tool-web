import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  BarChart3,
  Calculator,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ReceiptText,
  Sun,
  WalletCards,
} from 'lucide-react';
import logo from '../../assets/jco-logo.png';

export type Page =
  | 'dashboard'
  | 'bom'
  | 'finance-insight'
  | 'hourly-sales'
  | 'system-sales'
  | 'menu-item'
  | 'tender-listing'
  | 'rof'
  | 'deposit';

export type Theme = 'light' | 'dark';

interface SidebarProps {
  activePage: Page;
  collapsed: boolean;
  onToggleCollapse?: () => void;
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onNavigate: (page: Page) => void;
  onLogout: () => void;
}

interface NavItemProps {
  label: string;
  page: Page;
  icon: ReactNode;
  activePage: Page;
  collapsed: boolean;
  disabled?: boolean;
  onNavigate: (page: Page) => void;
}

interface SidebarSectionProps {
  title: string;
  collapsed: boolean;
  defaultOpen?: boolean;
  children: ReactNode;
}

function NavItem({ label, page, icon, activePage, collapsed, disabled, onNavigate }: NavItemProps) {
  const active = activePage === page;

  return (
    <button
      type="button"
      className={`sidebar-nav-item btn border-0 w-100 d-flex align-items-center gap-3 text-start rounded-3 px-3 py-2 ${
        active ? 'active' : ''
      } ${disabled ? 'opacity-50' : ''}`}
      onClick={() => !disabled && onNavigate(page)}
      disabled={disabled}
      title={collapsed ? label : undefined}
      aria-label={collapsed ? label : undefined}
    >
      <span className="d-flex align-items-center sidebar-nav-icon">{icon}</span>
      <span className="sidebar-item-label flex-grow-1">{label}</span>
    </button>
  );
}

function SidebarSection({ title, collapsed, defaultOpen = true, children }: SidebarSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="sidebar-section-current mb-3">
      {!collapsed ? (
        <button
          type="button"
          className="btn border-0 w-100 d-flex align-items-center justify-content-between px-3 py-1 text-secondary sidebar-section-title"
          onClick={() => setOpen((current) => !current)}
        >
          <span>{title}</span>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
      ) : (
        <div className="sidebar-collapsed-divider" title={title} aria-hidden="true" />
      )}
      {(open || collapsed) && <div className="d-grid gap-1 mt-1">{children}</div>}
    </div>
  );
}

export function Sidebar({ activePage, collapsed, onToggleCollapse, theme, onThemeChange, onNavigate, onLogout }: SidebarProps) {
  const isDark = theme === 'dark';

  return (
    <aside className={`app-sidebar bg-white border-end d-flex flex-column flex-shrink-0 ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-brand d-flex align-items-center gap-2 px-3 py-3 border-bottom position-relative">
        <img src={logo} alt="Oracle Reporting Tool" className="sidebar-logo" />
        <div className="sidebar-brand-copy lh-sm">
          <div className="fw-bold">Oracle</div>
          <small className="text-secondary">Reporting Tool</small>
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="sidebar-edge-toggle"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={15} strokeWidth={2.5} /> : <ChevronLeft size={15} strokeWidth={2.5} />}
          </button>
        )}
      </div>

      <nav className="sidebar-nav-current flex-grow-1 overflow-auto py-3 px-2">
        <SidebarSection title="DASHBOARD" collapsed={collapsed}>
          <NavItem label="Dashboard" page="dashboard" icon={<LayoutDashboard size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem label="Finance Insight" page="finance-insight" icon={<BarChart3 size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} disabled />
        </SidebarSection>

        <SidebarSection title="REPORTS" collapsed={collapsed}>
          <NavItem label="Theoretical BOM" page="bom" icon={<Calculator size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem label="Hourly Sales" page="hourly-sales" icon={<Clock3 size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} disabled />
          <NavItem label="System Sales" page="system-sales" icon={<FileBarChart size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} disabled />
          <NavItem label="Menu Item" page="menu-item" icon={<Menu size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} disabled />
        </SidebarSection>

        <SidebarSection title="FINANCE" collapsed={collapsed}>
          <NavItem label="ROF" page="rof" icon={<ReceiptText size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
          <NavItem label="Deposit Monitoring" page="deposit" icon={<WalletCards size={18} />} activePage={activePage} collapsed={collapsed} onNavigate={onNavigate} />
        </SidebarSection>
      </nav>

      <div className="border-top p-2">
        <div className="sidebar-theme-control d-flex align-items-center justify-content-between rounded-3 px-3 py-2">
          <span className="sidebar-theme-label small">Mode</span>
          <button
            type="button"
            className={`theme-switch sidebar-theme-switch ${isDark ? 'active' : ''}`}
            role="switch"
            aria-checked={isDark}
            aria-label="Toggle dark mode"
            title={collapsed ? `${isDark ? 'Dark' : 'Light'} mode` : undefined}
            onClick={() => onThemeChange(isDark ? 'light' : 'dark')}
          >
            <span className="theme-track">
              <Sun size={14} className="theme-icon theme-icon-light" />
              <Moon size={14} className="theme-icon theme-icon-dark" />
              <span className="theme-thumb" />
            </span>
          </button>
        </div>
        <button
          type="button"
          className="sidebar-logout btn border-0 w-100 d-flex align-items-center gap-3 text-start rounded-3 px-3 py-2 text-danger"
          onClick={onLogout}
          title={collapsed ? 'Logout' : undefined}
        >
          <LogOut size={18} />
          <span className="sidebar-item-label">Logout</span>
        </button>
      </div>
    </aside>
  );
}
