'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * A localStorage-backed UI preference (sort, density, which columns to show).
 * SSR-safe: it renders the initial value on the server, then hydrates from
 * localStorage on the client. Use for view-only settings that do not need to
 * persist across devices.
 */
export function usePref<T>(key: string, initial: T): [T, (value: T) => void] {
  const storageKey = `ss:pref:${key}`;
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw != null) setValue(JSON.parse(raw) as T);
    } catch {
      /* ignore */
    }
  }, [storageKey]);

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* ignore */
      }
    },
    [storageKey],
  );

  return [value, set];
}
