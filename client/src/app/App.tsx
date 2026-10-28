import { useEffect, useState } from 'react';

type HealthState = 'checking' | 'online' | 'offline';

export function App() {
  const [apiState, setApiState] = useState<HealthState>('checking');

  useEffect(() => {
    const controller = new AbortController();

    fetch('/api/health', { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('API health check failed');
        return response.json() as Promise<{ status: string }>;
      })
      .then((data) => setApiState(data.status === 'ok' ? 'online' : 'offline'))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setApiState('offline');
      });

    return () => controller.abort();
  }, []);

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark">OR</div>
        <div className="brand-copy">
          <strong>Oracle Reporting</strong>
          <span>Internal analytics</span>
        </div>
        <div className="nav-label">WORKSPACE</div>
        <button className="nav-item active" type="button">Overview</button>
        <div className="nav-label">REPORTS</div>
        <button className="nav-item" type="button" disabled>KPI &amp; Top Sales Stores</button>
        <button className="nav-item" type="button" disabled>Deposit Monitoring</button>
        <button className="nav-item" type="button" disabled>Variance Analysis</button>
        <button className="nav-item" type="button" disabled>BOM / Inventory Analysis</button>
        <div className="sidebar-footer">Foundation milestone · v0.1.0</div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <div className="eyebrow">REPORTING WORKSPACE</div>
            <h1>Overview</h1>
          </div>
          <div className={`api-status ${apiState}`}>
            <span className="status-dot" />
            API {apiState === 'checking' ? 'checking' : apiState}
          </div>
        </header>

        <section className="welcome-panel">
          <div>
            <div className="eyebrow light">PROJECT FOUNDATION</div>
            <h2>A clearer view of store performance.</h2>
            <p>The application shell is ready for the reporting modules to be added incrementally.</p>
          </div>
          <div className="welcome-symbol" aria-hidden="true">OR</div>
        </section>

        <section className="section-heading">
          <div>
            <div className="eyebrow">NEXT IMPLEMENTATION</div>
            <h2>Reporting modules</h2>
          </div>
          <span className="muted">Planned · not connected to production data</span>
        </section>

        <section className="module-grid">
          <article className="module-card featured">
            <div className="module-icon">BOM</div>
            <div className="module-status">NEXT UP</div>
            <h3>Theoretical BOM Requirements</h3>
            <p>Calculate theoretical raw-material requirements from sold finished goods, with multi-level recipe traceability.</p>
            <ul>
              <li>Business date and store filters</li>
              <li>Single finished good or all finished goods</li>
              <li>Consolidated raw-material summary</li>
              <li>Multi-level calculation trace</li>
            </ul>
          </article>
          <article className="module-card">
            <div className="module-icon">VAR</div>
            <h3>Variance Analysis</h3>
            <p>Reserved for the existing variance workflow and its validated business rules.</p>
            <span className="coming-soon">Planned</span>
          </article>
          <article className="module-card">
            <div className="module-icon">KPI</div>
            <h3>KPI &amp; Top Sales Stores</h3>
            <p>Store-level sales performance and KPI reporting.</p>
            <span className="coming-soon">Planned</span>
          </article>
        </section>

        <footer className="page-footer">
          SQL Server access is handled by the API only. No database credentials are exposed in the browser.
        </footer>
      </main>
    </div>
  );
}
