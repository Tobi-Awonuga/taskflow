export default function ErrorBanner({ error, onDevLogin }) {
  if (!error) return null;

  const isUnauthorized = error.includes('Unauthorized');

  return (
    <div className="flex items-center justify-between gap-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-2.5">
      <span>{error}</span>
      {isUnauthorized && (
        <button
          onClick={onDevLogin}
          className="shrink-0 px-3 py-1.5 rounded-lg bg-[#F0654D] text-white font-semibold hover:bg-[#E85B44] transition-colors"
        >
          Dev Login (Admin)
        </button>
      )}
    </div>
  );
}
