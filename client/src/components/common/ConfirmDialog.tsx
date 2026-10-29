interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(2px)' }}
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 400 }}>
        <div className="modal-content border-0 rounded-4 shadow">
          <div className="modal-header border-bottom py-3">
            <h5 className="modal-title h6 fw-bold mb-0">{title}</h5>
            <button
              type="button"
              className="btn-close"
              aria-label="Close"
              onClick={onCancel}
            />
          </div>
          <div className="modal-body py-4">
            <p className="text-secondary small mb-0">{message}</p>
          </div>
          <div className="modal-footer border-top bg-light rounded-bottom-4 py-2">
            <button
              type="button"
              className="btn btn-sm btn-light border"
              onClick={onCancel}
            >
              {cancelText}
            </button>
            <button
              type="button"
              className="btn btn-sm btn-danger"
              onClick={onConfirm}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
