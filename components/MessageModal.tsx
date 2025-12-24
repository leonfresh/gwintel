import React from "react";
import type { ToastTone } from "./ToastStack";

export default function MessageModal({
  open,
  title,
  message,
  tone = "info",
  primaryLabel = "OK",
  onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  tone?: ToastTone;
  primaryLabel?: string;
  onClose: () => void;
}) {
  if (!open) return null;

  const accent =
    tone === "success"
      ? "border-emerald-500/25"
      : tone === "error"
      ? "border-rose-500/25"
      : "border-blue-500/20";

  return (
    <div className="fixed inset-0 z-[250]">
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div
        className={`relative mx-auto mt-28 w-[min(520px,92vw)] rounded-3xl border-2 ${accent} bg-slate-900 shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="p-6 border-b border-white/10 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black text-white">{title}</h2>
            <p className="text-slate-400 text-sm mt-1">{message}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white"
            aria-label="Close"
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

        <div className="p-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-3 bg-slate-800 hover:bg-slate-700 text-white font-black rounded-xl border border-white/10"
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
