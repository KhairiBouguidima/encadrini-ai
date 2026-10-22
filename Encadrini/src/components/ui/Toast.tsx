import React, { createContext, useContext, useState, useCallback, useId } from "react"

export type ToastType = "success" | "error" | "warning" | "info"

export interface Toast {
  id: string
  type: ToastType
  title?: string
  message: string
  duration?: number
}

interface ConfirmDialogState {
  isOpen: boolean
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: "danger" | "primary"
  isLoading?: boolean
  onConfirm: () => Promise<void> | void
  onCancel?: () => void
}

interface ToastContextType {
  toast: {
    success: (message: string, title?: string) => void
    error: (message: string, title?: string) => void
    warning: (message: string, title?: string) => void
    info: (message: string, title?: string) => void
  }
  confirm: (options: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: "danger" | "primary"
    onConfirm: () => Promise<void> | void
  }) => void
}

const ToastContext = createContext<ToastContextType | null>(null)

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error("useToast must be used within ToastProvider")
  return ctx
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState>({
    isOpen: false,
    title: "",
    message: "",
    onConfirm: () => {},
  })

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback((type: ToastType, message: string, title?: string, duration = 4000) => {
    const id = `${Date.now()}-${Math.random()}`
    const newToast: Toast = { id, type, message, title, duration }
    setToasts((prev) => [...prev, newToast])

    if (duration > 0) {
      setTimeout(() => {
        removeToast(id)
      }, duration)
    }
  }, [removeToast])

  const toast = {
    success: (msg: string, title?: string) => addToast("success", msg, title),
    error: (msg: string, title?: string) => addToast("error", msg, title, 5500),
    warning: (msg: string, title?: string) => addToast("warning", msg, title),
    info: (msg: string, title?: string) => addToast("info", msg, title),
  }

  const confirm = useCallback((options: {
    title: string
    message: string
    confirmText?: string
    cancelText?: string
    variant?: "danger" | "primary"
    onConfirm: () => Promise<void> | void
  }) => {
    setConfirmDialog({
      isOpen: true,
      title: options.title,
      message: options.message,
      confirmText: options.confirmText ?? "Confirmer",
      cancelText: options.cancelText ?? "Annuler",
      variant: options.variant ?? "danger",
      isLoading: false,
      onConfirm: options.onConfirm,
    })
  }, [])

  const handleConfirmAction = async () => {
    try {
      setConfirmDialog((prev) => ({ ...prev, isLoading: true }))
      await confirmDialog.onConfirm()
      setConfirmDialog((prev) => ({ ...prev, isOpen: false, isLoading: false }))
    } catch (err) {
      setConfirmDialog((prev) => ({ ...prev, isLoading: false }))
      // keep dialog open or show error
      toast.error(err instanceof Error ? err.message : "L'opération a échoué.")
    }
  }

  return (
    <ToastContext.Provider value={{ toast, confirm }}>
      {children}

      {/* ── Toast Container (bottom-right) ── */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => {
          const bgColors = {
            success: "bg-emerald-50 border-emerald-300 text-emerald-900",
            error: "bg-red-50 border-red-300 text-red-900",
            warning: "bg-amber-50 border-amber-300 text-amber-900",
            info: "bg-blue-50 border-blue-300 text-blue-900",
          }
          const icon = {
            success: "✓",
            error: "✕",
            warning: "⚠",
            info: "ℹ",
          }[t.type]

          return (
            <div
              key={t.id}
              className={`pointer-events-auto p-3.5 rounded-xl border shadow-lg flex items-start gap-3 transition-all animate-in fade-in slide-in-from-bottom-2 ${bgColors[t.type]}`}
            >
              <span className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs bg-white/70">
                {icon}
              </span>
              <div className="flex-1 text-xs font-body">
                {t.title && <p className="font-semibold mb-0.5 text-[13px]">{t.title}</p>}
                <p className="leading-snug">{t.message}</p>
              </div>
              <button
                onClick={() => removeToast(t.id)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold leading-none p-1"
                aria-label="Fermer"
              >
                ×
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Accessible Confirmation Dialog ── */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs animate-in fade-in duration-150">
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-neutral-200 p-6 space-y-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
          >
            <div className="flex items-start gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  confirmDialog.variant === "danger"
                    ? "bg-red-100 text-red-600"
                    : "bg-primary-100 text-primary-600"
                }`}
              >
                {confirmDialog.variant === "danger" ? "⚠️" : "❓"}
              </div>
              <div className="space-y-1">
                <h3 id="confirm-dialog-title" className="text-base font-bold font-display text-neutral-900">
                  {confirmDialog.title}
                </h3>
                <p className="text-xs text-neutral-600 font-body leading-relaxed">
                  {confirmDialog.message}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100">
              <button
                type="button"
                disabled={confirmDialog.isLoading}
                onClick={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 text-xs font-medium font-body rounded-lg text-neutral-600 hover:bg-neutral-100 transition-colors disabled:opacity-50"
              >
                {confirmDialog.cancelText}
              </button>
              <button
                type="button"
                disabled={confirmDialog.isLoading}
                onClick={handleConfirmAction}
                className={`px-4 py-2 text-xs font-semibold font-body rounded-lg text-white shadow-xs transition-all disabled:opacity-50 flex items-center gap-1.5 ${
                  confirmDialog.variant === "danger"
                    ? "bg-red-600 hover:bg-red-700"
                    : "bg-primary-600 hover:bg-primary-700"
                }`}
              >
                {confirmDialog.isLoading && (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {confirmDialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
