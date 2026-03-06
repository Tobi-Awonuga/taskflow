import { createContext, useContext, useState, useCallback, useRef } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  return useContext(ToastContext);
}

const TYPE_META = {
  success: { dot: '#22C55E' },
  error:   { dot: '#F0654D' },
  info:    { dot: '#F0654D' },
};

function Toast({ id, message, type, onClose }) {
  const meta = TYPE_META[type] ?? TYPE_META.info;
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-2xl bg-white text-gray-800 text-sm
        shadow-[0_4px_24px_rgba(0,0,0,0.10)] border border-black/[0.06] min-w-64 max-w-xs
        animate-[toast-rise_0.25s_ease-out_both]"
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.dot }} />
      <span className="flex-1 font-medium leading-snug">{message}</span>
      <button
        onClick={() => onClose(id)}
        className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors ml-1"
        aria-label="Dismiss"
      >
        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
          <path d="M1 1l9 9M10 1L1 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const toast = useCallback((message, type = 'info') => {
    const id = nextId.current++;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 items-end">
        {toasts.map(t => (
          <Toast key={t.id} {...t} onClose={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
