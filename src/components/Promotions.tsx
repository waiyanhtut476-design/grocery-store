import React, { useState, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  orderBy, 
  onSnapshot 
} from 'firebase/firestore';
import { Promotion, Product, StoreSettings } from '../types';
import { useLanguage } from '../lib/i18n';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from '../lib/storeSettings';
import { PromotionsModal } from './PromotionsModal';
import { Sparkles, Plus, Tag, Gift, Percent, Layers, AlertCircle } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PromotionsProps {
  role: 'admin' | 'staff' | null;
}

export function Promotions({ role }: PromotionsProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'promotions'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      const list: Promotion[] = [];
      snap.forEach(d => list.push({ id: d.id, ...d.data() } as Promotion));
      setPromotions(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'promotions');
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'products'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const prods: Product[] = [];
      snap.forEach(d => prods.push({ id: d.id, ...d.data() } as Product));
      setProducts(prods);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'products');
    });
    return () => unsub();
  }, []);

  const currency = settings.currencySymbol || '฿';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">{t('promotions_bundles')}</h2>
          <p className="text-slate-500 text-sm">Create automated discounts and special offers for your customers.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-rose-600 text-white font-bold text-xs rounded-xl hover:bg-rose-700 transition-all shadow-md shadow-rose-100 active:scale-95"
        >
          <Plus className="w-4 h-4" />
          <span>Manage Promotions</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {promotions.map((promo) => (
          <div 
            key={promo.id} 
            className={cn(
              "bg-white rounded-3xl border p-6 flex flex-col justify-between transition-all hover:shadow-lg",
              promo.isActive ? "border-rose-100 shadow-sm" : "border-slate-200 opacity-60 grayscale"
            )}
          >
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className={cn(
                  "p-3 rounded-2xl",
                  promo.type === 'buy_x_get_y' ? "bg-rose-50 text-rose-600" : 
                  promo.type === 'bundle_price' ? "bg-indigo-50 text-indigo-600" : "bg-emerald-50 text-emerald-600"
                )}>
                  {promo.type === 'buy_x_get_y' ? <Gift className="w-6 h-6" /> : 
                   promo.type === 'bundle_price' ? <Layers className="w-6 h-6" /> : <Percent className="w-6 h-6" />}
                </div>
                <span className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest",
                  promo.isActive ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-500"
                )}>
                  {promo.isActive ? 'Active' : 'Disabled'}
                </span>
              </div>

              <h3 className="text-lg font-bold text-slate-900 mb-2 leading-tight">{promo.title}</h3>
              
              <div className="space-y-2 mt-4 pt-4 border-t border-slate-50">
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Type:</span>
                  <span className="text-slate-900 font-bold capitalize">{promo.type.replace(/_/g, ' ')}</span>
                </div>
                {promo.targetProductName && (
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Product:</span>
                    <span className="text-slate-900 font-bold truncate max-w-[150px]">{promo.targetProductName}</span>
                  </div>
                )}
                {promo.targetCategory && (
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                    <span>Category:</span>
                    <span className="text-slate-900 font-bold">{promo.targetCategory}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs font-medium text-slate-500">
                  <span>Benefit:</span>
                  <span className="text-rose-600 font-black">
                    {promo.type === 'buy_x_get_y' ? `Buy ${promo.buyQty} Get ${promo.freeQty} Free` : 
                     promo.type === 'bundle_price' ? `${promo.bundleQty} for ${currency}${promo.bundlePrice}` : 
                     `${promo.discountPercent}% OFF`}
                  </span>
                </div>
              </div>
            </div>
            
            <button
              onClick={() => setIsModalOpen(true)}
              className="mt-6 w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-bold text-[11px] rounded-xl transition-colors uppercase tracking-wider"
            >
              Modify Promotion
            </button>
          </div>
        ))}

        {promotions.length === 0 && !loading && (
          <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-slate-200">
            <Sparkles className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-900">No active promotions</h3>
            <p className="text-slate-500 text-sm mb-6">Drive more sales by creating limited-time offers.</p>
            <button
              onClick={() => setIsModalOpen(true)}
              className="px-6 py-2.5 bg-indigo-600 text-white font-bold rounded-xl hover:bg-indigo-700 transition-all shadow-md shadow-indigo-100"
            >
              Create First Promo
            </button>
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3">
        <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-xs font-bold text-amber-900 uppercase tracking-wider">How it works</p>
          <p className="text-xs text-amber-800 mt-1">
            Active promotions are automatically applied at the POS checkout when matching products are added to the cart. 
            You don&apos;t need to manually calculate discounts.
          </p>
        </div>
      </div>

      <PromotionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        promotions={promotions}
        products={products}
        settings={settings}
      />
    </div>
  );
}
