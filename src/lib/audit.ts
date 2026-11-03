import { db, auth } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { AuditLog } from '../types';

export async function logActivity(
  action: string,
  entityType: AuditLog['entityType'],
  details: string,
  entityId?: string
) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const log: Omit<AuditLog, 'id'> = {
      action,
      entityType,
      entityId,
      details,
      performedBy: user.uid,
      performedByName: user.displayName || user.email || 'System',
      createdAt: serverTimestamp()
    };

    await addDoc(collection(db, 'auditLogs'), log);
  } catch (err) {
    console.warn('Failed to log activity:', err);
  }
}
