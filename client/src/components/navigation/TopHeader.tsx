import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  CheckCheck,
  Clock,
  FileWarning,
  MessageSquareText,
  RefreshCw,
  Trash2,
  UserRound,
  WalletCards,
} from 'lucide-react';
import {
  useDepositNotifications,
  type DeductionApprovalNotification,
  type DeleteRequestNotification,
  type StoreUpdateNotification,
} from '../../features/deposit/DepositNotificationContext';

interface TopHeaderProps {
  title: string;
  version?: string;
  userName?: string;
  userRole?: string;
}

type NotificationTab = 'all' | 'approvals' | 'deletes' | 'updates';

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(value: string): string {
  if (!value) return '—';
  const clean = value.includes('T') ? value.split('T')[0] : value;
  const date = new Date(`${clean}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatWallClockDateTime(value: string | null | undefined): string {
  if (!value) return '';
  const normalized = value.endsWith('Z') ? value.slice(0, 19) : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function TopHeader({
  title,
  version = 'v0.1.0',
  userName = 'User',
  userRole = 'System User',
}: TopHeaderProps) {
  const {
    canViewApprovalNotifications,
    counts,
    pendingApprovals,
    pendingDeletes,
    recentStoreUpdates,
    loadingNotifications,
    lastRefreshedAt,
    refreshNotifications,
    isSeen,
    markAllAsSeen,
    unseenActionableCount,
    openDepositFromNotification,
  } = useDepositNotifications();

  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<NotificationTab>('all');
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Close popover on outside click or Escape key
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function handleToggleBell() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen && canViewApprovalNotifications) {
      void refreshNotifications();
    }
  }

  function handleSelectApprovalItem(item: DeductionApprovalNotification) {
    setOpen(false);
    openDepositFromNotification(
      {
        depositId: item.depositId,
        locationName: item.locationName,
        businessDate: item.businessDate,
      },
      item.notificationKey
    );
  }

  function handleSelectDeleteItem(item: DeleteRequestNotification) {
    setOpen(false);
    openDepositFromNotification(
      {
        depositId: item.depositId,
        locationName: item.locationName,
        businessDate: item.businessDate,
      },
      item.notificationKey
    );
  }

  function handleSelectStoreUpdateItem(item: StoreUpdateNotification) {
    setOpen(false);
    openDepositFromNotification(
      {
        depositId: item.depositId,
        locationName: item.locationName,
        businessDate: item.businessDate,
      },
      item.notificationKey
    );
  }

  const actionableCount = counts.totalActionable;
  const badgeLabel = actionableCount > 99 ? '99+' : String(actionableCount);

  return (
    <header className="top-header-minimal bg-white border-bottom px-3 px-lg-4 py-2">
      <div className="d-flex align-items-center justify-content-between gap-3">
        <div className="d-flex align-items-center gap-2">
          <h1 className="h6 fw-semibold mb-0">{title}</h1>
        </div>

        <div className="d-flex align-items-center gap-2">
          <span className="header-version">{version}</span>

          <div className="position-relative" ref={containerRef}>
            <button
              type="button"
              className={`btn header-notification header-minimal-icon d-flex align-items-center justify-content-center position-relative ${
                open ? 'active' : ''
              }`}
              aria-label={
                canViewApprovalNotifications && actionableCount > 0
                  ? `Notifications (${actionableCount} pending approvals)`
                  : 'Notifications'
              }
              aria-expanded={open}
              title={
                canViewApprovalNotifications
                  ? `${actionableCount} pending deposit approval(s)`
                  : 'Notifications'
              }
              onClick={handleToggleBell}
            >
              <Bell size={18} />
              {canViewApprovalNotifications && actionableCount > 0 && (
                <span
                  className={`depo-header-bell-badge ${
                    unseenActionableCount > 0 ? 'has-unseen' : ''
                  }`}
                >
                  {badgeLabel}
                </span>
              )}
            </button>

            {open && (
              <div
                className="depo-notif-popover shadow-lg"
                role="dialog"
                aria-label="Deposit Monitoring Notifications"
              >
                {/* Popover Header */}
                <div className="depo-notif-header">
                  <div className="d-flex align-items-center justify-content-between gap-2">
                    <div className="d-flex align-items-center gap-2">
                      <span className="depo-notif-header-icon">
                        <Bell size={16} />
                      </span>
                      <div>
                        <div className="fw-bold small lh-sm">Deposit Approvals &amp; Alerts</div>
                        <div className="depo-notif-subtitle">
                          {canViewApprovalNotifications
                            ? `${actionableCount} pending actionable request(s)`
                            : 'Area Manager notifications'}
                          {lastRefreshedAt ? ` • Updated ${lastRefreshedAt}` : ''}
                        </div>
                      </div>
                    </div>

                    {canViewApprovalNotifications && (
                      <div className="d-flex align-items-center gap-1">
                        <button
                          type="button"
                          className="btn btn-sm depo-notif-action-btn"
                          onClick={() => void refreshNotifications()}
                          disabled={loadingNotifications}
                          title="Refresh notifications"
                        >
                          <RefreshCw size={13} className={loadingNotifications ? 'spin' : ''} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm depo-notif-action-btn d-inline-flex align-items-center gap-1"
                          onClick={markAllAsSeen}
                          title="Mark all current notifications as seen"
                        >
                          <CheckCheck size={13} />
                          <span>Mark Seen</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Filter Tabs */}
                  {canViewApprovalNotifications && (
                    <div className="depo-notif-tabs mt-2">
                      <button
                        type="button"
                        className={`depo-notif-tab ${activeTab === 'all' ? 'active' : ''}`}
                        onClick={() => setActiveTab('all')}
                      >
                        <span>All Pending</span>
                        <span className="depo-notif-tab-count">{counts.totalActionable}</span>
                      </button>
                      <button
                        type="button"
                        className={`depo-notif-tab ${activeTab === 'approvals' ? 'active' : ''}`}
                        onClick={() => setActiveTab('approvals')}
                      >
                        <span>Deductions</span>
                        <span className="depo-notif-tab-count">{counts.pendingApprovalCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`depo-notif-tab ${activeTab === 'deletes' ? 'active' : ''}`}
                        onClick={() => setActiveTab('deletes')}
                      >
                        <span>Deletes</span>
                        <span className="depo-notif-tab-count">{counts.pendingDeleteCount}</span>
                      </button>
                      <button
                        type="button"
                        className={`depo-notif-tab ${activeTab === 'updates' ? 'active' : ''}`}
                        onClick={() => setActiveTab('updates')}
                      >
                        <span>Updates</span>
                        <span className="depo-notif-tab-count">{counts.recentUpdateCount}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Popover Body */}
                <div className="depo-notif-body">
                  {!canViewApprovalNotifications ? (
                    <div className="depo-notif-empty">
                      <Bell size={26} className="text-secondary mb-2" />
                      <div className="fw-semibold small">Area Manager Notifications</div>
                      <div className="small text-secondary">
                        Approval notifications are enabled for Area Manager and Admin accounts.
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* 1. Pending Delete Requests (shown in 'all' and 'deletes') */}
                      {(activeTab === 'all' || activeTab === 'deletes') &&
                        pendingDeletes.map((item) => {
                          const seen = isSeen(item.notificationKey);
                          return (
                            <button
                              key={item.notificationKey}
                              type="button"
                              className={`depo-notif-item is-delete ${seen ? 'is-seen' : 'is-unseen'}`}
                              onClick={() => handleSelectDeleteItem(item)}
                            >
                              <div className="depo-notif-item-icon is-delete">
                                <Trash2 size={16} />
                              </div>
                              <div className="depo-notif-item-content">
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                    {!seen && <span className="depo-notif-unseen-dot" />}
                                    <span className="depo-notif-store-tag">{item.locationName}</span>
                                    <span className="depo-notif-type-badge is-delete">
                                      Pending Delete
                                    </span>
                                  </div>
                                  <span className="depo-notif-time">
                                    #{item.depositId}
                                  </span>
                                </div>

                                <div className="depo-notif-main-line">
                                  Business Date: <strong>{formatDisplayDate(item.businessDate)}</strong>{' '}
                                  • Deposit: <strong>₱{formatMoney(item.depositAmount)}</strong>
                                </div>

                                <div className="depo-notif-reason-box">
                                  <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
                                  <span>
                                    <strong>{item.deleteRequestedBy}:</strong> &ldquo;{item.deleteReason}&rdquo;
                                  </span>
                                </div>

                                {item.deleteRequestedAt && (
                                  <div className="depo-notif-meta-footer">
                                    <Clock size={11} />
                                    <span>Requested {formatWallClockDateTime(item.deleteRequestedAt)}</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}

                      {/* 2. Pending Deduction Approvals (shown in 'all' and 'approvals') */}
                      {(activeTab === 'all' || activeTab === 'approvals') &&
                        pendingApprovals.map((item) => {
                          const seen = isSeen(item.notificationKey);
                          return (
                            <button
                              key={item.notificationKey}
                              type="button"
                              className={`depo-notif-item is-approval ${seen ? 'is-seen' : 'is-unseen'}`}
                              onClick={() => handleSelectApprovalItem(item)}
                            >
                              <div className="depo-notif-item-icon is-approval">
                                <FileWarning size={16} />
                              </div>
                              <div className="depo-notif-item-content">
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                    {!seen && <span className="depo-notif-unseen-dot" />}
                                    <span className="depo-notif-store-tag">{item.locationName}</span>
                                    <span className="depo-notif-type-badge is-approval">
                                      Pending Approval
                                    </span>
                                  </div>
                                  <span className="depo-notif-time">#{item.depositId}</span>
                                </div>

                                <div className="depo-notif-main-line">
                                  Business Date: <strong>{formatDisplayDate(item.businessDate)}</strong>{' '}
                                  • Deposit: <strong>₱{formatMoney(item.depositAmount)}</strong>
                                </div>

                                <div className="depo-notif-deduction-chips">
                                  {item.pettyCash > 0 && (
                                    <span className="depo-notif-deduction-chip is-petty">
                                      Petty Cash: ₱{formatMoney(item.pettyCash)} ({item.pettyCashStatus})
                                    </span>
                                  )}
                                  {item.openSales > 0 && (
                                    <span className="depo-notif-deduction-chip is-opensales">
                                      Open Sales: ₱{formatMoney(item.openSales)}
                                      {item.openSalesSourceDate
                                        ? ` (From ${formatDisplayDate(item.openSalesSourceDate)})`
                                        : ''}
                                    </span>
                                  )}
                                  {item.otherDepartmentExpense > 0 && (
                                    <span className="depo-notif-deduction-chip is-deptexp">
                                      Other Exp: ₱{formatMoney(item.otherDepartmentExpense)}
                                      {item.deptExpDepartment
                                        ? ` (${item.deptExpDepartment})`
                                        : ''}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          );
                        })}

                      {/* 3. Recent Store Updates / Petty Cash Replenishments (shown in 'updates') */}
                      {activeTab === 'updates' &&
                        recentStoreUpdates.map((item) => {
                          const seen = isSeen(item.notificationKey);
                          const isReplenish = item.category === 'PETTY_CASH_REPLENISH';
                          return (
                            <button
                              key={item.notificationKey}
                              type="button"
                              className={`depo-notif-item is-update ${seen ? 'is-seen' : 'is-unseen'}`}
                              onClick={() => handleSelectStoreUpdateItem(item)}
                            >
                              <div className="depo-notif-item-icon is-update">
                                {isReplenish ? (
                                  <WalletCards size={16} />
                                ) : (
                                  <MessageSquareText size={16} />
                                )}
                              </div>
                              <div className="depo-notif-item-content">
                                <div className="d-flex align-items-center justify-content-between gap-2 mb-1">
                                  <div className="d-flex align-items-center gap-1.5 flex-wrap">
                                    {!seen && <span className="depo-notif-unseen-dot" />}
                                    <span className="depo-notif-store-tag">{item.locationName}</span>
                                    <span
                                      className={`depo-notif-type-badge ${
                                        isReplenish ? 'is-replenish' : 'is-update'
                                      }`}
                                    >
                                      {isReplenish ? 'Petty Cash Replenished' : item.category}
                                    </span>
                                  </div>
                                  <span className="depo-notif-time">#{item.depositId}</span>
                                </div>

                                <div className="depo-notif-main-line">
                                  Business Date: <strong>{formatDisplayDate(item.businessDate)}</strong>{' '}
                                  • By <strong>{item.authorName}</strong>
                                </div>

                                <div className="depo-notif-message-preview">{item.message}</div>

                                {item.createdAt && (
                                  <div className="depo-notif-meta-footer">
                                    <Clock size={11} />
                                    <span>{formatWallClockDateTime(item.createdAt)}</span>
                                  </div>
                                )}
                              </div>
                            </button>
                          );
                        })}

                      {/* Empty states per tab */}
                      {activeTab === 'all' && counts.totalActionable === 0 && (
                        <div className="depo-notif-empty">
                          <CheckCheck size={28} className="text-success mb-2" />
                          <div className="fw-semibold small">All Caught Up!</div>
                          <div className="small text-secondary">
                            No pending deposit deduction approvals or delete requests.
                          </div>
                        </div>
                      )}

                      {activeTab === 'approvals' && pendingApprovals.length === 0 && (
                        <div className="depo-notif-empty">
                          <CheckCheck size={28} className="text-success mb-2" />
                          <div className="fw-semibold small">No Pending Deduction Approvals</div>
                          <div className="small text-secondary">
                            All store deposit deductions have been reviewed.
                          </div>
                        </div>
                      )}

                      {activeTab === 'deletes' && pendingDeletes.length === 0 && (
                        <div className="depo-notif-empty">
                          <CheckCheck size={28} className="text-success mb-2" />
                          <div className="fw-semibold small">No Pending Delete Requests</div>
                          <div className="small text-secondary">
                            There are no store deposit deletion requests awaiting approval.
                          </div>
                        </div>
                      )}

                      {activeTab === 'updates' && recentStoreUpdates.length === 0 && (
                        <div className="depo-notif-empty">
                          <MessageSquareText size={26} className="text-secondary mb-2" />
                          <div className="fw-semibold small">No Recent Store Thread Updates</div>
                          <div className="small text-secondary">
                            Recent petty cash replenishments and store thread remarks will appear here.
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            )}
          </div>

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
