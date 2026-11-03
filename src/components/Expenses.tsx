import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp, 
  limit 
} from 'firebase/firestore';
import { 
  DollarSign, 
  Plus, 
  Search, 
  Trash2, 
  Edit2, 
  X, 
  Loader2, 
  CheckCircle2, 
  Calendar,
  Filter,
  ArrowDownCircle,
  Tag
} from 'lucide-react';
import { Expense, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from '../lib/storeSettings';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ExpensesProps {
  user: User;
  role: 'admin' | 'staff' | null;
}

export function Expenses({ user, role }: ExpensesProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const { t } = useLanguage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    category: 'other' as Expense['category'],
    amount: '',
    date: new Date().toISOString().slice(0, 10),
    notes: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');

  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'expenses'), orderBy('date', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      const list: Expense[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Expense));
      setExpenses(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'expenses');
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.amount) return;
    setIsSaving(true);

    try {
      const id = editingExpense?.id || doc(collection(db, 'expenses')).id;
      const now = serverTimestamp();
      const payload = {
        title: formData.title.trim(),
        category: formData.category,
        amount: Number(formData.amount),
        date: formData.date,
        notes: formData.notes.trim(),
        recordedBy: user.uid,
        recordedByName: user.displayName || user.email || 'Staff',
        updatedAt: now,
        createdAt: editingExpense ? editingExpense.createdAt : now
      };

      await setDoc(doc(db, 'expenses', id), payload, { merge: true });
      setIsModalOpen(false);
      setToast(editingExpense ? 'Expense updated!' : 'Expense recorded!');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'expenses');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Delete this expense record?")) return;
    try {
      await deleteDoc(doc(db, 'expenses', id));
      setToast('Record deleted.');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `expenses/${id}`);
    }
  };

  const openEdit = (e: Expense) => {
    setEditingExpense(e);
    setFormData({
      title: e.title,
      category: e.category,
      amount: e.amount.toString(),
      date: e.date,
      notes: e.notes || ''
    });
    setIsModalOpen(true);
  };

  const openAdd = () => {
    setEditingExpense(null);
    setFormData({
      title: '',
      category: 'other',
      amount: '',
      date: new Date().toISOString().slice(0, 10),
      notes: ''
    });
    setIsModalOpen(true);
  };

  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(search.toLowerCase()) || (e.notes && e.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesCat = filterCategory === 'all' || e.category === filterCategory;
    return matchesSearch && matchesCat;
  });

  const totalFiltered = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);
  const currency = settings.currencySymbol || '฿';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('expenses')}</h2>
          <p className="text-slate-500 text-sm">Track store operations costs and overheads.</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-all shadow-md shadow-rose-100 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_expense')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Expenses</p>
            <p className="text-2xl font-black text-rose-600 mt-1 tabular-nums">{currency}{totalFiltered.toLocaleString()}</p>
            <p className="text-[10px] text-slate-400 mt-1">Based on active filters</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <ArrowDownCircle className="w-6 h-6" />
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search expenses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none shadow-xs"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="all">All Categories</option>
            <option value="rent">{t('rent')}</option>
            <option value="utility">{t('utility')}</option>
            <option value="salary">{t('salary')}</option>
            <option value="inventory">Inventory / Stock</option>
            <option value="marketing">{t('marketing')}</option>
            <option value="other">{t('other')}</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-4 font-bold">{t('date_time')}</th>
                <th className="px-5 py-4 font-bold">{t('expense_title')}</th>
                <th className="px-5 py-4 font-bold">{t('expense_category')}</th>
                <th className="px-5 py-4 font-bold">{t('amount')}</th>
                <th className="px-5 py-4 font-bold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredExpenses.map((exp) => (
                <tr key={exp.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-5 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {exp.date}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{exp.title}</span>
                      {exp.notes && <span className="text-[11px] text-slate-400 line-clamp-1">{exp.notes}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-1 rounded-lg text-[10px] font-black uppercase bg-slate-100 text-slate-600 border border-slate-200/50">
                      {exp.category}
                    </span>
                  </td>
                  <td className="px-5 py-4 whitespace-nowrap">
                    <span className="text-sm font-black text-rose-600 tabular-nums">
                      {currency}{exp.amount.toLocaleString()}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(exp)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(exp.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredExpenses.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-xs italic">
                    No expense records found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-rose-50 text-rose-600 rounded-xl">
                    <DollarSign className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingExpense ? 'Edit Expense' : t('add_expense')}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">{t('expense_title')} *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Monthly Shop Rent"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('expense_category')}</label>
                    <select
                      value={formData.category}
                      onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as any }))}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    >
                      <option value="rent">{t('rent')}</option>
                      <option value="utility">{t('utility')}</option>
                      <option value="salary">{t('salary')}</option>
                      <option value="inventory">Inventory</option>
                      <option value="marketing">{t('marketing')}</option>
                      <option value="other">{t('other')}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">{t('amount')} ({currency}) *</label>
                    <input
                      type="number"
                      required
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Notes (Optional)</label>
                  <textarea
                    rows={2}
                    value={formData.notes}
                    onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Additional details..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-rose-500 text-slate-900 resize-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="flex-1 py-2.5 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-md shadow-rose-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Record'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-[250] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold">{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
