import { useState, useEffect, useRef } from 'react';

const STATUSES = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE',        label: 'Done' },
  { value: 'BLOCKED',     label: 'Blocked' },
  { value: 'CANCELLED',   label: 'Cancelled' },
];

const PRIORITIES = [
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

// Native select wrapped with a custom chevron — clean, accessible, cross-browser consistent
function FilterSelect({ value, onChange, placeholder, options }) {
  const hasValue = value !== '';
  return (
    <div className="relative">
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className={`appearance-none pl-3 pr-8 py-2 text-sm rounded-xl border shadow-sm transition-colors cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]
          ${hasValue
            ? 'bg-[#F0654D]/5 border-[#F0654D]/30 text-[#F0654D] font-medium'
            : 'bg-white border-gray-200 text-gray-500 hover:border-gray-300'
          }`}
      >
        <option value="">{placeholder}</option>
        {options.map(({ value: v, label }) => (
          <option key={v} value={v}>{label}</option>
        ))}
      </select>
      <svg
        className={`pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 transition-colors ${hasValue ? 'text-[#F0654D]' : 'text-gray-400'}`}
        width="12" height="12" viewBox="0 0 12 12" fill="none"
      >
        <path d="M2.5 4.5L6 8l3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function FiltersBar({ status, priority, q, onChange }) {
  const [localQ, setLocalQ] = useState(q);
  const debounceRef = useRef(null);

  useEffect(() => { setLocalQ(q); }, [q]);
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setLocalQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange('q', value), 250);
  };

  return (
    <div className="flex items-center gap-3">
      {/* Search */}
      <div className="relative flex-1 max-w-xs">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          width="14" height="14" viewBox="0 0 14 14" fill="none"
        >
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" />
          <path d="M10 10l2.5 2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <input
          type="text"
          value={localQ}
          onChange={handleSearch}
          placeholder="Search tasks…"
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl shadow-sm
            focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]
            text-gray-700 placeholder-gray-400 hover:border-gray-300 transition-colors"
        />
        {localQ && (
          <button
            onClick={() => { setLocalQ(''); onChange('q', ''); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors"
            aria-label="Clear search"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 2l8 8M10 2L2 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>

      <FilterSelect
        value={status}
        onChange={v => onChange('status', v)}
        placeholder="All Statuses"
        options={STATUSES}
      />

      <FilterSelect
        value={priority}
        onChange={v => onChange('priority', v)}
        placeholder="All Priorities"
        options={PRIORITIES}
      />
    </div>
  );
}
