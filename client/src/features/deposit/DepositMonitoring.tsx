import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  FileCheck2,
  ImageIcon,
  MessageSquarePlus,
  MessageSquareText,
  Paperclip,
  RefreshCw,
  RotateCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  WalletCards,
  X,
  XCircle,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { StoreSearchSelect } from '../../components/common/StoreSearchSelect';
import {
  useDepositNotifications,
  type DepositThreadCategory,
} from './DepositNotificationContext';

export interface StoreOption {
  LOCATIONID: number;
  LOCATIONNAME: string;
  ORGLOCATIONREF: string;
}

export type DepositApprovalStatus = 'Not Required' | 'Pending' | 'Approved' | 'Rejected';
export type PettyCashStatus = 'N/A' | 'Unreplenished' | 'Replenished';
export type DepositDeleteStatus =
  | 'None'
  | 'Pending Delete'
  | 'Delete Approved'
  | 'Delete Rejected';

export interface DepositRecord {
  depositId: number;
  locationName: string;
  businessDate: string;
  depositDate: string;
  depositReference: string;
  posAmount: number;
  depositAmount: number;
  pettyCash: number;
  bir2307: number;
  openSales: number;
  otherDepartmentExpense: number;
  variance: number;
  filename: string;
  approvalStatus: DepositApprovalStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  pettyCashStatus: PettyCashStatus;
  pettyCashReplenishedAt: string | null;
  openSalesSourceDate: string | null;
  deptExpDepartment: string | null;
  deptExpBorrower: string | null;
  deleteStatus: DepositDeleteStatus;
  deleteReason: string | null;
  deleteRequestedBy: string | null;
  deleteRequestedAt: string | null;
  deleteApprovedBy: string | null;
  deleteApprovedAt: string | null;
  threadCount: number;
  attachmentCount: number;
}

export interface DepositAttachmentItem {
  attachmentId: number;
  depositId: number;
  threadId: number | null;
  category: DepositThreadCategory;
  filename: string;
  uploadedBy: string;
  uploadedAt: string | null;
}

export interface DepositThreadItem {
  threadId: number;
  depositId: number;
  category: DepositThreadCategory;
  authorName: string;
  authorRole: string;
  message: string;
  createdAt: string | null;
  attachments: DepositAttachmentItem[];
}

export interface DepositFilterMeta {
  locationName: string;
  dateFrom: string;
  dateTo: string;
  onlyActionable?: boolean;
}

interface StagedAttachmentUpload {
  id: string;
  fileName: string;
  dataUrl: string;
  sizeBytes: number;
}

interface AttachmentViewerState {
  filename: string;
  label: string;
  category?: string;
  depositId: number;
  locationName: string;
  businessDate: string;
  depositReference?: string;
  depositAmount?: number;
  variance?: number;
}

const THREAD_CATEGORY_META: Record<
  DepositThreadCategory,
  { label: string; badgeClass: string }
> = {
  PETTY_CASH: { label: 'Petty Cash', badgeClass: 'depo-cat-badge is-petty' },
  PETTY_CASH_REPLENISH: {
    label: 'Petty Cash Replenish',
    badgeClass: 'depo-cat-badge is-replenish',
  },
  OPEN_SALES: { label: 'Open Sales', badgeClass: 'depo-cat-badge is-opensales' },
  DEPT_EXPENSE: { label: 'Other Dept. Expense', badgeClass: 'depo-cat-badge is-deptexp' },
  APPROVAL: { label: 'Approval Decision', badgeClass: 'depo-cat-badge is-approval' },
  DELETE_REQUEST: { label: 'Delete Request', badgeClass: 'depo-cat-badge is-delete' },
  GENERAL: { label: 'General Remark', badgeClass: 'depo-cat-badge is-general' },
};

function todayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function firstDayOfCurrentMonthString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

