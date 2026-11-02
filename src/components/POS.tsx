import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  getDoc,
  doc, 
  setDoc, 
  writeBatch,
  serverTimestamp,
  where,
  limit
} from 'firebase/firestore';
import { 
  Search, 
  Scan, 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingBag,
  CreditCard,
  User as UserIcon,
  CheckCircle2,
  Loader2
} from 'lucide-react';
import { Product, SaleItem } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';

interface POSProps {
  user: User;
}

export function POS({ user }: POSProps) {
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    
    async function performSearch() {
      const q = query(
        collection(db, 'products'),
        where('name', '>=', search),
        where('name', '<=', search + '\uf8ff'),
        limit(5)
      );
      const snap = await getDocs(q);
      const results: Product[] = [];
      snap.forEach(doc => results.push({ id: doc.id, ...doc.data() } as Product));
      setSearchResults(results);
    }

    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        return prev.map(item => 
          item.productId === product.id 
            ? { ...item, quantity: item.quantity + 1 } 
            : item
        );
      }
      return [...prev, {
        productId: product.id,
        name: product.name,
        price: product.price,
        quantity: 1
      }];
    });
    setSearch('');
    setSearchResults([]);
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }));
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.productId !== productId));
  };

  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(db);
      const saleId = doc(collection(db, 'sales')).id;
      const saleRef = doc(db, 'sales', saleId);
      
      const now = serverTimestamp();
      
      batch.set(saleRef, {
        items: cart,
        total,
        staffId: user.uid,
        createdAt: now
      });

      // Update stock
      for (const item of cart) {
        const productRef = doc(db, 'products', item.productId);
        const productSnap = await getDoc(productRef);
        if (productSnap.exists()) {
          const currentStock = productSnap.data().stock;
          batch.update(productRef, {
            stock: Math.max(0, currentStock - item.quantity),
            updatedAt: now
          });
        }
      }

      await batch.commit();
      setShowSuccess(true);
      setCart([]);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'sales');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleScan = async (code: string) => {
    setIsScannerOpen(false);
    const q = query(collection(db, 'products'), where('barcode', '==', code), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) {
      addToCart({ id: snap.docs[0].id, ...snap.docs[0].data() } as Product);
    } else {
      alert("Product not found: " + code);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-0">
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Point of Sale</h2>
            <p className="text-slate-500">Scan or search items to checkout.</p>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100"
          >
            <Scan className="w-5 h-5" />
            Scan Barcode
          </button>
        </div>

        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-400" />
          <input
            type="text"
            placeholder="Search product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-lg focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm"
          />
          
          <AnimatePresence>
            {searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-xl border border-slate-200 z-10 overflow-hidden"
              >
                {searchResults.map(p => (
                  <button
                    key={p.id}
                    onClick={() => addToCart(p)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-slate-50 text-left border-b border-slate-100 last:border-0"
                  >
                    <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center border border-slate-200">
                      {p.imageUrl ? <img src={p.imageUrl} className="w-full h-full object-cover rounded-lg" /> : <ShoppingBag className="w-6 h-6 text-slate-300" />}
                    </div>
                    <div className="flex-1">
                      <p className="font-bold text-slate-900">{p.name}</p>
                      <p className="text-sm text-slate-500">฿{p.price.toLocaleString()} · {p.stock} in stock</p>
                    </div>
                    <Plus className="w-5 h-5 text-indigo-600" />
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Cart Items</span>
            <span className="text-sm text-slate-500">{cart.length} items</span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                <div className="flex-1">
                  <p className="font-bold text-slate-900">{item.name}</p>
                  <p className="text-sm text-slate-500">฿{item.price.toLocaleString()} each</p>
                </div>
                <div className="flex items-center gap-3">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"><Minus className="w-4 h-4" /></button>
                  <span className="font-bold text-lg w-8 text-center tabular-nums">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-2 bg-slate-100 rounded-lg text-slate-600 hover:bg-slate-200"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="w-24 text-right">
                  <p className="font-bold text-slate-900 tabular-nums">฿{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20">
                <ShoppingBag className="w-16 h-16 mb-4 opacity-20" />
                <p className="font-medium text-lg">Your cart is empty</p>
                <p className="text-sm">Scan items to start checkout</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-lg p-6 space-y-6">
          <h3 className="font-bold text-slate-900 text-lg border-b border-slate-100 pb-4">Checkout Summary</h3>
          
          <div className="space-y-3">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal</span>
              <span className="tabular-nums font-medium">฿{total.toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>Tax (0%)</span>
              <span className="tabular-nums font-medium">฿0</span>
            </div>
            <div className="border-t border-slate-100 pt-3 flex justify-between text-xl font-black text-slate-900">
              <span>Total</span>
              <span className="tabular-nums">฿{total.toLocaleString()}</span>
            </div>
          </div>

          <div className="space-y-3">
            <button
              disabled={cart.length === 0 || isProcessing}
              onClick={handleCheckout}
              className="w-full py-4 bg-indigo-600 text-white font-black text-lg rounded-2xl shadow-lg shadow-indigo-100 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CreditCard />}
              {isProcessing ? 'Processing...' : 'Complete Payment'}
            </button>
            <button
              onClick={() => setCart([])}
              className="w-full py-3 text-slate-500 font-semibold hover:bg-slate-50 rounded-xl transition-colors"
            >
              Clear Order
            </button>
          </div>
        </div>

        <div className="bg-slate-900 text-white rounded-2xl p-6 relative overflow-hidden">
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-xl">
              <UserIcon className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">Active Staff</p>
              <p className="font-bold">{user.displayName}</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10">
            <ShoppingBag className="w-24 h-24 rotate-12" />
          </div>
        </div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="bg-emerald-500 text-white p-4 rounded-2xl flex items-center gap-3 shadow-lg shadow-emerald-100"
            >
              <CheckCircle2 className="w-8 h-8" />
              <div>
                <p className="font-bold">Payment Successful!</p>
                <p className="text-sm text-emerald-50 opacity-90">Transaction recorded.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {isScannerOpen && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}
    </div>
  );
}
