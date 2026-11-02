import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { getPendingSales, clearPendingSales } from '../lib/offlineCache';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export function OfflineIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Attempt to sync pending offline sales
      const pending = getPendingSales();
      if (pending.length > 0) {
        setIsSyncing(true);
        try {
          for (const sale of pending) {
            const { offlineAt, ...saleData } = sale;
            await addDoc(collection(db, 'sales'), {
              ...saleData,
              createdAt: serverTimestamp(),
              syncedFromOffline: true
            });
          }
          clearPendingSales();
          setPendingCount(0);
        } catch (err) {
          console.error('Failed to sync offline sales:', err);
        } finally {
          setIsSyncing(false);
        }
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check pending count
    setPendingCount(getPendingSales().length);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && pendingCount === 0 && !isSyncing) {
    return null;
  }

  return (
    <div className={`fixed bottom-4 left-4 z-[400] flex items-center gap-2.5 px-4 py-2.5 rounded-2xl shadow-xl text-xs font-bold text-white transition-all ${
      isOnline ? 'bg-indigo-600' : 'bg-amber-600 animate-pulse'
    }`}>
      {!isOnline ? (
        <>
          <WifiOff className="w-4 h-4" />
          <span>Offline Mode — Using Cached Inventory & Queuing Sales</span>
        </>
      ) : isSyncing ? (
        <>
          <RefreshCw className="w-4 h-4 animate-spin" />
          <span>Syncing offline sales to cloud ({pendingCount})...</span>
        </>
      ) : pendingCount > 0 ? (
        <>
          <Wifi className="w-4 h-4" />
          <span>Back Online ({pendingCount} offline sales pending sync)</span>
        </>
      ) : null}
    </div>
  );
}
