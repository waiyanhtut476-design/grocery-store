import React, { useState, useEffect, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp,
  orderBy,
  updateDoc,
  writeBatch
} from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Scan, 
  Edit2, 
  Trash2, 
  Filter,
  Image as ImageIcon,
  Loader2,
  X,
  Camera,
  Calendar,
  AlertCircle,
  FileDown,
  FileUp,
  Layers,
  CheckCircle,
  Upload,
  Tag,
  AlertTriangle
} from 'lucide-react';
import { Product } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { BarcodeLabelsModal } from './BarcodeLabelsModal';
import { DamageWasteModal } from './DamageWasteModal';
import { motion, AnimatePresence } from 'motion/react';
import { useLanguage } from '../lib/i18n';
import { exportToExcel } from '../lib/excel';
import * as XLSX from 'xlsx';
import { User } from 'firebase/auth';

interface InventoryProps {
  role: 'admin' | 'staff' | null;
  user?: User | null;
}

function getExpiryStatus(expiryDate?: string) {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(expiryDate);
  if (isNaN(exp.getTime())) return null;
  exp.setHours(0, 0, 0, 0);
  const diffTime = exp.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return { status: 'expired' as const, days: diffDays };
  if (diffDays <= 30) return { status: 'expiring_soon' as const, days: diffDays };
  return { status: 'ok' as const, days: diffDays };
}

