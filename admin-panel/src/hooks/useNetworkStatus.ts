import { useState, useEffect } from 'react';
import { subscribeToNetworkStatus, getNetworkStatus } from '../api';

export function useNetworkStatus() {
  const [status, setStatus] = useState(getNetworkStatus);

  useEffect(() => {
    const unsub = subscribeToNetworkStatus((isOnline, queuedCount) => {
      setStatus({ isOnline, queuedCount });
    });
    return () => { unsub(); };
  }, []);

  return status;
}
