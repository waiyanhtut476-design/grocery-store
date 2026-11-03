import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  doc, 
  writeBatch,
  serverTimestamp,
  limit,
  orderBy,
  where
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
  Loader2,
  Banknote,
  QrCode,
  Tag,
  X,
  Receipt,
  Users,
  Award,
  BookOpen,
  Sparkles,
  Filter,
  Wand2,
  Layers,
  Check
} from 'lucide-react';
import { Product, SaleItem, Sale, Customer, StoreSettings, Shift } from '../types';
import { BarcodeScanner } from './BarcodeScanner';
import { ReceiptModal } from './ReceiptModal';
import { motion, AnimatePresence } from 'motion/react';
import { User } from 'firebase/auth';
import { useLanguage } from '../lib/i18n';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from '../lib/storeSettings';
import { cacheProductsLocally, getCachedProducts, queueOfflineSale } from '../lib/offlineCache';
import { logActivity } from '../lib/audit';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface POSProps {
  user: User;
}

export function POS({ user }: POSProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [showMobileCart, setShowMobileCart] = useState(false);
  const { t } = useLanguage();

  // Unique categories list from products
  const productCategories = Array.from(
    new Set(
      products
        .map(p => p.category?.trim())
        .filter((c): c is string => Boolean(c && c.length > 0))
    )
  );
  const uncategorizedCount = products.filter(p => !p.category || p.category.trim() === '').length;

  // Category Management & Auto-Categorization States
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [isAutoCategorizing, setIsAutoCategorizing] = useState(false);
  const [categoryModalSearch, setCategoryModalSearch] = useState('');
  const [categorizeToast, setCategorizeToast] = useState<string | null>(null);

  // Quick assign category to product
  const handleAssignCategory = async (productId: string, categoryName: string) => {
    try {
      const docRef = doc(db, 'products', productId);
      const batch = writeBatch(db);
      batch.update(docRef, { 
        category: categoryName.trim(), 
        updatedAt: serverTimestamp() 
      });
      await batch.commit();
      setCategorizeToast(`Updated to "${categoryName}"`);
      setTimeout(() => setCategorizeToast(null), 2500);
    } catch (err) {
      console.error('Error updating category:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products/' + productId);
    }
  };

  // Smart auto-categorize all products based on names & keywords
  const handleAutoCategorize = async () => {
    setIsAutoCategorizing(true);
    try {
      const batch = writeBatch(db);
      let updatedCount = 0;

      products.forEach(p => {
        const nameLower = (p.name || '').toLowerCase();
        let targetCategory = '';

        if (nameLower.includes('มาม่า') || nameLower.includes('ม่า') || nameLower.includes('ခေါက်ဆွဲ') || nameLower.includes('โจ๊ก') || nameLower.includes('noodle') || nameLower.includes('food')) {
          targetCategory = 'Food / ခေါက်ဆွဲ';
        } else if (nameLower.includes('namthip') || nameLower.includes('น้ำ') || nameLower.includes('water') || nameLower.includes('vitamilk') || nameLower.includes('milk') || nameLower.includes('drink') || nameLower.includes('အအေး')) {
          targetCategory = 'Drinks / အအေး';
        } else if (nameLower.includes('ยาดม') || nameLower.includes('hong') || nameLower.includes('thai') || nameLower.includes('ဆေး') || nameLower.includes('inhaler') || nameLower.includes('balm')) {
          targetCategory = 'Health / ဆေးဝါး';
        } else if (nameLower.includes('สามแม่ครัว') || nameLower.includes('ครัว') || nameLower.includes('canned') || nameLower.includes('fish') || nameLower.includes('ငါးသေတ္တာ')) {
          targetCategory = 'Canned / စည်သွပ်ဘူး';
        } else if (nameLower.includes('cooling') || nameLower.includes('play') || nameLower.includes('candy') || nameLower.includes('snack') || nameLower.includes('မုန့်')) {
          targetCategory = 'Snacks / မုန့်မျိုးစုံ';
        } else if (!p.category || p.category.trim() === '') {
          targetCategory = 'General / အထွေထွေ';
        }

        if (targetCategory && p.category !== targetCategory) {
          const docRef = doc(db, 'products', p.id);
          batch.update(docRef, { category: targetCategory, updatedAt: serverTimestamp() });
          updatedCount++;
        }
      });

      if (updatedCount > 0) {
        await batch.commit();
        setCategorizeToast(`အမျိုးအစား (${updatedCount}) ခု အလိုအလျောက် ခွဲခြားပြီးပါပြီ!`);
        
        logActivity(
          'Auto Categorize',
          'product',
          `Automatically categorized ${updatedCount} products into smart categories.`
        );
      } else {
        setCategorizeToast('ပစ္စည်းအားလုံး အမျိုးအစား သတ်မှတ်ပြီးဖြစ်ပါသည်');
      }
      setTimeout(() => setCategorizeToast(null), 3000);
    } catch (err) {
      console.error('Error auto-categorizing:', err);
      handleFirestoreError(err, OperationType.WRITE, 'products');
    } finally {
      setIsAutoCategorizing(false);
    }
  };

  // Settings
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  // Active Shift State
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Customer Loyalty & Credit State
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [redeemPoints, setRedeemPoints] = useState(false);

  // Discount State
  const [discountType, setDiscountType] = useState<'none' | 'percent' | 'amount'>('none');
  const [discountValue, setDiscountValue] = useState<number>(0);

  // Payment Checkout Modal State
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'qr' | 'card' | 'credit'>('cash');
  const [cashReceived, setCashReceived] = useState<number>(0);

  // Receipt Modal State
  const [completedSale, setCompletedSale] = useState<Sale | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);

  // Fetch products with offline caching support
  useEffect(() => {
    const cached = getCachedProducts();
    if (cached.length > 0) {
      setProducts(cached);
      setLoadingProducts(false);
    }

    const q = query(collection(db, 'products'), limit(80));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const prods: Product[] = [];
      snapshot.forEach(doc => prods.push({ id: doc.id, ...doc.data() } as Product));
      setProducts(prods);
      cacheProductsLocally(prods);
      setLoadingProducts(false);
    }, (error) => {
      console.warn("Offline or error loading products in POS, using cache:", error);
      const fallback = getCachedProducts();
      if (fallback.length > 0) {
        setProducts(fallback);
      }
      setLoadingProducts(false);
    });
    return () => unsubscribe();
  }, []);

  // Subscribe store settings
  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  // Subscribe customers
  useEffect(() => {
    const q = query(collection(db, 'customers'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const custs: Customer[] = [];
      snap.forEach(doc => custs.push({ id: doc.id, ...doc.data() } as Customer));
      setCustomers(custs);
    });
    return () => unsub();
  }, []);

  // Subscribe active shift
  useEffect(() => {
    const q = query(collection(db, 'shifts'), where('status', '==', 'open'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      if (!snap.empty) {
        const sDoc = snap.docs[0];
        setActiveShift({ id: sDoc.id, ...sDoc.data() } as Shift);
      } else {
        setActiveShift(null);
      }
    });
    return () => unsub();
  }, []);

  // Hardware Scanner notification state
  const [hardwareScanToast, setHardwareScanToast] = useState<string | null>(null);

  // Synthesize pleasant scanner beep using Web Audio API
  const playBeepSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.type = 'sine';
        osc.frequency.setValueAtTime(2200, ctx.currentTime);
        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
        osc.start();
        osc.stop(ctx.currentTime + 0.08);
      }
    } catch {
      // Audio autoplay policy fallback
    }
  };

  // Hardware Barcode Gun Keypress Listener (USB & Bluetooth Scanners)
  useEffect(() => {
    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isInput = activeEl?.tagName === 'INPUT' || activeEl?.tagName === 'TEXTAREA';

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime;
      lastKeyTime = currentTime;

      if (e.key === 'Enter') {
        if (barcodeBuffer.length >= 3) {
          const scannedCode = barcodeBuffer.trim();
          const matched = products.find(p => p.barcode === scannedCode);
          if (matched) {
            e.preventDefault();
            addToCart(matched);
            playBeepSound();
            setHardwareScanToast(`${matched.name} (${matched.barcode})`);
            setTimeout(() => setHardwareScanToast(null), 2500);
          }
        }
        barcodeBuffer = '';
        return;
      }

      // If user is typing slowly in a text input, don't hijack
      if (timeDiff > 70 && isInput) {
        barcodeBuffer = '';
        return;
      }

      // Barcode scanners output rapid printable characters (< 50ms intervals)
      if (e.key.length === 1) {
        if (timeDiff > 90) {
          barcodeBuffer = e.key;
        } else {
          barcodeBuffer += e.key;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [products]);

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
        costPrice: product.costPrice || 0,
        quantity: 1
      }];
    });
    setSearch('');
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

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const cartItemCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  let discountAmount = 0;
  if (discountType === 'percent') {
    discountAmount = Math.round(subtotal * (Math.min(100, Math.max(0, discountValue)) / 100));
  } else if (discountType === 'amount') {
    discountAmount = Math.min(subtotal, Math.max(0, discountValue));
  }

  // Points redemption calculation (10 pts = 1฿)
  const maxPointsDiscount = selectedCustomer 
    ? Math.min(Math.floor((selectedCustomer.points || 0) / 10), subtotal - discountAmount) 
    : 0;
  const pointsDiscountAmount = redeemPoints ? Math.max(0, maxPointsDiscount) : 0;
  const pointsRedeemedCount = pointsDiscountAmount * 10;

  const totalDiscount = discountAmount + pointsDiscountAmount;
  const finalTotal = Math.max(0, subtotal - totalDiscount);

  // Points earned: 1 pt per 10฿ spent
  const pointsEarned = selectedCustomer ? Math.floor(finalTotal / 10) : 0;

  // Filter products for gallery (search + category)
  const filteredProducts = products.filter(p => {
    if (selectedCategory === 'uncategorized') {
      if (p.category && p.category.trim().length > 0) return false;
    } else if (selectedCategory !== 'all') {
      if (p.category?.trim().toLowerCase() !== selectedCategory.toLowerCase()) {
        return false;
      }
    }
    if (!search) return true;
    const matchName = p.name.toLowerCase().includes(search.toLowerCase());
    const matchBarcode = p.barcode.includes(search);
    const matchCategory = p.category?.toLowerCase().includes(search.toLowerCase());
    return matchName || matchBarcode || matchCategory;
  });

  // Open Checkout Modal
  const openCheckoutModal = () => {
    if (cart.length === 0) return;
    setCashReceived(finalTotal);
    setPaymentMethod('cash');
    setIsCheckoutModalOpen(true);
  };

  const handleQuickCash = (amount: number) => {
    setCashReceived(amount);
  };

  const changeDue = Math.max(0, cashReceived - finalTotal);
  const isCashInsufficient = paymentMethod === 'cash' && cashReceived < finalTotal;

  // Complete Payment and Write to Firestore
  const handleConfirmCheckout = async () => {
    if (cart.length === 0 || isCashInsufficient) return;
    if (paymentMethod === 'credit' && !selectedCustomer) {
      alert("Please select a customer to charge on credit.");
      return;
    }
    setIsProcessing(true);
    
    try {
      const batch = writeBatch(db);
      const saleId = doc(collection(db, 'sales')).id;
      const saleRef = doc(db, 'sales', saleId);
      
      const now = serverTimestamp();
      
      const saleData = {
        items: cart,
        subtotal,
        discountType,
        discountValue: discountType === 'none' ? 0 : discountValue,
        discountAmount: totalDiscount,
        total: finalTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : finalTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        staffId: user.uid,
        staffName: user.displayName || 'Staff',
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerName: selectedCustomer ? selectedCustomer.name : null,
        pointsEarned,
        pointsRedeemed: pointsRedeemedCount,
        shiftId: activeShift ? activeShift.id : null,
        createdAt: now
      };

      batch.set(saleRef, saleData);

      // Update product stocks
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

      if (selectedCustomer) {
        const custRef = doc(db, 'customers', selectedCustomer.id);
        const newPoints = Math.max(0, (selectedCustomer.points || 0) - pointsRedeemedCount + pointsEarned);
        const newCredit = paymentMethod === 'credit' 
          ? (selectedCustomer.creditBalance || 0) + finalTotal 
          : (selectedCustomer.creditBalance || 0);

        batch.update(custRef, {
          points: newPoints,
          creditBalance: newCredit,
          updatedAt: now
        });

        // Record Credit Transaction if applicable
        if (paymentMethod === 'credit') {
          const creditTxRef = doc(collection(db, 'creditTransactions'));
          batch.set(creditTxRef, {
            customerId: selectedCustomer.id,
            type: 'charge',
            amount: finalTotal,
            previousBalance: selectedCustomer.creditBalance || 0,
            newBalance: newCredit,
            saleId: saleId,
            notes: `Sale #${saleId.slice(0, 8)}`,
            createdAt: now
          });
        }
      }

      await batch.commit();

      // Log Activity
      logActivity(
        'Complete Sale',
        'sale',
        `Sold ${cartItemCount} items for ${settings.currencySymbol}${finalTotal.toLocaleString()}${paymentMethod === 'credit' ? ' (On Credit)' : ''}`,
        saleId
      );

      // Show receipt modal with transaction details
      const recordedSale: Sale = {
        id: saleId,
        items: [...cart],
        subtotal,
        discountType,
        discountValue,
        discountAmount: totalDiscount,
        total: finalTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : finalTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        staffId: user.uid,
        staffName: user.displayName || 'Staff',
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        pointsEarned,
        pointsRedeemed: pointsRedeemedCount,
        shiftId: activeShift?.id,
        createdAt: new Date()
      };

      setCompletedSale(recordedSale);
      setIsReceiptModalOpen(true);
      setShowSuccess(true);
      setCart([]);
      setDiscountType('none');
      setDiscountValue(0);
      setRedeemPoints(false);
      setSelectedCustomer(null);
      setIsCheckoutModalOpen(false);
      setShowMobileCart(false);

      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.warn("Failed to commit sale to cloud (likely offline), queueing offline sale:", error);
      const saleId = 'offline_' + Date.now();
      const offlineSaleData = {
        items: cart,
        subtotal,
        discountType,
        discountValue: discountType === 'none' ? 0 : discountValue,
        discountAmount: totalDiscount,
        total: finalTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : finalTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        staffId: user.uid,
        staffName: user.displayName || 'Staff',
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        pointsEarned,
        pointsRedeemed: pointsRedeemedCount,
        shiftId: activeShift?.id,
      };
      
      queueOfflineSale(offlineSaleData);

      const recordedSale: Sale = {
        id: saleId,
        items: [...cart],
        subtotal,
        discountType,
        discountValue,
        discountAmount: totalDiscount,
        total: finalTotal,
        paymentMethod,
        cashReceived: paymentMethod === 'cash' ? cashReceived : finalTotal,
        changeDue: paymentMethod === 'cash' ? changeDue : 0,
        staffId: user.uid,
        staffName: user.displayName || 'Staff',
        customerId: selectedCustomer?.id,
        customerName: selectedCustomer?.name,
        pointsEarned,
        pointsRedeemed: pointsRedeemedCount,
        shiftId: activeShift?.id,
        createdAt: new Date()
      };

      setCompletedSale(recordedSale);
      setIsReceiptModalOpen(true);
      setShowSuccess(true);
      setCart([]);
      setDiscountType('none');
      setDiscountValue(0);
      setRedeemPoints(false);
      setSelectedCustomer(null);
      setIsCheckoutModalOpen(false);
      setShowMobileCart(false);
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
      alert("Product not found with barcode: " + code);
    }
  };

  const filteredCustomerResults = customers.filter(c => 
    c.name.toLowerCase().includes(customerSearch.toLowerCase()) || 
    c.phone.includes(customerSearch)
  );

  const currency = settings.currencySymbol || '฿';

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full relative">
      {/* Left Column: Product Menu & Search */}
      <div className={cn(
        "flex-1 flex flex-col gap-5 min-h-0 transition-all",
        showMobileCart ? "hidden lg:flex" : "flex"
      )}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-2xl font-bold text-slate-900">{t('pos')}</h2>
              {activeShift && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Shift #{activeShift.id.slice(0, 6)}
                </span>
              )}
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60" title="USB / Bluetooth handheld scanners will instantly add scanned items">
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
                {t('hardware_scanner_ready')}
              </span>
            </div>
            <p className="text-slate-500 text-sm">{t('process_sale')}</p>
          </div>
          <button
            onClick={() => setIsScannerOpen(true)}
            className="flex items-center justify-center gap-2 px-5 py-3 bg-indigo-600 text-white font-bold rounded-2xl hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 active:scale-95 whitespace-nowrap cursor-pointer"
          >
            <Scan className="w-5 h-5" />
            {t('scan_barcode')}
          </button>
        </div>

        {/* Hardware Barcode Scan Floating Toast */}
        <AnimatePresence>
          {hardwareScanToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4 text-sm font-bold min-w-[280px]"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                </div>
                <span>Added: {hardwareScanToast}</span>
              </div>
              <span className="bg-emerald-700 px-2 py-1 rounded-lg text-[10px] font-black">+1 Qty</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Categorization Toast */}
        <AnimatePresence>
          {categorizeToast && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] bg-indigo-600 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center justify-between gap-4 text-sm font-bold min-w-[280px]"
            >
              <div className="flex items-center gap-3">
                <div className="p-1.5 bg-white/20 rounded-lg">
                  <Check className="w-5 h-5 text-indigo-200" />
                </div>
                <span>{categorizeToast}</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search & Category Filter Bar */}
        <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder={t('search_placeholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-12 pr-10 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-medium focus:ring-2 focus:ring-indigo-500 outline-none shadow-xs transition-all text-slate-900"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-full"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Dropdown Selector - ALWAYS rendered */}
          <div className="shrink-0 flex items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full sm:w-auto px-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-indigo-500 shadow-xs cursor-pointer transition-all hover:border-slate-300"
              >
                <option value="all">📁 {t('all_categories')} ({products.length})</option>
                {uncategorizedCount > 0 && (
                  <option value="uncategorized">⚠️ {t('uncategorized')} ({uncategorizedCount})</option>
                )}
                {productCategories.map((c) => {
                  const count = products.filter(p => p.category?.trim().toLowerCase() === c.toLowerCase()).length;
                  return (
                    <option key={c} value={c}>
                      🏷️ {c} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
            
            {/* Quick Category Manager Modal Trigger */}
            <button
              type="button"
              onClick={() => setIsCategoryModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-xs cursor-pointer whitespace-nowrap active:scale-95"
              title="Organize / Manage Categories"
            >
              <Tag className="w-4 h-4 text-indigo-600" />
              <span className="hidden sm:inline">{t('manage_categories')}</span>
            </button>
          </div>
        </div>

        {/* Horizontal Category Navigation Tabs - ALWAYS rendered */}
        <div className="shrink-0 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
          <button
            type="button"
            onClick={() => setSelectedCategory('all')}
            className={cn(
              "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer",
              selectedCategory === 'all'
                ? "bg-slate-900 text-white shadow-sm"
                : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            )}
          >
            <span>📁 {t('all_categories')}</span>
            <span className={cn(
              "px-1.5 py-0.5 rounded-full text-[10px] font-black",
              selectedCategory === 'all' ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
            )}>
              {products.length}
            </span>
          </button>

          {uncategorizedCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedCategory('uncategorized')}
              className={cn(
                "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer",
                selectedCategory === 'uncategorized'
                  ? "bg-amber-600 text-white shadow-sm shadow-amber-200"
                  : "bg-amber-50 border border-amber-200 text-amber-800 hover:bg-amber-100"
              )}
            >
              <span>⚠️ {t('uncategorized')}</span>
              <span className={cn(
                "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                selectedCategory === 'uncategorized' ? "bg-white/20 text-white" : "bg-amber-200 text-amber-900"
              )}>
                {uncategorizedCount}
              </span>
            </button>
          )}

          {/* Dynamic Categories from Products */}
          {productCategories.map((cat) => {
            const count = products.filter(p => p.category?.trim().toLowerCase() === cat.toLowerCase()).length;
            const isSelected = selectedCategory.toLowerCase() === cat.toLowerCase();
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 flex items-center gap-1.5 active:scale-95 cursor-pointer",
                  isSelected
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-100"
                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <span>🏷️ {cat}</span>
                <span className={cn(
                  "px-1.5 py-0.5 rounded-full text-[10px] font-black",
                  isSelected ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                )}>
                  {count}
                </span>
              </button>
            );
          })}

          {/* If no categories yet or to offer presets */}
          {productCategories.length === 0 && uncategorizedCount === 0 && (
            <div className="flex items-center gap-1.5">
              {['Drinks / အအေး', 'Food / ခေါက်ဆွဲ', 'Snacks / မုန့်', 'Canned / စည်သွပ်ဘူး', 'Health / ဆေးဝါး'].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setIsCategoryModalOpen(true)}
                  className="px-3 py-1.5 rounded-xl text-xs font-medium border border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 bg-white whitespace-nowrap"
                >
                  + {preset}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Uncategorized Alert & 1-Click Auto-Categorize Banner */}
        {uncategorizedCount > 0 && (
          <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200/80 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5 text-amber-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-200 text-amber-800 shrink-0 font-bold text-sm">
                ⚠️
              </span>
              <div>
                <p className="font-bold text-slate-900">အမျိုးအစား မခွဲရသေးသော ပစ္စည်း ({uncategorizedCount}) မျိုး ရှိနေပါသည်</p>
                <p className="text-amber-800/80 text-[11px]">ပစ္စည်းများ များလာပါက ရှုပ်မသွားစေရန် Categories သတ်မှတ်ခွဲထားနိုင်ပါသည်</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleAutoCategorize}
                disabled={isAutoCategorizing}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>{isAutoCategorizing ? 'ခွဲနေပါသည်...' : 'အလိုအလျောက် ခွဲရန်'}</span>
              </button>
              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="px-3 py-2 bg-white border border-amber-300 text-amber-900 font-bold rounded-xl hover:bg-amber-100/50 transition-colors cursor-pointer"
              >
                {t('manage_categories')}
              </button>
            </div>
          </div>
        )}

        {/* Active Filter Header Notice */}
        {selectedCategory !== 'all' && (
          <div className="flex items-center justify-between px-1 text-xs">
            <span className="font-bold text-slate-700">
              {selectedCategory === 'uncategorized' ? '⚠️ အမျိုးအစား မသတ်မှတ်ရသေးသော ပစ္စည်းများ' : `🏷️ Category: ${selectedCategory}`} ({filteredProducts.length} items)
            </span>
            <button
              type="button"
              onClick={() => setSelectedCategory('all')}
              className="text-indigo-600 font-bold hover:underline"
            >
              အားလုံးပြန်ကြည့်မည် (Show All)
            </button>
          </div>
        )}

        {/* Quick Shortcuts / Top Selling Section */}
        {products.length > 0 && selectedCategory === 'all' && !search && (
          <div className="shrink-0 space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] flex items-center gap-1.5">
                <Sparkles className="w-3 h-3 text-indigo-600" />
                {t('top_selling')} / {t('quick_actions')}
              </p>
            </div>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
              {products.slice(0, 8).map(p => (
                <button
                  key={`shortcut-${p.id}`}
                  onClick={() => addToCart(p)}
                  className="flex items-center gap-2.5 px-3 py-2 bg-white border border-slate-200 rounded-2xl hover:border-indigo-500 hover:shadow-md transition-all active:scale-95 shrink-0 group"
                >
                  <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 overflow-hidden flex items-center justify-center group-hover:bg-indigo-50 transition-colors">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ShoppingBag className="w-4 h-4 text-slate-300 group-hover:text-indigo-400" />
                    )}
                  </div>
                  <div className="text-left pr-1">
                    <p className="text-[11px] font-bold text-slate-900 leading-tight truncate max-w-[80px]">{p.name}</p>
                    <p className="text-[10px] font-black text-indigo-600">{currency}{p.price}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Product Gallery */}
        <div className="flex-1 overflow-y-auto pb-24 lg:pb-4 scrollbar-thin scrollbar-thumb-slate-200">
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
            {loadingProducts ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-white rounded-3xl border border-slate-100 animate-pulse" />
              ))
            ) : filteredProducts.map((p) => (
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
                      <span className="bg-white text-slate-900 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest">{t('out_of_stock')}</span>
                    </div>
                  )}
                </div>
                <div className="p-3.5 sm:p-4">
                  {/* Category Tag Badge */}
                  {p.category ? (
                    <span className="inline-block px-2 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-100/70 rounded-md text-[10px] font-bold mb-1 line-clamp-1 max-w-full">
                      🏷️ {p.category}
                    </span>
                  ) : (
                    <span className="inline-block px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-200/50 rounded-md text-[10px] font-medium mb-1">
                      {t('uncategorized')}
                    </span>
                  )}
                  <p className="font-bold text-slate-900 text-sm line-clamp-1 leading-tight mb-1">{p.name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-indigo-600 font-black text-base">{currency}{p.price.toLocaleString()}</p>
                    <p className={cn("text-[10px] font-bold", p.stock <= (p.minStock ?? 5) ? "text-rose-500" : "text-slate-400")}>
                      {p.stock} {p.unit || 'left'}
                    </p>
                  </div>
                </div>
                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-lg">
                    <Plus className="w-4 h-4" />
                  </div>
                </div>
              </button>
            ))}
            {!loadingProducts && filteredProducts.length === 0 && (
              <div className="col-span-full py-16 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
                <Package className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-600 font-bold">{t('no_products_found')}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Cart Floating Action */}
      {!showMobileCart && cart.length > 0 && (
        <div className="lg:hidden fixed bottom-6 left-4 right-4 z-40">
          <button 
            onClick={() => setShowMobileCart(true)}
            className="w-full bg-slate-900 text-white p-4 rounded-3xl flex items-center justify-between shadow-2xl shadow-slate-900/40 active:scale-95 transition-all"
          >
            <div className="flex items-center gap-4">
              <div className="relative">
                <ShoppingBag className="w-6 h-6 text-indigo-400" />
                <span className="absolute -top-2 -right-2 bg-indigo-600 text-white text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900">
                  {cartItemCount}
                </span>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest leading-none mb-1">{t('cart')}</p>
                <p className="font-bold text-sm">{currency}{finalTotal.toLocaleString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              {t('checkout')}
              <CreditCard className="w-5 h-5" />
            </div>
          </button>
        </div>
      )}

      {/* Right Column: Cart, Customer & Checkout */}
      <div className={cn(
        "w-full lg:w-[410px] flex flex-col gap-4 shrink-0 min-h-0 transition-all",
        showMobileCart ? "flex fixed inset-0 z-50 bg-slate-50 p-4 lg:relative lg:inset-auto lg:bg-transparent lg:p-0" : "hidden lg:flex"
      )}>
        {/* Mobile Header for Cart */}
        <div className="lg:hidden flex items-center justify-between mb-2">
          <button 
            onClick={() => setShowMobileCart(false)}
            className="flex items-center gap-2 text-slate-600 font-bold text-sm hover:text-slate-900"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <span className="text-slate-900 font-black">{t('checkout')}</span>
        </div>

        {/* Customer Selector Pill */}
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between">
          {selectedCustomer ? (
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center gap-2 min-w-0">
                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                  <Users className="w-4 h-4" />
                </div>
                <div className="truncate">
                  <p className="font-bold text-slate-900 text-xs truncate">{selectedCustomer.name}</p>
                  <p className="text-[10px] text-amber-600 font-bold flex items-center gap-1">
                    <Award className="w-3 h-3" />
                    {selectedCustomer.points || 0} pts
                    {selectedCustomer.creditBalance && selectedCustomer.creditBalance > 0 ? (
                      <span className="text-rose-600 ml-1">({currency}{selectedCustomer.creditBalance} debt)</span>
                    ) : null}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => { setSelectedCustomer(null); setRedeemPoints(false); }}
                className="p-1.5 text-slate-400 hover:text-rose-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCustomerModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50/50 rounded-xl transition-colors"
            >
              <Users className="w-4 h-4" />
              <span>{t('select_customer')}</span>
            </button>
          )}
        </div>

        <div className="flex-1 bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden flex flex-col min-h-0">
          <div className="p-5 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between shrink-0">
            <div>
              <span className="text-xs font-black text-slate-400 uppercase tracking-widest">{t('cart')}</span>
              <h3 className="text-slate-900 font-bold">{cart.length} {t('items')} ({cartItemCount} pcs)</h3>
            </div>
            {cart.length > 0 && (
              <button 
                onClick={() => setCart([])}
                className="text-xs font-bold text-rose-500 hover:bg-rose-50 px-3 py-1.5 rounded-xl transition-colors"
              >
                {t('clear_all')}
              </button>
            )}
          </div>
          
          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto px-2 scrollbar-thin scrollbar-thumb-slate-200">
            {cart.map((item) => (
              <div key={item.productId} className="flex items-center gap-3 p-3.5 border-b border-slate-50 hover:bg-slate-50/50 transition-colors group">
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-bold text-slate-900 truncate text-sm">{item.name}</p>
                  <p className="text-xs text-slate-400 font-medium">{currency}{item.price.toLocaleString()} / unit</p>
                </div>
                <div className="flex items-center gap-1.5 bg-slate-100 rounded-xl p-1 shrink-0">
                  <button onClick={() => updateQuantity(item.productId, -1)} className="p-1.5 text-slate-600 hover:text-indigo-600 transition-colors"><Minus className="w-3.5 h-3.5" /></button>
                  <span className="font-black text-slate-900 w-5 text-center tabular-nums text-xs">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.productId, 1)} className="p-1.5 text-slate-600 hover:text-indigo-600 transition-colors"><Plus className="w-3.5 h-3.5" /></button>
                </div>
                <div className="w-16 text-right shrink-0">
                  <p className="font-bold text-slate-900 tabular-nums text-sm">{currency}{(item.price * item.quantity).toLocaleString()}</p>
                </div>
                <button onClick={() => removeFromCart(item.productId)} className="p-1.5 text-slate-300 hover:text-rose-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
            {cart.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-slate-300 py-20">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <ShoppingBag className="w-10 h-10 opacity-20" />
                </div>
                <p className="font-bold text-slate-900">{t('cart_empty')}</p>
                <p className="text-xs text-slate-400 mt-1">Select items from the gallery to begin</p>
              </div>
            )}
          </div>

          {/* Pricing & Discount & Checkout Section */}
          <div className="p-5 bg-slate-50/90 border-t border-slate-100 shrink-0 space-y-4">
            {/* Customer Points Redemption Toggle */}
            {selectedCustomer && (selectedCustomer.points || 0) >= 10 && cart.length > 0 && (
              <div className="bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Award className="w-4 h-4 text-amber-600" />
                  <span className="font-semibold text-amber-900">
                    Use {Math.min(selectedCustomer.points, 100)} pts for -{currency}{Math.min(Math.floor(selectedCustomer.points / 10), 10)}
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={redeemPoints}
                  onChange={(e) => setRedeemPoints(e.target.checked)}
                  className="w-4 h-4 text-amber-600 rounded cursor-pointer"
                />
              </div>
            )}

            {/* Discount Selector */}
            {cart.length > 0 && (
              <div className="bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                  <span className="flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-indigo-600" />
                    {t('discount')}
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setDiscountType('none'); setDiscountValue(0); }}
                      className={cn("px-2 py-0.5 rounded text-[11px] font-bold transition-colors", discountType === 'none' ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600")}
                    >
                      {t('no_discount')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('percent')}
                      className={cn("px-2 py-0.5 rounded text-[11px] font-bold transition-colors", discountType === 'percent' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}
                    >
                      %
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiscountType('amount')}
                      className={cn("px-2 py-0.5 rounded text-[11px] font-bold transition-colors", discountType === 'amount' ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600")}
                    >
                      {currency}
                    </button>
                  </div>
                </div>

                {discountType !== 'none' && (
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="number"
                        min="0"
                        max={discountType === 'percent' ? 100 : subtotal}
                        value={discountValue || ''}
                        onChange={(e) => setDiscountValue(Math.max(0, Number(e.target.value)))}
                        placeholder={discountType === 'percent' ? 'e.g. 5, 10, 15%' : `e.g. 20, 50${currency}`}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900 tabular-nums"
                      />
                    </div>
                    {discountAmount > 0 && (
                      <span className="text-xs font-bold text-rose-600 whitespace-nowrap">
                        -{currency}{discountAmount.toLocaleString()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Price Breakdown */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs text-slate-500 font-medium">
                <span>{t('subtotal')}</span>
                <span className="tabular-nums font-bold">{currency}{subtotal.toLocaleString()}</span>
              </div>
              {totalDiscount > 0 && (
                <div className="flex justify-between text-xs text-rose-600 font-bold">
                  <span>{t('discount')}</span>
                  <span className="tabular-nums">-{currency}{totalDiscount.toLocaleString()}</span>
                </div>
              )}
              {selectedCustomer && (
                <div className="flex justify-between text-xs text-amber-600 font-semibold">
                  <span>{t('earned_points')}</span>
                  <span className="tabular-nums font-bold">+{pointsEarned} pts</span>
                </div>
              )}
              <div className="flex justify-between text-xl font-black text-slate-900 pt-1 border-t border-slate-200/60">
                <span>{t('total')}</span>
                <span className="tabular-nums text-indigo-600">{currency}{finalTotal.toLocaleString()}</span>
              </div>
            </div>

            <button
              disabled={cart.length === 0 || isProcessing}
              onClick={openCheckoutModal}
              className="w-full py-4 bg-indigo-600 text-white font-black text-base rounded-2xl shadow-xl shadow-indigo-500/20 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3 transition-all active:scale-95"
            >
              <CreditCard className="w-5 h-5" />
              <span>{t('checkout')} ({currency}{finalTotal.toLocaleString()})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Select Customer Modal */}
      <AnimatePresence>
        {isCustomerModalOpen && (
          <div className="fixed inset-0 z-[260] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[85vh]"
            >
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">{t('select_customer')}</h3>
                    <p className="text-xs text-slate-500">Attach sale to member profile</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 border-b border-slate-100">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={customerSearch}
                    onChange={(e) => setCustomerSearch(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {filteredCustomerResults.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(c);
                      setIsCustomerModalOpen(false);
                    }}
                    className="w-full p-3 rounded-2xl border border-slate-200 hover:border-indigo-500 hover:bg-indigo-50/30 flex items-center justify-between text-left transition-all"
                  >
                    <div>
                      <p className="font-bold text-slate-900 text-xs">{c.name}</p>
                      <p className="text-[11px] text-slate-400 font-mono">{c.phone}</p>
                    </div>
                    <div className="text-right text-xs">
                      <span className="font-bold text-amber-600">{c.points || 0} pts</span>
                      {c.creditBalance && c.creditBalance > 0 ? (
                        <p className="text-[10px] text-rose-600 font-bold">{currency}{c.creditBalance} debt</p>
                      ) : null}
                    </div>
                  </button>
                ))}

                {filteredCustomerResults.length === 0 && (
                  <div className="text-center py-8 text-slate-400 text-xs">
                    No customer found.
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Checkout / Payment Modal */}
      <AnimatePresence>
        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[94vh]"
            >
              {/* Modal Header */}
              <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{t('checkout')}</h3>
                  <p className="text-xs text-slate-500">{t('payment_method')}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Payment Details Content */}
              <div className="p-5 sm:p-6 space-y-6 overflow-y-auto">
                {/* Total Display Banner */}
                <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-4 flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">{t('net_total')}</span>
                    <p className="text-2xl font-black text-slate-900 tabular-nums">{currency}{finalTotal.toLocaleString()}</p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>{cart.length} {t('items')} ({cartItemCount} pcs)</p>
                    {totalDiscount > 0 && (
                      <p className="text-rose-600 font-bold">-{totalDiscount}{currency} {t('discount')}</p>
                    )}
                    {selectedCustomer && (
                      <p className="text-indigo-600 font-bold">Member: {selectedCustomer.name}</p>
                    )}
                  </div>
                </div>

                {/* Payment Method Selector Tabs */}
                <div>
                  <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                    {t('payment_method')}
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 font-bold text-[11px]",
                        paymentMethod === 'cash'
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <Banknote className="w-5 h-5 text-emerald-600" />
                      <span>{t('cash')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('qr')}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 font-bold text-[11px]",
                        paymentMethod === 'qr'
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <QrCode className="w-5 h-5 text-indigo-600" />
                      <span>QR Code</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('card')}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 font-bold text-[11px]",
                        paymentMethod === 'card'
                          ? "border-indigo-600 bg-indigo-50/50 text-indigo-700 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <CreditCard className="w-5 h-5 text-amber-600" />
                      <span>{t('card')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (!selectedCustomer) {
                          setIsCustomerModalOpen(true);
                          return;
                        }
                        setPaymentMethod('credit');
                      }}
                      className={cn(
                        "flex flex-col items-center justify-center p-3 rounded-2xl border-2 transition-all gap-1.5 font-bold text-[11px]",
                        paymentMethod === 'credit'
                          ? "border-amber-600 bg-amber-50/50 text-amber-800 shadow-sm"
                          : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                      )}
                    >
                      <BookOpen className="w-5 h-5 text-rose-600" />
                      <span>{t('on_credit')}</span>
                    </button>
                  </div>
                </div>

                {/* Method Specific Details */}
                {paymentMethod === 'cash' && (
                  <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <div>
                      <div className="flex justify-between items-center mb-1.5">
                        <label className="text-xs font-bold text-slate-700">{t('cash_received')} ({currency})</label>
                        <span className="text-[11px] text-slate-400 font-medium">Quick amount buttons below</span>
                      </div>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-bold">{currency}</span>
                        <input
                          type="number"
                          min="0"
                          value={cashReceived || ''}
                          onChange={(e) => setCashReceived(Number(e.target.value))}
                          className="w-full pl-8 pr-4 py-3 bg-white border border-slate-300 rounded-xl text-lg font-black text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none tabular-nums"
                        />
                      </div>
                    </div>

                    {/* Quick Cash Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => handleQuickCash(finalTotal)}
                        className="px-3 py-1.5 rounded-xl text-xs font-bold bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 transition-colors"
                      >
                        {t('exact')} ({currency}{finalTotal})
                      </button>
                      {[100, 500, 1000, 2000].map(amt => (
                        <button
                          key={amt}
                          type="button"
                          onClick={() => handleQuickCash(amt)}
                          className={cn(
                            "px-3 py-1.5 rounded-xl text-xs font-bold border transition-colors",
                            cashReceived === amt 
                              ? "bg-indigo-600 text-white border-indigo-600" 
                              : "bg-white hover:bg-slate-100 border-slate-200 text-slate-700"
                          )}
                        >
                          {currency}{amt.toLocaleString()}
                        </button>
                      ))}
                    </div>

                    {/* Change Due Display */}
                    <div className="pt-2 border-t border-slate-200 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">{t('change_due')}</span>
                      <span className={cn(
                        "text-xl font-black tabular-nums",
                        isCashInsufficient ? "text-rose-500" : "text-emerald-600"
                      )}>
                        {currency}{changeDue.toLocaleString()}
                      </span>
                    </div>

                    {isCashInsufficient && (
                      <p className="text-xs font-bold text-rose-500 text-right">
                        {t('insufficient_cash')}
                      </p>
                    )}
                  </div>
                )}

                {paymentMethod === 'qr' && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="w-36 h-36 mx-auto bg-white p-3 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                      <QrCode className="w-24 h-24 text-slate-800" />
                      <span className="text-[10px] font-black tracking-widest text-indigo-600 mt-1">PROMPTPAY QR</span>
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{t('scan_qr_prompt')}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Amount to pay: <span className="font-bold text-indigo-600">{currency}{finalTotal.toLocaleString()}</span></p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'card' && (
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 text-center space-y-3">
                    <div className="w-20 h-20 mx-auto bg-amber-50 rounded-full flex items-center justify-center text-amber-600">
                      <CreditCard className="w-10 h-10" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900 text-sm">{t('card_swipe_prompt')}</p>
                      <p className="text-xs text-slate-500 mt-0.5">Charge amount: <span className="font-bold text-slate-900">{currency}{finalTotal.toLocaleString()}</span></p>
                    </div>
                  </div>
                )}

                {paymentMethod === 'credit' && (
                  <div className="bg-amber-50 p-6 rounded-2xl border border-amber-200 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-3 bg-amber-100 text-amber-800 rounded-2xl">
                        <BookOpen className="w-6 h-6" />
                      </div>
                      <div>
                        <p className="font-bold text-amber-900 text-sm">Customer Credit Account</p>
                        <p className="text-xs text-amber-700">The amount will be added to member&apos;s debt book.</p>
                      </div>
                    </div>
                    {selectedCustomer && (
                      <div className="bg-white p-4 rounded-xl border border-amber-200/60 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="text-slate-500">Customer:</span>
                          <span className="font-bold text-slate-900">{selectedCustomer.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-slate-500">Current Debt:</span>
                          <span className="font-bold text-rose-600">{currency}{(selectedCustomer.creditBalance || 0).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between pt-1 border-t border-slate-100 font-bold text-slate-900">
                          <span>New Total Debt:</span>
                          <span className="text-rose-700 font-black">
                            {currency}{((selectedCustomer.creditBalance || 0) + finalTotal).toLocaleString()}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="p-5 border-t border-slate-100 bg-white flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCheckoutModalOpen(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm rounded-xl transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="button"
                  disabled={isProcessing || isCashInsufficient}
                  onClick={handleConfirmCheckout}
                  className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-100 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all active:scale-95"
                >
                  {isProcessing ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Receipt className="w-4 h-4" />
                      <span>{t('confirm_payment')}</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Barcode Scanner Modal */}
      {isScannerOpen && (
        <BarcodeScanner
          onScan={handleScan}
          onClose={() => setIsScannerOpen(false)}
        />
      )}

      {/* Category Management Modal */}
      <AnimatePresence>
        {isCategoryModalOpen && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden border border-slate-100"
            >
              {/* Header */}
              <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/60 shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-2xl">
                    <Tag className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">အမျိုးအစားများ စီမံခွဲခြားရန် (Manage Categories)</h3>
                    <p className="text-xs text-slate-500">ပစ္စည်းများ အမျိုးအစား သတ်မှတ်ပေးခြင်းဖြင့် POS တွင် အလွယ်တကူ ရှာဖွေနိုင်ပါသည်</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Action Toolbar */}
              <div className="p-4 bg-white border-b border-slate-100 flex flex-col sm:flex-row gap-3 items-center justify-between shrink-0">
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="ရှာဖွေရန် (Search item)..."
                    value={categoryModalSearch}
                    onChange={(e) => setCategoryModalSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleAutoCategorize}
                  disabled={isAutoCategorizing}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                >
                  <Wand2 className="w-4 h-4" />
                  <span>{isAutoCategorizing ? 'ခွဲနေပါသည်...' : '⚡ အလိုအလျောက် အားလုံးခွဲရန် (Auto-Categorize)'}</span>
                </button>
              </div>

              {/* Products List with Quick Category Buttons */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {products
                  .filter(p => !categoryModalSearch || p.name.toLowerCase().includes(categoryModalSearch.toLowerCase()) || p.barcode.includes(categoryModalSearch))
                  .map(p => (
                    <div
                      key={p.id}
                      className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-100/50 transition-colors"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                          {p.imageUrl ? (
                            <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                          ) : (
                            <ShoppingBag className="w-5 h-5 text-slate-300" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-slate-400 font-mono">{p.barcode}</span>
                            <span className="text-[10px] font-bold text-indigo-600">{currency}{p.price}</span>
                            {p.category ? (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-100 text-indigo-800">
                                🏷️ {p.category}
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-100 text-amber-800">
                                မသတ်မှတ်ရသေး
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quick Category Chips */}
                      <div className="flex flex-wrap gap-1.5 shrink-0 sm:max-w-xs">
                        {[
                          'Drinks / အအေး',
                          'Food / ခေါက်ဆွဲ',
                          'Snacks / မုန့်',
                          'Canned / စည်သွပ်ဘူး',
                          'Health / ဆေးဝါး',
                          'General / အထွေထွေ'
                        ].map(cName => {
                          const isCurrent = p.category?.trim().toLowerCase() === cName.toLowerCase();
                          return (
                            <button
                              key={cName}
                              type="button"
                              onClick={() => handleAssignCategory(p.id, cName)}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer",
                                isCurrent
                                  ? "bg-indigo-600 text-white shadow-xs"
                                  : "bg-white border border-slate-200 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700"
                              )}
                            >
                              {cName}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>

              {/* Footer */}
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end shrink-0">
                <button
                  type="button"
                  onClick={() => setIsCategoryModalOpen(false)}
                  className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  {t('close')}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Thermal Receipt Modal */}
      <ReceiptModal
        sale={completedSale}
        settings={settings}
        isOpen={isReceiptModalOpen}
        onClose={() => setIsReceiptModalOpen(false)}
      />

      {/* Transaction Success Overlay */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 10 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 lg:left-auto lg:right-8 lg:translate-x-0 z-[200] bg-emerald-500 text-white px-8 py-5 rounded-[28px] flex items-center gap-4 shadow-2xl shadow-emerald-500/25 w-[90%] lg:w-auto"
          >
            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black text-base">Payment Complete!</p>
              <p className="text-xs text-emerald-50 opacity-90">Receipt ready & stock updated.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
