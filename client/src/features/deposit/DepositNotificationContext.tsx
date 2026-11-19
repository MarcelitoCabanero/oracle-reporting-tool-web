import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from '../auth/AuthContext';

export type DepositThreadCategory =
  | 'PETTY_CASH'
  | 'PETTY_CASH_REPLENISH'
  | 'OPEN_SALES'
  | 'DEPT_EXPENSE'
  | 'APPROVAL'
  | 'DELETE_REQUEST'
  | 'GENERAL';

export interface DeductionApprovalNotification {
  notificationKey: string;
  type: 'DEDUCTION_APPROVAL';
  depositId: number;
  locationName: string;
  businessDate: string;
  depositDate: string;
  depositReference: string;
  depositAmount: number;
  pettyCash: number;
  pettyCashStatus: string;
  openSales: number;
  openSalesSourceDate: string | null;
  otherDepartmentExpense: number;
  deptExpDepartment: string | null;
  deptExpBorrower: string | null;
  timestamp: string;
}

export interface DeleteRequestNotification {
  notificationKey: string;
  type: 'DELETE_REQUEST';
  depositId: number;
  locationName: string;
  businessDate: string;
  depositDate: string;
  depositReference: string;
  depositAmount: number;
  deleteReason: string;
  deleteRequestedBy: string;
  deleteRequestedAt: string | null;
  timestamp: string;
}

export interface StoreUpdateNotification {
  notificationKey: string;
  type: 'STORE_UPDATE';
  threadId: number;
  depositId: number;
  locationName: string;
  businessDate: string;
  depositAmount: number;
  category: DepositThreadCategory;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string | null;
  approvalStatus: string;
  pettyCashStatus: string;
  timestamp: string;
}

export interface DepositNotificationCounts {
  totalActionable: number;
  pendingApprovalCount: number;
  pendingDeleteCount: number;
  recentUpdateCount: number;
}

export interface DepositDeepLinkTarget {
  depositId: number;
  locationName: string;
  businessDate: string;
  requestedAt: number;
}

interface DepositNotificationContextValue {
  canViewApprovalNotifications: boolean;
  counts: DepositNotificationCounts;
  pendingApprovals: DeductionApprovalNotification[];
  pendingDeletes: DeleteRequestNotification[];
  recentStoreUpdates: StoreUpdateNotification[];
  loadingNotifications: boolean;
  lastRefreshedAt: string | null;
  refreshNotifications: () => Promise<void>;
  isSeen: (notificationKey: string) => boolean;
  markAsSeen: (notificationKey: string) => void;
  markAllAsSeen: () => void;
  unseenActionableCount: number;
  deepLinkTarget: DepositDeepLinkTarget | null;
  openDepositFromNotification: (
    target: { depositId: number; locationName: string; businessDate: string },
    notificationKey?: string
  ) => void;
  clearDeepLinkTarget: () => void;
}

const DepositNotificationContext = createContext<DepositNotificationContextValue | undefined>(
  undefined
);

const SEEN_STORAGE_PREFIX = 'oracle_depo_notif_seen_';
const POLL_INTERVAL_MS = 30_000;

function loadSeenSet(username: string | undefined): Set<string> {
  if (!username) return new Set();
  try {
    const raw = window.localStorage.getItem(`${SEEN_STORAGE_PREFIX}${username}`);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.map(String)) : new Set();
  } catch {
    return new Set();
  }
}

function saveSeenSet(username: string | undefined, set: Set<string>): void {
  if (!username) return;
  try {
    // Keep up to 500 most recent keys so localStorage stays compact
    const arr = Array.from(set).slice(-500);
    window.localStorage.setItem(`${SEEN_STORAGE_PREFIX}${username}`, JSON.stringify(arr));
  } catch {
    // Ignore localStorage quota issues
  }
}

