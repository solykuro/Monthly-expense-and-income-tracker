import { useEffect, useId, useRef, type ReactNode } from 'react'
import './Sheet.css'

interface SheetProps {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** 確認對話框使用較小的置中版面 */
  variant?: 'sheet' | 'alert'
}

/** 從底部滑出的面板（或置中的確認框），Esc 或點背景可關閉 */
export function Sheet({ title, onClose, children, footer, variant = 'sheet' }: SheetProps) {
  const titleId = useId()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null
    panelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      previous?.focus?.()
    }
  }, [onClose])

  return (
    <div className={`sheet-backdrop sheet-backdrop--${variant}`} onClick={onClose}>
      <div
        ref={panelRef}
        className={`sheet sheet--${variant}`}
        role={variant === 'alert' ? 'alertdialog' : 'dialog'}
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="sheet-header">
          <h2 id={titleId}>{title}</h2>
          {variant === 'sheet' && (
            <button type="button" className="plain" onClick={onClose}>
              關閉
            </button>
          )}
        </header>
        <div className="sheet-body">{children}</div>
        {footer && <footer className="sheet-footer">{footer}</footer>}
      </div>
    </div>
  )
}

interface ConfirmProps {
  title: string
  message: ReactNode
  confirmLabel: string
  cancelLabel?: string
  danger?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({ title, message, confirmLabel, cancelLabel = '取消', danger, onConfirm, onCancel }: ConfirmProps) {
  return (
    <Sheet
      title={title}
      onClose={onCancel}
      variant="alert"
      footer={
        <>
          <button type="button" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </>
      }
    >
      {message}
    </Sheet>
  )
}
