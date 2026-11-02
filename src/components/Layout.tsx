import React, { useState } from 'react';
import { User } from 'firebase/auth';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  History as HistoryIcon, 
  CheckSquare, 
  LogOut,
  Menu,
  X,
  Users,
  Clock,
  Settings as SettingsIcon,
  Store,
  Truck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useLanguage } from '../lib/i18n.tsx';
import { db } from '../lib/firebase';
import { collection, query, onSnapshot, where, limit } from 'firebase/firestore';
import { SettingsModal } from './SettingsModal';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from '../lib/storeSettings';
import { StoreSettings } from '../types';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface LayoutProps {
  children: React.ReactNode;
  user: User;
  role: 'admin' | 'staff' | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
}

export function Layout({ children, user, role, activeTab, setActiveTab, onLogout }: LayoutProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [lowStockCount, setLowStockCount] = useState(0);
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);
  const [isShiftOpen, setIsShiftOpen] = useState(false);
  const { language, setLanguage, t } = useLanguage();

  React.useEffect(() => {
    const q = query(collection(db, 'products'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let count = 0;
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const min = data.minStock !== undefined && data.minStock !== null ? Number(data.minStock) : 5;
        if (Number(data.stock) <= min) count++;
      });
      setLowStockCount(count);
    }, (err) => {
      console.warn("Layout products listener error", err);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe store settings
  React.useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  // Subscribe shift status
  React.useEffect(() => {
    const q = query(collection(db, 'shifts'), where('status', '==', 'open'), limit(1));
    const unsub = onSnapshot(q, (snap) => {
      setIsShiftOpen(!snap.empty);
    });
    return () => unsub();
  }, []);

  React.useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isMobileMenuOpen]);

  const menuItems = [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'pos', label: t('pos'), icon: ShoppingCart },
    { id: 'inventory', label: t('inventory'), icon: Package },
    { id: 'suppliers', label: t('suppliers'), icon: Truck },
    { id: 'customers', label: t('customers'), icon: Users },
    { id: 'shifts', label: t('shifts'), icon: Clock },
    { id: 'history', label: t('history'), icon: HistoryIcon },
    { id: 'tasks', label: t('tasks'), icon: CheckSquare },
  ];

  const LanguageSwitcher = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex items-center gap-1", mobile ? "p-3 border-t border-slate-100 mt-1" : "")}>
      {(['en', 'th', 'my'] as const).map((lang) => (
        <button
          key={lang}
          onClick={() => setLanguage(lang)}
          className={cn(
            "px-2 py-1 text-[10px] font-black uppercase rounded-lg transition-all",
            language === lang 
              ? "bg-slate-900 text-white shadow-lg" 
              : "text-slate-400 hover:text-slate-900 hover:bg-slate-100"
          )}
        >
          {lang}
        </button>
      ))}
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-64 bg-white border-r border-slate-200">
        <div className="p-5 flex items-center justify-between border-b border-slate-100">
          <div>
            <h1 className="text-lg font-black text-slate-900 tracking-tight truncate max-w-[150px]">
              {settings.storeName || 'Grocery Flow'}
            </h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-black">{role || 'User'}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
            title={t('settings')}
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
        
        <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={cn(
                "w-full flex items-center justify-between px-3 py-2.5 text-xs font-bold rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-100" 
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <div className="flex items-center gap-3">
                <item.icon className="w-4 h-4" />
                <span>{item.label}</span>
              </div>
              {item.id === 'inventory' && lowStockCount > 0 && (
                <span className={cn(
                  "px-2 py-0.5 text-[10px] font-black rounded-full shadow-xs",
                  activeTab === item.id ? "bg-white text-rose-600" : "bg-rose-500 text-white animate-pulse"
                )}>
                  {lowStockCount}
                </span>
              )}
              {item.id === 'shifts' && isShiftOpen && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
              )}
            </button>
          ))}
        </nav>

        <LanguageSwitcher mobile />

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 mb-3 px-1">
            {user.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || ''} className="w-8 h-8 rounded-full border border-slate-200" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-bold text-slate-600">
                {user.displayName?.[0] || 'U'}
              </div>
            )}
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-bold text-slate-900 truncate">{user.displayName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-xl transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('sign_out')}</span>
          </button>
        </div>
      </aside>

      {/* Mobile Nav Header */}
      <div className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white border-b border-slate-200 px-4 flex items-center justify-between z-50">
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-indigo-600" />
          <h1 className="text-base font-black text-slate-900 truncate max-w-[140px]">
            {settings.storeName || 'Grocery Flow'}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-slate-500 hover:text-slate-800"
          >
            <SettingsIcon className="w-5 h-5" />
          </button>
          <LanguageSwitcher />
          <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="p-2 text-slate-600">
            {isMobileMenuOpen ? <X /> : <Menu />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer Menu */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: -280 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -280 }}
            className="lg:hidden fixed inset-0 z-40 bg-white pt-20 px-4 flex flex-col justify-between pb-6"
          >
            <nav className="space-y-1.5 overflow-y-auto">
              {menuItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-3.5 text-base font-bold rounded-2xl transition-all",
                    activeTab === item.id 
                      ? "bg-indigo-600 text-white" 
                      : "text-slate-700 hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-3">
                    <item.icon className="w-5 h-5" />
                    <span>{item.label}</span>
                  </div>
                  {item.id === 'inventory' && lowStockCount > 0 && (
                    <span className="px-2 py-0.5 text-xs font-black rounded-full bg-rose-500 text-white">
                      {lowStockCount}
                    </span>
                  )}
                </button>
              ))}
            </nav>

            <div className="pt-4 border-t border-slate-100 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(true);
                  setIsMobileMenuOpen(false);
                }}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50 rounded-xl"
              >
                <SettingsIcon className="w-5 h-5 text-indigo-600" />
                <span>{t('settings')}</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-600 hover:bg-rose-50 rounded-xl"
              >
                <LogOut className="w-5 h-5" />
                <span>{t('sign_out')}</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col pt-16 lg:pt-0 overflow-hidden">
        <header className="hidden lg:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-3 text-sm text-slate-500">
            <span className="font-bold text-slate-900">{settings.storeName}</span>
            <span className="opacity-30">/</span>
            <span className="font-semibold text-slate-700 capitalize">{activeTab.replace('-', ' ')}</span>
            {isShiftOpen && (
              <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Shift Active
              </span>
            )}
          </div>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors"
            >
              <SettingsIcon className="w-3.5 h-3.5 text-indigo-600" />
              <span>{t('settings')}</span>
            </button>
            <LanguageSwitcher />
            <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2.5 py-1 rounded-xl border border-slate-200">
              {new Date().toLocaleDateString()}
            </span>
          </div>
        </header>
        
        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="max-w-7xl mx-auto h-full"
          >
            {children}
          </motion.div>
        </div>
      </main>

      {/* Store Settings Modal */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </div>
  );
}