export function DepositNotificationProvider({
  onNavigateToDeposit,
  children,
}: {
  onNavigateToDeposit: () => void;
  children: ReactNode;
}) {
  const { user, token } = useAuth();

  const canViewApprovalNotifications = useMemo(() => {
    const role = (user?.access ?? '').trim().toLowerCase();
    return role === 'area manager' || role === 'admin';
  }, [user?.access]);

  const [counts, setCounts] = useState<DepositNotificationCounts>({
    totalActionable: 0,
    pendingApprovalCount: 0,
    pendingDeleteCount: 0,
    recentUpdateCount: 0,
  });
  const [pendingApprovals, setPendingApprovals] = useState<DeductionApprovalNotification[]>([]);
  const [pendingDeletes, setPendingDeletes] = useState<DeleteRequestNotification[]>([]);
  const [recentStoreUpdates, setRecentStoreUpdates] = useState<StoreUpdateNotification[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState<boolean>(false);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(null);

  const [seenKeys, setSeenKeys] = useState<Set<string>>(() => loadSeenSet(user?.username));
  const [deepLinkTarget, setDeepLinkTarget] = useState<DepositDeepLinkTarget | null>(null);

  // Sync seenKeys when user changes
  useEffect(() => {
    setSeenKeys(loadSeenSet(user?.username));
  }, [user?.username]);

  const refreshNotifications = useCallback(async () => {
    if (!token || !canViewApprovalNotifications) {
      setCounts({
        totalActionable: 0,
        pendingApprovalCount: 0,
        pendingDeleteCount: 0,
        recentUpdateCount: 0,
      });
      setPendingApprovals([]);
      setPendingDeletes([]);
      setRecentStoreUpdates([]);
      return;
    }

    setLoadingNotifications(true);
    try {
      const response = await fetch('/api/reports/deposit/notifications', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const data = await response.json();

      setCounts(
        data.counts ?? {
          totalActionable: 0,
          pendingApprovalCount: 0,
          pendingDeleteCount: 0,
          recentUpdateCount: 0,
        }
      );
      setPendingApprovals(Array.isArray(data.pendingApprovals) ? data.pendingApprovals : []);
      setPendingDeletes(Array.isArray(data.pendingDeletes) ? data.pendingDeletes : []);
      setRecentStoreUpdates(Array.isArray(data.recentStoreUpdates) ? data.recentStoreUpdates : []);

      const now = new Date();
      setLastRefreshedAt(
        now.toLocaleTimeString('en-PH', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    } catch (err) {
      console.error('Error refreshing Deposit Monitoring notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  }, [token, canViewApprovalNotifications]);

  // Initial fetch & periodic 30-second polling
  useEffect(() => {
    if (!token || !canViewApprovalNotifications) return;

    void refreshNotifications();

    const interval = window.setInterval(() => {
      void refreshNotifications();
    }, POLL_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [token, canViewApprovalNotifications, refreshNotifications]);

  const isSeen = useCallback(
    (notificationKey: string) => seenKeys.has(notificationKey),
    [seenKeys]
  );

  const markAsSeen = useCallback(
    (notificationKey: string) => {
      if (!notificationKey) return;
      setSeenKeys((prev) => {
        if (prev.has(notificationKey)) return prev;
        const next = new Set(prev);
        next.add(notificationKey);
        saveSeenSet(user?.username, next);
        return next;
      });
    },
    [user?.username]
  );

  const markAllAsSeen = useCallback(() => {
    setSeenKeys((prev) => {
      const next = new Set(prev);
      for (const item of pendingApprovals) next.add(item.notificationKey);
      for (const item of pendingDeletes) next.add(item.notificationKey);
      for (const item of recentStoreUpdates) next.add(item.notificationKey);
      saveSeenSet(user?.username, next);
      return next;
    });
  }, [pendingApprovals, pendingDeletes, recentStoreUpdates, user?.username]);

  const unseenActionableCount = useMemo(() => {
    let count = 0;
    for (const item of pendingApprovals) {
      if (!seenKeys.has(item.notificationKey)) count++;
    }
    for (const item of pendingDeletes) {
      if (!seenKeys.has(item.notificationKey)) count++;
    }
    return count;
  }, [pendingApprovals, pendingDeletes, seenKeys]);

  const openDepositFromNotification = useCallback(
    (
      target: { depositId: number; locationName: string; businessDate: string },
      notificationKey?: string
    ) => {
      if (notificationKey) {
        markAsSeen(notificationKey);
      }
      setDeepLinkTarget({
        depositId: target.depositId,
        locationName: target.locationName,
        businessDate: target.businessDate,
        requestedAt: Date.now(),
      });
      onNavigateToDeposit();
    },
    [markAsSeen, onNavigateToDeposit]
  );

  const clearDeepLinkTarget = useCallback(() => {
    setDeepLinkTarget(null);
  }, []);

  const contextValue = useMemo<DepositNotificationContextValue>(
    () => ({
      canViewApprovalNotifications,
      counts,
      pendingApprovals,
      pendingDeletes,
      recentStoreUpdates,
      loadingNotifications,
      lastRefreshedAt,
      refreshNotifications,
      isSeen,
      markAsSeen,
      markAllAsSeen,
      unseenActionableCount,
      deepLinkTarget,
      openDepositFromNotification,
      clearDeepLinkTarget,
    }),
    [
      canViewApprovalNotifications,
      counts,
      pendingApprovals,
      pendingDeletes,
      recentStoreUpdates,
      loadingNotifications,
      lastRefreshedAt,
      refreshNotifications,
      isSeen,
      markAsSeen,
      markAllAsSeen,
      unseenActionableCount,
      deepLinkTarget,
      openDepositFromNotification,
      clearDeepLinkTarget,
    ]
  );

  return (
    <DepositNotificationContext.Provider value={contextValue}>
      {children}
    </DepositNotificationContext.Provider>
  );
}

export function useDepositNotifications(): DepositNotificationContextValue {
  const ctx = useContext(DepositNotificationContext);
  if (!ctx) {
    throw new Error('useDepositNotifications must be used within a DepositNotificationProvider');
  }
  return ctx;
}
