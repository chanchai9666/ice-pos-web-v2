"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import {
  CheckCircle2,
  AlertCircle,
  TriangleAlert,
  Info,
  X,
} from "lucide-react";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
  removeToast: (id: string) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
  };
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message: string, type: ToastType = "info", duration = 3500) => {
      const id = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
      const newItem: ToastItem = { id, message, type, duration };

      setToasts((prev) => [...prev, newItem]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const toastMethods = useMemo(
    () => ({
      success: (msg: string, duration?: number) =>
        showToast(msg, "success", duration),
      error: (msg: string, duration?: number) =>
        showToast(msg, "error", duration),
      warning: (msg: string, duration?: number) =>
        showToast(msg, "warning", duration),
      info: (msg: string, duration?: number) =>
        showToast(msg, "info", duration),
    }),
    [showToast]
  );

  return (
    <ToastContext.Provider
      value={{ showToast, removeToast, toast: toastMethods }}
    >
      {children}
      <ToastContainer toasts={toasts} onDismiss={removeToast} />
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
};

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
}) => {
  if (toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-5 right-5 z-[9999] flex flex-col gap-2.5 max-w-md w-[calc(100vw-2.5rem)] pointer-events-none transition-all duration-300"
    >
      {toasts.map((toast) => {
        const { id, message, type } = toast;

        const config = {
          success: {
            bgClass:
              "bg-emerald-600 text-white border-emerald-700/50 shadow-emerald-900/20",
            icon: <CheckCircle2 className="w-5 h-5 shrink-0 text-white" />,
          },
          error: {
            bgClass:
              "bg-rose-600 text-white border-rose-700/50 shadow-rose-900/20",
            icon: <AlertCircle className="w-5 h-5 shrink-0 text-white" />,
          },
          warning: {
            bgClass:
              "bg-amber-500 text-amber-950 border-amber-600/50 shadow-amber-900/20",
            icon: <TriangleAlert className="w-5 h-5 shrink-0 text-amber-950" />,
          },
          info: {
            bgClass:
              "bg-sky-600 text-white border-sky-700/50 shadow-sky-900/20",
            icon: <Info className="w-5 h-5 shrink-0 text-white" />,
          },
        }[type];

        return (
          <div
            key={id}
            role="alert"
            className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border shadow-xl backdrop-blur-xs transition-all duration-200 animate-in fade-in slide-in-from-top-3 ${config.bgClass}`}
          >
            <div className="flex items-center gap-3 overflow-hidden">
              {config.icon}
              <p className="text-sm font-medium leading-snug break-words">
                {message}
              </p>
            </div>
            <button
              type="button"
              onClick={() => onDismiss(id)}
              className="p-1 rounded-lg opacity-80 hover:opacity-100 transition-opacity hover:bg-black/10 shrink-0"
              aria-label="ปิดการแจ้งเตือน"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
};
