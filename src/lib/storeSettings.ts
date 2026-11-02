import { db } from './firebase';
import { doc, getDoc, setDoc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { StoreSettings } from '../types';

export const DEFAULT_SETTINGS: StoreSettings = {
  storeName: 'Grocery Flow Mart',
  address: 'Main Branch Grocery Store',
  phone: '02-123-4567',
  currencySymbol: '฿',
  taxEnabled: false,
  taxRate: 7,
  receiptFooter: 'Thank you for shopping with us!',
  themeColor: 'emerald'
};

export function subscribeStoreSettings(callback: (settings: StoreSettings) => void) {
  const ref = doc(db, 'settings', 'store');
  return onSnapshot(ref, (snap) => {
    if (snap.exists()) {
      callback({ ...DEFAULT_SETTINGS, ...snap.data() } as StoreSettings);
    } else {
      callback(DEFAULT_SETTINGS);
    }
  }, (err) => {
    console.error('Error subscribing to store settings:', err);
    callback(DEFAULT_SETTINGS);
  });
}

export async function saveStoreSettings(settings: StoreSettings) {
  const ref = doc(db, 'settings', 'store');
  await setDoc(ref, {
    ...settings,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
