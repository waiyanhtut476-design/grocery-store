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
  serverTimestamp 
} from 'firebase/firestore';
import { 
  Users, 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Loader2, 
  CheckCircle2, 
  Shield,
  User as UserIcon,
  Mail
} from 'lucide-react';
import { UserRole } from '../types';
import { useLanguage } from '../lib/i18n';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface StaffProps {
  role: 'admin' | 'staff' | null;
  isOwnerUnlocked?: boolean;
  onRequirePin?: () => void;
}

export function Staff({ role, isOwnerUnlocked, onRequirePin }: StaffProps) {
  const [staffList, setStaffList] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useLanguage();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<UserRole | null>(null);
  const [formData, setFormData] = useState({
    email: '',
    role: 'staff' as 'admin' | 'staff',
    uid: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const q = query(collection(db, 'roles'), orderBy('updatedAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: UserRole[] = [];
      snap.forEach(d => list.push({ uid: d.id, ...d.data() } as UserRole));
      setStaffList(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'roles');
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) return;
    setIsSaving(true);

    try {
      const id = formData.uid || formData.email.replace(/\./g, '_'); 
      const now = serverTimestamp();
      const payload = {
        email: formData.email.trim().toLowerCase(),
        role: formData.role,
        updatedAt: now
      };

      await setDoc(doc(db, 'roles', id), payload, { merge: true });
      setIsModalOpen(false);
      setToast('Staff role updated!');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'roles');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remove this staff role?")) return;
    try {
      await deleteDoc(doc(db, 'roles', id));
      setToast('Staff removed.');
      setTimeout(() => setToast(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `roles/${id}`);
    }
  };

  const openEdit = (s: UserRole) => {
    setEditingStaff(s);
    setFormData({
      email: s.email,
      role: s.role,
      uid: s.uid
    });
    setIsModalOpen(true);
  };

  if (role !== 'admin' && !isOwnerUnlocked) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white rounded-3xl border border-slate-200 p-8 text-center">
        <div className="p-4 bg-slate-50 rounded-2xl mb-4">
          <Shield className="w-12 h-12 text-slate-300" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">ဝင်ရောက်ခွင့် ကန့်သတ်ထားပါသည်</h3>
        <p className="text-slate-500 text-sm mb-8 max-w-xs">
          ဝန်ထမ်းစာရင်းနှင့် ရာထူးများကို စီမံခန့်ခွဲရန် Administrator သာ လုပ်ဆောင်နိုင်ပါသည်။
        </p>
        <button
          onClick={onRequirePin}
          className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
        >
          Owner PIN ဖြင့် ဖွင့်ပါ
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('staff_management')}</h2>
          <p className="text-slate-500 text-sm">Assign roles and permissions for your team.</p>
        </div>
        <button
          onClick={() => {
            setEditingStaff(null);
            setFormData({ email: '', role: 'staff', uid: '' });
            setIsModalOpen(true);
          }}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>{t('add_staff')}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {staffList.map((s) => (
          <div key={s.uid} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between hover:border-indigo-200 transition-all">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-slate-50 rounded-xl">
                  <UserIcon className="w-5 h-5 text-slate-400" />
                </div>
                <div>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{s.role}</p>
                  <p className="text-sm font-bold text-slate-900 line-clamp-1">{s.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => openEdit(s)}
                  className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(s.uid)}
                  className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className={cn(
                "px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest border",
                s.role === 'admin' ? "bg-indigo-50 text-indigo-700 border-indigo-100" : "bg-emerald-50 text-emerald-700 border-emerald-100"
              )}>
                {s.role === 'admin' ? 'Owner / Manager' : 'Cashier / Staff'}
              </span>
              <span className="text-[10px] text-slate-400">UID: {s.uid.slice(0, 8)}...</span>
            </div>
          </div>
        ))}
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
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Shield className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-base">
                    {editingStaff ? 'Edit Staff Role' : t('add_staff')}
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
                  <label className="block text-xs font-bold text-slate-700 mb-1">Email Address *</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="staff@gmail.com"
                      className="w-full pl-10 pr-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1.5 italic">Note: Staff must use this exact email to sign in with Google.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Assigned Role</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, role: 'staff' }))}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-1 transition-all",
                        formData.role === 'staff' ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">Staff</span>
                      <span className="text-[10px] opacity-80">POS & Inventory View</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, role: 'admin' }))}
                      className={cn(
                        "p-3 rounded-xl border flex flex-col gap-1 transition-all",
                        formData.role === 'admin' ? "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-100" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <span className="text-xs font-black uppercase tracking-wider">Admin</span>
                      <span className="text-[10px] opacity-80">Full Access & Financials</span>
                    </button>
                  </div>
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
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Staff'}
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