function ninetyDaysAgoString(): string {
  const d = new Date();
  d.setDate(d.getDate() - 90);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMoney(value: number): string {
  return Number(value || 0).toLocaleString('en-PH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDisplayDate(value: string | null | undefined): string {
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
  if (!value) return '—';
  const normalized = value.endsWith('Z') ? value.slice(0, 19) : value;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getVarianceClass(variance: number): string {
  if (Math.abs(variance) < 0.005) return 'rof-variance-zero';
  return variance > 0 ? 'rof-variance-over' : 'rof-variance-short';
}

function renderApprovalStatusBadge(row: DepositRecord) {
  switch (row.approvalStatus) {
    case 'Pending':
      return (
        <span className="depo-status-badge is-pending" title="Awaiting Area Manager approval">
          <Clock size={12} />
          <span>Pending Approval</span>
        </span>
      );
    case 'Approved':
      return (
        <span
          className="depo-status-badge is-approved"
          title={
            row.approvedBy
              ? `Approved by ${row.approvedBy}${
                  row.approvedAt ? ` on ${formatWallClockDateTime(row.approvedAt)}` : ''
                }`
              : 'Approved'
          }
        >
          <CheckCircle2 size={12} />
          <span>Approved</span>
        </span>
      );
    case 'Rejected':
      return (
        <span
          className="depo-status-badge is-rejected"
          title={
            row.approvedBy
              ? `Rejected by ${row.approvedBy}${
                  row.approvedAt ? ` on ${formatWallClockDateTime(row.approvedAt)}` : ''
                }`
              : 'Rejected'
          }
        >
          <XCircle size={12} />
          <span>Rejected</span>
        </span>
      );
    default:
      return (
        <span className="depo-status-badge is-not-required">
          <span>Not Required</span>
        </span>
      );
  }
}

function renderDeleteStatusBadge(row: DepositRecord) {
  if (!row.deleteStatus || row.deleteStatus === 'None') return null;

  switch (row.deleteStatus) {
    case 'Pending Delete':
      return (
        <span
          className="depo-delete-badge is-pending-delete"
          title={
            row.deleteReason
              ? `Delete requested by ${row.deleteRequestedBy || 'Store'}: "${row.deleteReason}"`
              : 'Pending Delete Approval'
          }
        >
          <Trash2 size={11} />
          <span>Pending Delete Approval</span>
        </span>
      );
    case 'Delete Approved':
      return (
        <span
          className="depo-delete-badge is-delete-approved"
          title={
            row.deleteApprovedBy
              ? `Delete approved by ${row.deleteApprovedBy} (awaiting store final confirmation)`
              : 'Delete Approved'
          }
        >
          <Trash2 size={11} />
          <span>Delete Approved</span>
        </span>
      );
    case 'Delete Rejected':
      return (
        <span
          className="depo-delete-badge is-delete-rejected"
          title={
            row.deleteApprovedBy
              ? `Delete rejected by ${row.deleteApprovedBy}`
              : 'Delete Rejected'
          }
        >
          <XCircle size={11} />
          <span>Delete Rejected</span>
        </span>
      );
    default:
      return null;
  }
}

const DEPOSIT_SESSION_KEY = 'oracle-session-deposit';

interface DepositSavedSession {
  selectedLocation: string;
  dateFrom: string;
  dateTo: string;
  searchKeyword: string;
  approvalFilter: string;
  deleteFilter: string;
  pettyCashFilter: string;
  rows: DepositRecord[];
  loadedFilters: DepositFilterMeta | null;
}

function loadDepositSession(): Partial<DepositSavedSession> {
  try {
    const raw = window.sessionStorage.getItem(DEPOSIT_SESSION_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as Partial<DepositSavedSession>;
  } catch {
    return {};
  }
}

export function DepositMonitoring() {
  const { user, token } = useAuth();
  const {
    canViewApprovalNotifications,
    counts,
    refreshNotifications,
    deepLinkTarget,
    clearDeepLinkTarget,
  } = useDepositNotifications();

  const savedSession = useMemo(() => loadDepositSession(), []);

  const canApprove = useMemo(() => {
    const role = (user?.access ?? '').trim().toLowerCase();
    return role === 'area manager' || role === 'admin';
  }, [user?.access]);

  // Store list & selection
  const [stores, setStores] = useState<StoreOption[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>(
    () => savedSession.selectedLocation ?? ''
  );

  // Date range & search filters
  const [dateFrom, setDateFrom] = useState<string>(
    () => savedSession.dateFrom ?? firstDayOfCurrentMonthString()
  );
  const [dateTo, setDateTo] = useState<string>(
    () => savedSession.dateTo ?? todayString()
  );
  const [searchKeyword, setSearchKeyword] = useState<string>(
    () => savedSession.searchKeyword ?? ''
  );

  // Quick Filter Pills / Dropdowns
  const [approvalFilter, setApprovalFilter] = useState<string>(
    () => savedSession.approvalFilter ?? 'All'
  );
  const [deleteFilter, setDeleteFilter] = useState<string>(
    () => savedSession.deleteFilter ?? 'All'
  );
  const [pettyCashFilter, setPettyCashFilter] = useState<string>(
    () => savedSession.pettyCashFilter ?? 'All'
  );

  // Table Data state
  const [rows, setRows] = useState<DepositRecord[]>(() => savedSession.rows ?? []);
  const [loadedFilters, setLoadedFilters] = useState<DepositFilterMeta | null>(
    () => savedSession.loadedFilters ?? null
  );
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Monitoring Thread & Backtracking Modal state
  const [threadModalOpen, setThreadModalOpen] = useState<boolean>(false);
  const [threadLoading, setThreadLoading] = useState<boolean>(false);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [threadDeposit, setThreadDeposit] = useState<DepositRecord | null>(null);
  const [threads, setThreads] = useState<DepositThreadItem[]>([]);
  const [unlinkedAttachments, setUnlinkedAttachments] = useState<DepositAttachmentItem[]>([]);

  // Area Manager Approval / Delete Decision Form states inside Thread Modal
  const [approvalRemarks, setApprovalRemarks] = useState<string>('');
  const [approvalSubmitting, setApprovalSubmitting] = useState<boolean>(false);
  const [approvalActionError, setApprovalActionError] = useState<string | null>(null);
  const [showChangeApprovalPanel, setShowChangeApprovalPanel] = useState<boolean>(false);

  const [deleteRemarks, setDeleteRemarks] = useState<string>('');
  const [deleteSubmitting, setDeleteSubmitting] = useState<boolean>(false);
  const [deleteActionError, setDeleteActionError] = useState<string | null>(null);
  const [showChangeDeletePanel, setShowChangeDeletePanel] = useState<boolean>(false);

  // Post Follow-Up Remark Form state
  const [remarkCategory, setRemarkCategory] = useState<DepositThreadCategory>('GENERAL');
  const [remarkMessage, setRemarkMessage] = useState<string>('');
  const [stagedUploads, setStagedUploads] = useState<StagedAttachmentUpload[]>([]);
  const [remarkSubmitting, setRemarkSubmitting] = useState<boolean>(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // FTP Attachment Viewer Modal state (works for primary deposit slip & thread supporting docs)
  const [attachmentTarget, setAttachmentTarget] = useState<AttachmentViewerState | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string>('');
  const [attachmentLoading, setAttachmentLoading] = useState<boolean>(false);
  const [attachmentError, setAttachmentError] = useState<string | null>(null);
  const [attachmentZoom, setAttachmentZoom] = useState<number>(1);
  const [attachmentRotation, setAttachmentRotation] = useState<number>(0);

  // Persist Deposit Monitoring session state to sessionStorage
  useEffect(() => {
    try {
      const payload: DepositSavedSession = {
        selectedLocation,
        dateFrom,
        dateTo,
        searchKeyword,
        approvalFilter,
        deleteFilter,
        pettyCashFilter,
        rows,
        loadedFilters,
      };
      window.sessionStorage.setItem(DEPOSIT_SESSION_KEY, JSON.stringify(payload));
    } catch {
      // Ignore sessionStorage quota errors
    }
  }, [
    selectedLocation,
    dateFrom,
    dateTo,
    searchKeyword,
    approvalFilter,
    deleteFilter,
    pettyCashFilter,
    rows,
    loadedFilters,
  ]);

  // Fetch active stores on mount
  useEffect(() => {
    if (!token) return;
    let cancelled = false;

    fetch('/api/reports/deposit/stores', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => res.json())
      .then((data: { stores?: StoreOption[] }) => {
        if (cancelled) return;
        const list = data.stores ?? [];
        setStores(list);
        if (list.length > 0) {
          setSelectedLocation((current) => {
            if (current && list.some((s) => s.LOCATIONNAME === current)) {
              return current;
            }
            const userStore = list.find(
              (s) => s.LOCATIONNAME.toLowerCase() === (user?.locationName ?? '').toLowerCase()
            );
            return userStore ? userStore.LOCATIONNAME : list[0].LOCATIONNAME;
          });
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('Failed to load active stores for Deposit Monitoring:', err);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token, user?.locationName]);

  const fetchDepositsForParams = useCallback(
    async (params: {
      locationName: string;
      dateFrom: string;
      dateTo: string;
      onlyActionable?: boolean;
    }) => {
      if (!token) return [];
      setLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/reports/deposit/list', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            locationName: params.locationName,
            dateFrom: params.dateFrom,
            dateTo: params.dateTo,
            onlyActionable: params.onlyActionable ?? false,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to load Deposit Monitoring records.');
        }

        const loadedRows: DepositRecord[] = data.rows ?? [];
        setRows(loadedRows);
        setLoadedFilters({
          locationName: params.locationName,
          dateFrom: params.dateFrom,
          dateTo: params.dateTo,
          onlyActionable: params.onlyActionable,
        });
        return loadedRows;
      } catch (err) {
        setError((err as Error).message);
        return [];
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  const handleOpenThreadModal = useCallback(
    async (depositId: number, initialRecord?: DepositRecord) => {
      if (!token) return;

      setThreadModalOpen(true);
      setThreadLoading(true);
      setThreadError(null);
      if (initialRecord) {
        setThreadDeposit(initialRecord);
      }

      // Reset form inputs
      setApprovalRemarks('');
      setApprovalActionError(null);
      setShowChangeApprovalPanel(false);
      setDeleteRemarks('');
      setDeleteActionError(null);
      setShowChangeDeletePanel(false);
      setRemarkMessage('');
      setStagedUploads([]);
      setRemarkError(null);

      try {
        const response = await fetch(`/api/reports/deposit/${depositId}/thread`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || `Unable to load monitoring thread for Deposit #${depositId}.`);
        }

        if (data.deposit) {
          setThreadDeposit(data.deposit);
          // Sync row in table if loaded
          setRows((prev) =>
            prev.map((r) => (r.depositId === data.deposit.depositId ? data.deposit : r))
          );
        }
        setThreads(Array.isArray(data.threads) ? data.threads : []);
        setUnlinkedAttachments(
          Array.isArray(data.unlinkedAttachments) ? data.unlinkedAttachments : []
        );
      } catch (err) {
        setThreadError((err as Error).message);
      } finally {
        setThreadLoading(false);
      }
    },
    [token]
  );

  // Handle deep-link from Top Header Notification Bell
  useEffect(() => {
    if (!deepLinkTarget || !token) return;

    const target = deepLinkTarget;
    clearDeepLinkTarget();

    const targetLoc = target.locationName || selectedLocation;
    const targetDate = target.businessDate || todayString();
    const nextFrom = targetDate < dateFrom ? targetDate : dateFrom;
    const nextTo = targetDate > dateTo ? targetDate : dateTo;

    if (targetLoc) {
      setSelectedLocation(targetLoc);
    }
    setDateFrom(nextFrom);
    setDateTo(nextTo);
    setApprovalFilter('All');
    setDeleteFilter('All');
    setPettyCashFilter('All');
    setSearchKeyword('');

    void (async () => {
      if (targetLoc) {
        await fetchDepositsForParams({
          locationName: targetLoc,
          dateFrom: nextFrom,
          dateTo: nextTo,
        });
      }
      await handleOpenThreadModal(target.depositId);
    })();
  }, [
    deepLinkTarget,
    token,
    clearDeepLinkTarget,
    selectedLocation,
    dateFrom,
    dateTo,
    fetchDepositsForParams,
    handleOpenThreadModal,
  ]);

  // Close topmost modal on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      if (attachmentTarget && !attachmentLoading) {
        setAttachmentTarget(null);
      } else if (threadModalOpen && !threadLoading && !approvalSubmitting && !deleteSubmitting && !remarkSubmitting) {
        setThreadModalOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    attachmentTarget,
    attachmentLoading,
    threadModalOpen,
    threadLoading,
    approvalSubmitting,
    deleteSubmitting,
    remarkSubmitting,
  ]);

  async function handleGenerateDeposits() {
    if (!selectedLocation) {
      setError('Please select a Store / Location.');
      return;
    }
    if (!dateFrom || !dateTo) {
      setError('Please select both Start Date and End Date.');
      return;
    }
    if (dateTo < dateFrom) {
      setError('End Date cannot be earlier than Start Date.');
      return;
    }

    await fetchDepositsForParams({
      locationName: selectedLocation,
      dateFrom,
      dateTo,
      onlyActionable: false,
    });
  }

  async function handleLoadAllPendingActionable() {
    const start = ninetyDaysAgoString();
    const end = todayString();
    setDateFrom(start);
    setDateTo(end);
    setApprovalFilter('All');
    setDeleteFilter('All');
    setPettyCashFilter('All');
    setSearchKeyword('');

    await fetchDepositsForParams({
      locationName: 'ALL_PENDING',
      dateFrom: start,
      dateTo: end,
      onlyActionable: true,
    });
  }

  async function openFtpAttachmentViewer(target: AttachmentViewerState) {
    if (!target.filename) return;

    setAttachmentTarget(target);
    setAttachmentPreview('');
    setAttachmentError(null);
    setAttachmentZoom(1);
    setAttachmentRotation(0);
    setAttachmentLoading(true);

    try {
      const response = await fetch('/api/reports/deposit/attachment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          filename: target.filename,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Unable to load attachment from FTP.');
      }

      setAttachmentPreview(data.previewDataUrl || '');
    } catch (err) {
      setAttachmentError((err as Error).message);
    } finally {
      setAttachmentLoading(false);
    }
  }

  function handleOpenDepositSlip(row: DepositRecord) {
    if (!row.filename) return;
    void openFtpAttachmentViewer({
      filename: row.filename,
      label: 'Primary Deposit Slip',
      depositId: row.depositId,
      locationName: row.locationName,
      businessDate: row.businessDate,
      depositReference: row.depositReference,
      depositAmount: row.depositAmount,
      variance: row.variance,
    });
  }

  function handleOpenSupportingAttachment(att: DepositAttachmentItem, deposit: DepositRecord) {
    const catLabel = THREAD_CATEGORY_META[att.category]?.label ?? att.category;
    void openFtpAttachmentViewer({
      filename: att.filename,
      label: `Supporting Document (${catLabel})`,
      category: catLabel,
      depositId: deposit.depositId,
      locationName: deposit.locationName,
      businessDate: deposit.businessDate,
      depositReference: deposit.depositReference,
      depositAmount: deposit.depositAmount,
      variance: deposit.variance,
    });
  }

  function handleCloseAttachment() {
    if (attachmentLoading) return;
    setAttachmentTarget(null);
    setAttachmentPreview('');
    setAttachmentError(null);
    setAttachmentZoom(1);
    setAttachmentRotation(0);
  }

  function handleDownloadAttachment() {
    if (!attachmentTarget || !attachmentPreview) return;
    const link = document.createElement('a');
    link.href = attachmentPreview;
    link.download = attachmentTarget.filename || `Deposit_${attachmentTarget.depositId}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function handleDeductionApprovalDecision(decision: 'Approved' | 'Rejected') {
    if (!threadDeposit || !token) return;
    if (decision === 'Rejected' && !approvalRemarks.trim()) {
      setApprovalActionError('Please provide remarks explaining why the deposit deductions are rejected.');
      return;
    }

    setApprovalSubmitting(true);
    setApprovalActionError(null);

    try {
      const response = await fetch(
        `/api/reports/deposit/${threadDeposit.depositId}/approve-deductions`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            remarks: approvalRemarks.trim(),
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to save deduction approval decision.');
      }

      if (data.deposit) {
        setThreadDeposit(data.deposit);
        setRows((prev) =>
          prev.map((r) => (r.depositId === data.deposit.depositId ? data.deposit : r))
        );
      }
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
      }
      if (Array.isArray(data.unlinkedAttachments)) {
        setUnlinkedAttachments(data.unlinkedAttachments);
      }

      setApprovalRemarks('');
      setShowChangeApprovalPanel(false);
      void refreshNotifications();
    } catch (err) {
      setApprovalActionError((err as Error).message);
    } finally {
      setApprovalSubmitting(false);
    }
  }

  async function handleDeleteApprovalDecision(
    decision: 'Delete Approved' | 'Delete Rejected'
  ) {
    if (!threadDeposit || !token) return;
    if (decision === 'Delete Rejected' && !deleteRemarks.trim()) {
      setDeleteActionError('Please enter remarks explaining why the delete request is rejected.');
      return;
    }

    setDeleteSubmitting(true);
    setDeleteActionError(null);

    try {
      const response = await fetch(
        `/api/reports/deposit/${threadDeposit.depositId}/approve-delete`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            decision,
            remarks: deleteRemarks.trim(),
          }),
        }
      );

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to process delete request decision.');
      }

      if (data.deposit) {
        setThreadDeposit(data.deposit);
        setRows((prev) =>
          prev.map((r) => (r.depositId === data.deposit.depositId ? data.deposit : r))
        );
      }
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
      }
      if (Array.isArray(data.unlinkedAttachments)) {
        setUnlinkedAttachments(data.unlinkedAttachments);
      }

      setDeleteRemarks('');
      setShowChangeDeletePanel(false);
      void refreshNotifications();
    } catch (err) {
      setDeleteActionError((err as Error).message);
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleSelectAttachmentFiles(e: ChangeEvent<HTMLInputElement>) {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList);
    for (const file of files) {
      if (file.size > 8 * 1024 * 1024) {
        setRemarkError(`File "${file.name}" exceeds the 8 MB image size limit.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        if (!result) return;
        setStagedUploads((prev) => [
          ...prev,
          {
            id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            fileName: file.name,
            dataUrl: result,
            sizeBytes: file.size,
          },
        ]);
      };
      reader.readAsDataURL(file);
    }

    e.target.value = '';
  }

  function handleRemoveStagedUpload(id: string) {
    setStagedUploads((prev) => prev.filter((item) => item.id !== id));
  }

  async function handlePostFollowUpRemark() {
    if (!threadDeposit || !token) return;
    if (!remarkMessage.trim() && stagedUploads.length === 0) {
      setRemarkError('Please enter a remark message or attach a supporting image.');
      return;
    }

    setRemarkSubmitting(true);
    setRemarkError(null);

    try {
      const response = await fetch(`/api/reports/deposit/${threadDeposit.depositId}/thread`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          category: remarkCategory,
          message: remarkMessage.trim(),
          attachments: stagedUploads.map((u) => ({
            fileName: u.fileName,
            dataUrl: u.dataUrl,
            category: remarkCategory,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to post remark to monitoring thread.');
      }

      if (data.deposit) {
        setThreadDeposit(data.deposit);
        setRows((prev) =>
          prev.map((r) => (r.depositId === data.deposit.depositId ? data.deposit : r))
        );
      }
      if (Array.isArray(data.threads)) {
        setThreads(data.threads);
      }
      if (Array.isArray(data.unlinkedAttachments)) {
        setUnlinkedAttachments(data.unlinkedAttachments);
      }

      setRemarkMessage('');
      setStagedUploads([]);
      void refreshNotifications();
    } catch (err) {
      setRemarkError((err as Error).message);
    } finally {
      setRemarkSubmitting(false);
    }
  }

  // Filter loaded rows by quick filters + keyword
  const filteredRows = useMemo(() => {
    const q = searchKeyword.trim().toLowerCase();

    return rows.filter((r) => {
      if (approvalFilter !== 'All' && r.approvalStatus !== approvalFilter) {
        return false;
      }
      if (deleteFilter !== 'All' && r.deleteStatus !== deleteFilter) {
        return false;
      }
      if (pettyCashFilter !== 'All' && r.pettyCashStatus !== pettyCashFilter) {
        return false;
      }

      if (!q) return true;

      return (
        String(r.depositId).includes(q) ||
        r.locationName.toLowerCase().includes(q) ||
        r.businessDate.toLowerCase().includes(q) ||
        formatDisplayDate(r.businessDate).toLowerCase().includes(q) ||
        r.depositDate.toLowerCase().includes(q) ||
        formatDisplayDate(r.depositDate).toLowerCase().includes(q) ||
        (r.depositReference || '').toLowerCase().includes(q) ||
        (r.filename || '').toLowerCase().includes(q) ||
        (r.deptExpDepartment || '').toLowerCase().includes(q) ||
        (r.deptExpBorrower || '').toLowerCase().includes(q) ||
        formatMoney(r.depositAmount).includes(q) ||
        formatMoney(r.posAmount).includes(q)
      );
    });
  }, [rows, approvalFilter, deleteFilter, pettyCashFilter, searchKeyword]);

  // Quick filter counts across currently loaded rows
  const quickCounts = useMemo(() => {
    let pendingApproval = 0;
    let pendingDelete = 0;
    let unreplenishedPetty = 0;
    for (const r of rows) {
      if (r.approvalStatus === 'Pending') pendingApproval++;
      if (r.deleteStatus === 'Pending Delete') pendingDelete++;
      if (r.pettyCashStatus === 'Unreplenished') unreplenishedPetty++;
    }
    return { pendingApproval, pendingDelete, unreplenishedPetty };
  }, [rows]);

  // Totals across filtered rows
  const totals = useMemo(() => {
    return filteredRows.reduce(
      (acc, r) => {
        acc.posAmount += Number(r.posAmount || 0);
        acc.depositAmount += Number(r.depositAmount || 0);
        acc.pettyCash += Number(r.pettyCash || 0);
        acc.bir2307 += Number(r.bir2307 || 0);
        acc.openSales += Number(r.openSales || 0);
        acc.otherDepartmentExpense += Number(r.otherDepartmentExpense || 0);
        acc.variance += Number(r.variance || 0);
        return acc;
      },
      {
        posAmount: 0,
        depositAmount: 0,
        pettyCash: 0,
        bir2307: 0,
        openSales: 0,
        otherDepartmentExpense: 0,
        variance: 0,
      }
    );
  }, [filteredRows]);

  const totalDeductions =
    totals.pettyCash + totals.bir2307 + totals.openSales + totals.otherDepartmentExpense;

  const isAllStoresLoaded =
    loadedFilters?.locationName === 'ALL' || loadedFilters?.locationName === 'ALL_PENDING';

  return (
    <div className="bom-report-container">
      {/* Header Banner */}
      <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3 mb-4">
        <div className="d-flex align-items-center gap-3">
          <div className="bom-header-icon-badge rounded-3 d-flex align-items-center justify-content-center flex-shrink-0">
            <WalletCards size={22} />
          </div>
          <div>
            <h2 className="h5 fw-bold mb-0 bom-main-heading">Deposit Monitoring</h2>
            <p className="small text-secondary mb-0">
              View store bank deposits, deduction backtracking, Area Manager approvals, delete requests, and FTP attachments.
            </p>
          </div>
        </div>

        {canViewApprovalNotifications && counts.totalActionable > 0 && (
          <button
            type="button"
            className="btn btn-sm depo-actionable-banner-btn d-inline-flex align-items-center gap-2"
            onClick={() => void handleLoadAllPendingActionable()}
            disabled={loading}
          >
            <ShieldAlert size={16} />
            <span>
              Review All Pending Approvals across Stores ({counts.totalActionable})
            </span>
          </button>
        )}
      </div>

      {/* Filter Card */}
      <div className="card border rounded-4 shadow-sm p-4 mb-4 bg-white bom-filter-card">
        <div className="row g-3 align-items-end">
          {/* Store Location */}
          <div className="col-12 col-md-4 col-lg-4">
            <label htmlFor="deposit-store" className="form-label small fw-semibold text-secondary">
              Store / Location
            </label>
            <StoreSearchSelect
              id="deposit-store"
              inputClassName="form-select bom-filter-input"
              stores={stores}
              value={selectedLocation}
              onChange={setSelectedLocation}
              disabled={loading}
            />
          </div>

          {/* Start Date */}
          <div className="col-12 col-sm-6 col-md-3 col-lg-3">
            <label htmlFor="deposit-date-from" className="form-label small fw-semibold text-secondary">
              Start Date (Business Date)
            </label>
            <input
              id="deposit-date-from"
              type="date"
              className="form-control bom-filter-input"
              value={dateFrom}
              max={todayString()}
              onChange={(e) => setDateFrom(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* End Date */}
          <div className="col-12 col-sm-6 col-md-3 col-lg-3">
            <label htmlFor="deposit-date-to" className="form-label small fw-semibold text-secondary">
              End Date (Business Date)
            </label>
            <input
              id="deposit-date-to"
              type="date"
              className="form-control bom-filter-input"
              value={dateTo}
              max={todayString()}
              onChange={(e) => setDateTo(e.target.value)}
              disabled={loading}
            />
          </div>

          {/* Load Button */}
          <div className="col-12 col-md-2 col-lg-2">
            <button
              type="button"
              className="btn btn-oracle-red w-100 py-2 d-flex align-items-center justify-content-center gap-2 fw-semibold"
              onClick={() => void handleGenerateDeposits()}
              disabled={loading || !selectedLocation}
            >
              <RefreshCw size={16} className={loading ? 'spin' : ''} />
              <span>{loading ? 'Loading...' : 'Load Deposits'}</span>
            </button>
          </div>
        </div>

        {error && (
          <div className="alert alert-danger py-2 small mt-3 mb-0 rounded-3" role="alert">
            {error}
          </div>
        )}
      </div>

      {/* Results Section */}
      {loadedFilters && (
        <div className="d-flex flex-column gap-4">
          {/* KPI Summary Strip */}
          <div className="row g-3">
            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total POS Cash</div>
                <div className="h4 fw-bold mb-0 bom-charcoal-text">
                  ₱{formatMoney(totals.posAmount)}
                </div>
                <div className="small text-secondary mt-1">
                  {filteredRows.length} deposit record(s)
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total Deposited Cash</div>
                <div className="h4 fw-bold mb-0 bom-charcoal-text">
                  ₱{formatMoney(totals.depositAmount)}
                </div>
                <div className="small text-secondary mt-1">Actual bank deposit total</div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total Deductions / Credits</div>
                <div className="h4 fw-bold mb-0 bom-charcoal-text">
                  ₱{formatMoney(totalDeductions)}
                </div>
                <div className="small text-secondary mt-1">
                  Petty Cash, BIR 2307, Open Sales, Other Exp.
                </div>
              </div>
            </div>

            <div className="col-12 col-sm-6 col-xl-3">
              <div className="card border rounded-4 p-3 h-100 shadow-sm bg-white">
                <div className="small text-secondary fw-semibold mb-1">Total Net Variance</div>
                <div className={`h4 fw-bold mb-0 ${getVarianceClass(totals.variance)}`}>
                  ₱{formatMoney(totals.variance)}
                </div>
                <div className="small text-secondary mt-1">
                  Over / Short deposit reconciliation
                </div>
              </div>
            </div>
          </div>

          {/* Quick Status Filter Bar & Keyword Search */}
          <div className="card border rounded-4 shadow-sm p-3 bg-white">
            <div className="d-flex flex-column flex-xl-row align-items-xl-center justify-content-between gap-3">
              {/* Left: Loaded metadata pills + Quick Filter Dropdowns */}
              <div className="d-flex flex-wrap align-items-center gap-2">
                <span className="bom-uom-badge px-3 py-1">
                  Store:{' '}
                  <strong>
                    {loadedFilters.locationName === 'ALL_PENDING'
                      ? 'All Stores (Pending Actionable)'
                      : loadedFilters.locationName}
                  </strong>
                </span>
                <span className="bom-uom-badge px-3 py-1">
                  Period: <strong>{loadedFilters.dateFrom}</strong> to{' '}
                  <strong>{loadedFilters.dateTo}</strong>
                </span>
                <span className="bom-uom-badge px-3 py-1">
                  Showing: <strong>{filteredRows.length}</strong> / {rows.length}
                </span>

                {/* Approval Status Quick Filter */}
                <div className="depo-quick-filter-group">
                  <label htmlFor="depo-filter-approval" className="depo-quick-filter-label">
                    Approval:
                  </label>
                  <select
                    id="depo-filter-approval"
                    className={`form-select form-select-sm depo-quick-filter-select ${
                      approvalFilter !== 'All' ? 'is-active' : ''
                    }`}
                    value={approvalFilter}
                    onChange={(e) => setApprovalFilter(e.target.value)}
                  >
                    <option value="All">All ({rows.length})</option>
                    <option value="Pending">
                      Pending ({quickCounts.pendingApproval})
                    </option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Not Required">Not Required</option>
                  </select>
                </div>

                {/* Delete Request Quick Filter */}
                <div className="depo-quick-filter-group">
                  <label htmlFor="depo-filter-delete" className="depo-quick-filter-label">
                    Delete Req:
                  </label>
                  <select
                    id="depo-filter-delete"
                    className={`form-select form-select-sm depo-quick-filter-select ${
                      deleteFilter !== 'All' ? 'is-active' : ''
                    }`}
                    value={deleteFilter}
                    onChange={(e) => setDeleteFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Pending Delete">
                      Pending Delete ({quickCounts.pendingDelete})
                    </option>
                    <option value="Delete Approved">Delete Approved</option>
                    <option value="Delete Rejected">Delete Rejected</option>
                  </select>
                </div>

                {/* Petty Cash Status Quick Filter */}
                <div className="depo-quick-filter-group">
                  <label htmlFor="depo-filter-petty" className="depo-quick-filter-label">
                    Petty Cash:
                  </label>
                  <select
                    id="depo-filter-petty"
                    className={`form-select form-select-sm depo-quick-filter-select ${
                      pettyCashFilter !== 'All' ? 'is-active' : ''
                    }`}
                    value={pettyCashFilter}
                    onChange={(e) => setPettyCashFilter(e.target.value)}
                  >
                    <option value="All">All</option>
                    <option value="Unreplenished">
                      Unreplenished ({quickCounts.unreplenishedPetty})
                    </option>
                    <option value="Replenished">Replenished</option>
                  </select>
                </div>

                {(approvalFilter !== 'All' ||
                  deleteFilter !== 'All' ||
                  pettyCashFilter !== 'All' ||
                  searchKeyword) && (
                  <button
                    type="button"
                    className="btn btn-sm btn-link text-decoration-none small px-2"
                    onClick={() => {
                      setApprovalFilter('All');
                      setDeleteFilter('All');
                      setPettyCashFilter('All');
                      setSearchKeyword('');
                    }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>

              {/* Right: Search Input */}
              <div className="d-flex align-items-center gap-2">
                <div className="input-group input-group-sm" style={{ width: 290 }}>
                  <span className="input-group-text bg-white border-end-0">
                    <Search size={14} className="text-secondary" />
                  </span>
                  <input
                    type="text"
                    className="form-control border-start-0 ps-0"
                    placeholder="Search ID, Ref#, borrower, dept, amount..."
                    value={searchKeyword}
                    onChange={(e) => setSearchKeyword(e.target.value)}
                  />
                  {searchKeyword && (
                    <button
                      type="button"
                      className="btn btn-outline-secondary border-start-0"
                      onClick={() => setSearchKeyword('')}
                      title="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Deposit Monitoring Table Card */}
          <div className="card border rounded-4 shadow-sm overflow-hidden bg-white">
            <div className="table-responsive rof-grid-scroll-container">
              <table className="table align-middle mb-0 bom-data-table deposit-monitoring-table">
                <colgroup>
                  <col style={{ width: '205px' }} />
                  <col style={{ width: '74px' }} />
                  {isAllStoresLoaded && <col style={{ width: '150px' }} />}
                  <col style={{ width: '118px' }} />
                  <col style={{ width: '118px' }} />
                  <col style={{ width: '155px' }} />
                  <col style={{ width: '175px' }} />
                  <col style={{ width: '124px' }} />
                  <col style={{ width: '124px' }} />
                  <col style={{ width: '138px' }} />
                  <col style={{ width: '110px' }} />
                  <col style={{ width: '142px' }} />
                  <col style={{ width: '165px' }} />
                  <col style={{ width: '122px' }} />
                  <col style={{ width: '165px' }} />
                </colgroup>
                <thead>
                  <tr>
                    <th className="text-center">Actions / Thread</th>
                    <th>ID</th>
                    {isAllStoresLoaded && <th>Store</th>}
                    <th>Business Date</th>
                    <th>Deposit Date</th>
                    <th>Deposit Ref#</th>
                    <th>Approval &amp; Status</th>
                    <th className="text-end">POS Amount</th>
                    <th className="text-end">Deposit Amt</th>
                    <th className="text-end">Petty Cash</th>
                    <th className="text-end">BIR 2307</th>
                    <th className="text-end">Open Sales</th>
                    <th className="text-end">Other Expense</th>
                    <th className="text-end">Variance</th>
                    <th>Filename</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isAllStoresLoaded ? 15 : 14}
                        className="text-center py-5 text-secondary"
                      >
                        No deposit records match the selected store, date range, and status filters.
                      </td>
                    </tr>
                  ) : (
                    <>
                      {filteredRows.map((row) => {
                        const needsAction =
                          row.approvalStatus === 'Pending' ||
                          row.deleteStatus === 'Pending Delete';

                        return (
                          <tr
                            key={row.depositId}
                            className={
                              row.deleteStatus === 'Pending Delete'
                                ? 'depo-row-pending-delete'
                                : row.approvalStatus === 'Pending'
                                ? 'depo-row-pending-approval'
                                : undefined
                            }
                          >
                            {/* Actions: Deposit Slip + Monitoring Thread */}
                            <td className="text-center text-nowrap">
                              <div className="d-inline-flex align-items-center gap-1.5">
                                {row.filename ? (
                                  <button
                                    type="button"
                                    className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1"
                                    onClick={() => handleOpenDepositSlip(row)}
                                    title={`View Deposit Slip (${row.filename})`}
                                  >
                                    <Eye size={13} />
                                    <span>Slip</span>
                                  </button>
                                ) : (
                                  <span
                                    className="btn btn-sm rof-view-details-btn disabled opacity-50"
                                    title="No primary deposit slip uploaded"
                                  >
                                    No Slip
                                  </span>
                                )}

                                <button
                                  type="button"
                                  className={`btn btn-sm depo-thread-btn d-inline-flex align-items-center gap-1 ${
                                    needsAction ? 'needs-action' : ''
                                  }`}
                                  onClick={() => void handleOpenThreadModal(row.depositId, row)}
                                  title="Open Monitoring Thread, Backtracking & Approvals"
                                >
                                  <MessageSquareText size={13} />
                                  <span>Thread</span>
                                  <span className="depo-thread-count-pill">
                                    {row.threadCount}
                                  </span>
                                </button>
                              </div>
                            </td>

                            <td className="fw-semibold bom-charcoal-text text-nowrap">
                              #{row.depositId}
                            </td>

                            {isAllStoresLoaded && (
                              <td className="fw-semibold text-truncate" title={row.locationName}>
                                {row.locationName}
                              </td>
                            )}

                            <td className="text-nowrap fw-medium">
                              {formatDisplayDate(row.businessDate)}
                            </td>

                            <td className="text-nowrap text-secondary">
                              {formatDisplayDate(row.depositDate)}
                            </td>

                            <td className="text-truncate" title={row.depositReference || ''}>
                              {row.depositReference ? (
                                <span className="rof-mod-badge">{row.depositReference}</span>
                              ) : (
                                <span className="text-secondary">—</span>
                              )}
                            </td>

                            {/* Approval Status & Delete Status Badges */}
                            <td>
                              <div className="d-flex flex-column align-items-start gap-1">
                                {renderApprovalStatusBadge(row)}
                                {renderDeleteStatusBadge(row)}
                              </div>
                            </td>

                            <td className="num-cell">₱{formatMoney(row.posAmount)}</td>
                            <td className="num-cell fw-semibold">
                              ₱{formatMoney(row.depositAmount)}
                            </td>

                            {/* Petty Cash + Unreplenished / Replenished sub-badge */}
                            <td className="num-cell">
                              <div>₱{formatMoney(row.pettyCash)}</div>
                              {row.pettyCash > 0 && (
                                <div className="mt-0.5">
                                  <span
                                    className={`depo-sub-badge ${
                                      row.pettyCashStatus === 'Replenished'
                                        ? 'is-replenished'
                                        : 'is-unreplenished'
                                    }`}
                                    title={
                                      row.pettyCashReplenishedAt
                                        ? `Replenished on ${formatWallClockDateTime(
                                            row.pettyCashReplenishedAt
                                          )}`
                                        : 'Petty Cash Status'
                                    }
                                  >
                                    {row.pettyCashStatus === 'Replenished'
                                      ? 'Replenished'
                                      : 'Unreplenished'}
                                  </span>
                                </div>
                              )}
                            </td>

                            <td className="num-cell">₱{formatMoney(row.bir2307)}</td>

                            {/* Open Sales + Borrowed From Business Date */}
                            <td className="num-cell">
                              <div>₱{formatMoney(row.openSales)}</div>
                              {row.openSales > 0 && row.openSalesSourceDate && (
                                <div className="mt-0.5">
                                  <span
                                    className="depo-sub-badge is-opensales"
                                    title={`Borrowed from Business Date: ${formatDisplayDate(
                                      row.openSalesSourceDate
                                    )}`}
                                  >
                                    From: {formatDisplayDate(row.openSalesSourceDate)}
                                  </span>
                                </div>
                              )}
                            </td>

                            {/* Other Dept. Expense + Department (Borrower) */}
                            <td className="num-cell">
                              <div>₱{formatMoney(row.otherDepartmentExpense)}</div>
                              {row.otherDepartmentExpense > 0 &&
                                (row.deptExpDepartment || row.deptExpBorrower) && (
                                  <div
                                    className="depo-sub-meta text-truncate mt-0.5"
                                    title={`${row.deptExpDepartment || 'Dept'} (${
                                      row.deptExpBorrower || 'Borrower'
                                    })`}
                                  >
                                    {row.deptExpDepartment || 'Dept'}
                                    {row.deptExpBorrower ? ` (${row.deptExpBorrower})` : ''}
                                  </div>
                                )}
                            </td>

                            <td className={`num-cell fw-bold ${getVarianceClass(row.variance)}`}>
                              ₱{formatMoney(row.variance)}
                            </td>

                            <td className="rof-remarks-cell" title={row.filename || ''}>
                              {row.filename || '—'}
                            </td>
                          </tr>
                        );
                      })}

                      {/* TOTAL Footer Row */}
                      <tr className="rof-total-row fw-bold">
                        <td colSpan={isAllStoresLoaded ? 7 : 6} className="bom-charcoal-text">
                          TOTAL
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.posAmount)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.depositAmount)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.pettyCash)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.bir2307)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.openSales)}
                        </td>
                        <td className="num-cell bom-charcoal-text">
                          ₱{formatMoney(totals.otherDepartmentExpense)}
                        </td>
                        <td className={`num-cell fw-bold ${getVarianceClass(totals.variance)}`}>
                          ₱{formatMoney(totals.variance)}
                        </td>
                        <td />
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Initial Placeholder before Loading Deposits */}
      {!loadedFilters && !loading && (
        <div className="system-sales-placeholder mt-2">
          <WalletCards size={40} className="mb-2 bom-charcoal-text" />
          <h5 className="fw-bold bom-main-heading">Ready to Load Deposit Monitoring</h5>
          <p className="text-secondary">
            Select a store location and business date range above, then click{' '}
            <strong>Load Deposits</strong> to inspect deposit history, deduction backtracking, Area Manager approvals, and bank deposit slip images.
          </p>
        </div>
      )}

      {/* =========================================================
          MONITORING THREAD & BACKTRACKING MODAL
          ========================================================= */}
      {threadModalOpen && (
        <div
          className="rof-drawer-backdrop deposit-modal-backdrop"
          onClick={() => {
            if (!threadLoading && !approvalSubmitting && !deleteSubmitting && !remarkSubmitting) {
              setThreadModalOpen(false);
            }
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Monitoring Thread and Backtracking Modal"
        >
          <div
            className="depo-thread-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Thread Modal Header */}
            <div className="rof-drawer-header d-flex flex-column flex-md-row align-items-md-center justify-content-between gap-3">
              <div className="min-w-0">
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  {threadDeposit && (
                    <>
                      <span className="bom-uom-badge">{threadDeposit.locationName}</span>
                      <span className="small text-secondary">•</span>
                      <span className="small fw-bold text-secondary">
                        Deposit #{threadDeposit.depositId}
                      </span>
                      <span className="small text-secondary">•</span>
                      <span className="small text-secondary">
                        Business Date:{' '}
                        <strong>{formatDisplayDate(threadDeposit.businessDate)}</strong>
                      </span>
                      {renderApprovalStatusBadge(threadDeposit)}
                      {renderDeleteStatusBadge(threadDeposit)}
                    </>
                  )}
                </div>

                <h3 className="h5 fw-bold mb-0 bom-main-heading d-flex align-items-center gap-2">
                  <MessageSquareText size={19} />
                  <span>Monitoring Thread &amp; Deduction Backtracking</span>
                </h3>
              </div>

              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                {threadDeposit?.filename && (
                  <button
                    type="button"
                    className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                    onClick={() => handleOpenDepositSlip(threadDeposit)}
                  >
                    <Eye size={14} />
                    <span>View Deposit Slip</span>
                  </button>
                )}

                {threadDeposit && (
                  <button
                    type="button"
                    className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1"
                    onClick={() => void handleOpenThreadModal(threadDeposit.depositId, threadDeposit)}
                    disabled={threadLoading}
                    title="Refresh thread timeline"
                  >
                    <RefreshCw size={13} className={threadLoading ? 'spin' : ''} />
                    <span>Refresh</span>
                  </button>
                )}

                <button
                  type="button"
                  className="btn rof-drawer-close-btn"
                  onClick={() => setThreadModalOpen(false)}
                  disabled={threadLoading || approvalSubmitting || deleteSubmitting || remarkSubmitting}
                  aria-label="Close modal"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Thread Modal Scrollable Body */}
            <div className="depo-thread-modal-body">
              {threadError && (
                <div className="alert alert-danger py-2 small mb-3 rounded-3">
                  {threadError}
                </div>
              )}

              {threadDeposit && (
                <>
                  {/* 1. Prominent Delete Request Banner (when delete_status <> 'None') */}
                  {threadDeposit.deleteStatus !== 'None' && (
                    <div
                      className={`depo-delete-request-banner mb-3 ${
                        threadDeposit.deleteStatus === 'Pending Delete'
                          ? 'is-pending'
                          : threadDeposit.deleteStatus === 'Delete Approved'
                          ? 'is-approved'
                          : 'is-rejected'
                      }`}
                    >
                      <div className="d-flex flex-column flex-lg-row align-items-lg-center justify-content-between gap-2">
                        <div className="d-flex align-items-start gap-2.5">
                          <div className="depo-delete-banner-icon">
                            <Trash2 size={18} />
                          </div>
                          <div>
                            <div className="fw-bold small d-flex align-items-center gap-2 flex-wrap">
                              <span>
                                {threadDeposit.deleteStatus === 'Pending Delete'
                                  ? 'Delete Request Pending Area Manager Approval'
                                  : threadDeposit.deleteStatus === 'Delete Approved'
                                  ? 'Delete Request Approved (Awaiting Store Final Deletion in Desktop App)'
                                  : 'Delete Request Rejected'}
                              </span>
                            </div>
                            <div className="small mt-1">
                              Requested by{' '}
                              <strong>
                                {threadDeposit.deleteRequestedBy || threadDeposit.locationName}
                              </strong>
                              {threadDeposit.deleteRequestedAt && (
                                <>
                                  {' '}
                                  on{' '}
                                  <strong>
                                    {formatWallClockDateTime(threadDeposit.deleteRequestedAt)}
                                  </strong>
                                </>
                              )}
                            </div>
                            <div className="depo-delete-banner-reason mt-1">
                              <strong>Reason:</strong>{' '}
                              {threadDeposit.deleteReason || 'No reason provided'}
                            </div>
                            {threadDeposit.deleteApprovedBy && (
                              <div className="small mt-1 opacity-75">
                                Decision by <strong>{threadDeposit.deleteApprovedBy}</strong>
                                {threadDeposit.deleteApprovedAt
                                  ? ` on ${formatWallClockDateTime(threadDeposit.deleteApprovedAt)}`
                                  : ''}
                              </div>
                            )}
                          </div>
                        </div>

                        {canApprove && threadDeposit.deleteStatus !== 'Pending Delete' && (
                          <button
                            type="button"
                            className="btn btn-sm rof-view-details-btn align-self-start"
                            onClick={() => setShowChangeDeletePanel((prev) => !prev)}
                          >
                            {showChangeDeletePanel ? 'Cancel Change' : 'Update Delete Decision'}
                          </button>
                        )}
                      </div>

                      {/* Area Manager Delete Request Approval Controls */}
                      {canApprove &&
                        (threadDeposit.deleteStatus === 'Pending Delete' ||
                          showChangeDeletePanel) && (
                          <div className="depo-delete-approval-controls mt-3 pt-3 border-top">
                            {deleteActionError && (
                              <div className="alert alert-danger py-1.5 px-2.5 small mb-2">
                                {deleteActionError}
                              </div>
                            )}
                            <div className="row g-2 align-items-end">
                              <div className="col-12 col-lg-7">
                                <label className="form-label small fw-semibold mb-1">
                                  Area Manager Delete Decision Remarks (required if rejecting)
                                </label>
                                <input
                                  type="text"
                                  className="form-control form-control-sm"
                                  placeholder="Enter remarks for approving or rejecting this delete request..."
                                  value={deleteRemarks}
                                  onChange={(e) => setDeleteRemarks(e.target.value)}
                                  disabled={deleteSubmitting}
                                />
                              </div>
                              <div className="col-12 col-lg-5 d-flex align-items-center gap-2">
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold py-1.5"
                                  onClick={() =>
                                    void handleDeleteApprovalDecision('Delete Approved')
                                  }
                                  disabled={deleteSubmitting}
                                >
                                  <CheckCircle2 size={15} />
                                  <span>Approve Delete Request</span>
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-outline-secondary flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold py-1.5"
                                  onClick={() =>
                                    void handleDeleteApprovalDecision('Delete Rejected')
                                  }
                                  disabled={deleteSubmitting}
                                >
                                  <XCircle size={15} />
                                  <span>Reject Delete</span>
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                    </div>
                  )}

                  {/* 2. Top Summary Cards: Deposit Totals, Petty Cash, Open Sales, Other Dept. Expense */}
                  <div className="row g-3 mb-3">
                    {/* Deposit & Variance Card */}
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="depo-summary-card h-100">
                        <div className="depo-summary-card-header">
                          <span className="depo-summary-card-title">Deposit &amp; Variance</span>
                          <WalletCards size={15} className="text-secondary" />
                        </div>
                        <div className="depo-summary-card-amount">
                          ₱{formatMoney(threadDeposit.depositAmount)}
                        </div>
                        <div className="depo-summary-card-meta">
                          <span>POS: ₱{formatMoney(threadDeposit.posAmount)}</span>
                          <span>•</span>
                          <span className={getVarianceClass(threadDeposit.variance)}>
                            Var: ₱{formatMoney(threadDeposit.variance)}
                          </span>
                        </div>
                        {threadDeposit.approvedBy && (
                          <div className="depo-summary-card-sub mt-1">
                            {threadDeposit.approvalStatus} by{' '}
                            <strong>{threadDeposit.approvedBy}</strong>
                            {threadDeposit.approvedAt
                              ? ` (${formatWallClockDateTime(threadDeposit.approvedAt)})`
                              : ''}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Petty Cash Backtracking Card */}
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="depo-summary-card h-100">
                        <div className="depo-summary-card-header">
                          <span className="depo-summary-card-title">Petty Cash</span>
                          <span
                            className={`depo-sub-badge ${
                              threadDeposit.pettyCashStatus === 'Replenished'
                                ? 'is-replenished'
                                : threadDeposit.pettyCashStatus === 'Unreplenished'
                                ? 'is-unreplenished'
                                : 'is-na'
                            }`}
                          >
                            {threadDeposit.pettyCashStatus}
                          </span>
                        </div>
                        <div className="depo-summary-card-amount">
                          ₱{formatMoney(threadDeposit.pettyCash)}
                        </div>
                        <div className="depo-summary-card-sub">
                          {threadDeposit.pettyCashReplenishedAt ? (
                            <>
                              Replenished:{' '}
                              <strong>
                                {formatWallClockDateTime(threadDeposit.pettyCashReplenishedAt)}
                              </strong>
                            </>
                          ) : threadDeposit.pettyCash > 0 ? (
                            'Awaiting petty cash replenishment'
                          ) : (
                            'No petty cash deduction'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Open Sales Backtracking Card */}
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="depo-summary-card h-100">
                        <div className="depo-summary-card-header">
                          <span className="depo-summary-card-title">Open Sales</span>
                          {threadDeposit.openSalesSourceDate && (
                            <span className="depo-sub-badge is-opensales">
                              From {formatDisplayDate(threadDeposit.openSalesSourceDate)}
                            </span>
                          )}
                        </div>
                        <div className="depo-summary-card-amount">
                          ₱{formatMoney(threadDeposit.openSales)}
                        </div>
                        <div className="depo-summary-card-sub">
                          {threadDeposit.openSales > 0 ? (
                            <>
                              Borrowed from Business Date:{' '}
                              <strong>
                                {threadDeposit.openSalesSourceDate
                                  ? formatDisplayDate(threadDeposit.openSalesSourceDate)
                                  : 'Not specified'}
                              </strong>
                            </>
                          ) : (
                            'No open sales deduction'
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Other Dept. Expense Backtracking Card */}
                    <div className="col-12 col-md-6 col-xl-3">
                      <div className="depo-summary-card h-100">
                        <div className="depo-summary-card-header">
                          <span className="depo-summary-card-title">Other Dept. Expense</span>
                          {threadDeposit.bir2307 > 0 && (
                            <span className="depo-sub-badge is-na">
                              BIR 2307: ₱{formatMoney(threadDeposit.bir2307)}
                            </span>
                          )}
                        </div>
                        <div className="depo-summary-card-amount">
                          ₱{formatMoney(threadDeposit.otherDepartmentExpense)}
                        </div>
                        <div className="depo-summary-card-sub">
                          {threadDeposit.otherDepartmentExpense > 0 ? (
                            <>
                              Dept:{' '}
                              <strong>
                                {threadDeposit.deptExpDepartment || 'Not specified'}
                              </strong>{' '}
                              • Borrower:{' '}
                              <strong>
                                {threadDeposit.deptExpBorrower || 'Not specified'}
                              </strong>
                            </>
                          ) : (
                            'No other department expense'
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 3. Area Manager Deduction Approval Panel */}
                  {canApprove && (
                    <div className="depo-approval-panel mb-3">
                      <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-2">
                        <div className="d-flex align-items-center gap-2">
                          <ShieldCheck size={18} className="text-primary" />
                          <div>
                            <span className="fw-bold small">
                              Area Manager Deduction Approval
                            </span>
                            <span className="small text-secondary ms-2">
                              Current Status: <strong>{threadDeposit.approvalStatus}</strong>
                              {threadDeposit.approvedBy
                                ? ` by ${threadDeposit.approvedBy}`
                                : ''}
                            </span>
                          </div>
                        </div>

                        {threadDeposit.approvalStatus !== 'Pending' && (
                          <button
                            type="button"
                            className="btn btn-sm rof-view-details-btn"
                            onClick={() => setShowChangeApprovalPanel((prev) => !prev)}
                          >
                            {showChangeApprovalPanel
                              ? 'Hide Approval Controls'
                              : 'Update Approval Decision'}
                          </button>
                        )}
                      </div>

                      {(threadDeposit.approvalStatus === 'Pending' ||
                        showChangeApprovalPanel) && (
                        <div className="mt-3 pt-2 border-top">
                          {approvalActionError && (
                            <div className="alert alert-danger py-1.5 px-2.5 small mb-2">
                              {approvalActionError}
                            </div>
                          )}
                          <div className="row g-2 align-items-end">
                            <div className="col-12 col-lg-7">
                              <label className="form-label small fw-semibold text-secondary mb-1">
                                Approval / Rejection Remarks (required when rejecting)
                              </label>
                              <input
                                type="text"
                                className="form-control form-control-sm"
                                placeholder="Enter verification remarks for Petty Cash, Open Sales, or Other Dept. Expense..."
                                value={approvalRemarks}
                                onChange={(e) => setApprovalRemarks(e.target.value)}
                                disabled={approvalSubmitting}
                              />
                            </div>
                            <div className="col-12 col-lg-5 d-flex align-items-center gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-success flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold py-1.5"
                                onClick={() => void handleDeductionApprovalDecision('Approved')}
                                disabled={approvalSubmitting}
                              >
                                <CheckCircle2 size={15} />
                                <span>Approve Deposit</span>
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-danger flex-grow-1 d-inline-flex align-items-center justify-content-center gap-1.5 fw-semibold py-1.5"
                                onClick={() => void handleDeductionApprovalDecision('Rejected')}
                                disabled={approvalSubmitting}
                              >
                                <XCircle size={15} />
                                <span>Reject Deposit</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 4. Unlinked Supporting Category Attachments (if any) */}
                  {unlinkedAttachments.length > 0 && (
                    <div className="depo-unlinked-attachments-card mb-3">
                      <div className="small fw-bold mb-2 d-flex align-items-center gap-1.5">
                        <Paperclip size={14} />
                        <span>Category Supporting Documents ({unlinkedAttachments.length})</span>
                      </div>
                      <div className="d-flex flex-wrap gap-2">
                        {unlinkedAttachments.map((att) => {
                          const catMeta = THREAD_CATEGORY_META[att.category] ?? {
                            label: att.category,
                            badgeClass: 'depo-cat-badge is-general',
                          };
                          return (
                            <button
                              key={att.attachmentId}
                              type="button"
                              className="depo-attachment-chip"
                              onClick={() =>
                                handleOpenSupportingAttachment(att, threadDeposit)
                              }
                              title={`View FTP Attachment: ${att.filename}`}
                            >
                              <ImageIcon size={13} />
                              <span className={catMeta.badgeClass}>{catMeta.label}</span>
                              <span className="depo-attachment-chip-name">{att.filename}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* 5. Chronological Backtracking Thread Timeline */}
              <div className="depo-timeline-section">
                <div className="d-flex align-items-center justify-content-between mb-2">
                  <h4 className="h6 fw-bold mb-0 d-flex align-items-center gap-2">
                    <Clock size={16} />
                    <span>Backtracking &amp; Remarks Timeline ({threads.length})</span>
                  </h4>
                  <span className="small text-secondary">
                    Ordered chronologically (oldest to newest)
                  </span>
                </div>

                {threadLoading ? (
                  <div className="d-flex flex-column align-items-center justify-content-center py-5 text-secondary gap-2">
                    <span className="spinner-border spinner-border-sm text-secondary" />
                    <span className="small fw-medium">
                      Loading deposit backtracking timeline...
                    </span>
                  </div>
                ) : threads.length === 0 ? (
                  <div className="depo-timeline-empty">
                    <FileCheck2 size={28} className="text-secondary mb-2" />
                    <div className="fw-semibold small">No Thread Entries Yet</div>
                    <div className="small text-secondary">
                      Deduction remarks, petty cash replenishments, and approval decisions will appear in this timeline.
                    </div>
                  </div>
                ) : (
                  <div className="depo-timeline-list">
                    {threads.map((item) => {
                      const catMeta = THREAD_CATEGORY_META[item.category] ?? {
                        label: item.category,
                        badgeClass: 'depo-cat-badge is-general',
                      };
                      const isApproverEntry =
                        item.authorRole.toLowerCase() === 'area manager' ||
                        item.authorRole.toLowerCase() === 'admin';

                      return (
                        <div
                          key={item.threadId}
                          className={`depo-timeline-item ${
                            isApproverEntry ? 'is-approver' : 'is-store'
                          }`}
                        >
                          <div className="depo-timeline-item-header">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <span className={catMeta.badgeClass}>{catMeta.label}</span>
                              <span className="fw-bold small">{item.authorName}</span>
                              <span
                                className={`depo-role-pill ${
                                  isApproverEntry ? 'is-approver' : 'is-store'
                                }`}
                              >
                                {item.authorRole}
                              </span>
                            </div>
                            <span className="depo-timeline-timestamp">
                              {formatWallClockDateTime(item.createdAt)}
                            </span>
                          </div>

                          <div className="depo-timeline-message">{item.message}</div>

                          {item.attachments.length > 0 && threadDeposit && (
                            <div className="depo-timeline-attachments mt-2">
                              {item.attachments.map((att) => (
                                <button
                                  key={att.attachmentId}
                                  type="button"
                                  className="depo-attachment-chip"
                                  onClick={() =>
                                    handleOpenSupportingAttachment(att, threadDeposit)
                                  }
                                  title={`Click to view FTP attachment (${att.filename})`}
                                >
                                  <ImageIcon size={13} />
                                  <span className="depo-attachment-chip-name">
                                    {att.filename}
                                  </span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Thread Modal Footer: Post Follow-Up Remark Form */}
            <div className="depo-thread-modal-footer">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="small fw-bold d-flex align-items-center gap-1.5">
                  <MessageSquarePlus size={15} />
                  <span>Post Follow-Up Remark / Supporting Attachment</span>
                </span>
                <span className="small text-secondary">
                  Posting as <strong>{user?.locationName || user?.username}</strong> (
                  {user?.access})
                </span>
              </div>

              {remarkError && (
                <div className="alert alert-danger py-1.5 px-2.5 small mb-2">
                  {remarkError}
                </div>
              )}

              {stagedUploads.length > 0 && (
                <div className="d-flex flex-wrap gap-2 mb-2">
                  {stagedUploads.map((u) => (
                    <span key={u.id} className="depo-staged-upload-pill">
                      <ImageIcon size={12} />
                      <span className="text-truncate" style={{ maxWidth: 180 }}>
                        {u.fileName}
                      </span>
                      <button
                        type="button"
                        className="depo-staged-upload-remove"
                        onClick={() => handleRemoveStagedUpload(u.id)}
                        title="Remove attachment"
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <div className="row g-2 align-items-center">
                <div className="col-12 col-sm-4 col-md-3">
                  <select
                    className="form-select form-select-sm"
                    value={remarkCategory}
                    onChange={(e) =>
                      setRemarkCategory(e.target.value as DepositThreadCategory)
                    }
                    disabled={remarkSubmitting}
                    aria-label="Remark category"
                  >
                    <option value="GENERAL">General Remark</option>
                    <option value="APPROVAL">Approval Follow-Up</option>
                    <option value="PETTY_CASH">Petty Cash</option>
                    <option value="PETTY_CASH_REPLENISH">Petty Cash Replenishment</option>
                    <option value="OPEN_SALES">Open Sales</option>
                    <option value="DEPT_EXPENSE">Other Dept. Expense</option>
                    <option value="DELETE_REQUEST">Delete Request</option>
                  </select>
                </div>

                <div className="col-12 col-sm-8 col-md-6">
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Write a follow-up remark or backtracking note..."
                    value={remarkMessage}
                    onChange={(e) => setRemarkMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handlePostFollowUpRemark();
                      }
                    }}
                    disabled={remarkSubmitting}
                  />
                </div>

                <div className="col-12 col-md-3 d-flex align-items-center justify-content-end gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="d-none"
                    onChange={handleSelectAttachmentFiles}
                  />
                  <button
                    type="button"
                    className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={remarkSubmitting}
                    title="Attach supporting image to upload to FTP"
                  >
                    <Paperclip size={14} />
                    <span>Attach</span>
                  </button>

                  <button
                    type="button"
                    className="btn btn-sm btn-oracle-red d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold"
                    onClick={() => void handlePostFollowUpRemark()}
                    disabled={
                      remarkSubmitting ||
                      (!remarkMessage.trim() && stagedUploads.length === 0)
                    }
                  >
                    <Send size={14} />
                    <span>{remarkSubmitting ? 'Posting...' : 'Post'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================
          DEPOSIT SLIP & SUPPORTING FTP ATTACHMENT VIEWER MODAL
          ========================================================= */}
      {attachmentTarget && (
        <div
          className="rof-drawer-backdrop deposit-modal-backdrop depo-attachment-overlay"
          onClick={handleCloseAttachment}
          role="dialog"
          aria-modal="true"
          aria-label="FTP Attachment Image Viewer"
        >
          <div
            className="deposit-attachment-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="rof-drawer-header d-flex flex-column flex-sm-row align-items-sm-center justify-content-between gap-3">
              <div className="min-w-0">
                <div className="d-flex align-items-center gap-2 flex-wrap mb-1">
                  <span className="bom-uom-badge">{attachmentTarget.locationName}</span>
                  <span className="small text-secondary">•</span>
                  <span className="small fw-semibold text-secondary">
                    Deposit #{attachmentTarget.depositId}
                  </span>
                  <span className="small text-secondary">•</span>
                  <span className="small text-secondary">
                    Business Date:{' '}
                    <strong>{formatDisplayDate(attachmentTarget.businessDate)}</strong>
                  </span>
                </div>
                <h3 className="h5 fw-bold mb-0 bom-main-heading d-flex align-items-center gap-2 text-truncate">
                  <ImageIcon size={19} className="flex-shrink-0" />
                  <span>{attachmentTarget.label}</span>
                  <span className="small fw-normal text-secondary ms-1 text-truncate">
                    ({attachmentTarget.filename})
                  </span>
                </h3>
              </div>

              <div className="d-flex align-items-center gap-2 flex-shrink-0">
                {attachmentTarget.depositAmount !== undefined &&
                  attachmentTarget.variance !== undefined && (
                    <div className="rof-section-kpi-strip me-1 d-none d-lg-inline-flex">
                      <div className="rof-kpi-item">
                        <span className="rof-kpi-label">Deposit:</span>
                        <strong className="rof-kpi-value bom-charcoal-text">
                          ₱{formatMoney(attachmentTarget.depositAmount)}
                        </strong>
                      </div>
                      <span className="rof-kpi-divider" aria-hidden="true" />
                      <div className="rof-kpi-item">
                        <span className="rof-kpi-label">Variance:</span>
                        <strong
                          className={`rof-kpi-value ${getVarianceClass(
                            attachmentTarget.variance
                          )}`}
                        >
                          ₱{formatMoney(attachmentTarget.variance)}
                        </strong>
                      </div>
                    </div>
                  )}

                <button
                  type="button"
                  className="btn rof-drawer-close-btn"
                  onClick={handleCloseAttachment}
                  disabled={attachmentLoading}
                  aria-label="Close viewer"
                  title="Close (Esc)"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Modal Body: Image Canvas */}
            <div className="deposit-attachment-canvas-wrapper">
              <div className="deposit-attachment-canvas">
                {attachmentLoading ? (
                  <div className="d-flex flex-column align-items-center justify-content-center py-5 text-secondary gap-2">
                    <span
                      className="spinner-border text-secondary"
                      role="status"
                      aria-hidden="true"
                    />
                    <span className="fw-medium">Loading attachment image from FTP...</span>
                  </div>
                ) : attachmentError ? (
                  <div className="d-flex flex-column align-items-center justify-content-center p-4 text-center">
                    <AlertTriangle size={40} className="text-danger mb-2" />
                    <div className="fw-semibold text-danger mb-1">
                      Unable to Load Attachment
                    </div>
                    <div className="small text-secondary">{attachmentError}</div>
                  </div>
                ) : attachmentPreview ? (
                  <img
                    src={attachmentPreview}
                    alt={attachmentTarget.filename}
                    className="deposit-attachment-img"
                    style={{
                      transform: `scale(${attachmentZoom}) rotate(${attachmentRotation}deg)`,
                    }}
                  />
                ) : (
                  <div className="d-flex flex-column align-items-center justify-content-center p-4 text-secondary">
                    <ImageIcon size={40} className="mb-2" />
                    <span>No preview available.</span>
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer: Zoom / Rotate / Download Controls */}
            <div className="deposit-attachment-footer d-flex flex-wrap align-items-center justify-content-between gap-3">
              <div className="d-flex flex-wrap align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                  onClick={() => setAttachmentZoom((z) => Math.max(z - 0.25, 0.5))}
                  disabled={!attachmentPreview || attachmentLoading || attachmentZoom <= 0.5}
                >
                  <ZoomOut size={15} />
                  <span>Zoom Out</span>
                </button>

                <span className="rof-mod-badge px-3 py-1">
                  {Math.round(attachmentZoom * 100)}%
                </span>

                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                  onClick={() => setAttachmentZoom((z) => Math.min(z + 0.25, 3))}
                  disabled={!attachmentPreview || attachmentLoading || attachmentZoom >= 3}
                >
                  <ZoomIn size={15} />
                  <span>Zoom In</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn d-inline-flex align-items-center gap-1.5"
                  onClick={() => setAttachmentRotation((r) => (r + 90) % 360)}
                  disabled={!attachmentPreview || attachmentLoading}
                >
                  <RotateCw size={15} />
                  <span>Rotate</span>
                </button>

                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn"
                  onClick={() => {
                    setAttachmentZoom(1);
                    setAttachmentRotation(0);
                  }}
                  disabled={
                    !attachmentPreview ||
                    attachmentLoading ||
                    (attachmentZoom === 1 && attachmentRotation === 0)
                  }
                >
                  Reset View
                </button>
              </div>

              <div className="d-flex align-items-center gap-2">
                <button
                  type="button"
                  className="btn btn-sm rof-view-details-btn px-3"
                  onClick={handleCloseAttachment}
                  disabled={attachmentLoading}
                >
                  Close
                </button>

                <button
                  type="button"
                  className="btn btn-sm btn-oracle-red d-inline-flex align-items-center gap-1.5 px-3 py-1.5 fw-semibold"
                  onClick={handleDownloadAttachment}
                  disabled={!attachmentPreview || attachmentLoading}
                >
                  <Download size={15} />
                  <span>Download Image</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
