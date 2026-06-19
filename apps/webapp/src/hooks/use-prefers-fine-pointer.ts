'use client';

import { useEffect, useState } from 'react';

const FINE_POINTER_QUERY = '(hover: hover) and (pointer: fine)';

/** True when the primary input supports hover (mouse/trackpad), not touch-only. */
export function usePrefersFinePointer(): boolean {
  const [prefersFinePointer, setPrefersFinePointer] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(FINE_POINTER_QUERY);
    const update = () => setPrefersFinePointer(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return prefersFinePointer;
}
