import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

type ToastKind = 'success' | 'error' | 'info';

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastContextValue {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const AUTO_DISMISS_MS = 5000;

const KIND_STYLES: Record<ToastKind, string> = {
  success: 'border-panel-accent/40 bg-panel-surface text-panel-text',
  error: 'border-panel-danger/50 bg-panel-surface text-panel-text',
  info: 'border-panel-border bg-panel-surface text-panel-text',
};

const KIND_ICON: Record<ToastKind, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
};

const KIND_ICON_COLOR: Record<ToastKind, string> = {
  success: 'text-panel-accent',
  error: 'text-panel-danger',
  info: 'text-panel-muted',
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [toasts, setToasts] = useState<Toast[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback(
    (kind: ToastKind, message: string) => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev.slice(-4), { id, kind, message }]);
      setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message: string) => push('success', message),
      error: (message: string) => push('error', message),
      info: (message: string) => push('info', message),
    }),
    [push],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            role="status"
            className={`toast-enter pointer-events-auto flex items-start gap-2 rounded-lg border px-3 py-2.5 text-sm shadow-lg backdrop-blur ${KIND_STYLES[toastItem.kind]}`}
          >
            <span className={`mt-0.5 font-semibold ${KIND_ICON_COLOR[toastItem.kind]}`}>{KIND_ICON[toastItem.kind]}</span>
            <span className="flex-1 leading-snug">{toastItem.message}</span>
            <button
              onClick={() => dismiss(toastItem.id)}
              className="text-panel-muted transition hover:text-panel-text"
              aria-label={t('common.dismiss')}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
