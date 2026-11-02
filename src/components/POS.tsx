import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  getDocs, 
  getDoc,
  onSnapshot,
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
  Package,
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
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);

  // Fetch all products for the menu
  useEffect(() => {
    const q = query(collection(db, 'products'), limit(50));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => prods.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      setLoadingProducts(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (search.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const results = products.filter(p => 
      p.name.toLowerCase().includes(search.toLowerCase()) || 
      p.barcode.includes(search)
    );
    setSearchResults(results.slice(0, 5));
  }, [search, products]);

  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert("This product is out of stock.");
      return;
    }

    setCart(prev => {
      const existing = prev.find(item => item.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) {
          alert("Cannot add more than available stock.");
          return prev;
        }
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
    const product = products.find(p => p.id === productId);
    setCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const newQty = Math.max(1, item.quantity + delta);
        if (product && newQty > product.stock) {
          alert("Cannot exceed available stock.");
          return item;
        }
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
        const product = products.find(p => p.id === item.productId);
        if (product) {
          batch.update(productRef, {
            stock: Math.max(0, product.stock - item.quantity),
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
    const product = products.find(p => p.barcode === code);
    if (product) {
      addToCart(product);
    } else {
      alert("Product not found: " + code);
    }
  };

  return (
    <div className="flex flex-col lg:flex-row gap-8 h-full min-h-0">
      {/* Left Column: Product Menu & Search */}
      <div className="flex-1 flex flex-col gap-6 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Point of Sale</h2>
            <p className="text-slate-500 text-sm">Select items or scan to checkout.</p>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center justify-center gap-2 px-6 py-3 bg-indigo-600 text-white font-black rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap"
          >
            <Scan className="w-5 h-5" />
            Scan Barcode
          </button>
        </div>

        <div className="relative shrink-0">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            placeholder="Search product name or barcode..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-base focus:ring-2 focus:ring-indigo-500 outline-none shadow-sm transition-all"
          />
        </div>

        {/* Product Gallery */}
        <div className="flex-1 overflow-y-auto pr-2 pb-4 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {loadingProducts ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-white rounded-3xl border border-slate-100 animate-pulse" />
              ))
            ) : products.map((p) => (
              <button
                key={p.id}
                onClick={() => addToCart(p)}
                className="group relative flex flex-col bg-white rounded-3xl border border-slate-200 overflow-hidden hover:border-indigo-500 hover:shadow-xl hover:shadow-indigo-500/5 transition-all active:scale-95 text-left"
              >
                <div className="aspect-square bg-slate-50 relative overflow-hidden">
                  {p.imageUrl ? (
                    <img src={p.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <ShoppingBag className="w-8 h-8 text-slate-200" />
                    </div>
                  )}
                  {p.stock <= 0 && (
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="bg-white text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">Out of Stock</span>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <p className="font-bold text-slate-900 text-sm line-clamp-1 leading-tight mb-1">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-indigo-600 font-black text-base">฿{p.price.toLocaleString()}</p>
                    <p className={cn("text-[10px] font-bold", p.stock < 10 ? "text-rose-500" : "text-slate-400")}>{p.stock} left</p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
            {!loadingProducts && products.length === 0 && (
              <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500 font-medium">No products found in inventory.</p>
                <p className="text-sm text-slate-400">Add some items in the Inventory tab first.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right Column: Checkout & Summary */}
      <div className="w-full lg:w-[400px] flex flex-col gap-6 shrink-0 min-h-0">
        <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
            <div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">Current Cart</span>
              <h3 className="text-slate-900 font-bold">{cart.length} items selected</h3>
            </div>
            <button 
              onClick={() => setCart([])}
              className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              Clear All
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-slate-200">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-4 p-4 border-b border-slate-50 hover:bg-slate-50/30 transition-colors group">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-400 font-medium">฿{item.price.toLocaleString()} per unit</p>
                </div>
                <div className="flex items-center gap-2 bg-slate-100 rounded-2xl p-1 shrink-0">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-2 text-slate-600 hover:text-indigo-600 transition-colors"><Minus className="w-4 h-4" /></button>
                  <span className="font-black text-slate-900 w-6 text-center tabular-nums text-sm">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-2 text-slate-600 hover:text-indigo-600 transition-colors"><Plus className="w-4 h-4" /></button>
                </div>
                <div className="w-20 text-right shrink-0">
                  <p className="font-black text-slate-900 tabular-nums">฿{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="p-2 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-20">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6">
                  <ShoppingBag className="w-12 h-12 opacity-20" />
                </div>
                <p className="font-bold text-slate-900">Your cart is empty</p>
                <p className="text-sm text-slate-400 mt-1">Select items from the gallery to begin</p>
              </div>
            )}
          </div>

          <div className="p-6 bg-slate-50 border-t border-slate-100 shrink-0">
            <div className="space-y-4 mb-6">
              <div className="flex justify-between text-sm text-slate-500 font-medium">
                <span>Subtotal</span>
                <span className="tabular-nums">฿{total.toLocaleString()}</span>
              </div>
              <div className="flex justify-between text-xl font-black text-slate-900">
                <span>Total Amount</span>
                <span className="tabular-nums">฿{total.toLocaleString()}</span>
              </div>
            </div>

            <button
              disabled={cart.length === 0 || isProcessing}
              onClick={handleCheckout}
              className="w-full py-5 bg-indigo-600 text-white font-black text-lg rounded-[24px] shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              {isProcessing ? <Loader2 className="animate-spin" /> : <CreditCard />}
              {isProcessing ? 'Processing Payment...' : 'Complete Checkout'}
            </button>
          </div>
        </div>

        {/* Staff Card */}
        <div className="bg-slate-900 text-white rounded-[32px] p-6 relative overflow-hidden shrink-0">
          <div className="relative z-10 flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-[20px] backdrop-blur-md">
              <UserIcon className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mb-0.5">Active Staff</p>
              <p className="font-bold text-sm truncate max-w-[200px]">{user.displayName}</p>
            </div>
          </div>
          <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
            <ShoppingBag className="w-32 h-32 rotate-12" />
          </div>
        </div>

        <AnimatePresence>
          {showSuccess && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              className="fixed bottom-8 right-8 z-[200] bg-emerald-500 text-white px-8 py-6 rounded-[32px] flex items-center gap-4 shadow-2xl shadow-emerald-500/20"
            >
              <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <p className="font-black text-lg">Transaction Complete!</p>
                <p className="text-sm text-emerald-50 opacity-90">Stock updated automatically.</p>
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

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(' ');
}
