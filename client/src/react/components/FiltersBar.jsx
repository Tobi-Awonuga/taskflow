import { useState, useEffect, useRef } from 'react';

const STATUSES = [
  { value: 'TODO',        label: 'To Do' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'DONE',        label: 'Done' },
  { value: 'CANCELLED',   label: 'Cancelled' },
];

const PRIORITIES = [
  { value: 'LOW',    label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH',   label: 'High' },
  { value: 'URGENT', label: 'Urgent' },
];

const SELECT_CLS =
  'text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 text-gray-600 ' +
  'focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D]';

export default function FiltersBar({ status, priority, q, onChange }) {
  const [localQ, setLocalQ] = useState(q);
  const debounceRef = useRef(null);

  // Sync when parent clears the query (e.g. sidebar nav resets filters)
  useEffect(() => { setLocalQ(q); }, [q]);

  // Clear pending debounce on unmount
  useEffect(() => () => clearTimeout(debounceRef.current), []);

  const handleSearch = (e) => {
    const value = e.target.value;
    setLocalQ(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange('q', value), 250);
  };

  return (
    <div className="flex items-center gap-3">
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
          className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F0654D]/20 focus:border-[#F0654D] text-gray-700 placeholder-gray-400"
        />
      </div>

      <select value={status} onChange={e => onChange('status', e.target.value)} className={SELECT_CLS}>
        <option value="">All Statuses</option>
        {STATUSES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>

      <select value={priority} onChange={e => onChange('priority', e.target.value)} className={SELECT_CLS}>
        <option value="">All Priorities</option>
        {PRIORITIES.map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
    </div>
  );
}
