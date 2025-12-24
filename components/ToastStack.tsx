import React from "react";

export type ToastTone = "success" | "error" | "info";

export type ToastItem = {
  id: string;
  tone: ToastTone;
  title: string;
  message?: string;
};

export default function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}) {
  if (toasts.length === 0) return null;

  const toneStyles: Record<ToastTone, { border: string; title: string }> = {
    success: { border: "border-emerald-500/25", title: "text-emerald-300" },
    error: { border: "border-rose-500/25", title: "text-rose-300" },
    info: { border: "border-blue-500/20", title: "text-blue-300" },
  };

  return (
    <div className="fixed z-[300] top-4 right-4 w-[min(420px,92vw)] space-y-3">
      {toasts.map((t) => {
        const s = toneStyles[t.tone];
        return (
          <div
            key={t.id}
            className={`bg-slate-900/80 glass border ${s.border} rounded-2xl shadow-2xl px-4 py-3 backdrop-blur-md`}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className={`text-sm font-black ${s.title}`}>{t.title}</div>
                {t.message ? (
                  <div className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {t.message}
                  </div>
                ) : null}
              </div>
              <button
                onClick={() => onDismiss(t.id)}
                className="p-1.5 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                aria-label="Dismiss notification"
                title="Dismiss"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
