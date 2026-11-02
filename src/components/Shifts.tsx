import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  serverTimestamp, 
  orderBy, 
  where 
} from 'firebase/firestore';
import { Shift, StoreSettings, Sale } from '../types';
import { useLanguage } from '../lib/i18n';
import { 
  Clock, 
  DollarSign, 
  Lock, 
  Unlock, 
  CheckCircle, 
  AlertCircle, 
  Calendar, 
  FileText, 
  User as UserIcon,
  Loader2,
  X
} from 'lucide-react';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { ZReportModal } from './ZReportModal';

interface ShiftsProps {
  user: User;
  settings?: StoreSettings;
}

export function Shifts({ user, settings }: ShiftsProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);
  const [sales, setSales] = useState<Sale[]>([]);
  const { t } = useLanguage();

  // Active shift states
  const [isOpeningShift, setIsOpeningShift] = useState(false);
  const [openingCashInput, setOpeningCashInput] = useState<number>(1000);

  // Closing shift states
  const [isClosingShift, setIsClosingShift] = useState(false);
  const [actualCashCounted, setActualCashCounted] = useState<number>(0);
  const [closingNotes, setClosingNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Z-Report viewing
  const [selectedShiftForZReport, setSelectedShiftForZReport] = useState<Shift | null>(null);
  const [isZReportOpen, setIsZReportOpen] = useState(false);

  // Subscribe to shifts
  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('openedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Shift[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Shift));
      setShifts(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'shifts');
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to recent sales for live active shift calculation
  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Sale[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Sale));
      setSales(data);
    });
    return () => unsubscribe();
  }, []);

  const activeShift = shifts.find(s => s.status === 'open');

  // Compute live active shift stats
  let liveCashSales = 0;
  let liveQrSales = 0;
  let liveCardSales = 0;
  let liveCreditSales = 0;
  let liveTotalSales = 0;

  if (activeShift) {
    const shiftOpenTime = activeShift.openedAt?.toDate 
      ? activeShift.openedAt.toDate().getTime() 
      : 0;

    const shiftSales = sales.filter(s => {
      const saleTime = s.createdAt?.toDate ? s.createdAt.toDate().getTime() : 0;
      return saleTime >= shiftOpenTime;
    });

    for (const s of shiftSales) {
      liveTotalSales += s.total || 0;
      if (s.paymentMethod === 'cash') liveCashSales += s.total || 0;
      else if (s.paymentMethod === 'qr') liveQrSales += s.total || 0;
      else if (s.paymentMethod === 'card') liveCardSales += s.total || 0;
      else if (s.paymentMethod === 'credit') liveCreditSales += s.total || 0;
      else liveCashSales += s.total || 0;
    }
  }

  const expectedCashInDrawer = activeShift 
    ? (activeShift.openingCash + liveCashSales) 
    : 0;

  const cashDiff = actualCashCounted - expectedCashInDrawer;

  // Handle Open Shift
  const handleOpenShift = async () => {
    setIsSubmitting(true);
    try {
      const id = doc(collection(db, 'shifts')).id;
      const now = serverTimestamp();

      const newShift: Partial<Shift> = {
        openedBy: user.uid,
        openedByName: user.displayName || 'Staff',
        openingCash: Number(openingCashInput) || 0,
        openedAt: now,
        status: 'open',
      };

      await setDoc(doc(db, 'shifts', id), newShift);
      setIsOpeningShift(false);
    } catch (err) {
      console.error('Failed to open shift:', err);
      handleFirestoreError(err, OperationType.CREATE, 'shifts');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Close Shift
  const handleConfirmCloseShift = async () => {
    if (!activeShift) return;
    setIsSubmitting(true);
    try {
      const now = serverTimestamp();
      const updatedShiftData = {
        closedAt: now,
        closedBy: user.uid,
        closedByName: user.displayName || 'Staff',
        totalCashSales: liveCashSales,
        totalQrSales: liveQrSales,
        totalCardSales: liveCardSales,
        totalCreditSales: liveCreditSales,
        totalSales: liveTotalSales,
        expectedCash: expectedCashInDrawer,
        actualCash: actualCashCounted,
        cashDifference: cashDiff,
        status: 'closed' as const,
        notes: closingNotes
      };

      await updateDoc(doc(db, 'shifts', activeShift.id), updatedShiftData);

      const completedShiftRecord: Shift = {
        ...activeShift,
        ...updatedShiftData,
        closedAt: new Date()
      };

      setSelectedShiftForZReport(completedShiftRecord);
      setIsZReportOpen(true);
      setIsClosingShift(false);
    } catch (err) {
      console.error('Failed to close shift:', err);
      handleFirestoreError(err, OperationType.WRITE, 'shifts/' + activeShift.id);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = settings?.currencySymbol || '฿';

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('shifts')}</h2>
          <p className="text-slate-500 text-sm">Cash drawer float tracking, shift management, and Z-Reports.</p>
        </div>

        {activeShift ? (
          <button
            onClick={() => {
              setActualCashCounted(expectedCashInDrawer);
              setIsClosingShift(true);
            }}
            className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-rose-100 self-start sm:self-auto"
          >
            <Lock className="w-4 h-4" />
            <span>{t('close_shift')}</span>
          </button>
        ) : (
          <button
            onClick={() => setIsOpeningShift(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-indigo-100 self-start sm:self-auto"
          >
            <Unlock className="w-4 h-4" />
            <span>{t('open_shift')}</span>
          </button>
        )}
      </div>

      {/* Active Shift Card / Banner */}
      {activeShift ? (
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                {t('active_shift')} (ONLINE)
              </div>
              <h3 className="text-2xl font-black">Cash Drawer is Active</h3>
              <p className="text-slate-400 text-xs">
                Opened by <span className="text-white font-bold">{activeShift.openedByName}</span> at{' '}
                {activeShift.openedAt?.toDate ? activeShift.openedAt.toDate().toLocaleTimeString() : 'Recently'}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-[10px] uppercase font-bold text-slate-400">{t('opening_cash')}</span>
                <p className="text-lg font-black text-white tabular-nums mt-0.5">
                  {currency}{activeShift.openingCash.toLocaleString()}
                </p>
              </div>

              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md">
                <span className="text-[10px] uppercase font-bold text-slate-400">Cash Sales</span>
                <p className="text-lg font-black text-emerald-400 tabular-nums mt-0.5">
                  +{currency}{liveCashSales.toLocaleString()}
                </p>
              </div>

              <div className="bg-white/10 p-4 rounded-2xl backdrop-blur-md col-span-2 sm:col-span-1">
                <span className="text-[10px] uppercase font-bold text-indigo-300">{t('expected_cash')}</span>
                <p className="text-xl font-black text-white tabular-nums mt-0.5">
                  {currency}{expectedCashInDrawer.toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-amber-50 border border-amber-200 rounded-3xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-bold text-amber-900 text-sm">{t('no_active_shift')}</p>
              <p className="text-xs text-amber-700 mt-0.5">Start a new shift with your opening cash float to track drawer balances.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsOpeningShift(true)}
            className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs rounded-xl transition-all shadow-md shadow-amber-200 self-start sm:self-auto"
          >
            {t('open_shift')}
          </button>
        </div>
      )}

      {/* Shifts History */}
      <div className="space-y-3">
        <h3 className="font-bold text-slate-900 text-base">Shifts & Cash History</h3>
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-4 font-bold">Shift ID / Date</th>
                  <th className="px-5 py-4 font-bold">Cashier</th>
                  <th className="px-5 py-4 font-bold">Opening Float</th>
                  <th className="px-5 py-4 font-bold">Total Sales</th>
                  <th className="px-5 py-4 font-bold">Cash Difference</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold text-right">{t('actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {shifts.map((shift) => {
                  const dateStr = shift.openedAt?.toDate 
                    ? shift.openedAt.toDate().toLocaleDateString() 
                    : 'Recent';
                  const diff = shift.cashDifference ?? 0;

                  return (
                    <tr key={shift.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-mono text-xs font-bold text-indigo-600">#{shift.id.slice(0, 8).toUpperCase()}</span>
                          <span className="text-xs text-slate-400 mt-0.5">{dateStr}</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold text-slate-800">
                        {shift.openedByName}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs font-semibold tabular-nums text-slate-700">
                        {currency}{(shift.openingCash || 0).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs font-black tabular-nums text-slate-900">
                        {currency}{(shift.totalSales || 0).toLocaleString()}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs font-bold tabular-nums">
                        {shift.status === 'open' ? (
                          <span className="text-slate-400 italic">In progress</span>
                        ) : diff === 0 ? (
                          <span className="text-emerald-600">Balanced</span>
                        ) : diff > 0 ? (
                          <span className="text-indigo-600">+{currency}{diff.toLocaleString()} (Over)</span>
                        ) : (
                          <span className="text-rose-600">{currency}{diff.toLocaleString()} (Short)</span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-xs font-bold ${
                          shift.status === 'open' 
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' 
                            : 'bg-slate-100 text-slate-600'
                        }`}>
                          {shift.status === 'open' ? 'Active' : 'Closed'}
                        </span>
                      </td>

                      <td className="px-5 py-4 text-right whitespace-nowrap">
                        {shift.status === 'closed' ? (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedShiftForZReport(shift);
                              setIsZReportOpen(true);
                            }}
                            className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs rounded-xl border border-indigo-200/60 transition-colors inline-flex items-center gap-1.5"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>Z-Report</span>
                          </button>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Ongoing</span>
                        )}
                      </td>
                    </tr>
                  );
                })}

                {shifts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                      No shift records found. Click &quot;Open Shift&quot; to begin.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Open Shift Modal */}
      <AnimatePresence>
        {isOpeningShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('open_shift')}</h3>
                  <p className="text-xs text-slate-500">Enter cash float amount in drawer</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpeningShift(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    {t('opening_cash')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      value={openingCashInput}
                      onChange={(e) => setOpeningCashInput(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  {[500, 1000, 2000].map(amt => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setOpeningCashInput(amt)}
                      className="flex-1 py-1.5 rounded-lg text-xs font-bold border border-slate-200 hover:bg-slate-50 text-slate-700"
                    >
                      {currency}{amt}
                    </button>
                  ))}
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpeningShift(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleOpenShift}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                    <span>Confirm Open</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Close Shift / Z-Report Reconciliation Modal */}
      <AnimatePresence>
        {isClosingShift && activeShift && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('close_shift')}</h3>
                  <p className="text-xs text-slate-500">Reconcile cash drawer & print daily summary</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClosingShift(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 sm:p-6 space-y-4">
                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>{t('opening_cash')}:</span>
                    <span className="font-bold tabular-nums">{currency}{activeShift.openingCash.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Cash Sales:</span>
                    <span className="font-bold text-emerald-600 tabular-nums">+{currency}{liveCashSales.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>QR & Card Sales:</span>
                    <span className="font-bold tabular-nums">{currency}{(liveQrSales + liveCardSales).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200 text-sm">
                    <span>{t('expected_cash')}:</span>
                    <span className="tabular-nums text-indigo-600">{currency}{expectedCashInDrawer.toLocaleString()}</span>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    {t('actual_cash')}
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                    <input
                      type="number"
                      min="0"
                      value={actualCashCounted || ''}
                      onChange={(e) => setActualCashCounted(Number(e.target.value))}
                      className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums"
                    />
                  </div>
                </div>

                {/* Over / Short Indicator */}
                <div className={`p-3 rounded-xl border flex items-center justify-between text-xs font-bold ${
                  cashDiff === 0 
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200' 
                    : cashDiff > 0 
                    ? 'bg-indigo-50 text-indigo-800 border-indigo-200' 
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}>
                  <span>{t('cash_diff')}:</span>
                  <span className="text-sm font-black tabular-nums">
                    {cashDiff === 0 ? 'Exact Match (฿0)' : cashDiff > 0 ? `+฿${cashDiff.toLocaleString()} (Over)` : `-฿${Math.abs(cashDiff).toLocaleString()} (Short)`}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Notes (Optional)
                  </label>
                  <input
                    type="text"
                    value={closingNotes}
                    onChange={(e) => setClosingNotes(e.target.value)}
                    placeholder="e.g. End of evening shift"
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsClosingShift(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleConfirmCloseShift}
                    className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                    <span>Confirm & Print Z-Report</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thermal Z-Report Modal */}
      <ZReportModal
        shift={selectedShiftForZReport}
        settings={settings}
        isOpen={isZReportOpen}
        onClose={() => setIsZReportOpen(false)}
      />
    </div>
  );
}
