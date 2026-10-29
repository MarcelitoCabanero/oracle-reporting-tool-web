import type { ReactNode } from 'react';
import {
  Activity,
  Banknote,
  Calculator,
  Database,
  FileText,
  Monitor,
  ReceiptText,
  ShieldCheck,
  Store,
  TrendingUp,
} from 'lucide-react';
import type { Page } from '../components/navigation/Sidebar';
import { useAuth } from '../features/auth/AuthContext';

interface DashboardPageProps {
  onNavigate: (page: Page) => void;
}

export function DashboardPage({ onNavigate }: DashboardPageProps) {
  const { user } = useAuth();

  return (
    <div className="container-fluid p-0">
      {/* Welcome Banner */}
      <section className="bg-white border rounded-4 p-4 mb-4 shadow-sm">
        <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-3">
          <div>
            <div className="text-uppercase fw-bold small brand-text mb-2" style={{ color: 'var(--brand-orange)' }}>
              Overview
            </div>
            <h1 className="h4 fw-bold mb-2">Welcome back, {user?.username}</h1>
            <p className="text-secondary mb-0">
              Contemporain Foods Inc. internal reporting and analytics environment.
            </p>
          </div>

          <div className="d-flex align-items-center gap-3 bg-light border rounded-3 px-3 py-2">
            <div className="dashboard-icon-box text-primary">
              <Store size={20} />
            </div>
            <div className="lh-sm">
              <small className="text-secondary d-block mb-1">Assigned Role</small>
              <strong className="text-dark">{user?.access || 'Executive'}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* KPI Cards */}
      <section className="row g-3 mb-4">
        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Theoretical BOMs"
            value="Active"
            description="Multi-level recipe calculation"
            icon={<Calculator size={20} style={{ color: 'var(--brand-orange)' }} />}
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Transactions"
            value="~200M"
            description="dts_details historical lines"
            icon={<ReceiptText size={20} style={{ color: 'var(--brand-orange)' }} />}
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Database"
            value="OracleDB"
            description="MSSQL Server 2016"
            icon={<Database size={20} style={{ color: 'var(--brand-orange)' }} />}
          />
        </div>

        <div className="col-12 col-sm-6 col-xl-3">
          <KpiCard
            title="Deployment"
            value="LAN Target"
            description="Synology Container Manager"
            icon={<Monitor size={20} style={{ color: 'var(--brand-orange)' }} />}
          />
        </div>
      </section>

      {/* Bottom Cards: System Status & Quick Actions */}
      <section className="row g-3">
        <div className="col-12 col-xl-6">
          <div className="card border rounded-4 h-100 shadow-sm">
            <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-3">
              <div>
                <h2 className="h6 fw-bold mb-1">System Status</h2>
                <p className="small text-secondary mb-0">Current application environment</p>
              </div>
              <div className="dashboard-icon-box text-primary">
                <Activity size={19} />
              </div>
            </div>

            <div className="card-body p-0">
              <SystemInfo
                icon={<Database size={18} className="text-secondary" />}
                label="Database Host"
                value="192.168.5.201:1433 (OracleDB)"
                status="online"
              />
              <SystemInfo
                icon={<ShieldCheck size={18} className="text-secondary" />}
                label="Authenticated User"
                value={`${user?.username} (${user?.access})`}
              />
              <SystemInfo
                icon={<FileText size={18} className="text-secondary" />}
                label="Active Reporting Stored Procedure"
                value="dbo.usp_CalculateBOMRequirements"
                status="online"
              />
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card border rounded-4 h-100 shadow-sm">
            <div className="card-header bg-white border-bottom d-flex align-items-center justify-content-between py-3">
              <div>
                <h2 className="h6 fw-bold mb-1">Quick Actions</h2>
                <p className="small text-secondary mb-0">Frequently accessed modules</p>
              </div>
              <div className="dashboard-icon-box text-primary">
                <TrendingUp size={19} />
              </div>
            </div>

            <div className="card-body p-3">
              <div className="row g-2">
                <div className="col-12 col-md-6">
                  <QuickAction
                    icon={<Calculator size={19} style={{ color: 'var(--brand-orange)' }} />}
                    title="Theoretical BOM"
                    description="Calculate raw-material needs"
                    onClick={() => onNavigate('bom')}
                    highlight
                  />
                </div>

                <div className="col-12 col-md-6">
                  <QuickAction
                    icon={<TrendingUp size={19} className="text-secondary" />}
                    title="System Sales"
                    description="Variance Analysis (Scoping)"
                    onClick={() => onNavigate('system-sales')}
                  />
                </div>

                <div className="col-12 col-md-6">
                  <QuickAction
                    icon={<Banknote size={19} className="text-secondary" />}
                    title="Deposit Monitoring"
                    description="Review store deposits"
                    onClick={() => onNavigate('deposit')}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

interface KpiCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}

function KpiCard({ title, value, description, icon }: KpiCardProps) {
  return (
    <article className="card border rounded-4 h-100 shadow-sm bg-white">
      <div className="card-body d-flex align-items-center gap-3">
        <div
          className="dashboard-icon-box flex-shrink-0 d-flex align-items-center justify-content-center rounded-3"
          style={{ width: 44, height: 44, background: 'var(--brand-orange-soft)' }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <small className="text-secondary d-block mb-1">{title}</small>
          <div className="fs-4 fw-bold lh-sm mb-1">{value}</div>
          <small className="text-secondary" style={{ fontSize: '0.75rem' }}>{description}</small>
        </div>
      </div>
    </article>
  );
}

interface SystemInfoProps {
  icon: ReactNode;
  label: string;
  value: string;
  status?: 'online';
}

function SystemInfo({ icon, label, value, status }: SystemInfoProps) {
  return (
    <div className="d-flex align-items-center gap-3 px-3 py-3 border-bottom">
      <div className="dashboard-icon-box flex-shrink-0">{icon}</div>
      <div className="flex-grow-1 min-w-0">
        <small className="text-secondary d-block mb-1">{label}</small>
        <strong className="d-block text-truncate small">{value}</strong>
      </div>
      {status && (
        <span className="badge text-bg-success bg-opacity-10 text-success border border-success border-opacity-25">
          Online
        </span>
      )}
    </div>
  );
}

interface QuickActionProps {
  icon: ReactNode;
  title: string;
  description: string;
  onClick: () => void;
  highlight?: boolean;
}

function QuickAction({ icon, title, description, onClick, highlight }: QuickActionProps) {
  return (
    <button
      type="button"
      className={`btn ${
        highlight ? 'btn-outline-primary border-primary' : 'btn-light border'
      } rounded-3 w-100 h-100 d-flex align-items-center gap-3 text-start p-3`}
      onClick={onClick}
    >
      <span className="dashboard-icon-box flex-shrink-0">{icon}</span>
      <span className="min-w-0">
        <strong className="d-block mb-1 small">{title}</strong>
        <small className="text-secondary d-block" style={{ fontSize: '0.75rem' }}>{description}</small>
      </span>
    </button>
  );
}
