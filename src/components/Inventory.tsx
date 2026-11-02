import React, { useState, useEffect } from 'react';
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
  where
} from 'firebase/firestore';
import { 
  Plus, 
  Search, 
  Scan, 
  Edit2, 
  Trash2, 
  MoreVertical,
  Filter,
  Image as ImageIcon,
  Loader2,
  X,
  Camera
} from 'lucide-react';
import { Product } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';

interface InventoryProps {
  role: 'admin' | 'staff' | null;
}

export function Inventory({ role }: InventoryProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    price: '',
    stock: '',
    description: '',
    imageUrl: ''
  });

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

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || 
    p.barcode.includes(search)
  );

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const id = editingProduct?.id || doc(collection(db, 'products')).id;
    const now = serverTimestamp();
    
    const payload = {
      name: formData.name,
      barcode: formData.barcode,
      price: Number(formData.price),
      stock: Number(formData.stock),
      description: formData.description,
      imageUrl: formData.imageUrl || null,
      createdAt: editingProduct ? editingProduct.createdAt : now,
      updatedAt: now
    };

    try {
      await setDoc(doc(db, 'products', id), payload);
      setIsModalOpen(false);
      setEditingProduct(null);
      setFormData({ name: '', barcode: '', price: '', stock: '', description: '', imageUrl: '' });
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
      stock: product.stock.toString(),
      description: product.description || '',
      imageUrl: product.imageUrl || ''
    });
    setIsModalOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
          <p className="text-slate-500">Manage your product stock and details.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <Scan className="w-4 h-4" />
            Scan
          </button>
          <button
            onClick={() => {
              setEditingProduct(null);
              setFormData({ name: '', barcode: '', price: '', stock: '', description: '', imageUrl: '' });
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white font-medium rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
          >
            <Plus className="w-4 h-4" />
            Add Product
          </button>
        </div>
      </div>

      <div className="flex gap-4 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border-none rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
          />
        </div>
        <button className="p-2 bg-slate-50 rounded-xl text-slate-500 hover:text-indigo-600 transition-colors">
          <Filter className="w-5 h-5" />
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 text-xs uppercase tracking-wider">
                <th className="px-6 py-4 font-semibold">Product</th>
                <th className="px-6 py-4 font-semibold">Barcode</th>
                <th className="px-6 py-4 font-semibold">Price</th>
                <th className="px-6 py-4 font-semibold">Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto text-slate-200" />
                  </td>
                </tr>
              ) : filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 overflow-hidden border border-slate-200">
                        <ProductImage src={product.imageUrl} name={product.name} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">{product.name}</p>
                        <p className="text-xs text-slate-500 line-clamp-1">{product.description || 'No description'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm font-mono text-slate-500">{product.barcode}</td>
                  <td className="px-6 py-4 text-sm font-bold text-slate-900 tabular-nums">฿{product.price.toLocaleString()}</td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2 py-1 rounded text-xs font-bold tabular-nums",
                      product.stock < 5 ? "bg-rose-50 text-rose-600" : 
                      product.stock < 10 ? "bg-amber-50 text-amber-600" : 
                      "bg-emerald-50 text-emerald-600"
                    )}>
                      {product.stock}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => openEdit(product)}
                        className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      {role === 'admin' && (
                        <button
                          onClick={() => handleDelete(product.id)}
                          className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredProducts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                    No products found matching your search.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">{editingProduct ? 'Edit Product' : 'Add New Product'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><X /></button>
              </div>
              <form onSubmit={handleSave} className="p-6 space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Product Name</label>
                    <input
                      required
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Barcode</label>
                    <div className="flex gap-2">
                      <input
                        required
                        type="text"
                        value={formData.barcode}
                        onChange={(e) => setFormData({...formData, barcode: e.target.value})}
                        className="flex-1 px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setIsScannerOpen(true)}
                        className="p-2 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-100 transition-colors"
                      >
                        <Scan className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Price (฿)</label>
                      <input
                        required
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Stock</label>
                      <input
                        required
                        type="number"
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: e.target.value})}
                        className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Image</label>
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={formData.imageUrl}
                          onChange={(e) => setFormData({...formData, imageUrl: e.target.value})}
                          placeholder="Image URL (https://...)"
                          className="flex-1 px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                        <ImageCapture onCapture={(url) => setFormData({...formData, imageUrl: url})} />
                      </div>
                      {formData.imageUrl && (
                        <div className="relative w-20 h-20 rounded-xl overflow-hidden border border-slate-200">
                          <img src={formData.imageUrl} className="w-full h-full object-cover" />
                          <button 
                            type="button" 
                            onClick={() => setFormData({...formData, imageUrl: ''})}
                            className="absolute top-1 right-1 p-1 bg-black/50 text-white rounded-full hover:bg-black/70"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Description</label>
                    <textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      rows={3}
                      className="w-full px-4 py-2 bg-slate-50 border-none rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 font-bold rounded-xl hover:bg-slate-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 px-4 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-100"
                  >
                    {editingProduct ? 'Update Product' : 'Add Product'}
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Resize image to keep base64 small
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
        <span className="text-sm font-bold">Capture</span>
      </button>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
