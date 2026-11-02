import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { FileDown, Calendar, ArrowRight, User as UserIcon } from 'lucide-react';
import { Sale } from '../types';
import { exportToExcel } from '../lib/excel';
import { motion } from 'motion/react';

interface HistoryProps {
  role: 'admin' | 'staff' | null;
}

export function History({ role }: HistoryProps) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'sales'), orderBy('createdAt', 'desc'), limit(50));
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

  const handleExport = () => {
    const exportData = sales.map(s => ({
      ID: s.id,
      Date: s.createdAt?.toDate().toLocaleString(),
      Total: s.total,
      Staff: s.staffId,
      Items: s.items.map(i => `${i.name} (x${i.quantity})`).join(', ')
    }));
    exportToExcel(exportData, `Sales_History_${new Date().toISOString().slice(0,10)}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sales History</h2>
          <p className="text-slate-500">View and export past transactions.</p>
        </div>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100"
        >
          <FileDown className="w-4 h-4" />
          Export Excel
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Transaction</th>
                <th className="px-6 py-4 font-semibold">Items</th>
                <th className="px-6 py-4 font-semibold">Total</th>
                <th className="px-6 py-4 font-semibold">Staff</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sales.map((sale) => (
                <tr key={sale.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-mono text-slate-400">#{sale.id.slice(0, 8)}</span>
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {sale.createdAt?.toDate().toLocaleString()}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1">
                      {sale.items.slice(0, 2).map((item, i) => (
                        <div key={i} className="text-sm text-slate-700 flex justify-between gap-4">
                          <span>{item.name}</span>
                          <span className="text-slate-400 font-medium whitespace-nowrap">x{item.quantity}</span>
                        </div>
                      ))}
                      {sale.items.length > 2 && (
                        <span className="text-xs text-indigo-600 font-medium">+{sale.items.length - 2} more items</span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-lg font-black text-slate-900 tabular-nums">฿{sale.total.toLocaleString()}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <UserIcon className="w-4 h-4 text-slate-300" />
                      <span className="truncate max-w-[120px]">{sale.staffId.slice(0, 6)}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {sales.length === 0 && !loading && (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-slate-400">No transactions recorded yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
