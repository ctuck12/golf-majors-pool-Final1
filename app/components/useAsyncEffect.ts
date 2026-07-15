'use client';

import { useEffect } from 'react';

// Fetch-on-mount helper: runs an async loader whenever it changes (pages
// wrap theirs in useCallback). State updates inside the loader happen after
// awaits, never synchronously during the effect.
export function useAsyncEffect(load: () => Promise<unknown>) {
  useEffect(() => {
    void load();
  }, [load]);
}
