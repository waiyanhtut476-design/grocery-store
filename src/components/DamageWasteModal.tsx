import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { 
  Trash2, 
  AlertTriangle, 
  X, 
  Loader2, 
  CheckCircle2, 
  Package, 
  DollarSign, 
  Calendar,
  Clock
} from 'lucide-react';
import { Product, DamageRecord, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';

interface DamageWasteModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  user: User;
  settings?: StoreSettings;
  preSelectedProduct?: Product | null;
}

export function DamageWasteModal({
  isOpen,
  onClose,
  products,
  user,
  settings,
  preSelectedProduct
}: DamageWasteModalProps) {
  const [activeTab, setActiveTab] = useState<'record' | 'logs'>('record');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [reason, setReason] = useState<'expired' | 'damaged' | 'lost' | 'other'>('expired');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // Past logs
  const [damageLogs, setDamageLogs] = useState<DamageRecord[]>([]);
  const { t } = useLanguage();
  const currency = settings?.currencySymbol || '฿';

  useEffect(() => {
    if (preSelectedProduct) {
      setSelectedProductId(preSelectedProduct.id);
    } else if (products.length > 0 && !selectedProductId) {
      setSelectedProductId(products[0].id);
    }
  }, [preSelectedProduct, products, selectedProductId]);

  useEffect(() => {
    if (!isOpen) return;
    const q = query(collection(db, 'damages'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const logs: DamageRecord[] = [];
      snap.forEach(d => logs.push({ id: d.id, ...d.data() } as DamageRecord));
      setDamageLogs(logs);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'damages');
    });
    return () => unsub();
  }, [isOpen]);

  if (!isOpen) return null;

  const currentProduct = products.find(p => p.id === selectedProductId) || preSelectedProduct;
  const costPrice = currentProduct?.costPrice || 0;
  const calculatedLoss = quantity * costPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentProduct) {
      alert("Please select a product.");
      return;
    }
    if (quantity <= 0) {
      alert("Quantity must be greater than 0.");
      return;
    }
    if (quantity > currentProduct.stock) {
      if (!window.confirm(`Discard quantity (${quantity}) exceeds current recorded stock (${currentProduct.stock}). Proceed anyway?`)) {
        return;
      }
    }

    setIsSubmitting(true);

    try {
      const batch = writeBatch(db);
      const damageId = doc(collection(db, 'damages')).id;
      const damageRef = doc(db, 'damages', damageId);
      const now = serverTimestamp();

      const recordData = {
        productId: currentProduct.id,
        productName: currentProduct.name,
        barcode: currentProduct.barcode,
        quantity: Number(quantity),
        costPrice: Number(costPrice),
        lossAmount: Number(calculatedLoss),
        reason,
        notes: notes.trim(),
        recordedBy: user.uid,
        recordedByName: user.displayName || user.email || 'Staff',
        createdAt: now
      };

      batch.set(damageRef, recordData);

      // Deduct stock from product
      const productRef = doc(db, 'products', currentProduct.id);
      batch.update(productRef, {
        stock: Math.max(0, currentProduct.stock - Number(quantity)),
        updatedAt: now
      });

      await batch.commit();

      setSuccessToast(`Recorded ${quantity}x ${currentProduct.name} discarded. Stock deducted!`);
      setQuantity(1);
      setNotes('');
      setTimeout(() => setSuccessToast(null), 3000);
      setActiveTab('logs');
    } catch (err) {
      console.error('Error writing off damage:', err);
      handleFirestoreError(err, OperationType.CREATE, 'damages');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalLossAllTime = damageLogs.reduce((acc, log) => acc + (log.lossAmount || 0), 0);

  return (
    <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]"
      >
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50/60 shrink-0">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
              <Trash2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">{t('damage_writeoff')}</h3>
              <p className="text-xs text-rose-700">Stock reduction for damaged / expired goods</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switch */}
        <div className="flex border-b border-slate-200 px-5 pt-3 gap-6 shrink-0 bg-white">
          <button
            type="button"
            onClick={() => setActiveTab('record')}
            className={cn(
              "pb-2.5 text-xs font-bold transition-all relative cursor-pointer",
              activeTab === 'record' ? "text-rose-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <span>{t('record_damage')}</span>
            {activeTab === 'record' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600 rounded-full" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={cn(
              "pb-2.5 text-xs font-bold transition-all relative cursor-pointer",
              activeTab === 'logs' ? "text-rose-600" : "text-slate-400 hover:text-slate-600"
            )}
          >
            <span>{t('waste_history')} ({damageLogs.length})</span>
            {activeTab === 'logs' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-600 rounded-full" />
            )}
          </button>
        </div>

        {/* Tab 1: Record Form */}
        {activeTab === 'record' && (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                {t('item_name')} *
              </label>
              <select
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
              >
                {products.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.barcode}) - Current stock: {p.stock}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Quantity Discarded *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, Number(e.target.value)))}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {t('damage_reason')} *
                </label>
                <select
                  value={reason}
                  onChange={(e) => setReason(e.target.value as any)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                >
                  <option value="expired">{t('expired')}</option>
                  <option value="damaged">{t('damaged')}</option>
                  <option value="lost">Lost / Spilled</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            {/* Loss Cost Summary Banner */}
            <div className="p-4 bg-rose-50/70 border border-rose-200/80 rounded-2xl flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] font-bold text-rose-700 uppercase tracking-wider block">
                  {t('loss_amount')}
                </span>
                <span className="text-xs text-rose-600 font-medium">
                  {quantity} units @ cost {currency}{costPrice}
                </span>
              </div>
              <span className="text-xl font-black text-rose-700 tabular-nums">
                -{currency}{calculatedLoss.toLocaleString()}
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Disposal Notes / Explanation
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Broken bottle during restocking or passed expiration date"
                className="w-full px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 resize-none"
              />
            </div>

            <div className="pt-2 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    <span>Deduct Stock & Write-Off</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Tab 2: Logs Table */}
        {activeTab === 'logs' && (
          <div className="p-5 overflow-y-auto space-y-4">
            <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-700">Cumulative Recorded Losses:</span>
              <span className="text-base font-black text-rose-600 tabular-nums">
                {currency}{totalLossAllTime.toLocaleString()}
              </span>
            </div>

            <div className="divide-y divide-slate-100">
              {damageLogs.map(log => {
                const dateStr = log.createdAt?.toDate ? log.createdAt.toDate().toLocaleString() : 'Recent';
                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-900">{log.productName}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-700">
                          {log.reason}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                        {log.barcode} • -{log.quantity} units • By {log.recordedByName}
                      </p>
                      {log.notes && (
                        <p className="text-[11px] text-slate-600 italic mt-0.5">&quot;{log.notes}&quot;</p>
                      )}
                    </div>

                    <div className="text-right shrink-0">
                      <span className="font-black text-rose-600 tabular-nums">
                        -{currency}{log.lossAmount.toLocaleString()}
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">{dateStr}</p>
                    </div>
                  </div>
                );
              })}

              {damageLogs.length === 0 && (
                <p className="text-center text-xs text-slate-400 py-10">
                  No damaged or expired goods recorded.
                </p>
              )}
            </div>
          </div>
        )}

        {/* Toast */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="m-3 p-3 bg-slate-900 text-white rounded-xl shadow-lg flex items-center gap-2 text-xs font-bold"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{successToast}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
