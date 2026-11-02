import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { TrendingUp, Package, AlertCircle, ShoppingCart, Loader2, AlertTriangle } from 'lucide-react';
import { motion } from 'motion/react';
import { Product, Sale } from '../types';

export function Dashboard() {
  const [stats, setStats] = useState({
    todaySales: 0,
    inventoryCount: 0,
    lowStockCount: 0,
    totalTransactions: 0
  });
  const [recentSales, setRecentSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayTimestamp = Timestamp.fromDate(today);

        // Sales today
        const salesPath = 'sales';
        let salesSnap;
        try {
          const salesQuery = query(collection(db, salesPath), where('createdAt', '>=', todayTimestamp));
          salesSnap = await getDocs(salesQuery);
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, salesPath);
          throw err;
        }

        let todayTotal = 0;
        salesSnap.forEach(doc => todayTotal += doc.data().total);

        // Inventory stats
        const productsPath = 'products';
        let productsSnap;
        try {
          productsSnap = await getDocs(collection(db, productsPath));
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, productsPath);
          throw err;
        }

        let inventoryCount = 0;
        let lowStockCount = 0;
        productsSnap.forEach(doc => {
          inventoryCount++;
          if (doc.data().stock < 10) lowStockCount++;
        });

        // Recent sales
        const recentQuery = query(collection(db, salesPath), orderBy('createdAt', 'desc'), limit(5));
        const recentSnap = await getDocs(recentQuery);
        const recent: Sale[] = [];
        recentSnap.forEach(doc => recent.push({ id: doc.id, ...doc.data() } as Sale));

        setStats({
          todaySales: todayTotal,
          inventoryCount,
          lowStockCount,
          totalTransactions: salesSnap.size
        });
        setRecentSales(recent);
      } catch (err) {
        console.error("Dashboard Stats Error:", err);
        setError("Unable to load store statistics. Please check your permissions.");
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, []);

  const statCards = [
    { label: "Today's Sales", value: `฿${stats.todaySales.toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Inventory Items", value: stats.inventoryCount, icon: Package, color: "text-indigo-600", bg: "bg-indigo-50" },
    { label: "Low Stock Alert", value: stats.lowStockCount, icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Transactions", value: stats.totalTransactions, icon: ShoppingCart, color: "text-blue-600", bg: "bg-blue-50" },
  ];

  if (loading) {
    return <div className="animate-pulse space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map(i => <div key={i} className="h-32 bg-white rounded-2xl border border-slate-200" />)}
      </div>
      <div className="h-64 bg-white rounded-2xl border border-slate-200" />
    </div>;
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-20 bg-white rounded-2xl border border-slate-200">
        <AlertTriangle className="w-12 h-12 text-rose-500 mb-4" />
        <p className="text-lg font-bold text-slate-900">{error}</p>
        <p className="text-slate-500 mb-6 text-center max-w-md px-4">
          This usually means your account hasn't been fully authorized as a staff member yet.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-2 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Dashboard Overview</h2>
        <p className="text-slate-500">Welcome back to Grocery Flow.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="p-6 bg-white rounded-2xl border border-slate-200 shadow-sm"
          >
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="w-6 h-6" />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500">{stat.label}</p>
            <h3 className="text-2xl font-bold text-slate-900 tabular-nums">{stat.value}</h3>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-bold text-slate-900">Recent Transactions</h3>
            <button className="text-sm text-indigo-600 font-medium hover:underline">View All</button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-6 py-3 font-semibold">ID</th>
                  <th className="px-6 py-3 font-semibold">Total</th>
                  <th className="px-6 py-3 font-semibold">Items</th>
                  <th className="px-6 py-3 font-semibold">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentSales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 text-sm font-mono text-slate-400">#{sale.id.slice(0, 6)}</td>
                    <td className="px-6 py-4 text-sm font-bold text-slate-900 tabular-nums">฿{sale.total.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{sale.items.length} products</td>
                    <td className="px-6 py-4 text-sm text-slate-500">
                      {sale.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </td>
                  </tr>
                ))}
                {recentSales.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-6 py-12 text-center text-slate-400">No transactions today</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h3 className="font-bold text-slate-900 mb-6">Quick Actions</h3>
          <div className="space-y-3">
            <button className="w-full p-4 text-left rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
              <p className="font-semibold text-slate-900 group-hover:text-indigo-700">New Sale</p>
              <p className="text-xs text-slate-500">Process a customer purchase</p>
            </button>
            <button className="w-full p-4 text-left rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
              <p className="font-semibold text-slate-900 group-hover:text-indigo-700">Add Product</p>
              <p className="text-xs text-slate-500">Restock or add new item</p>
            </button>
            <button className="w-full p-4 text-left rounded-xl border border-slate-100 hover:border-indigo-200 hover:bg-indigo-50/50 transition-all group">
              <p className="font-semibold text-slate-900 group-hover:text-indigo-700">Export Report</p>
              <p className="text-xs text-slate-500">Download inventory as Excel</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
