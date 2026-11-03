import React, { useState, useEffect, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  limit, 
  doc, 
  writeBatch, 
  serverTimestamp, 
  increment,
  getDoc
} from 'firebase/firestore';
import { 
  FileDown, 
  Calendar, 
  User as UserIcon, 
  Receipt as ReceiptIcon,
  DollarSign,
  TrendingUp,
  ShoppingBag,
  Filter,
  RotateCcw,
  AlertTriangle,
  Award,
  Loader2,
  X,
  CheckCircle2,
  Package
} from 'lucide-react';
import { Sale, StoreSettings } from '../types';
import { exportToExcel } from '../lib/excel';
import { useLanguage } from '../lib/i18n';
import { ReceiptModal } from './ReceiptModal';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from '../lib/storeSettings';
import { logActivity } from '../lib/audit';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HistoryProps {
  role: 'admin' | 'staff' | null;
  isOwnerUnlocked?: boolean;
  onRequirePin?: () => void;
}

type DateRangeOption = 'today' | 'yesterday' | 'week' | 'month' | 'all';

export function History({ role, isOwnerUnlocked = true, onRequirePin }: HistoryProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRangeOption>('all');
  const [selectedSaleForReceipt, setSelectedSaleForReceipt] = useState<Sale | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  
  // Void / Refund Modal State
  const [saleToVoid, setSaleToVoid] = useState<Sale | null>(null);
  const [voidReason, setVoidReason] = useState('Customer returned item');
  const [isVoiding, setIsVoiding] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const { t } = useLanguage();
  const isAuthorized = role === 'admin' || isOwnerUnlocked;
  const currency = settings.currencySymbol || '฿';

  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(200));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Sale[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Sale));
      setSales(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sales');
    });

    return () => unsubscribe();
  }, []);

  // Filter sales by date range
  const filteredSales = sales.filter((sale) => {
    if (dateRange === 'all') return true;
    
    const saleDate = sale.createdAt?.toDate ? sale.createdAt.toDate() : new Date();
    const now = new Date();
    
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfYesterday = new Date(startOfToday);
    startOfYesterday.setDate(startOfYesterday.getDate() - 1);

    if (dateRange === 'today') {
      return saleDate >= startOfToday;
    }
    if (dateRange === 'yesterday') {
      return saleDate >= startOfYesterday && saleDate < startOfToday;
    }
    if (dateRange === 'week') {
      const startOfWeek = new Date(startOfToday);
      startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
      return saleDate >= startOfWeek;
    }
    if (dateRange === 'month') {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return saleDate >= startOfMonth;
    }
    return true;
  });

  // Active (non-voided) sales for accurate KPIs
  const activeSales = filteredSales.filter(s => s.status !== 'voided');

  // Calculate totals for period
  const totalRevenue = activeSales.reduce((acc, s) => acc + (s.total || 0), 0);
  const totalProfit = activeSales.reduce((acc, s) => {
    const cost = (s.items || []).reduce((cAcc, item) => cAcc + ((item.costPrice || 0) * item.quantity), 0);
    return acc + (s.total - cost);
  }, 0);
  const totalItemsSold = activeSales.reduce((acc, s) => {
    return acc + (s.items || []).reduce((itemCount, item) => itemCount + item.quantity, 0);
  }, 0);

  // Top Selling Items and Most Profitable Items
  const { topByQty, topByProfit } = useMemo(() => {
    const counts: Record<string, { name: string; quantity: number; revenue: number; profit: number }> = {};
    activeSales.forEach(s => {
      (s.items || []).forEach(item => {
        if (!counts[item.productId]) {
          counts[item.productId] = { name: item.name, quantity: 0, revenue: 0, profit: 0 };
        }
        counts[item.productId].quantity += item.quantity;
        counts[item.productId].revenue += item.price * item.quantity;
        counts[item.productId].profit += ((item.price - (item.costPrice || 0)) * item.quantity);
      });
    });
    const list = Object.values(counts);
    const byQty = [...list].sort((a, b) => b.quantity - a.quantity).slice(0, 5);
    const byProfit = [...list].sort((a, b) => b.profit - a.profit).slice(0, 5);
    return { topByQty: byQty, topByProfit: byProfit };
  }, [activeSales]);

  const maxSoldQty = topByQty.length > 0 ? topByQty[0].quantity : 1;
  const maxProfit = topByProfit.length > 0 ? Math.max(1, topByProfit[0].profit) : 1;

  const handleExport = () => {
    const exportData = filteredSales.map(s => {
      const formattedDate = s.createdAt?.toDate ? s.createdAt.toDate().toLocaleString() : '';
      return {
        'Receipt ID': s.id,
        Date: formattedDate,
        Status: s.status === 'voided' ? `VOIDED (${s.voidReason || 'Refunded'})` : 'COMPLETED',
        Subtotal: s.subtotal ?? s.total,
        [`Discount (${currency})`]: s.discountAmount || 0,
        [`Total (${currency})`]: s.total,
        'Payment Method': s.paymentMethod || 'cash',
        'Cash Received': s.cashReceived || s.total,
        'Change Due': s.changeDue || 0,
        Cashier: s.staffName || s.staffId,
        Items: (s.items || []).map(i => `${i.name} (x${i.quantity} @ ${currency}${i.price})`).join('; ')
      };
    });
    exportToExcel(exportData, `Sales_Report_${dateRange}_${new Date().toISOString().slice(0,10)}`);
  };

  const handleOpenReceipt = (sale: Sale) => {
    setSelectedSaleForReceipt(sale);
    setIsReceiptOpen(true);
  };

  // Void / Refund Transaction
  const handleConfirmVoid = async () => {
    if (!saleToVoid) return;
    setIsVoiding(true);

    try {
      const batch = writeBatch(db);
      const saleRef = doc(db, 'sales', saleToVoid.id);
      const now = serverTimestamp();

      // 1. Mark sale as voided
      batch.update(saleRef, {
        status: 'voided',
        voidReason: voidReason.trim() || 'Refunded by cashier',
        voidedAt: now,
        voidedBy: role || 'staff'
      });

      // 2. Return product stocks
      for (const item of saleToVoid.items || []) {
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          stock: increment(item.quantity),
          updatedAt: now
        });
      }

      // 3. Adjust customer points or credit if linked
      if (saleToVoid.customerId) {
        const custRef = doc(db, 'customers', saleToVoid.customerId);
        const custSnap = await getDoc(custRef);
        if (custSnap.exists()) {
          const custData = custSnap.data();
          const earned = saleToVoid.pointsEarned || 0;
          const redeemed = saleToVoid.pointsRedeemed || 0;
          const updatedPoints = Math.max(0, (custData.points || 0) - earned + redeemed);
          const creditRefund = saleToVoid.paymentMethod === 'credit' ? saleToVoid.total : 0;
          const updatedCredit = Math.max(0, (custData.creditBalance || 0) - creditRefund);

          batch.update(custRef, {
            points: updatedPoints,
            creditBalance: updatedCredit,
            updatedAt: now
          });
        }
      }

      await batch.commit();

      // Log Activity
      logActivity(
        'Void Sale',
        'sale',
        `Voided sale #${saleToVoid.id.slice(0, 8)} (${voidReason}). Total refund: ${currency}${saleToVoid.total.toLocaleString()}`,
        saleToVoid.id
      );

      setActionSuccessMessage(`Receipt #${saleToVoid.id.slice(0, 8)} voided and items restocked!`);
      setSaleToVoid(null);
      setTimeout(() => setActionSuccessMessage(null), 4000);
    } catch (err) {
      console.error('Error voiding sale:', err);
      handleFirestoreError(err, OperationType.UPDATE, `sales/${saleToVoid.id}`);
    } finally {
      setIsVoiding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('history')}</h2>
          <p className="text-slate-500 text-sm">{t('view_history') || 'View, filter, void sales and reprint receipts.'}</p>
        </div>
        <button
          onClick={handleExport}
          disabled={filteredSales.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl hover:bg-emerald-700 transition-colors shadow-md shadow-emerald-100 disabled:opacity-50 self-start sm:self-auto cursor-pointer"
        >
          <FileDown className="w-4 h-4" />
          <span>{t('export_csv')}</span>
        </button>
      </div>

      {/* Date Filter Bar & Summary Cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            Range:
          </span>
          {(['all', 'today', 'yesterday', 'week', 'month'] as DateRangeOption[]).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setDateRange(option)}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap cursor-pointer",
                dateRange === option
                  ? "bg-slate-900 text-white shadow-xs"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              )}
            >
              {option === 'all' && t('all_time')}
              {option === 'today' && t('today')}
              {option === 'yesterday' && t('yesterday')}
              {option === 'week' && t('this_week')}
              {option === 'month' && t('this_month')}
            </button>
          ))}
        </div>

        {/* Period Summary KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('total_revenue')}</p>
              <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{currency}{totalRevenue.toLocaleString()}</p>
              {filteredSales.length - activeSales.length > 0 && (
                <p className="text-[11px] text-rose-500 font-bold mt-0.5">
                  ({filteredSales.length - activeSales.length} voided orders excluded)
                </p>
              )}
            </div>
            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('est_profit')}</p>
              <p className={cn("text-2xl font-black mt-1 tabular-nums", isAuthorized ? "text-emerald-600" : "text-slate-400")}>
                {isAuthorized ? `${currency}${totalProfit.toLocaleString()}` : '••••••••'}
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                {isAuthorized 
                  ? (totalRevenue > 0 ? `${Math.round((totalProfit / totalRevenue) * 100)}% profit margin` : '0% margin')
                  : '🔒 Owner PIN required'}
              </p>
            </div>
            <div 
              className={cn("p-3 rounded-2xl cursor-pointer transition-all", isAuthorized ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-400 hover:bg-slate-200")}
              onClick={!isAuthorized ? onRequirePin : undefined}
            >
              {isAuthorized ? <TrendingUp className="w-6 h-6" /> : <TrendingUp className="w-6 h-6" />}
            </div>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('total_orders')}</p>
              <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">
                {activeSales.length} <span className="text-xs font-normal text-slate-400">({totalItemsSold} pcs)</span>
              </p>
              <p className="text-[11px] text-slate-400 font-medium mt-0.5">
                Active transactions
              </p>
            </div>
            <div className="p-3 bg-amber-50 text-amber-600 rounded-2xl">
              <ShoppingBag className="w-6 h-6" />
            </div>
          </div>
        </div>
      </div>

      {/* Top 5 Products Analytics Ranking Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top 5 by Volume */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-600" />
              <span>{t('top_selling')}</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">By volume sold</span>
          </div>

          <div className="space-y-3">
            {topByQty.map((item, idx) => {
              const pct = Math.round((item.quantity / maxSoldQty) * 100);
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-slate-800 truncate max-w-[200px] flex items-center gap-1.5">
                      <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                        {idx + 1}
                      </span>
                      {item.name}
                    </span>
                    <span className="text-indigo-600 font-bold tabular-nums">
                      {item.quantity} {t('units_sold')}
                    </span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                    <div 
                      className="bg-indigo-600 h-2 rounded-full transition-all duration-500" 
                      style={{ width: `${pct}%` }} 
                    />
                  </div>
                </div>
              );
            })}
            {topByQty.length === 0 && (
              <p className="text-xs text-slate-400 py-4 text-center">No sales data available yet.</p>
            )}
          </div>
        </div>

        {/* Top 5 by Profit */}
        <div className={cn(
          "bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4 relative overflow-hidden",
          !isAuthorized && "min-h-[200px]"
        )}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Award className="w-4 h-4 text-emerald-600" />
              <span>{t('top_profit')}</span>
            </h3>
            <span className="text-xs text-slate-400 font-medium">By net profit earned</span>
          </div>

          {!isAuthorized ? (
            <div className="absolute inset-0 bg-white/60 backdrop-blur-[2px] flex flex-col items-center justify-center p-6 text-center">
              <div className="p-2.5 bg-slate-100 rounded-xl mb-2 text-slate-400">
                <TrendingUp className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-slate-600 mb-2">အမြတ်စာရင်း ကြည့်ရန် PIN ရိုက်ပါ</p>
              <button
                onClick={onRequirePin}
                className="px-4 py-1.5 bg-indigo-600 text-white text-[10px] font-black rounded-lg shadow-sm hover:bg-indigo-700 transition-all uppercase tracking-wider"
              >
                Unlock Profits
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {topByProfit.map((item, idx) => {
                const pct = Math.round((item.profit / maxProfit) * 100);
                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-800 truncate max-w-[200px] flex items-center gap-1.5">
                        <span className="w-4 h-4 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                          {idx + 1}
                        </span>
                        {item.name}
                      </span>
                      <span className="text-emerald-600 font-bold tabular-nums">
                        +{currency}{item.profit.toLocaleString()} {t('profit_earned')}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500" 
                        style={{ width: `${pct}%` }} 
                      />
                    </div>
                  </div>
                );
              })}
              {topByProfit.length === 0 && (
                <p className="text-xs text-slate-400 py-4 text-center">No sales data available yet.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Transactions Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-4 font-bold">{t('voucher_no')} / {t('date_time')}</th>
                <th className="px-5 py-4 font-bold">{t('items')}</th>
                <th className="px-5 py-4 font-bold">{t('payment_method')}</th>
                <th className="px-5 py-4 font-bold">{t('total')}</th>
                <th className="px-5 py-4 font-bold">{t('cashier')}</th>
                <th className="px-5 py-4 font-bold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSales.map((sale) => {
                const formattedDate = sale.createdAt?.toDate 
                  ? sale.createdAt.toDate().toLocaleString() 
                  : 'Recent';
                const isVoided = sale.status === 'voided';

                return (
                  <tr key={sale.id} className={cn("transition-colors group", isVoided ? "bg-rose-50/40 hover:bg-rose-50/60" : "hover:bg-slate-50/60")}>
                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className={cn("text-xs font-mono font-bold", isVoided ? "line-through text-slate-400" : "text-indigo-600")}>
                            #{sale.id.slice(0, 10).toUpperCase()}
                          </span>
                          {isVoided && (
                            <span className="px-2 py-0.5 rounded-md bg-rose-100 text-rose-700 text-[10px] font-black uppercase tracking-wider">
                              {t('voided')}
                            </span>
                          )}
                        </div>
                        <span className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formattedDate}
                        </span>
                        {isVoided && sale.voidReason && (
                          <span className="text-[10px] text-rose-600 italic mt-0.5">
                            Reason: {sale.voidReason}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4">
                      <div className="flex flex-col gap-1 max-w-[260px]">
                        {sale.items.slice(0, 2).map((item, i) => (
                          <div key={i} className="text-xs text-slate-700 flex justify-between gap-3">
                            <span className="font-semibold truncate">{item.name}</span>
                            <span className="text-slate-400 font-medium whitespace-nowrap">x{item.quantity}</span>
                          </div>
                        ))}
                        {sale.items.length > 2 && (
                          <span className="text-[11px] text-indigo-600 font-bold">+{sale.items.length - 2} more items</span>
                        )}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-bold uppercase bg-slate-100 text-slate-700">
                        {sale.paymentMethod || 'cash'}
                      </span>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className={cn("text-base font-black tabular-nums", isVoided ? "line-through text-slate-400" : "text-slate-900")}>
                          {currency}{sale.total.toLocaleString()}
                        </span>
                        {sale.discountAmount && sale.discountAmount > 0 ? (
                          <span className="text-[10px] text-rose-500 font-bold">-{currency}{sale.discountAmount} disc</span>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-5 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <UserIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate max-w-[120px]">{sale.staffName || sale.staffId.slice(0, 8)}</span>
                      </div>
                    </td>

                    <td className="px-5 py-4 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleOpenReceipt(sale)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-bold rounded-xl transition-all active:scale-95 border border-indigo-200/60 cursor-pointer"
                          title={t('reprint')}
                        >
                          <ReceiptIcon className="w-3.5 h-3.5" />
                          <span>{t('reprint')}</span>
                        </button>

                        {!isVoided && (
                          <button
                            type="button"
                            onClick={() => {
                              setSaleToVoid(sale);
                              setVoidReason('Customer returned item');
                            }}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl transition-all active:scale-95 border border-rose-200/60 cursor-pointer"
                            title={t('void_refund')}
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>{t('void_refund')}</span>
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}

              {filteredSales.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-400 text-sm">
                    No transactions recorded for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Void / Refund Confirmation Modal */}
      <AnimatePresence>
        {saleToVoid && (
          <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-rose-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                    <RotateCcw className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{t('void_refund')}</h3>
                    <p className="text-xs text-rose-700 font-mono">#{saleToVoid.id.slice(0, 10).toUpperCase()}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSaleToVoid(null)}
                  className="p-2 hover:bg-rose-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed">
                  {t('void_sale_confirm')}
                </p>

                {/* Items to Restock Preview */}
                <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200 space-y-2 text-xs">
                  <span className="font-bold text-slate-700 block text-[11px] uppercase tracking-wider">
                    Items returning to stock:
                  </span>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {saleToVoid.items.map((it, idx) => (
                      <div key={idx} className="flex justify-between text-slate-800">
                        <span className="truncate pr-2 font-medium">{it.name}</span>
                        <span className="font-bold text-emerald-600 whitespace-nowrap">+{it.quantity} stock</span>
                      </div>
                    ))}
                  </div>
                  <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                    <span>Refund Amount:</span>
                    <span className="text-rose-600">{currency}{saleToVoid.total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Void Reason */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1.5">
                    {t('void_reason')}
                  </label>
                  <select
                    value={voidReason}
                    onChange={(e) => setVoidReason(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 mb-2"
                  >
                    <option value="Customer returned item">Customer returned item</option>
                    <option value="Cashier entry mistake">Cashier entry mistake</option>
                    <option value="Customer canceled purchase">Customer canceled purchase</option>
                    <option value="Defective / damaged product">Defective / damaged product</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex gap-2">
                <button
                  type="button"
                  onClick={() => setSaleToVoid(null)}
                  className="flex-1 py-2.5 px-4 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={isVoiding}
                  onClick={handleConfirmVoid}
                  className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isVoiding ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>{t('void_refund')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Notification */}
      <AnimatePresence>
        {actionSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-[250] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold">{actionSuccessMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt Modal for View / Reprint */}
      <ReceiptModal
        sale={selectedSaleForReceipt}
        settings={settings}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}


