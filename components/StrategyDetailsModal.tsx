import React from "react";

export default function StrategyDetailsModal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[250]">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div
        className="relative mx-auto mt-8 w-[min(1100px,96vw)] max-h-[88vh] rounded-3xl border-2 border-white/10 bg-slate-900 bg-grain shadow-2xl overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="p-5 border-b border-white/10 flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-base sm:text-lg font-black text-white truncate">
              {title}
            </h2>
            <p className="text-slate-400 text-xs sm:text-sm mt-1">
              Click outside to close
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
            aria-label="Close"
            title="Close"
          >
            <svg
              className="w-6 h-6"
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

        <div className="p-4 sm:p-6 overflow-auto max-h-[calc(88vh-72px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
