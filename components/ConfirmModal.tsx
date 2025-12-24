import React from "react";

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "danger" | "neutral";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;

  const accent = tone === "danger" ? "border-rose-500/25" : "border-white/10";
  const confirmBtn =
    tone === "danger"
      ? "bg-rose-600 hover:bg-rose-500"
      : "bg-slate-800 hover:bg-slate-700";

  return (
    <div className="fixed inset-0 z-[250]">
      <button
        aria-label="Cancel"
        onClick={onCancel}
        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
      />

      <div
        className={`relative mx-auto mt-28 w-[min(520px,92vw)] rounded-3xl border-2 ${accent} bg-slate-900 bg-grain shadow-2xl`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="p-6 border-b border-white/10">
          <h2 className="text-lg font-black text-white">{title}</h2>
          <p className="text-slate-400 text-sm mt-1">{message}</p>
        </div>

        <div className="p-6 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-slate-900/60 glass hover:bg-slate-900/75 text-slate-200 font-black rounded-xl border border-white/10"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 ${confirmBtn} text-white font-black rounded-xl border border-white/10`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
