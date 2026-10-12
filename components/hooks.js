'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';

export function useLoad(url) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    setError('');
    try { setData(await api(url)); } catch (e) { setError(e.message); }
  }, [url]);
  useEffect(() => { load(); }, [load]);
  return { data, error, reload: load };
}
