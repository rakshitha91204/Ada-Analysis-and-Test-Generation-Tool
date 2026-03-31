import React, { useEffect, useState, useCallback } from 'react';
import { X, CheckCircle, AlertTriangle, XCircle, Info } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
}

// Global toast state
let toastListeners: Array<(toasts: ToastMessage[]) => void> = [];
let toastList: ToastMessage[] = [];

export function showToast(message: string, type: ToastType = 'info') {
  const id = crypto.randomUUID();
  toastList = [...toastList, { id, type, message }];
  toastListeners.forEach((l) => l([...toastList]));

  setTimeout(() => {
    toastList = toastList.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l([...toastList]));
  }, 3000);
}

const icons: Record<ToastType, React.ReactNode> = {
  success: <CheckCircle size={14} className="text-green-400" />,
  error: <XCircle size={14} className="text-red-400" />,
  warning: <AlertTriangle size={14} className="text-amber-400" />,
  info: <Info size={14} className="text-blue-400" />,
};

const borderColors: Record<ToastType, string> = {
  success: 'border-green-500/40',
  error: 'border-red-500/40',
  warning: 'border-amber-500/40',
  info: 'border-blue-500/40',
};

export const Toast: React.FC = () => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const listener = (list: ToastMessage[]) => setToasts(list);
    toastListeners.push(listener);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== listener);
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    toastList = toastList.filter((t) => t.id !== id);
    toastListeners.forEach((l) => l([...toastList]));
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast-enter flex items-center gap-2.5 px-3 py-2.5 rounded-lg bg-zinc-900 border ${borderColors[toast.type]} shadow-xl pointer-events-auto max-w-xs`}
        >
          {icons[toast.type]}
          <span className="text-xs text-zinc-200 flex-1">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
};
