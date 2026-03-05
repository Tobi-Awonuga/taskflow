import { useState, useCallback, useEffect } from 'react';

export const INITIAL_QUERY = {
  page:     1,
  pageSize: 10,
  status:   '',
  priority: '',
  q:        '',
  scope:    'ALL', // client-side only — not forwarded to backend
};

export function useTasks() {
  const [query,       setQueryRaw]  = useState(INITIAL_QUERY);
  const [refetchTick, setRefetchTick] = useState(0);  // incremented to force re-fetch
  const [tasks,       setTasks]     = useState([]);
  const [total,       setTotal]     = useState(0);
  const [page,        setPage]      = useState(1);
  const [pageSize,    setPageSize]  = useState(10);
  const [totalPages,  setTotalPages]= useState(1);
  const [loading,     setLoading]   = useState(true);
  const [error,       setError]     = useState('');

  // setQuery — merges partial updates, resets page=1 for any non-page change
  const setQuery = useCallback((updates) => {
    setQueryRaw(prev => {
      const isPageOnly = Object.keys(updates).length === 1 && 'page' in updates;
      return { ...prev, ...updates, ...(isPageOnly ? {} : { page: 1 }) };
    });
  }, []);

  // Fetch whenever query or refetchTick changes (including initial mount)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');

      const params = new URLSearchParams({ page: query.page, pageSize: query.pageSize });
      if (query.status)   params.set('status',   query.status);
      if (query.priority) params.set('priority', query.priority);
      if (query.q)        params.set('q',        query.q);
      // query.scope is client-side; not sent to backend

      try {
        const res = await fetch(`/api/tasks?${params}`, { credentials: 'include' });
        if (cancelled) return;

        if (res.status === 401) {
          setError('Unauthorized. Use Dev Login.');
          setTasks([]); setTotal(0); setPage(1); setTotalPages(1);
        } else if (!res.ok) {
          setError(`Server error (${res.status}). Please try again.`);
          setTasks([]);
        } else {
          const data = await res.json();
          setTasks(data.tasks);
          setTotal(data.total);
          setPage(data.page);
          setPageSize(data.pageSize);
          setTotalPages(data.totalPages);
        }
      } catch {
        if (!cancelled) {
          setError('Network error. Is the server running?');
          setTasks([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [query, refetchTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const updateTaskStatus = useCallback(async (taskId, status, cancelReason) => {
    const body = { status };
    if (status === 'CANCELLED' && cancelReason) body.cancelReason = cancelReason;
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed to update task (${res.status}).`);
        return false;
      }
      setRefetchTick(t => t + 1);
      return true;
    } catch {
      setError('Network error. Could not update task.');
      return false;
    }
  }, []);

  const createTask = useCallback(async (body) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        return { ok: false, error: data.error ?? `Failed to create task (${res.status}).` };
      }
      setRefetchTick(t => t + 1);
      return { ok: true };
    } catch {
      return { ok: false, error: 'Network error. Could not create task.' };
    }
  }, []);

  const updateTaskPriority = useCallback(async (taskId, priority) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `Failed to update task (${res.status}).`);
        return false;
      }
      setRefetchTick(t => t + 1);
      return true;
    } catch {
      setError('Network error. Could not update task.');
      return false;
    }
  }, []);

  const devLoginAdmin = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/dev/login-as/1', {
        method: 'POST',
        credentials: 'include',
      });
      if (!res.ok) {
        setLoading(false);
        setError(`Dev login failed (${res.status}).`);
        return;
      }
      setRefetchTick(t => t + 1);
    } catch {
      setLoading(false);
      setError('Network error during dev login.');
    }
  }, []);

  return {
    query,
    setQuery,
    tasks,
    total,
    page,
    pageSize,
    totalPages,
    loading,
    error,
    devLoginAdmin,
    updateTaskStatus,
    updateTaskPriority,
    createTask,
  };
}
