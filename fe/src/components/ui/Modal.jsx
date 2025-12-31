import { useEffect } from "react";

/**
 * Generic modal using shared UI selectors (ui.css).
 * open: boolean
 * title: string | ReactNode
 * onClose: function
 * footer: ReactNode
 */
export default function Modal({ open, title, onClose, children, footer, className = "", maxWidth }) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        className={"modal " + className}
        style={maxWidth ? { width: `min(${maxWidth}, 100%)` } : undefined}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="modal__header">
          <div className="modal__title">{title}</div>
          <button type="button" className="btn-ghost btn-sm" onClick={onClose} aria-label="Đóng">
            ✕
          </button>
        </div>

        <div className="modal__body">{children}</div>

        {footer ? <div className="modal__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
