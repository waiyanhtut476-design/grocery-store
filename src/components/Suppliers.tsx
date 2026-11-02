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
  writeBatch, 
  serverTimestamp, 
  increment 
} from 'firebase/firestore';
import { 
  Truck, 
  Plus, 
  Search, 
  Phone, 
  Mail, 
  MapPin, 
  Calendar, 
  Package, 
  Receipt, 
  Trash2, 
  Edit2, 
  X, 
  Loader2, 
  CheckCircle2, 
  FileText,
  DollarSign
} from 'lucide-react';
import { Supplier, PurchaseOrder, Product, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from '../lib/storeSettings';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';

interface SuppliersProps {
  user: User;
  role: 'admin' | 'staff' | null;
}

export function Suppliers({ user, role }: SuppliersProps) {
  const [activeTab, setActiveTab] = useState<'directory' | 'purchases'>('directory');
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    notes: ''
  });

  // Stock-In Purchase Modal
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);
  const [purchaseInvoiceNumber, setPurchaseInvoiceNumber] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<{
    productId: string;
    name: string;
    barcode: string;
    quantity: number;
    costPrice: number;
  }[]>([]);
  const [purchaseNotes, setPurchaseNotes] = useState('');
  const [isSavingPurchase, setIsSavingPurchase] = useState(false);
  const [isSavingSupplier, setIsSavingSupplier] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Search
  const [search, setSearch] = useState('');

  const { t } = useLanguage();
  const currency = settings.currencySymbol || '฿';

  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  // Fetch Suppliers
  useEffect(() => {
    const q = query(collection(db, 'suppliers'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Supplier[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Supplier));
      setSuppliers(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'suppliers');
    });
    return () => unsub();
  }, []);

  // Fetch Purchases
  useEffect(() => {
    const q = query(collection(db, 'purchases'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: PurchaseOrder[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as PurchaseOrder));
      setPurchases(list);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'purchases');
    });
    return () => unsub();
  }, []);

  // Fetch Products for Stock-In
  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const prods: Product[] = [];
      snap.forEach(d => prods.push({ id: d.id, ...d.data() } as Product));
      setProducts(prods);
    });
    return () => unsub();
  }, []);

  const openNewSupplier = () => {
    setEditingSupplier(null);
    setSupplierFormData({
      name: '',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      notes: ''
    });
    setIsSupplierModalOpen(true);
  };

  const openEditSupplier = (s: Supplier) => {
    setEditingSupplier(s);
    setSupplierFormData({
      name: s.name,
      contactPerson: s.contactPerson || '',
      phone: s.phone || '',
      email: s.email || '',
      address: s.address || '',
      notes: s.notes || ''
    });
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierFormData.name.trim() || !supplierFormData.phone.trim()) {
      alert("Supplier name and phone number are required.");
      return;
    }
    setIsSavingSupplier(true);

    try {
      const id = editingSupplier?.id || doc(collection(db, 'suppliers')).id;
      const now = serverTimestamp();
      const payload: Partial<Supplier> = {
        name: supplierFormData.name.trim(),
        contactPerson: supplierFormData.contactPerson.trim() || '',
        phone: supplierFormData.phone.trim(),
        email: supplierFormData.email.trim() || '',
        address: supplierFormData.address.trim() || '',
        notes: supplierFormData.notes.trim() || '',
        updatedAt: now
      };
      if (!editingSupplier) {
        payload.createdAt = now;
      }

      await setDoc(doc(db, 'suppliers', id), payload, { merge: true });
      setIsSupplierModalOpen(false);
      setToastMessage(editingSupplier ? 'Supplier updated!' : 'Supplier added successfully!');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      console.error('Error saving supplier:', err);
      handleFirestoreError(err, OperationType.WRITE, 'suppliers');
    } finally {
      setIsSavingSupplier(false);
    }
  };

  const handleDeleteSupplier = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this supplier?")) return;
    try {
      await deleteDoc(doc(db, 'suppliers', id));
      setToastMessage('Supplier deleted.');
      setTimeout(() => setToastMessage(null), 3000);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `suppliers/${id}`);
    }
  };

  // Open New Stock-In Modal
  const openNewPurchase = () => {
    setPurchaseInvoiceNumber(`PO-${new Date().toISOString().slice(2,10).replace(/-/g,'')}-${Math.floor(1000 + Math.random() * 9000)}`);
    setSelectedSupplierId(suppliers.length > 0 ? suppliers[0].id : '');
    setPurchaseItems([]);
    setPurchaseNotes('');
    setIsPurchaseModalOpen(true);
  };

  const handleAddProductToPurchase = (prod: Product) => {
    setPurchaseItems(prev => {
      const exist = prev.find(i => i.productId === prod.id);
      if (exist) {
        return prev.map(i => i.productId === prod.id ? { ...i, quantity: i.quantity + 10 } : i);
      }
      return [...prev, {
        productId: prod.id,
        name: prod.name,
        barcode: prod.barcode,
        quantity: 10,
        costPrice: prod.costPrice || 0
      }];
    });
  };

  const updatePurchaseItem = (productId: string, field: 'quantity' | 'costPrice', val: number) => {
    setPurchaseItems(prev => prev.map(i => {
      if (i.productId === productId) {
        return { ...i, [field]: Math.max(0, val) };
      }
      return i;
    }));
  };

  const removePurchaseItem = (productId: string) => {
    setPurchaseItems(prev => prev.filter(i => i.productId !== productId));
  };

  const totalPurchaseCost = purchaseItems.reduce((acc, it) => acc + (it.quantity * it.costPrice), 0);

  const handleSavePurchase = async () => {
    if (!selectedSupplierId) {
      alert("Please select a supplier.");
      return;
    }
    if (purchaseItems.length === 0) {
      alert("Please add at least one item to this purchase order.");
      return;
    }

    const supplier = suppliers.find(s => s.id === selectedSupplierId);
    if (!supplier) return;

    setIsSavingPurchase(true);

    try {
      const batch = writeBatch(db);
      const purchaseId = doc(collection(db, 'purchases')).id;
      const purchaseRef = doc(db, 'purchases', purchaseId);
      const now = serverTimestamp();

      const purchaseData = {
        invoiceNumber: purchaseInvoiceNumber.trim() || `PO-${purchaseId.slice(0, 8)}`,
        supplierId: supplier.id,
        supplierName: supplier.name,
        items: purchaseItems.map(it => ({
          productId: it.productId,
          name: it.name,
          barcode: it.barcode,
          quantity: it.quantity,
          costPrice: it.costPrice,
          totalCost: it.quantity * it.costPrice
        })),
        totalCost: totalPurchaseCost,
        notes: purchaseNotes.trim() || '',
        receivedBy: user.uid,
        receivedByName: user.displayName || user.email || 'Staff',
        createdAt: now
      };

      batch.set(purchaseRef, purchaseData);

      // Increment stocks and update costPrice on product
      for (const item of purchaseItems) {
        const productRef = doc(db, 'products', item.productId);
        batch.update(productRef, {
          stock: increment(item.quantity),
          costPrice: item.costPrice,
          updatedAt: now
        });
      }

      await batch.commit();

      setIsPurchaseModalOpen(false);
      setToastMessage(`Stock-In ${purchaseInvoiceNumber} recorded & stock updated!`);
      setTimeout(() => setToastMessage(null), 3500);
    } catch (err) {
      console.error('Error saving purchase order:', err);
      handleFirestoreError(err, OperationType.CREATE, 'purchases');
    } finally {
      setIsSavingPurchase(false);
    }
  };

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.phone.includes(search) ||
    (s.contactPerson && s.contactPerson.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('suppliers')}</h2>
          <p className="text-slate-500 text-sm">Manage vendor directory and goods received stock-in invoices.</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button
            onClick={openNewPurchase}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100 cursor-pointer active:scale-95"
          >
            <Package className="w-4 h-4" />
            <span>{t('new_stock_in')}</span>
          </button>
          <button
            onClick={openNewSupplier}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-all shadow-md shadow-slate-200 cursor-pointer active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_supplier')}</span>
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab('directory')}
          className={cn(
            "pb-3 text-sm font-bold transition-all relative cursor-pointer",
            activeTab === 'directory' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4" />
            <span>{t('supplier_list')} ({suppliers.length})</span>
          </div>
          {activeTab === 'directory' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab('purchases')}
          className={cn(
            "pb-3 text-sm font-bold transition-all relative cursor-pointer",
            activeTab === 'purchases' ? "text-indigo-600" : "text-slate-400 hover:text-slate-600"
          )}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            <span>{t('purchase_history')} ({purchases.length})</span>
          </div>
          {activeTab === 'purchases' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab 1: Supplier Directory */}
      {activeTab === 'directory' && (
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search supplier by name, contact, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none shadow-xs text-slate-900"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredSuppliers.map((s) => (
              <div key={s.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs hover:border-indigo-200 transition-all flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{s.name}</h4>
                      {s.contactPerson && (
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">Attn: {s.contactPerson}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => openEditSupplier(s)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        title="Edit Supplier"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteSupplier(s.id)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
                        title="Delete Supplier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs text-slate-600 mt-3 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <Phone className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <a href={`tel:${s.phone}`} className="font-mono font-bold hover:underline text-slate-800">{s.phone}</a>
                    </div>
                    {s.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{s.email}</span>
                      </div>
                    )}
                    {s.address && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                        <span className="text-slate-500 line-clamp-2">{s.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Purchases: {purchases.filter(p => p.supplierId === s.id).length} orders</span>
                  <button
                    onClick={() => {
                      setSelectedSupplierId(s.id);
                      openNewPurchase();
                    }}
                    className="text-indigo-600 font-bold hover:underline cursor-pointer"
                  >
                    + Stock-In
                  </button>
                </div>
              </div>
            ))}

            {filteredSuppliers.length === 0 && !loading && (
              <div className="col-span-full py-16 text-center bg-white rounded-2xl border border-dashed border-slate-200">
                <Truck className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-slate-600 font-bold text-sm">No suppliers found.</p>
                <p className="text-xs text-slate-400 mt-1">Click &quot;Add Supplier&quot; above to add your store vendors.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Stock-In Purchases */}
      {activeTab === 'purchases' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                  <th className="px-5 py-4 font-bold">{t('invoice_number')} / {t('date_time')}</th>
                  <th className="px-5 py-4 font-bold">{t('supplier_name')}</th>
                  <th className="px-5 py-4 font-bold">{t('items')}</th>
                  <th className="px-5 py-4 font-bold">Total Cost</th>
                  <th className="px-5 py-4 font-bold">Received By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {purchases.map((po) => {
                  const formattedDate = po.createdAt?.toDate 
                    ? po.createdAt.toDate().toLocaleString() 
                    : 'Recent';
                  const totalUnits = (po.items || []).reduce((acc, it) => acc + it.quantity, 0);

                  return (
                    <tr key={po.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-mono font-bold text-indigo-600">{po.invoiceNumber}</span>
                          <span className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {formattedDate}
                          </span>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-xs">{po.supplierName}</span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-1 max-w-[280px]">
                          {po.items.slice(0, 2).map((item, i) => (
                            <div key={i} className="text-xs text-slate-700 flex justify-between gap-3">
                              <span className="font-semibold truncate">{item.name}</span>
                              <span className="text-slate-500 font-mono whitespace-nowrap">+{item.quantity} pcs @ {currency}{item.costPrice}</span>
                            </div>
                          ))}
                          {po.items.length > 2 && (
                            <span className="text-[11px] text-indigo-600 font-bold">+{po.items.length - 2} more items</span>
                          )}
                          <span className="text-[10px] text-slate-400">Total: {totalUnits} units</span>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="text-base font-black text-slate-900 tabular-nums">
                          {currency}{po.totalCost.toLocaleString()}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-xs text-slate-600">
                        {po.receivedByName || 'Staff'}
                      </td>
                    </tr>
                  );
                })}

                {purchases.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No stock-in purchases recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      <AnimatePresence>
        {isSupplierModalOpen && (
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
                    <Truck className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {editingSupplier ? 'Edit Supplier' : t('add_supplier')}
                    </h3>
                    <p className="text-xs text-slate-500">Vendor directory entry</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveSupplier} className="p-5 space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t('supplier_name')} *
                  </label>
                  <input
                    type="text"
                    required
                    value={supplierFormData.name}
                    onChange={(e) => setSupplierFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. CP Foods Co., Ltd."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Contact Person
                    </label>
                    <input
                      type="text"
                      value={supplierFormData.contactPerson}
                      onChange={(e) => setSupplierFormData(prev => ({ ...prev, contactPerson: e.target.value }))}
                      placeholder="e.g. John Doe"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('phone_number')} *
                    </label>
                    <input
                      type="text"
                      required
                      value={supplierFormData.phone}
                      onChange={(e) => setSupplierFormData(prev => ({ ...prev, phone: e.target.value }))}
                      placeholder="e.g. 081-234-5678"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Email Address
                  </label>
                  <input
                    type="email"
                    value={supplierFormData.email}
                    onChange={(e) => setSupplierFormData(prev => ({ ...prev, email: e.target.value }))}
                    placeholder="e.g. sales@vendor.com"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Office / Warehouse Address
                  </label>
                  <textarea
                    rows={2}
                    value={supplierFormData.address}
                    onChange={(e) => setSupplierFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="e.g. 123 Sukhumvit Rd, Bangkok"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 resize-none"
                  />
                </div>

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsSupplierModalOpen(false)}
                    className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSupplier}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {isSavingSupplier ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Supplier'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* New Stock-In Purchase Modal */}
      <AnimatePresence>
        {isPurchaseModalOpen && (
          <div className="fixed inset-0 z-[280] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">{t('new_stock_in')}</h3>
                    <p className="text-xs text-indigo-600 font-mono">{purchaseInvoiceNumber}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('invoice_number')}
                    </label>
                    <input
                      type="text"
                      value={purchaseInvoiceNumber}
                      onChange={(e) => setPurchaseInvoiceNumber(e.target.value)}
                      placeholder="e.g. PO-2026-001"
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      {t('supplier_name')} *
                    </label>
                    <select
                      value={selectedSupplierId}
                      onChange={(e) => setSelectedSupplierId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                    >
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone})</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Product Search & Quick Add */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Select Product to Receive:
                  </label>
                  <div className="max-h-36 overflow-y-auto bg-slate-50 p-2 rounded-2xl border border-slate-200 space-y-1">
                    {products.map(prod => (
                      <button
                        key={prod.id}
                        type="button"
                        onClick={() => handleAddProductToPurchase(prod)}
                        className="w-full p-2 rounded-xl bg-white hover:bg-indigo-50/60 border border-slate-100 hover:border-indigo-300 flex items-center justify-between text-left transition-all text-xs cursor-pointer"
                      >
                        <div>
                          <span className="font-bold text-slate-900">{prod.name}</span>
                          <span className="text-[11px] text-slate-400 font-mono ml-2">({prod.barcode})</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-500">Current: {prod.stock}</span>
                          <span className="font-bold text-indigo-600">+ Add</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Items Table */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Items to Restock: ({purchaseItems.length})
                  </label>
                  <div className="bg-slate-50 rounded-2xl border border-slate-200 p-2 space-y-2">
                    {purchaseItems.map(it => (
                      <div key={it.productId} className="bg-white p-3 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900 truncate">{it.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">{it.barcode}</p>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">Qty:</span>
                            <input
                              type="number"
                              min="1"
                              value={it.quantity}
                              onChange={(e) => updatePurchaseItem(it.productId, 'quantity', Number(e.target.value))}
                              className="w-16 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-center"
                            />
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="text-[11px] text-slate-500">Cost ({currency}):</span>
                            <input
                              type="number"
                              min="0"
                              value={it.costPrice}
                              onChange={(e) => updatePurchaseItem(it.productId, 'costPrice', Number(e.target.value))}
                              className="w-20 px-2 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-900 text-center"
                            />
                          </div>

                          <div className="w-20 text-right font-black text-slate-900 tabular-nums">
                            {currency}{(it.quantity * it.costPrice).toLocaleString()}
                          </div>

                          <button
                            type="button"
                            onClick={() => removePurchaseItem(it.productId)}
                            className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {purchaseItems.length === 0 && (
                      <p className="text-center text-xs text-slate-400 py-6">
                        No products added yet. Click &quot;+ Add&quot; on products above.
                      </p>
                    )}
                  </div>
                </div>

                {/* Total Cost Display */}
                <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-100 flex items-center justify-between text-xs">
                  <span className="font-bold text-indigo-900">Total Purchase Invoice Cost:</span>
                  <span className="text-lg font-black text-indigo-700 tabular-nums">
                    {currency}{totalPurchaseCost.toLocaleString()}
                  </span>
                </div>
              </div>

              <div className="p-4 border-t border-slate-100 bg-white flex gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsPurchaseModalOpen(false)}
                  className="flex-1 py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={isSavingPurchase || purchaseItems.length === 0}
                  onClick={handleSavePurchase}
                  className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isSavingPurchase ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm Stock-In & Update Stock</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Toast Notification */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-[250] bg-slate-900 text-white px-5 py-3 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-800"
          >
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span className="text-xs font-bold">{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
