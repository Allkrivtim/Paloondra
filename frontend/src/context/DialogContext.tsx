import { createContext, FormEvent, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ConfirmOptions {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface PromptOptions {
  title: string;
  message?: string;
  defaultValue?: string;
  confirmLabel?: string;
  placeholder?: string;
}

type PendingRequest =
  | ({ kind: 'confirm' } & ConfirmOptions & { resolve: (value: boolean) => void })
  | ({ kind: 'prompt' } & PromptOptions & { resolve: (value: string | null) => void });

interface DialogContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const [pending, setPending] = useState<PendingRequest | null>(null);
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setPending({ kind: 'confirm', ...options, resolve });
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    setInputValue(options.defaultValue ?? '');
    return new Promise<string | null>((resolve) => {
      setPending({ kind: 'prompt', ...options, resolve });
    });
  }, []);

  useEffect(() => {
    if (pending?.kind === 'prompt') {
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [pending]);

  function close(result: boolean | string | null) {
    if (!pending) return;
    if (pending.kind === 'confirm') pending.resolve(result === true);
    else pending.resolve(typeof result === 'string' ? result : null);
    setPending(null);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    close(inputValue.trim());
  }

  return (
    <DialogContext.Provider value={{ confirm, prompt }}>
      {children}
      {pending && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 p-4"
          onKeyDown={(e) => e.key === 'Escape' && close(pending.kind === 'confirm' ? false : null)}
        >
          <div className="dialog-enter w-full max-w-sm rounded-xl border border-panel-border bg-panel-surface p-5 shadow-2xl">
            <h2 className="text-sm font-semibold text-panel-text">{pending.title}</h2>
            {pending.message && <p className="mt-1.5 text-sm text-panel-muted">{pending.message}</p>}

            {pending.kind === 'prompt' ? (
              <form onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  autoFocus
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={pending.placeholder}
                  className="mt-3 w-full rounded-lg border border-panel-border bg-panel-surface2 px-3 py-2 text-sm text-panel-text outline-none focus:border-panel-accent"
                />
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => close(null)}
                    className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-muted"
                  >
                    {t('dialogs.defaultCancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={!inputValue.trim()}
                    className="rounded-lg bg-panel-accent2 px-3 py-1.5 text-xs font-medium text-black transition hover:bg-panel-accent disabled:opacity-50"
                  >
                    {pending.confirmLabel ?? t('dialogs.defaultConfirm')}
                  </button>
                </div>
              </form>
            ) : (
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => close(false)}
                  className="rounded-lg border border-panel-border px-3 py-1.5 text-xs font-medium text-panel-text transition hover:border-panel-muted"
                >
                  {pending.cancelLabel ?? t('dialogs.defaultCancel')}
                </button>
                <button
                  type="button"
                  autoFocus
                  onClick={() => close(true)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                    pending.danger
                      ? 'bg-panel-danger text-black hover:bg-red-400'
                      : 'bg-panel-accent2 text-black hover:bg-panel-accent'
                  }`}
                >
                  {pending.confirmLabel ?? t('dialogs.defaultConfirm')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within DialogProvider');
  return ctx;
}
