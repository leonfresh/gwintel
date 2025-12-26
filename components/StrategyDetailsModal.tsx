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

  if (
    typeof document !== "undefined" &&
    !document.getElementById("modal-scrollbar-styles")
  ) {
    const styleEl = document.createElement("style");
    styleEl.id = "modal-scrollbar-styles";
    styleEl.textContent = `
      /* Modal-only scrollbar styling */
      .modal-scroll {
        scrollbar-width: thin;
        scrollbar-color: rgba(148, 163, 184, 0.45) rgba(2, 6, 23, 0.25);
        overscroll-behavior: contain;
      }
      .modal-scroll::-webkit-scrollbar { width: 10px; height: 10px; }
      .modal-scroll::-webkit-scrollbar-track {
        background: rgba(2, 6, 23, 0.18);
        border-radius: 999px;
      }
      .modal-scroll::-webkit-scrollbar-thumb {
        background: linear-gradient(to bottom, rgba(226,232,240,0.30), rgba(148,163,184,0.45));
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 999px;
      }
      .modal-scroll::-webkit-scrollbar-thumb:hover {
        background: linear-gradient(to bottom, rgba(226,232,240,0.45), rgba(148,163,184,0.65));
      }
    `;
    document.head.appendChild(styleEl);
  }

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

        <div className="modal-scroll overflow-auto max-h-[calc(88vh-72px)]">
          {children}
        </div>
      </div>
    </div>
  );
}