export function Inventory({ role, user }: InventoryProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [filterType, setFilterType] = useState<'all' | 'low_stock' | 'expiring'>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [quickRestockingId, setQuickRestockingId] = useState<string | null>(null);
  const { t } = useLanguage();

  // CSV Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  // Barcode Labels Modal State
  const [isBarcodeLabelsOpen, setIsBarcodeLabelsOpen] = useState(false);

  // Damage & Expiry Waste Modal State
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [selectedProductForDamage, setSelectedProductForDamage] = useState<Product | null>(null);

  // Form State
  const initialFormData = {
    name: '',
    barcode: '',
    price: '',
    costPrice: '',
    stock: '',
    minStock: '5',
    expiryDate: '',
    unit: '',
    category: '',
    description: '',
    imageUrl: ''
  };
  const [formData, setFormData] = useState(initialFormData);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => prods.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'products');
    });

    return () => unsubscribe();
  }, []);

  // Unique categories list
  const categories = Array.from(
    new Set(
      products
        .map(p => p.category?.trim())
        .filter((c): c is string => Boolean(c && c.length > 0))
    )
  );

  const lowStockCount = products.filter((p) => {
    const minThreshold = p.minStock !== undefined && p.minStock !== null ? Number(p.minStock) : 5;
    return Number(p.stock) <= minThreshold;
  }).length;

  const expiringCount = products.filter((p) => {
    const exp = getExpiryStatus(p.expiryDate);
    return exp?.status === 'expired' || exp?.status === 'expiring_soon';
  }).length;

  const filteredProducts = products.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.barcode.includes(search) ||
      (p.category && p.category.toLowerCase().includes(search.toLowerCase()));
    if (!matchesSearch) return false;

    if (selectedCategory !== 'all') {
      if (p.category !== selectedCategory) return false;
    }

    if (filterType === 'low_stock') {
      const minThreshold = p.minStock !== undefined && p.minStock !== null ? Number(p.minStock) : 5;
      return Number(p.stock) <= minThreshold;
    }

    if (filterType === 'expiring') {
      const exp = getExpiryStatus(p.expiryDate);
      return exp?.status === 'expired' || exp?.status === 'expiring_soon';
    }

    return true;
  });

  const handleQuickRestock = async (product: Product, addAmount: number) => {
    try {
      setQuickRestockingId(product.id);
      const productRef = doc(db, 'products', product.id);
      const newStock = Math.max(0, Number(product.stock) + addAmount);
      await updateDoc(productRef, {
        stock: newStock,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      console.error('Quick restock error in Inventory:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products/' + product.id);
    } finally {
      setQuickRestockingId(null);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingProduct?.id || doc(collection(db, 'products')).id;
    const now = serverTimestamp();
    
    const minStockVal = formData.minStock !== '' ? Number(formData.minStock) : 5;
    const payload = {
      name: formData.name,
      barcode: formData.barcode,
      price: Number(formData.price),
      costPrice: Number(formData.costPrice) || 0,
      stock: Number(formData.stock),
      minStock: isNaN(minStockVal) ? 5 : minStockVal,
      expiryDate: formData.expiryDate || null,
      unit: formData.unit,
      category: formData.category,
      description: formData.description,
      imageUrl: formData.imageUrl || null,
      createdAt: editingProduct ? editingProduct.createdAt : now,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'products', id), payload);
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData(initialFormData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products/' + id);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await deleteDoc(doc(db, 'products', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'products/' + id);
    }
  };

  const openEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      barcode: product.barcode,
      price: product.price.toString(),
      costPrice: (product.costPrice || 0).toString(),
      stock: product.stock.toString(),
      minStock: (product.minStock ?? 5).toString(),
      expiryDate: product.expiryDate || '',
      unit: product.unit || '',
      category: product.category || '',
      description: product.description || '',
      imageUrl: product.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  // Export to Excel / CSV
  const handleExportCSV = () => {
    const exportData = filteredProducts.map(p => ({
      ID: p.id,
      Barcode: p.barcode,
      'Product Name': p.name,
      Category: p.category || '',
      Unit: p.unit || '',
      'Cost Price (฿)': p.costPrice || 0,
      'Selling Price (฿)': p.price,
      'Stock Remaining': p.stock,
      'Min Stock': p.minStock ?? 5,
      'Expiry Date': p.expiryDate || '',
      Description: p.description || '',
      'Image URL': p.imageUrl || ''
    }));
    exportToExcel(exportData, `Grocery_Inventory_${new Date().toISOString().slice(0, 10)}`);
  };

  // Handle CSV/Excel File Parse
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: 'binary' });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json(ws);
        
        // Map common column name aliases
        const normalized = data.map((row: any) => {
          return {
            name: row['Product Name'] || row['Name'] || row['name'] || row['ชื่อสินค้า'] || row['ကုန်ပစ္စည်းအမည်'] || '',
            barcode: String(row['Barcode'] || row['barcode'] || row['บาร์โค้ด'] || row['ဘားကုတ်'] || Date.now().toString().slice(-8)),
            category: row['Category'] || row['category'] || row['หมวดหมู่'] || row['အမျိုးအစား'] || '',
            unit: row['Unit'] || row['unit'] || row['หน่วยนับ'] || row['ယူနစ်'] || '',
            costPrice: Number(row['Cost Price (฿)'] || row['Cost Price'] || row['costPrice'] || row['ราคาทุน'] || row['ရင်းဈေး'] || 0),
            price: Number(row['Selling Price (฿)'] || row['Selling Price'] || row['Price'] || row['price'] || row['ราคาขาย'] || row['ရောင်းဈေး'] || 0),
            stock: Number(row['Stock Remaining'] || row['Stock'] || row['stock'] || row['คงเหลือ'] || row['လက်ကျန်'] || 0),
            minStock: Number(row['Min Stock'] || row['minStock'] || row['จำหน่วยขั้นต้ำ'] || row['အနည်းဆုံးသတ်မှတ်ချက်'] || 5),
            expiryDate: row['Expiry Date'] || row['expiryDate'] || row['วันหมดอายุ'] || row['သက်တမ်းကုန်ဆုံးရက်'] || '',
            description: row['Description'] || row['description'] || '',
            imageUrl: row['Image URL'] || row['imageUrl'] || ''
          };
        }).filter((item: any) => item.name);

        setImportRows(normalized);
      } catch (err) {
        console.error('File parsing error:', err);
        alert('Could not parse file. Please upload a valid CSV or XLSX file.');
      }
    };
    reader.readAsBinaryString(file);
  };

  // Commit batch import to Firestore
  const handleConfirmImport = async () => {
    if (importRows.length === 0) return;
    setIsImporting(true);
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();

      for (const row of importRows) {
        const docRef = doc(collection(db, 'products'));
        batch.set(docRef, {
          name: row.name,
          barcode: row.barcode,
          category: row.category || '',
          unit: row.unit || '',
          costPrice: row.costPrice || 0,
          price: row.price || 0,
          stock: row.stock || 0,
          minStock: row.minStock || 5,
          expiryDate: row.expiryDate || null,
          description: row.description || '',
          imageUrl: row.imageUrl || null,
          createdAt: now,
          updatedAt: now
        });
      }

      await batch.commit();
      setIsImportModalOpen(false);
      setImportRows([]);
      if (importFileRef.current) importFileRef.current.value = '';
    } catch (err) {
      console.error('Batch import failed:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Action Buttons */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('inventory')}</h2>
          <p className="text-slate-500 text-sm">{t('manage_inventory') || 'Manage product stock and details.'}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => {
              setSelectedProductForDamage(null);
              setIsDamageModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-rose-200 text-rose-700 font-bold text-xs rounded-xl hover:bg-rose-50 transition-colors shadow-xs cursor-pointer"
            title="Record Waste / Damage"
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>{t('record_damage')}</span>
          </button>
          <button
            onClick={() => setIsBarcodeLabelsOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-xs cursor-pointer"
            title="Print Barcode Labels"
          >
            <Tag className="w-4 h-4 text-amber-600" />
            <span>{t('barcode_labels')}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            title="Export CSV"
          >
            <FileDown className="w-4 h-4 text-emerald-600" />
            <span>{t('export_csv')}</span>
          </button>
          <button
            onClick={() => { setImportRows([]); setIsImportModalOpen(true); }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
            title="Import CSV"
          >
            <FileUp className="w-4 h-4 text-indigo-600" />
            <span>{t('import_csv')}</span>
          </button>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-slate-200 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Scan className="w-4 h-4" />
            <span>{t('scan_barcode')}</span>
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData(initialFormData);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-md shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            <span>{t('add_product')}</span>
          </button>
        </div>
      </div>

      {/* Search & Smart Filters Bar */}
      <div className="flex flex-col md:flex-row gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder={t('search_placeholder')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
          />
        </div>

        {/* Category Dropdown */}
        {categories.length > 0 && (
          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer"
            >
              <option value="all">{t('all_categories')} ({products.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        )}
        
        {/* Status Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          <button
            onClick={() => setFilterType('all')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
              filterType === 'all'
                ? "bg-slate-900 text-white shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            )}
          >
            All ({products.length})
          </button>
          <button
            onClick={() => setFilterType('low_stock')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
              filterType === 'low_stock'
                ? "bg-rose-600 text-white shadow-xs"
                : "bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200/50"
            )}
          >
            <AlertCircle className="w-3.5 h-3.5" />
            <span>{t('low_stock')}</span>
            {lowStockCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                filterType === 'low_stock' ? "bg-white text-rose-600" : "bg-rose-600 text-white"
              )}>
                {lowStockCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setFilterType('expiring')}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
              filterType === 'expiring'
                ? "bg-amber-600 text-white shadow-xs"
                : "bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/50"
            )}
          >
            <Calendar className="w-3.5 h-3.5" />
            <span>{t('expiring_soon')}</span>
            {expiringCount > 0 && (
              <span className={cn(
                "px-1.5 py-0.2 rounded-full text-[10px] font-black",
                filterType === 'expiring' ? "bg-white text-amber-600" : "bg-amber-600 text-white"
              )}>
                {expiringCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 10-Column Grocery Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[980px]">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-100 text-slate-600 text-xs uppercase tracking-wider">
                <th className="px-4 py-3.5 font-bold">{t('photo')}</th>
                <th className="px-4 py-3.5 font-bold">{t('barcode')}</th>
                <th className="px-4 py-3.5 font-bold">{t('item_name')}</th>
                <th className="px-4 py-3.5 font-bold">{t('expiry_date')}</th>
                <th className="px-4 py-3.5 font-bold">{t('purchase_price')}</th>
                <th className="px-4 py-3.5 font-bold">{t('selling_price')}</th>
                <th className="px-4 py-3.5 font-bold">{t('category_header')}</th>
                <th className="px-4 py-3.5 font-bold">{t('stock_remaining')}</th>
                <th className="px-4 py-3.5 font-bold">{t('min_stock')}</th>
                <th className="px-4 py-3.5 font-bold text-right">{t('actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-300" />
                  </td>
                </tr>
              ) : filteredProducts.map((product) => {
                const minThreshold = product.minStock ?? 5;
                const expInfo = getExpiryStatus(product.expiryDate);

                return (
                  <tr key={product.id} className="hover:bg-slate-50/60 transition-colors group">
                    {/* 1. Photo */}
                    <td className="px-4 py-3">
                      <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200 shadow-xs">
                        <ProductImage src={product.imageUrl} name={product.name} />
                      </div>
                    </td>

                    {/* 2. Barcode */}
                    <td className="px-4 py-3 text-sm font-mono font-medium text-slate-600 whitespace-nowrap">
                      {product.barcode}
                    </td>

                    {/* 3. Item Name */}
                    <td className="px-4 py-3">
                      <div className="min-w-[140px] max-w-[220px]">
                        <p className="font-semibold text-slate-900 leading-snug">{product.name}</p>
                        {product.description && (
                          <p className="text-xs text-slate-400 line-clamp-1 mt-0.5">{product.description}</p>
                        )}
                      </div>
                    </td>

                    {/* 4. วันหมดอายุ (Expiry Date) */}
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {product.expiryDate ? (
                        expInfo?.status === 'expired' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertCircle className="w-3.5 h-3.5" />
                            {product.expiryDate} ({t('expired')})
                          </span>
                        ) : expInfo?.status === 'expiring_soon' ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                            <Calendar className="w-3.5 h-3.5" />
                            {product.expiryDate} ({expInfo.days}d)
                          </span>
                        ) : (
                          <span className="font-mono text-slate-600 font-medium">{product.expiryDate}</span>
                        )
                      ) : (
                        <span className="text-slate-300 font-mono">-</span>
                      )}
                    </td>

                    {/* 5. ราคาซื้อ (Purchase Price) */}
                    <td className="px-4 py-3 text-sm font-medium text-slate-600 tabular-nums whitespace-nowrap">
                      ฿{(product.costPrice ?? 0).toLocaleString()}
                    </td>

                    {/* 6. ราคาขาย (Selling Price) */}
                    <td className="px-4 py-3 text-sm font-bold text-slate-900 tabular-nums whitespace-nowrap">
                      ฿{product.price.toLocaleString()}
                    </td>

                    {/* 7. Category */}
                    <td className="px-4 py-3 text-sm whitespace-nowrap">
                      {product.category ? (
                        <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200/60">
                          {product.category}
                        </span>
                      ) : (
                        <span className="text-slate-300">-</span>
                      )}
                    </td>

                    {/* 8. จำหน่วยสิ้นค้าคงเหลือ (Stock Remaining) with Quick Restock (+10, +50) */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold tabular-nums border",
                          product.stock <= minThreshold 
                            ? "bg-rose-50 text-rose-700 border-rose-200" 
                            : product.stock <= minThreshold * 1.5
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        )}>
                          {product.stock}
                        </span>
                        {product.unit && <span className="text-xs text-slate-400 font-medium">{product.unit}</span>}
                        
                        {/* Quick Restock Buttons */}
                        <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 ml-1 transition-opacity">
                          <button
                            type="button"
                            disabled={quickRestockingId === product.id}
                            onClick={() => handleQuickRestock(product, 10)}
                            className="px-1.5 py-0.5 text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200/60 transition-all active:scale-95 disabled:opacity-50"
                            title="Quick Restock +10"
                          >
                            +10
                          </button>
                          <button
                            type="button"
                            disabled={quickRestockingId === product.id}
                            onClick={() => handleQuickRestock(product, 50)}
                            className="px-1.5 py-0.5 text-[10px] font-black bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded border border-indigo-200/60 transition-all active:scale-95 disabled:opacity-50"
                            title="Quick Restock +50"
                          >
                            +50
                          </button>
                        </div>
                      </div>
                    </td>

                    {/* 9. จำหน่วยขั้นต้ำ (Min Stock) */}
                    <td className="px-4 py-3 text-sm font-medium text-slate-600 tabular-nums whitespace-nowrap">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-xs font-semibold">
                        {minThreshold}
                      </span>
                      {product.unit && <span className="ml-1 text-xs text-slate-400">{product.unit}</span>}
                    </td>

                    {/* 10. Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1.5 opacity-90 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedProductForDamage(product);
                            setIsDamageModalOpen(true);
                          }}
                          className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                          title="Record Waste / Damage Write-Off"
                        >
                          <AlertTriangle className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(product)}
                          className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                          title={t('edit_product')}
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        {role === 'admin' && (
                          <button
                            type="button"
                            onClick={() => handleDelete(product.id)}
                            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-slate-400 italic">
                    {t('no_products_found')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CSV / Excel Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{t('import_csv')}</h3>
                  <p className="text-xs text-slate-500">Upload .csv or .xlsx to bulk add/update inventory</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 space-y-4 overflow-y-auto">
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-6 text-center hover:border-indigo-400 transition-colors bg-slate-50/50">
                  <input
                    ref={importFileRef}
                    type="file"
                    accept=".csv, .xlsx, .xls"
                    onChange={handleFileSelect}
                    className="hidden"
                    id="csv-file-input"
                  />
                  <label htmlFor="csv-file-input" className="cursor-pointer flex flex-col items-center">
                    <Upload className="w-10 h-10 text-indigo-500 mb-2" />
                    <span className="font-bold text-slate-900 text-sm">{t('upload_file')}</span>
                    <span className="text-xs text-slate-400 mt-1">Columns: Product Name, Barcode, Price, Cost Price, Stock, Category, Expiry Date</span>
                  </label>
                </div>

                {importRows.length > 0 && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-700">{t('import_preview')} ({importRows.length} items)</span>
                      <span className="text-xs text-emerald-600 font-bold">Ready to import</span>
                    </div>
                    <div className="border border-slate-200 rounded-xl overflow-x-auto max-h-56">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase">
                          <tr>
                            <th className="px-3 py-2">Barcode</th>
                            <th className="px-3 py-2">Name</th>
                            <th className="px-3 py-2">Category</th>
                            <th className="px-3 py-2">Price</th>
                            <th className="px-3 py-2">Stock</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {importRows.slice(0, 10).map((r, i) => (
                            <tr key={i} className="hover:bg-slate-50">
                              <td className="px-3 py-2 font-mono text-slate-600">{r.barcode}</td>
                              <td className="px-3 py-2 font-semibold text-slate-900">{r.name}</td>
                              <td className="px-3 py-2 text-slate-500">{r.category || '-'}</td>
                              <td className="px-3 py-2 tabular-nums">฿{r.price}</td>
                              <td className="px-3 py-2 tabular-nums">{r.stock}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {importRows.length > 10 && (
                      <p className="text-[11px] text-slate-400 text-right mt-1">+ {importRows.length - 10} more items</p>
                    )}
                  </div>
                )}
              </div>

              <div className="p-5 border-t border-slate-100 bg-white flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={importRows.length === 0 || isImporting}
                  onClick={handleConfirmImport}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                >
                  {isImporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                  <span>{isImporting ? t('importing') : t('confirm_import')}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Add / Edit Product Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]"
            >
              <div className="p-5 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
                <h3 className="text-xl font-bold text-slate-900">{editingProduct ? t('edit_product') : t('add_product')}</h3>
                <button 
                  onClick={() => setIsModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSave} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <div className="p-5 sm:p-6 space-y-4 overflow-y-auto flex-1 overscroll-contain">
                  <div className="grid grid-cols-1 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('product_name')}</label>
                      <input
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('barcode')}</label>
                      <div className="flex gap-2">
                        <input
                          required
                          type="text"
                          value={formData.barcode}
                          onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 font-mono"
                        />
                        <button
                          type="button"
                          onClick={() => setIsScannerOpen(true)}
                          className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                        >
                          <Scan className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('category')}</label>
                        <input
                          type="text"
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('unit')}</label>
                        <input
                          type="text"
                          value={formData.unit}
                          onChange={(e) => setFormData({...formData, unit: e.target.value})}
                          placeholder="e.g. pcs, box, kg"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('selling_price')} (฿)</label>
                        <input
                          required
                          type="number"
                          value={formData.price}
                          onChange={(e) => setFormData({...formData, price: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('purchase_price')} (฿)</label>
                        <input
                          required
                          type="number"
                          value={formData.costPrice}
                          onChange={(e) => setFormData({...formData, costPrice: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('stock_remaining')}</label>
                        <input
                          required
                          type="number"
                          value={formData.stock}
                          onChange={(e) => setFormData({...formData, stock: e.target.value})}
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('min_stock')}</label>
                        <input
                          type="number"
                          value={formData.minStock}
                          onChange={(e) => setFormData({...formData, minStock: e.target.value})}
                          placeholder="e.g. 5"
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('expiry_date')}</label>
                      <input
                        type="date"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({...formData, expiryDate: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('image')}</label>
                      <div className="space-y-3">
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={formData.imageUrl}
                            onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                            placeholder="Image URL (https://...)"
                            className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 text-sm"
                          />
                          <ImageCapture onCapture={(url) => setFormData({...formData, imageUrl: url})} />
                        </div>
                        {formData.imageUrl && (
                          <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200 shadow-xs">
                            <img src={formData.imageUrl} className="w-full h-full object-cover" />
                            <button 
                              type="button" 
                              onClick={() => setFormData({...formData, imageUrl: ''})}
                              className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">{t('description')}</label>
                      <textarea
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        rows={2}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none text-slate-900 text-sm"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 p-4 sm:p-6 border-t border-slate-100 bg-white shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    {t('cancel')}
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                  >
                    {editingProduct ? t('update') || 'Update' : t('add') || 'Add'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {isScannerOpen && (
        <BarcodeScanner
          onScan={(code) => {
            setFormData(prev => ({ ...prev, barcode: code }));
            setIsScannerOpen(false);
          }}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Barcode Sticker Labels Sheet Modal */}
      <BarcodeLabelsModal
        products={products}
        isOpen={isBarcodeLabelsOpen}
        onClose={() => setIsBarcodeLabelsOpen(false)}
      />

      {/* Damage & Expiry Waste Modal */}
      {user && (
        <DamageWasteModal
          isOpen={isDamageModalOpen}
          onClose={() => {
            setIsDamageModalOpen(false);
            setSelectedProductForDamage(null);
          }}
          products={products}
          user={user}
          preSelectedProduct={selectedProductForDamage}
        />
      )}
    </div>
  );
}

function ProductImage({ src, name }: { src?: string | null, name: string }) {
  const [error, setError] = useState(false);
  
  if (!src || error) {
    return <ImageIcon className="w-5 h-5 text-slate-400" />;
  }

  return (
    <img 
      src={src} 
      alt={name} 
      className="w-full h-full object-cover" 
      onError={() => setError(true)}
    />
  );
}

function ImageCapture({ onCapture }: { onCapture: (url: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const { t } = useLanguage();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
          onCapture(dataUrl);
        };
        img.src = event.target?.result as string;
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        ref={inputRef}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors flex items-center gap-2 h-full px-4"
      >
        <Camera className="w-5 h-5" />
        <span className="text-sm font-bold">{t('capture') || 'Capture'}</span>
      </button>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
