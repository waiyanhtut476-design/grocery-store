import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp, 
  orderBy,
  addDoc
} from 'firebase/firestore';
import { Customer } from '../types';
import { useLanguage } from '../lib/i18n';
import { 
  Users, 
  Search, 
  Plus, 
  Edit2, 
  Trash2, 
  Phone, 
  Award, 
  CreditCard, 
  CheckCircle, 
  X, 
  DollarSign, 
  FileDown,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportToExcel } from '../lib/excel';

interface CustomersProps {
  role: 'admin' | 'staff' | null;
}

export function Customers({ role }: CustomersProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const { t } = useLanguage();

  // Settle Debt modal
  const [settlingCustomer, setSettlingCustomer] = useState<Customer | null>(null);
  const [settleAmount, setSettleAmount] = useState<number>(0);
  const [isSettling, setIsSettling] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    points: 0,
    creditBalance: 0,
    notes: ''
  });

  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data: Customer[] = [];
      snapshot.forEach(doc => data.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'customers');
    });

    return () => unsubscribe();
  }, []);

  const filteredCustomers = customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  const totalOutstandingCredit = customers.reduce((sum, c) => sum + (c.creditBalance || 0), 0);
  const totalPoints = customers.reduce((sum, c) => sum + (c.points || 0), 0);

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingCustomer?.id || doc(collection(db, 'customers')).id;
    const now = serverTimestamp();

    const payload = {
      name: formData.name.trim(),
      phone: formData.phone.trim(),
      points: Number(formData.points) || 0,
      creditBalance: Number(formData.creditBalance) || 0,
      notes: formData.notes.trim(),
      createdAt: editingCustomer ? (editingCustomer.createdAt || now) : now,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'customers', id), payload);
      setIsModalOpen(false);
      setEditingCustomer(null);
      setFormData({ name: '', phone: '', points: 0, creditBalance: 0, notes: '' });
    } catch (err) {
      console.error('Failed to save customer:', err);
      handleFirestoreError(err, OperationType.WRITE, 'customers/' + id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await deleteDoc(doc(db, 'customers', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'customers/' + id);
    }
  };

  const handleOpenSettle = (customer: Customer) => {
    setSettlingCustomer(customer);
    setSettleAmount(customer.creditBalance || 0);
  };

  const handleConfirmSettle = async () => {
    if (!settlingCustomer || settleAmount <= 0) return;
    setIsSettling(true);
    try {
      const newCredit = Math.max(0, (settlingCustomer.creditBalance || 0) - settleAmount);
      await updateDoc(doc(db, 'customers', settlingCustomer.id), {
        creditBalance: newCredit,
        updatedAt: serverTimestamp()
      });
      setSettlingCustomer(null);
      setSettleAmount(0);
    } catch (err) {
      console.error('Failed to settle customer debt:', err);
      handleFirestoreError(err, OperationType.WRITE, 'customers/' + settlingCustomer.id);
    } finally {
      setIsSettling(false);
    }
  };

  const handleExport = () => {
    const data = customers.map(c => ({
      ID: c.id,
      Name: c.name,
      Phone: c.phone,
      Points: c.points || 0,
      'Credit Debt (฿)': c.creditBalance || 0,
      Notes: c.notes || ''
    }));
    exportToExcel(data, `Customers_Report_${new Date().toISOString().slice(0, 10)}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('customers')}</h2>
          <p className="text-slate-500 text-sm">Manage member points, loyalty and customer credit debt.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            <span>{t('export_csv')}</span>
          </button>
          <button
            onClick={() => {
              setEditingCustomer(null);
              setFormData({ name: '', phone: '', points: 0, creditBalance: 0, notes: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_customer')}</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('customers')}</p>
            <p className="text-2xl font-black text-slate-900 mt-1 tabular-nums">{customers.length}</p>
          </div>
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('points')}</p>
            <p className="text-2xl font-black text-amber-500 mt-1 tabular-nums">{totalPoints.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-amber-50 text-amber-500 rounded-2xl">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{t('credit_debt')}</p>
            <p className="text-2xl font-black text-rose-600 mt-1 tabular-nums">฿{totalOutstandingCredit.toLocaleString()}</p>
          </div>
          <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search customer by name or phone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-5 py-4 font-bold">{t('customer_name')}</th>
                <th className="px-5 py-4 font-bold">{t('phone_number')}</th>
                <th className="px-5 py-4 font-bold">{t('points')}</th>
                <th className="px-5 py-4 font-bold">{t('credit_debt')}</th>
                <th className="px-5 py-4 font-bold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" />
                  </td>
                </tr>
              ) : filteredCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors group">
                  <td className="px-5 py-4">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{customer.name}</span>
                      {customer.notes && <span className="text-xs text-slate-400">{customer.notes}</span>}
                    </div>
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-slate-600">
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{customer.phone || '-'}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200/60">
                      <Award className="w-3.5 h-3.5" />
                      {customer.points || 0} pts
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {customer.creditBalance && customer.creditBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200/80">
                        ฿{customer.creditBalance.toLocaleString()}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-emerald-600">฿0 (Clear)</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right whitespace-nowrap">
                    <div className="flex justify-end items-center gap-2">
                      {customer.creditBalance && customer.creditBalance > 0 ? (
                        <button
                          type="button"
                          onClick={() => handleOpenSettle(customer)}
                          className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-xs rounded-xl border border-emerald-200 transition-colors"
                        >
                          {t('settle_debt')}
                        </button>
                      ) : null}
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCustomer(customer);
                          setFormData({
                            name: customer.name,
                            phone: customer.phone,
                            points: customer.points || 0,
                            creditBalance: customer.creditBalance || 0,
                            notes: customer.notes || ''
                          });
                          setIsModalOpen(true);
                        }}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {role === 'admin' && (
                        <button
                          type="button"
                          onClick={() => handleDelete(customer.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredCustomers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                    No customers found. Click &quot;Add Customer&quot; to register a member.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Customer Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <h3 className="text-base font-bold text-slate-900">
                  {editingCustomer ? t('edit_customer') : t('add_customer')}
                </h3>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCustomer} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    {t('customer_name')}
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    {t('phone_number')}
                  </label>
                  <input
                    type="tel"
                    required
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      {t('points')}
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.points}
                      onChange={(e) => setFormData({ ...formData, points: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                      {t('credit_debt')} (฿)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={formData.creditBalance}
                      onChange={(e) => setFormData({ ...formData, creditBalance: Number(e.target.value) })}
                      className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. VIP regular customer"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all active:scale-95"
                  >
                    {t('update')}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settle Debt Modal */}
      <AnimatePresence>
        {settlingCustomer && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col border border-slate-200"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-base font-bold text-slate-900">{t('settle_debt')}</h3>
                  <p className="text-xs text-slate-500">{settlingCustomer.name}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setSettlingCustomer(null)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4">
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 flex justify-between items-center">
                  <span className="text-xs font-bold text-rose-700">{t('credit_debt')}</span>
                  <span className="text-lg font-black text-rose-700 tabular-nums">
                    ฿{settlingCustomer.creditBalance.toLocaleString()}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                    Repayment Amount (฿)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={settlingCustomer.creditBalance}
                    value={settleAmount || ''}
                    onChange={(e) => setSettleAmount(Number(e.target.value))}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-black text-slate-900 focus:ring-2 focus:ring-emerald-500 outline-none tabular-nums"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setSettlingCustomer(null)}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="button"
                    disabled={isSettling || settleAmount <= 0}
                    onClick={handleConfirmSettle}
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-md shadow-emerald-100 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {isSettling ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    <span>Confirm Repayment</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
