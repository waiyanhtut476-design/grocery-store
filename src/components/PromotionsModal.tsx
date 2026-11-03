import React, { useState } from 'react';
import { Promotion, Product, StoreSettings } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { X, Sparkles, Plus, Trash2, Check, Tag } from 'lucide-react';
import { createPromotion, deletePromotion, togglePromotionStatus } from '../lib/promotions';

interface PromotionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  promotions: Promotion[];
  products: Product[];
  settings: StoreSettings;
}

export function PromotionsModal({
  isOpen,
  onClose,
  promotions,
  products,
  settings
}: PromotionsModalProps) {
  const currency = settings.currencySymbol || '฿';
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [promoType, setPromoType] = useState<'buy_x_get_y' | 'bundle_price' | 'category_discount'>('buy_x_get_y');
  const [targetProductId, setTargetProductId] = useState('');
  const [targetCategory, setTargetCategory] = useState('');
  const [buyQty, setBuyQty] = useState(2);
  const [freeQty, setFreeQty] = useState(1);
  const [bundleQty, setBundleQty] = useState(3);
  const [bundlePrice, setBundlePrice] = useState(50);
  const [discountPercent, setDiscountPercent] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Available categories
  const categories = Array.from(
    new Set(
      products
        .map(p => p.category?.trim())
        .filter((c): c is string => Boolean(c && c.length > 0))
    )
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const selectedProd = products.find(p => p.id === targetProductId);
      await createPromotion({
        title: newTitle.trim() || (
          promoType === 'buy_x_get_y' 
            ? `Buy ${buyQty} Get ${freeQty} Free (${selectedProd?.name || targetCategory || 'Promo'})` 
            : promoType === 'bundle_price'
              ? `Bundle ${bundleQty} for ${currency}${bundlePrice} (${selectedProd?.name || 'Promo'})`
              : `${discountPercent}% off on ${targetCategory || 'Items'}`
        ),
        type: promoType,
        targetProductId: targetProductId || undefined,
        targetProductName: selectedProd?.name,
        targetCategory: targetCategory || undefined,
        buyQty: promoType === 'buy_x_get_y' ? Number(buyQty) : undefined,
        freeQty: promoType === 'buy_x_get_y' ? Number(freeQty) : undefined,
        bundleQty: promoType === 'bundle_price' ? Number(bundleQty) : undefined,
        bundlePrice: promoType === 'bundle_price' ? Number(bundlePrice) : undefined,
        discountPercent: promoType === 'category_discount' ? Number(discountPercent) : undefined,
        isActive: true
      });

      setShowAddForm(false);
      setNewTitle('');
      setTargetProductId('');
      setTargetCategory('');
    } catch (err) {
      console.error('Error creating promo:', err);
      alert('Failed to save promotion');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggle = async (id: string, current: boolean) => {
    try {
      await togglePromotionStatus(id, !current);
    } catch (err) {
      console.error('Error toggling promo:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this promotion?')) return;
    try {
      await deletePromotion(id);
    } catch (err) {
      console.error('Error deleting promo:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[90vh]"
        >
          {/* Header */}
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ပရိုမိုးရှင်းနှင့် လျှော့ဈေးများ (Promotions & Bundles)
                </h3>
                <p className="text-xs text-slate-500">
                  POS အရောင်းတွင် အလိုအလျောက် လျှော့ပေးမည့် ပရိုမိုးရှင်းများ
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 hover:bg-slate-200/60 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Top Action */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Active Promotions ({promotions.length})
              </span>
              <button
                type="button"
                onClick={() => setShowAddForm(!showAddForm)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
              >
                <Plus className="w-4 h-4" />
                <span>{showAddForm ? 'Cancel' : 'Add Promotion'}</span>
              </button>
            </div>

            {/* Create Promo Form */}
            {showAddForm && (
              <form onSubmit={handleCreate} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                <h4 className="text-xs font-bold text-slate-900">ပရိုမိုးရှင်း အသစ်ဖန်တီးရန်</h4>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Promotion Type</label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'buy_x_get_y', label: 'Buy X Get Y Free' },
                      { id: 'bundle_price', label: 'Bundle Price' },
                      { id: 'category_discount', label: 'Category % Off' }
                    ].map(t => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPromoType(t.id as any)}
                        className={`p-2 rounded-xl text-xs font-bold transition-all border ${
                          promoType === t.id
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 mb-1">Promo Title (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. မာမား ၃ ထုပ်ဝယ် ၁ ထုပ်လက်ဆောင်"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {promoType === 'buy_x_get_y' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Select Target Product</label>
                      <select
                        required
                        value={targetProductId}
                        onChange={(e) => setTargetProductId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({currency}{p.price})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Buy Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={buyQty}
                          onChange={(e) => setBuyQty(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Free Quantity</label>
                        <input
                          type="number"
                          min="1"
                          value={freeQty}
                          onChange={(e) => setFreeQty(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {promoType === 'bundle_price' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Select Target Product</label>
                      <select
                        required
                        value={targetProductId}
                        onChange={(e) => setTargetProductId(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose Product --</option>
                        {products.map(p => (
                          <option key={p.id} value={p.id}>{p.name} ({currency}{p.price})</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Bundle Quantity</label>
                        <input
                          type="number"
                          min="2"
                          value={bundleQty}
                          onChange={(e) => setBundleQty(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-500 mb-1">Special Bundle Price ({currency})</label>
                        <input
                          type="number"
                          min="1"
                          value={bundlePrice}
                          onChange={(e) => setBundlePrice(Number(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {promoType === 'category_discount' && (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Select Category</label>
                      <select
                        required
                        value={targetCategory}
                        onChange={(e) => setTargetCategory(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">-- Choose Category --</option>
                        {categories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-500 mb-1">Discount Percentage (%)</label>
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={discountPercent}
                        onChange={(e) => setDiscountPercent(Number(e.target.value))}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-3 py-2 bg-white border border-slate-200 text-slate-600 font-bold text-xs rounded-xl hover:bg-slate-100"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs"
                  >
                    {isSubmitting ? 'Saving...' : 'Save Promotion'}
                  </button>
                </div>
              </form>
            )}

            {/* List of Promotions */}
            <div className="space-y-2.5">
              {promotions.map(promo => (
                <div
                  key={promo.id}
                  className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between gap-3 ${
                    promo.isActive
                      ? 'bg-rose-50/50 border-rose-200/80'
                      : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="p-2 bg-white rounded-xl shadow-xs text-rose-600 shrink-0">
                      🎁
                    </span>
                    <div>
                      <p className="text-xs font-bold text-slate-900">{promo.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-500 font-medium">
                        <span className="capitalize">{promo.type.replace(/_/g, ' ')}</span>
                        {promo.targetProductName && (
                          <span>&bull; {promo.targetProductName}</span>
                        )}
                        {promo.targetCategory && (
                          <span>&bull; Category: {promo.targetCategory}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleToggle(promo.id, promo.isActive)}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold transition-all ${
                        promo.isActive
                          ? 'bg-emerald-600 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                      }`}
                    >
                      {promo.isActive ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(promo.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {promotions.length === 0 && !showAddForm && (
                <div className="py-12 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                  <Sparkles className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-bold text-slate-600">No active promotions yet</p>
                  <p className="text-[11px] text-slate-400">Click &ldquo;Add Promotion&rdquo; to set up special deals.</p>
                </div>
              )}
            </div>
          </div>

          <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 bg-slate-900 text-white font-bold text-xs rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
