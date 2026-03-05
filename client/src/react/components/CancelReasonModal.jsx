import { useState, useEffect } from 'react';

const inputClass =
  'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 bg-white ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/30 focus:border-[#F0654D] transition-colors resize-none';

export default function CancelReasonModal({ open, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const [error, setError]   = useState('');

  useEffect(() => {
    if (!open) { setReason(''); setError(''); return; }
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  function handleConfirm() {
    if (!reason.trim()) { setError('Please enter a reason.'); return; }
    onConfirm(reason.trim());
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-800">Cancel Task</h2>
          <p className="text-sm text-gray-400 mt-1">
            Please provide a reason for cancelling this task.
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-5 flex flex-col gap-2">
          <textarea
            rows={3}
            value={reason}
            onChange={e => { setReason(e.target.value); setError(''); }}
            placeholder="Reason for cancellation…"
            className={inputClass}
            autoFocus
          />
          {error && <p className="text-red-500 text-xs">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-semibold text-gray-500 hover:text-gray-700 border border-gray-200 hover:border-gray-300 rounded-xl transition-colors"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="px-5 py-2.5 text-sm font-semibold text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors"
          >
            Cancel Task
          </button>
        </div>
      </div>
    </div>
  );
}
