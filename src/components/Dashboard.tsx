import React, { useEffect, useState, useMemo } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  limit, 
  orderBy, 
  Timestamp, 
  onSnapshot, 
  doc, 
  updateDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { 
  TrendingUp, 
  Package, 
  AlertCircle, 
  ShoppingCart, 
  Loader2, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  ArrowRight, 
  Bell, 
  Image as ImageIcon 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Product, Sale } from '../types';
import { useLanguage } from '../lib/i18n';

export interface LowStockAlert {
  product: Product;
  stock: number;
  minStock: number;
  deficit: number;
  urgency: 'out_of_stock' | 'critical' | 'low';
}

/**
 * Calculates items that drop below or reach their minimum stock levels.
 * Default minimum stock is 5 if unspecified on the product.
 */
export function calculateLowStockItems(products: Product[]): LowStockAlert[] {
  return products
    .filter((p) => {
      const minThreshold = p.minStock !== undefined && p.minStock !== null ? Number(p.minStock) : 5;
      return Number(p.stock) <= minThreshold;
    })
    .map((p) => {
      const minThreshold = p.minStock !== undefined && p.minStock !== null ? Number(p.minStock) : 5;
      const currentStock = Number(p.stock);
      const deficit = Math.max(0, minThreshold - currentStock);

      let urgency: 'out_of_stock' | 'critical' | 'low' = 'low';
      if (currentStock <= 0) {
        urgency = 'out_of_stock';
      } else if (currentStock <= Math.floor(minThreshold / 2)) {
        urgency = 'critical';
      }

      return {
        product: p,
        stock: currentStock,
        minStock: minThreshold,
        deficit,
        urgency
      };
    })
    .sort((a, b) => {
      const rank = { out_of_stock: 0, critical: 1, low: 2 };
      if (rank[a.urgency] !== rank[b.urgency]) {
        return rank[a.urgency] - rank[b.urgency];
      }
      return a.stock - b.stock;
    });
}

interface DashboardProps {
  onNavigate?: (tab: string) => void;
}

