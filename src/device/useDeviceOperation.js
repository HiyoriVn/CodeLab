import { useCallback, useMemo, useRef, useState } from 'react';

// One owner for bridge requests and browser USB, including same-tick clicks.
export function useDeviceOperation() {
  const owner = useRef(null);
  const [busy, setBusy] = useState(false);
  const isBusy = useCallback(() => owner.current !== null, []);
  const acquire = useCallback(() => {
    if (owner.current) return null;
    const token = Symbol('device-operation');
    owner.current = token;
    setBusy(true);
    return () => {
      if (owner.current !== token) return;
      owner.current = null;
      setBusy(false);
    };
  }, []);
  return useMemo(() => ({ busy, isBusy, acquire }), [busy, isBusy, acquire]);
}
