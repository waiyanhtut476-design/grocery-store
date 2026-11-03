import React, { useState, useMemo } from 'react';
import { Sale, StoreSettings, Product, Expense } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  FileSpreadsheet, 
  Printer, 
  TrendingUp, 
  DollarSign, 
  ShoppingBag, 
  Calendar,
  Layers,
  ChevronDown,
  ArrowDownCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';

interface MonthlyReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  sales: Sale[];
  products: Product[];
  settings: StoreSettings;
}

export function MonthlyReportModal({
  isOpen,
  onClose,
  sales,
  products,
  settings
}: MonthlyReportModalProps) {
  const currency = settings.currencySymbol || '฿';
  const dualCurrency = settings.dualCurrencyEnabled;
  const rate = settings.exchangeRateMMK || 125;
  const secSymbol = settings.secondaryCurrencySymbol || 'Ks';

  // Available months derived from sales
  const months = useMemo(() => {
    const set = new Set<string>();
    sales.forEach(s => {
      const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
      if (!isNaN(date.getTime())) {
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        set.add(key);
      }
    });
    const arr = Array.from(set).sort().reverse();
    if (arr.length === 0) {
      const now = new Date();
      arr.push(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`);
    }
    return arr;
  }, [sales]);

  const [selectedMonth, setSelectedMonth] = useState<string>(months[0] || '');
  const [monthExpenses, setMonthExpenses] = useState<Expense[]>([]);

  // Fetch expenses for selected month
  React.useEffect(() => {
    async function fetchExpenses() {
      if (!selectedMonth) return;
      const startStr = `${selectedMonth}-01`;
      const endStr = `${selectedMonth}-31`;
      
      const q = query(
        collection(db, 'expenses'), 
        where('date', '>=', startStr),
        where('date', '<=', endStr)
      );
      const snap = await getDocs(q);
      const list: Expense[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Expense));
      setMonthExpenses(list);
    }
    fetchExpenses();
  }, [selectedMonth]);

  // Filter sales for selected month
  const monthSales = useMemo(() => {
    if (!selectedMonth) return sales;
    return sales.filter(s => {
      if (s.status === 'voided') return false;
      const date = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
      if (isNaN(date.getTime())) return false;
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      return key === selectedMonth;
    });
  }, [sales, selectedMonth]);

  // Financial calculations
  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalCost = 0;
    let totalDiscount = 0;
    let totalOrders = monthSales.length;

    const categoryMap: Record<string, { revenue: number; cost: number; qty: number }> = {};
    const productMap: Record<string, { name: string; qty: number; revenue: number; profit: number }> = {};
    const dailyMap: Record<string, { date: string; orders: number; revenue: number; cost: number }> = {};

    monthSales.forEach(s => {
      totalRevenue += s.total || 0;
      totalDiscount += s.discountAmount || 0;

      const dateObj = s.createdAt?.toDate ? s.createdAt.toDate() : new Date(s.createdAt || Date.now());
      const dayKey = dateObj.toISOString().slice(0, 10);

      if (!dailyMap[dayKey]) {
        dailyMap[dayKey] = { date: dayKey, orders: 0, revenue: 0, cost: 0 };
      }
      dailyMap[dayKey].orders += 1;
      dailyMap[dayKey].revenue += s.total || 0;

      if (Array.isArray(s.items)) {
        s.items.forEach(item => {
          const itemCost = (item.costPrice || 0) * item.quantity;
          const itemRev = item.price * item.quantity;
          totalCost += itemCost;
          dailyMap[dayKey].cost += itemCost;

          // Product level
          if (!productMap[item.productId]) {
            productMap[item.productId] = { name: item.name, qty: 0, revenue: 0, profit: 0 };
          }
          productMap[item.productId].qty += item.quantity;
          productMap[item.productId].revenue += itemRev;
          productMap[item.productId].profit += (itemRev - itemCost);

          // Category level
          const prodObj = products.find(p => p.id === item.productId);
          const cat = prodObj?.category?.trim() || 'Uncategorized';
          if (!categoryMap[cat]) {
            categoryMap[cat] = { revenue: 0, cost: 0, qty: 0 };
          }
          categoryMap[cat].revenue += itemRev;
          categoryMap[cat].cost += itemCost;
          categoryMap[cat].qty += item.quantity;
        });
      }
    });

    const grossProfit = totalRevenue - totalCost;
    const totalOperatingExpenses = monthExpenses.reduce((acc, e) => acc + e.amount, 0);
    const netProfit = grossProfit - totalOperatingExpenses;
    
    const marginPercent = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMarginPercent = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
    const avgOrder = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;

    return {
      totalRevenue,
      totalCost,
      grossProfit,
      totalOperatingExpenses,
      netProfit,
      marginPercent,
      netMarginPercent,
      totalDiscount,
      totalOrders,
      avgOrder,
      categoryList: Object.entries(categoryMap).map(([name, data]) => ({
        name,
        revenue: data.revenue,
        profit: data.revenue - data.cost,
        qty: data.qty,
        margin: data.revenue > 0 ? ((data.revenue - data.cost) / data.revenue) * 100 : 0
      })).sort((a, b) => b.revenue - a.revenue),
      productList: Object.values(productMap).sort((a, b) => b.revenue - a.revenue).slice(0, 15),
      dailyList: Object.values(dailyMap).sort((a, b) => a.date.localeCompare(b.date))
    };
  }, [monthSales, products, monthExpenses]);

  // Export Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Financial Summary
      const summaryData = [
        ['GROCERY FLOW MART - MONTHLY FINANCIAL P&L REPORT'],
        ['Store Name', settings.storeName || 'Grocery Flow Mart'],
        ['Report Month', selectedMonth],
        ['Generated At', new Date().toLocaleString()],
        [],
        ['Metric', `Amount (${currency})`, dualCurrency ? `Equivalent (${secSymbol})` : ''],
        ['Total Gross Revenue', stats.totalRevenue, dualCurrency ? Math.round(stats.totalRevenue * rate) : ''],
        ['Cost of Goods Sold (COGS)', stats.totalCost, dualCurrency ? Math.round(stats.totalCost * rate) : ''],
        ['Gross Profit', stats.grossProfit, dualCurrency ? Math.round(stats.grossProfit * rate) : ''],
        ['Operating Expenses', stats.totalOperatingExpenses, dualCurrency ? Math.round(stats.totalOperatingExpenses * rate) : ''],
        ['NET PROFIT', stats.netProfit, dualCurrency ? Math.round(stats.netProfit * rate) : ''],
        ['Net Profit Margin %', `${stats.netMarginPercent.toFixed(1)}%`, ''],
        ['Total Discounts Given', stats.totalDiscount, dualCurrency ? Math.round(stats.totalDiscount * rate) : ''],
        ['Total Orders Completed', stats.totalOrders, ''],
        ['Average Order Value', stats.avgOrder, dualCurrency ? Math.round(stats.avgOrder * rate) : '']
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, 'P&L Summary');

      // Sheet 2: Daily Sales Breakdown
      const dailyRows = [
        ['Date', 'Orders', `Revenue (${currency})`, `COGS (${currency})`, `Gross Profit (${currency})`, 'Margin %']
      ];
      stats.dailyList.forEach(d => {
        const profit = d.revenue - d.cost;
        const margin = d.revenue > 0 ? ((profit / d.revenue) * 100).toFixed(1) + '%' : '0%';
        dailyRows.push([d.date, d.orders as any, d.revenue as any, d.cost as any, profit as any, margin]);
      });
      const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
      XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Sales');

      // Sheet 3: Category Performance
      const catRows = [
        ['Category', 'Units Sold', `Revenue (${currency})`, `Profit (${currency})`, 'Margin %']
      ];
      stats.categoryList.forEach(c => {
        catRows.push([c.name, c.qty as any, c.revenue as any, c.profit as any, `${c.margin.toFixed(1)}%`]);
      });
      const wsCat = XLSX.utils.aoa_to_sheet(catRows);
      XLSX.utils.book_append_sheet(wb, wsCat, 'Category Breakdown');

      // Sheet 4: Top Products
      const prodRows = [
        ['Product Name', 'Quantity Sold', `Total Revenue (${currency})`, `Estimated Profit (${currency})`]
      ];
      stats.productList.forEach(p => {
        prodRows.push([p.name, p.qty as any, p.revenue as any, p.profit as any]);
      });
      const wsProd = XLSX.utils.aoa_to_sheet(prodRows);
      XLSX.utils.book_append_sheet(wb, wsProd, 'Top Selling Products');

      // Trigger download
      XLSX.writeFile(wb, `Grocery_Flow_P&L_Report_${selectedMonth}.xlsx`);
    } catch (err) {
      console.error('Error generating Excel report:', err);
      alert('Could not generate Excel report.');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm print:p-0 print:bg-white">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-4xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[92vh] print:max-h-none print:shadow-none print:border-none print:rounded-none"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 print:hidden">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                <FileSpreadsheet className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  လစဉ် အရှုံး/အမြတ် အစီရင်ခံစာ (Monthly P&L Report)
                </h3>
                <p className="text-xs text-slate-500">
                  {settings.storeName || 'Grocery Flow Mart'} &bull; Financial Overview & Excel Export
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500 shadow-xs cursor-pointer"
              >
                {months.map(m => (
                  <option key={m} value={m}>
                    📅 {m}
                  </option>
                ))}
              </select>

              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Printable Report Content */}
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Print Header (Only visible on print) */}
            <div className="hidden print:block text-center border-b pb-4 mb-4">
              <h1 className="text-2xl font-bold">{settings.storeName || 'Grocery Flow Mart'}</h1>
              <p className="text-sm text-slate-600">Monthly Profit & Loss Statement - {selectedMonth}</p>
              <p className="text-xs text-slate-400">Generated: {new Date().toLocaleString()}</p>
            </div>

            {/* Key Financial Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
              <div className="p-4 bg-emerald-50/80 rounded-2xl border border-emerald-100">
                <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block mb-1">
                  Gross Revenue (ဝင်ငွေ)
                </span>
                <p className="text-xl font-black text-emerald-700">
                  {currency}{stats.totalRevenue.toLocaleString()}
                </p>
                {dualCurrency && (
                  <p className="text-[10px] text-emerald-800/80 font-bold mt-0.5">
                    ≈ {Math.round(stats.totalRevenue * rate).toLocaleString()} {secSymbol}
                  </p>
                )}
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block mb-1">
                  COGS (ဝယ်ရင်းစရိတ်)
                </span>
                <p className="text-xl font-black text-slate-800">
                  {currency}{stats.totalCost.toLocaleString()}
                </p>
                {dualCurrency && (
                  <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                    ≈ {Math.round(stats.totalCost * rate).toLocaleString()} {secSymbol}
                  </p>
                )}
              </div>

              <div className="p-4 bg-indigo-50/80 rounded-2xl border border-indigo-100">
                <span className="text-[11px] font-bold text-indigo-800 uppercase tracking-wider block mb-1">
                  Gross Profit (အမြတ်ကြမ်း)
                </span>
                <p className="text-xl font-black text-indigo-700">
                  {currency}{stats.grossProfit.toLocaleString()}
                </p>
                {dualCurrency && (
                  <p className="text-[10px] text-indigo-800/80 font-bold mt-0.5">
                    ≈ {Math.round(stats.grossProfit * rate).toLocaleString()} {secSymbol}
                  </p>
                )}
              </div>

              <div className="p-4 bg-rose-50/80 rounded-2xl border border-rose-100">
                <span className="text-[11px] font-bold text-rose-800 uppercase tracking-wider block mb-1">
                  Expenses (အသုံးစရိတ်)
                </span>
                <p className="text-xl font-black text-rose-700">
                  {currency}{stats.totalOperatingExpenses.toLocaleString()}
                </p>
                <p className="text-[10px] text-rose-800/80 font-bold mt-0.5">
                  {monthExpenses.length} records recorded
                </p>
              </div>

              <div className="p-4 bg-emerald-600 rounded-2xl border border-emerald-500 shadow-lg shadow-emerald-100 col-span-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-emerald-50 uppercase tracking-wider block mb-1">
                    NET PROFIT (အသားတင် အမြတ်ငွေ)
                  </span>
                  <div className="p-1 bg-white/20 rounded-lg">
                    <TrendingUp className="w-4 h-4 text-white" />
                  </div>
                </div>
                <p className="text-2xl font-black text-white">
                  {currency}{stats.netProfit.toLocaleString()}
                </p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[10px] text-emerald-100 font-bold">
                    Net Margin: {stats.netMarginPercent.toFixed(1)}%
                  </p>
                  {dualCurrency && (
                    <p className="text-[10px] text-emerald-50 font-black">
                      ≈ {Math.round(stats.netProfit * rate).toLocaleString()} {secSymbol}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Category Performance Breakdown */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-indigo-600" />
                အမျိုးအစားအလိုက် အရောင်းနှင့် အမြတ် (Category Breakdown)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold">Category</th>
                      <th className="p-3 font-bold text-center">Items Sold</th>
                      <th className="p-3 font-bold text-right">Revenue</th>
                      <th className="p-3 font-bold text-right">Gross Profit</th>
                      <th className="p-3 font-bold text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.categoryList.map(c => (
                      <tr key={c.name} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">🏷️ {c.name}</td>
                        <td className="p-3 text-center text-slate-600 font-mono">{c.qty}</td>
                        <td className="p-3 text-right font-black text-slate-900">{currency}{c.revenue.toLocaleString()}</td>
                        <td className="p-3 text-right font-black text-emerald-600">{currency}{c.profit.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-slate-700">{c.margin.toFixed(1)}%</td>
                      </tr>
                    ))}
                    {stats.categoryList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-slate-400">No category transactions this month.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Top 10 Best Selling Items */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2.5 flex items-center gap-1.5">
                <ShoppingBag className="w-4 h-4 text-amber-600" />
                အရောင်းရဆုံး ပစ္စည်းများ (Top Selling Products)
              </h4>
              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="p-3 font-bold">Product</th>
                      <th className="p-3 font-bold text-center">Qty Sold</th>
                      <th className="p-3 font-bold text-right">Total Revenue</th>
                      <th className="p-3 font-bold text-right">Profit Contribution</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {stats.productList.slice(0, 8).map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50">
                        <td className="p-3 font-bold text-slate-800">{idx + 1}. {p.name}</td>
                        <td className="p-3 text-center text-slate-600 font-mono">{p.qty}</td>
                        <td className="p-3 text-right font-bold text-slate-900">{currency}{p.revenue.toLocaleString()}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{currency}{p.profit.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Action Footer */}
          <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
            <span className="text-xs text-slate-500">
              Selected: <strong className="text-slate-800">{selectedMonth}</strong> ({stats.totalOrders} total sales transactions)
            </span>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <button
                type="button"
                onClick={handlePrint}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-4 py-2.5 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                <span>Print / PDF</span>
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-100 transition-all active:scale-95 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Download Excel (.xlsx)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