export function Dashboard({ onNavigate }: DashboardProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [todaySalesTotal, setTodaySalesTotal] = useState(0);
  const [todayProfitTotal, setTodayProfitTotal] = useState(0);
  const [todayTransactionsCount, setTodayTransactionsCount] = useState(0);
  const [todayTopItems, setTodayTopItems] = useState<{ name: string; quantity: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [restockingId, setRestockingId] = useState<string | null>(null);
  const [restockSuccessItem, setRestockSuccessItem] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useLanguage();

  // Real-time listener for products to keep stock alerts accurate
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const prods: Product[] = [];
        snapshot.forEach((d) => prods.push({ id: d.id, ...d.data() } as Product));
        setProducts(prods);
        setLoading(false);
      },
      (err) => {
        console.error('Products listener error:', err);
        handleFirestoreError(err, OperationType.LIST, 'products');
        setError('Unable to load products. Please check permissions.');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Fetch today's sales and recent sales
  useEffect(() => {
    async function fetchSales() {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        const salesQuery = query(collection(db, 'sales'), where('createdAt', '>=', todayTimestamp));
        const salesSnap = await getDocs(salesQuery);

        let total = 0;
        let profit = 0;
        let validTransactions = 0;
        const itemMap: Record<string, { name: string; quantity: number }> = {};

        salesSnap.forEach((docSnap) => {
          const data = docSnap.data() as Sale;
          if (data.status === 'voided') return; // ignore voided
          validTransactions++;
          total += data.total;
          data.items?.forEach((item) => {
            profit += (item.price - (item.costPrice || 0)) * item.quantity;
            if (!itemMap[item.productId]) {
              itemMap[item.productId] = { name: item.name, quantity: 0 };
            }
            itemMap[item.productId].quantity += item.quantity;
          });
        });

        setTodaySalesTotal(total);
        setTodayProfitTotal(profit);
        setTodayTransactionsCount(validTransactions);

        const sortedTop = Object.values(itemMap)
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 5);
        setTodayTopItems(sortedTop);

        // Recent sales
        const recentQuery = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(5));
        const recentSnap = await getDocs(recentQuery);
        const recent: Sale[] = [];
        recentSnap.forEach((d) => recent.push({ id: d.id, ...d.data() } as Sale));
        setRecentSales(recent);
      } catch (err) {
        console.error('Dashboard sales error:', err);
      }
    }

    fetchSales();
  }, []);

  // Calculate low stock alerts using the dedicated calculation function
  const lowStockAlerts = useMemo(() => calculateLowStockItems(products), [products]);

  // Quick Restock handler right from the Dashboard
  const handleQuickRestock = async (product: Product, addAmount: number) => {
    try {
      setRestockingId(product.id);
      const productRef = doc(db, 'products', product.id);
      const newStock = Math.max(0, Number(product.stock) + addAmount);
      await updateDoc(productRef, {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
      setRestockSuccessItem(product.name);
      setTimeout(() => setRestockSuccessItem(null), 3000);
    } catch (err) {
      console.error('Quick restock error:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products/' + product.id);
    } finally {
      setRestockingId(null);
    }
  };

  const statCards = [
    {
      label: t('today_sales'),
      value: `฿${todaySalesTotal.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50'
    },
    {
      label: t('profit'),
      value: `฿${todayProfitTotal.toLocaleString()}`,
      icon: TrendingUp,
      color: 'text-blue-600',
      bg: 'bg-blue-50'
    },
    {
      label: t('inventory'),
      value: products.length,
      icon: Package,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50'
    },
    {
      label: t('low_stock'),
      value: lowStockAlerts.length,
      icon: AlertCircle,
      color: lowStockAlerts.length > 0 ? 'text-rose-600' : 'text-slate-600',
      bg: lowStockAlerts.length > 0 ? 'bg-rose-50' : 'bg-slate-50',
      badge: lowStockAlerts.length > 0 ? `${lowStockAlerts.length} ${t('critical_stock')}` : undefined
    }
  ];

  if (loading) {
    return (
      <div className="animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200" />
          ))}
        </div>
        <div className="h-64 bg-white rounded-2xl border border-slate-200" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-lg font-bold text-slate-900">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('dashboard')}</h2>
          <p className="text-slate-500">{t('welcome_back') || 'Welcome back to Grocery Flow.'}</p>
        </div>
        {lowStockAlerts.length > 0 && (
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold animate-pulse">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
            {lowStockAlerts.length} {t('low_stock_alert_title')}
          </div>
        )}
      </div>

      {/* Prominent Manager Notification Alert Banner */}
      <AnimatePresence>
        {lowStockAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-5 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-rose-500/5 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="flex items-start gap-3.5">
              <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 shadow-md shadow-rose-200">
                <Bell className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-rose-600 text-white text-[11px] font-black uppercase tracking-wider">
                    MANAGER ALERT
                  </span>
                  <h4 className="font-bold text-slate-900 text-base">
                    {t('low_stock_alert_title')}
                  </h4>
                </div>
                <p className="text-xs text-slate-600 mt-1">
                  {lowStockAlerts.length} {t('items_need_restock')}.{' '}
                  {lowStockAlerts.filter((a) => a.urgency === 'out_of_stock').length > 0 && (
                    <span className="font-bold text-rose-700">
                      ({lowStockAlerts.filter((a) => a.urgency === 'out_of_stock').length} {t('out_of_stock')}!)
                    </span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
              {onNavigate && (
                <button
                  onClick={() => onNavigate('inventory')}
                  className="flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-rose-100"
                >
                  <span>{t('view_all_inventory')}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Restock success toast indicator */}
      {restockSuccessItem && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0 }}
          className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-bold flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>
            {restockSuccessItem} - {t('restock_success')}!
          </span>
        </motion.div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
              {stat.badge && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-rose-100 text-rose-700 border border-rose-200">
                  {stat.badge}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 tabular-nums">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      {/* Manager Low Stock Alert List & Quick Restock */}
      {lowStockAlerts.length > 0 ? (
        <div className="bg-white rounded-2xl border-2 border-rose-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-rose-100 bg-rose-50/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-rose-100 text-rose-700 rounded-xl">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-base">{t('items_need_restock')}</h3>
                <p className="text-xs text-slate-500">
                  Items that have reached or fallen below minimum threshold.
                </p>
              </div>
            </div>
            {onNavigate && (
              <button
                onClick={() => onNavigate('inventory')}
                className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 self-start sm:self-auto"
              >
                <span>{t('view_all_inventory')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="divide-y divide-slate-100 overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[650px]">
              <thead>
                <tr className="bg-slate-50/70 text-slate-500 text-[11px] font-bold uppercase tracking-wider">
                  <th className="px-5 py-3">Product</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Stock / Min</th>
                  <th className="px-5 py-3">Shortage</th>
                  <th className="px-5 py-3 text-right">Quick Restock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {lowStockAlerts.map((alert) => {
                  const p = alert.product;
                  const isRestocking = restockingId === p.id;

                  return (
                    <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                      {/* Product image and name */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {p.imageUrl ? (
                              <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                            ) : (
                              <ImageIcon className="w-4 h-4 text-slate-400" />
                            )}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                            <p className="font-mono text-[11px] text-slate-400">{p.barcode}</p>
                          </div>
                        </div>
                      </td>

                      {/* Status / Urgency */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        {alert.urgency === 'out_of_stock' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-black bg-rose-100 text-rose-800 border border-rose-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                            {t('out_of_stock')}
                          </span>
                        ) : alert.urgency === 'critical' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600"></span>
                            {t('critical_stock')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            {t('low_stock')}
                          </span>
                        )}
                      </td>

                      {/* Stock vs Min */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="px-2 py-0.5 rounded font-black text-sm tabular-nums bg-rose-50 text-rose-700 border border-rose-200">
                            {alert.stock}
                          </span>
                          <span className="text-slate-400 text-xs">/</span>
                          <span className="text-slate-600 text-xs font-medium">
                            Min: {alert.minStock} {p.unit || 'pcs'}
                          </span>
                        </div>
                      </td>

                      {/* Deficit / Shortage */}
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className="text-xs font-bold text-rose-600 tabular-nums">
                          -{alert.deficit} {p.unit || 'pcs'}
                        </span>
                      </td>

                      {/* Quick Restock Action Buttons */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          {isRestocking ? (
                            <Loader2 className="w-4 h-4 animate-spin text-indigo-600 mx-2" />
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => handleQuickRestock(p, 5)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                                title="Add 5 units"
                              >
                                +5
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickRestock(p, 10)}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 border border-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all"
                                title="Add 10 units"
                              >
                                +10
                              </button>
                              <button
                                type="button"
                                onClick={() => handleQuickRestock(p, 25)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-bold transition-all"
                                title="Add 25 units"
                              >
                                +25
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-5 bg-emerald-50/60 border border-emerald-200/80 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-100 text-emerald-700">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">{t('all_stock_healthy')}</p>
              <p className="text-xs text-slate-500">
                All inventory items are currently above their minimum threshold.
              </p>
            </div>
          </div>
          {onNavigate && (
            <button
              onClick={() => onNavigate('inventory')}
              className="text-xs font-bold text-emerald-700 hover:underline flex items-center gap-1"
            >
              <span>{t('inventory')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}

      {/* Main Grid: Recent Transactions & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">{t('recent_transactions') || 'Recent Transactions'}</h3>
            {onNavigate && (
              <button
                onClick={() => onNavigate('history')}
                className="text-sm text-indigo-600 font-medium hover:underline"
              >
                {t('view_all') || 'View All'}
              </button>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">ID</th>
                  <th className="px-6 py-3 font-semibold">{t('total')}</th>
                  <th className="px-6 py-3 font-semibold">{t('items')}</th>
                  <th className="px-6 py-3 font-semibold">{t('time') || 'Time'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">#{sale.id.slice(0, 6)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 tabular-nums">
                      ฿{sale.total.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">
                      {sale.items.length} {t('items')}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {sale.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                      {t('no_transactions_today') || 'No transactions today'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          {/* Top Selling Today */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Package className="w-4 h-4 text-indigo-600" />
                <span>{t('top_selling')}</span>
              </h3>
              <span className="text-[11px] text-slate-400 font-bold">{t('today')}</span>
            </div>

            <div className="space-y-2.5">
              {todayTopItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700 truncate max-w-[170px] flex items-center gap-1.5">
                    <span className="w-4 h-4 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center text-[10px] font-bold">
                      {idx + 1}
                    </span>
                    {item.name}
                  </span>
                  <span className="font-bold text-indigo-600 tabular-nums">
                    {item.quantity} {t('items')}
                  </span>
                </div>
              ))}
              {todayTopItems.length === 0 && (
                <p className="text-xs text-slate-400 py-2 text-center">No sales completed yet today.</p>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="font-bold text-slate-900 mb-4">{t('quick_actions') || 'Quick Actions'}</h3>
            <div className="space-y-3">
              <button
                onClick={() => onNavigate && onNavigate('pos')}
                className="w-full p-3.5 text-left rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group cursor-pointer"
              >
                <p className="font-semibold text-slate-900 group-hover:text-indigo-700">{t('pos')}</p>
                <p className="text-xs text-slate-500">{t('process_sale') || 'Process a customer purchase'}</p>
              </button>
              <button
                onClick={() => onNavigate && onNavigate('inventory')}
                className="w-full p-3.5 text-left rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group cursor-pointer"
              >
                <p className="font-semibold text-slate-900 group-hover:text-indigo-700">{t('inventory')}</p>
                <p className="text-xs text-slate-500">{t('manage_inventory') || 'Manage stock & add products'}</p>
              </button>
              <button
                onClick={() => onNavigate && onNavigate('history')}
                className="w-full p-3.5 text-left rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group cursor-pointer"
              >
                <p className="font-semibold text-slate-900 group-hover:text-indigo-700">{t('history')}</p>
                <p className="text-xs text-slate-500">{t('view_history') || 'View transaction records'}</p>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
