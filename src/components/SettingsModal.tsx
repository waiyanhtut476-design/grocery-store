import React, { useState, useEffect } from 'react';
import { StoreSettings } from '../types';
import { DEFAULT_SETTINGS, saveStoreSettings, subscribeStoreSettings } from '../lib/storeSettings';
import { useLanguage } from '../lib/i18n';
import { Store, Phone, MapPin, Percent, DollarSign, X, Check, Loader2, Printer, Bluetooth, Key, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  isBluetoothSupported, 
  connectBluetoothPrinter, 
  disconnectBluetoothPrinter, 
  getConnectedPrinterName, 
  printTestReceipt 
} from '../lib/bluetoothPrinter';
import { logActivity } from '../lib/audit';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const { t } = useLanguage();

  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => {
      setSettings(s);
    });
    return () => unsub();
  }, []);

  const [bluetoothName, setBluetoothName] = useState<string | null>(getConnectedPrinterName());
  const [isConnectingBt, setIsConnectingBt] = useState(false);
  const [isTestingBt, setIsTestingBt] = useState(false);
  const [btStatusMsg, setBtStatusMsg] = useState<string | null>(null);

  const handleConnectBt = async () => {
    setIsConnectingBt(true);
    setBtStatusMsg(null);
    try {
      const name = await connectBluetoothPrinter();
      setBluetoothName(name);
      setSettings(prev => ({ ...prev, bluetoothPrinterName: name }));
      setBtStatusMsg(`Connected to ${name}!`);
      setTimeout(() => setBtStatusMsg(null), 3000);
    } catch (err: any) {
      if (err.name !== 'NotFoundError') {
        alert(err.message || 'Failed to connect Bluetooth printer.');
      }
    } finally {
      setIsConnectingBt(false);
    }
  };

  const handleTestBt = async () => {
    setIsTestingBt(true);
    try {
      await printTestReceipt();
      setBtStatusMsg('Test receipt printed successfully!');
      setTimeout(() => setBtStatusMsg(null), 3000);
    } catch (err: any) {
      alert(err.message || 'Error printing test receipt.');
    } finally {
      setIsTestingBt(false);
    }
  };

  const handleDisconnectBt = async () => {
    await disconnectBluetoothPrinter();
    setBluetoothName(null);
    setSettings(prev => ({ ...prev, bluetoothPrinterName: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await saveStoreSettings(settings);
      
      logActivity(
        'Update Settings',
        'settings',
        `Updated store settings for ${settings.storeName}`,
      );

      setSaveSuccess(true);
      setTimeout(() => {
        setSaveSuccess(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('Error saving settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[250] flex items-center justify-center p-3 sm:p-4 bg-slate-950/60 backdrop-blur-sm">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col border border-slate-200 max-h-[92vh]"
        >
          <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">{t('store_settings')}</h3>
                <p className="text-xs text-slate-500">Configure receipt header, currency & VAT</p>
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

          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {t('store_name')}
              </label>
              <input
                type="text"
                required
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {t('store_address')}
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {t('store_tel')}
                </label>
                <input
                  type="text"
                  value={settings.phone}
                  onChange={(e) => setSettings({ ...settings, phone: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                  {t('currency_symbol')}
                </label>
                <input
                  type="text"
                  value={settings.currencySymbol}
                  onChange={(e) => setSettings({ ...settings, currencySymbol: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
            </div>

            {/* VAT / Tax Toggle */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">{t('enable_tax')}</p>
                  <p className="text-xs text-slate-500">Calculate VAT on receipts automatically</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.taxEnabled}
                    onChange={(e) => setSettings({ ...settings, taxEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {settings.taxEnabled && (
                <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-600">{t('tax_rate')}</span>
                  <div className="relative w-28">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settings.taxRate}
                      onChange={(e) => setSettings({ ...settings, taxRate: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500 text-right pr-7"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Dual Currency (THB ฿ & MMK ကျပ်) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-slate-900">ငွေလဲလှယ်နှုန်းပြစနစ် (Dual Currency: ฿ / MMK)</p>
                  <p className="text-xs text-slate-500">ဘတ်ဈေးအပြင် မြန်မာကျပ်ငွေ တန်ဖိုးပါ တွက်ချက်ပြသပေးခြင်း</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.dualCurrencyEnabled}
                    onChange={(e) => setSettings({ ...settings, dualCurrencyEnabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                </label>
              </div>

              {settings.dualCurrencyEnabled && (
                <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      1 THB (฿) = MMK (ကျပ်)
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.exchangeRateMMK || 125}
                      onChange={(e) => setSettings({ ...settings, exchangeRateMMK: Number(e.target.value) })}
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 mb-1">
                      ငွေကြေး သင်္ကေတ (Symbol)
                    </label>
                    <input
                      type="text"
                      value={settings.secondaryCurrencySymbol || 'Ks'}
                      onChange={(e) => setSettings({ ...settings, secondaryCurrencySymbol: e.target.value })}
                      placeholder="e.g. Ks သို့မဟုတ် MMK"
                      className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl text-sm font-bold text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Owner Security PIN (4 Digits) */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-indigo-600" />
                <span className="text-sm font-bold text-slate-900">ဆိုင်ရှင် လုံခြုံရေး PIN ကုတ် (Owner PIN)</span>
              </div>
              <p className="text-xs text-slate-500">
                ငွေကိုင် (Cashier) မုဒ်တွင် စုစုပေါင်းအမြတ်၊ ဝယ်ရင်းဈေးနှင့် ပစ္စည်းဖျက်ခြင်းများကို ကာကွယ်ရန် ၄ လုံး PIN ကုတ်
              </p>
              <div className="w-36 mt-1">
                <input
                  type="password"
                  maxLength={4}
                  value={settings.ownerPin || '1234'}
                  onChange={(e) => setSettings({ ...settings, ownerPin: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-base font-mono font-bold text-center tracking-widest text-slate-900 outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="1234"
                />
              </div>
            </div>

            {/* Bluetooth Thermal Receipt Printer */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-indigo-600" />
                  <span className="text-sm font-bold text-slate-900">Bluetooth Thermal Printer</span>
                </div>
                {bluetoothName ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-800 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Connected
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-200 text-slate-600">
                    Not connected
                  </span>
                )}
              </div>

              <p className="text-xs text-slate-500">
                ဖုန်း သို့မဟုတ် ကွန်ပျူတာမှ 58mm/80mm Bluetooth ဘောက်ချာစက်သို့ တိုက်ရိုက် Print ထုတ်နိုင်ပါသည်
              </p>
              <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 text-[11px] text-amber-800">
                💡 <b>Note:</b> Web Bluetooth requires opening the app in a standalone browser tab if preview security blocks direct hardware access.
              </div>

              {bluetoothName && (
                <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-800">🖨️ {bluetoothName}</span>
                  <button
                    type="button"
                    onClick={handleDisconnectBt}
                    className="text-rose-600 hover:underline font-bold text-[11px]"
                  >
                    Disconnect
                  </button>
                </div>
              )}

              {btStatusMsg && (
                <p className="text-xs font-bold text-emerald-600 animate-fade-in">
                  ✓ {btStatusMsg}
                </p>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConnectBt}
                  disabled={isConnectingBt}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Bluetooth className="w-3.5 h-3.5" />
                  <span>{isConnectingBt ? 'Searching...' : bluetoothName ? 'Reconnect Printer' : 'Connect Bluetooth Printer'}</span>
                </button>
                {bluetoothName && (
                  <button
                    type="button"
                    onClick={handleTestBt}
                    disabled={isTestingBt}
                    className="px-3 py-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 font-bold text-xs rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {isTestingBt ? 'Printing...' : 'Test Print'}
                  </button>
                )}
              </div>
            </div>

            {/* Vibrant Color Theme Selector */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                Store Color Theme (Vibrant & Colorful)
              </label>
              <div className="grid grid-cols-6 gap-2">
                {[
                  { id: 'emerald', label: 'Emerald', bg: 'bg-emerald-500' },
                  { id: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                  { id: 'violet', label: 'Violet', bg: 'bg-violet-600' },
                  { id: 'amber', label: 'Amber', bg: 'bg-amber-500' },
                  { id: 'rose', label: 'Rose', bg: 'bg-rose-500' },
                  { id: 'cyan', label: 'Cyan', bg: 'bg-cyan-500' },
                ].map((theme) => (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => setSettings({ ...settings, themeColor: theme.id as any })}
                    className={`h-10 rounded-xl ${theme.bg} flex items-center justify-center text-white transition-all shadow-md ${settings.themeColor === theme.id ? 'ring-4 ring-offset-2 ring-slate-900 scale-105' : 'opacity-80 hover:opacity-100'}`}
                    title={theme.label}
                  >
                    {settings.themeColor === theme.id && <Check className="w-5 h-5 drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Receipt Footer Message */}
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase mb-1">
                {t('receipt_footer')}
              </label>
              <textarea
                rows={2}
                value={settings.receiptFooter}
                onChange={(e) => setSettings({ ...settings, receiptFooter: e.target.value })}
                className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
              />
            </div>

            <div className="pt-2 flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-colors"
              >
                {t('cancel')}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md shadow-indigo-100 flex items-center gap-2 transition-all active:scale-95"
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saveSuccess ? <Check className="w-4 h-4" /> : null}
                <span>{saveSuccess ? 'Saved!' : t('save_settings')}</span>
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
