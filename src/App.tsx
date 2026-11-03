import React, { useState, useEffect } from 'react';
import { auth, db, signInWithGoogle, logout, handleFirestoreError, OperationType } from './lib/firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, query, onSnapshot, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { Inventory } from './components/Inventory';
import { POS } from './components/POS';
import { History } from './components/History';
import { Tasks } from './components/Tasks';
import { Customers } from './components/Customers';
import { Shifts } from './components/Shifts';
import { Suppliers } from './components/Suppliers';
import { Expenses } from './components/Expenses';
import { Staff } from './components/Staff';
import { Promotions } from './components/Promotions';
import AuditLogList from './components/AuditLog';
import { PinPadModal } from './components/PinPadModal';
import { DEFAULT_SETTINGS, subscribeStoreSettings } from './lib/storeSettings';
import { StoreSettings } from './types';
import { Loader2, Lock } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [settings, setSettings] = useState<StoreSettings>(DEFAULT_SETTINGS);

  // Owner vs Cashier Lock State
  const [isOwnerUnlocked, setIsOwnerUnlocked] = useState<boolean>(() => {
    return localStorage.getItem('pos_owner_unlocked') === 'true';
  });
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalTitle, setPinModalTitle] = useState('ပိုင်ရှင် PIN နံပါတ် ရိုက်ထည့်ပါ');
  const [pinModalSubtitle, setPinModalSubtitle] = useState('Admin/Owner သာ ကြည့်ရှုခွင့်ရှိသော စာရင်းများအတွက် PIN ၄ လုံး ရိုက်ပါ');
  const [pendingPinAction, setPendingPinAction] = useState<(() => void) | null>(null);

  useEffect(() => {
    const unsub = subscribeStoreSettings((s) => setSettings(s));
    return () => unsub();
  }, []);

  const handleUnlockOwner = () => {
    setIsOwnerUnlocked(true);
    localStorage.setItem('pos_owner_unlocked', 'true');
  };

  const handleLockCashier = () => {
    setIsOwnerUnlocked(false);
    localStorage.setItem('pos_owner_unlocked', 'false');
  };

  const promptPin = (
    title = 'ပိုင်ရှင် PIN နံပါတ် ရိုက်ထည့်ပါ',
    subtitle = 'Gross Profit, ဝယ်ဈေး (Cost Price) နှင့် ပစ္စည်းပြင်ဆင်/ဖျက်ပိုင်ခွင့်အတွက် PIN ရိုက်ပါ',
    onSuccessAction?: () => void
  ) => {
    setPinModalTitle(title);
    setPinModalSubtitle(subtitle);
    setPendingPinAction(() => () => {
      handleUnlockOwner();
      if (onSuccessAction) onSuccessAction();
    });
    setIsPinModalOpen(true);
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const roleDoc = await getDoc(doc(db, 'roles', currentUser.uid));
          let finalRole: 'admin' | 'staff' = 'staff';

          if (roleDoc.exists()) {
            finalRole = roleDoc.data().role as 'admin' | 'staff';
          } else {
            finalRole = 'admin';
            const rolePayload = {
              role: finalRole,
              email: currentUser.email,
              updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'roles', currentUser.uid), rolePayload);
          }

          // Force admin for the owner email
          if (currentUser.email === 'waiyanhtut476@gmail.com') {
            finalRole = 'admin';
          }
          
          setRole(finalRole);
        } catch (error) {
          console.error("Error fetching or creating role:", error);
          if (currentUser.email === 'waiyanhtut476@gmail.com') {
            setRole('admin');
          } else {
            setRole('staff');
          }
        }
      } else {
        setUser(null);
        setRole(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!user) {
    const isIframe = window.self !== window.top;
    const appUrl = window.location.href;

    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2 font-display">Grocery Flow</h1>
          <p className="text-slate-500 mb-8">Manage your store inventory and sales efficiently.</p>
          
          <button
            onClick={signInWithGoogle}
            className="w-full py-4 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-3 mb-4 active:scale-95"
          >
            Sign in with Google
          </button>

          {isIframe && (
            <div className="mt-6 p-4 bg-amber-50 rounded-xl border border-amber-100 text-left">
              <p className="text-amber-800 text-xs font-bold uppercase tracking-wider mb-2">Mobile / iOS Users:</p>
              <p className="text-amber-700 text-[13px] leading-relaxed mb-4">
                If login fails, please open the app in a new tab. Browsers on iOS often block login inside iframes.
              </p>
              <a 
                href={appUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-indigo-600 text-sm font-bold hover:underline"
              >
                Open in New Tab
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            </div>
          )}

          <p className="mt-8 text-slate-400 text-[10px] uppercase tracking-widest font-black">Secure Cloud Infrastructure</p>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': 
        return (
          <Dashboard 
            onNavigate={setActiveTab} 
            role={role}
            isOwnerUnlocked={isOwnerUnlocked}
            onRequirePin={() => promptPin('ပိုင်ရှင် PIN နံပါတ် ရိုက်ပါ', 'ဆိုင်၏ အမြတ်ငွေ (Profit) စာရင်းကို ကြည့်ရန် Owner PIN ရိုက်ပါ')}
          />
        );
      case 'inventory': 
        return (
          <Inventory 
            role={role} 
            user={user} 
            isOwnerUnlocked={isOwnerUnlocked}
            onRequirePin={promptPin}
          />
        );
      case 'pos': return <POS user={user} />;
      case 'suppliers': return <Suppliers user={user} role={role} />;
      case 'customers': return <Customers role={role} />;
      case 'shifts': return <Shifts user={user} />;
      case 'history': return (
        <History 
          role={role} 
          isOwnerUnlocked={isOwnerUnlocked}
          onRequirePin={() => promptPin('အရောင်းမှတ်တမ်း အမြတ်စာရင်း ကြည့်ရန်', 'အသေးစိတ် အရှုံး/အမြတ် တွက်ချက်မှုများကို ကြည့်ရန် Owner PIN ရိုက်ပါ')}
        />
      );
      case 'expenses': return <Expenses user={user} role={role} />;
      case 'staff': return (
        <Staff 
          role={role} 
          isOwnerUnlocked={isOwnerUnlocked}
          onRequirePin={() => promptPin('ဝန်ထမ်းစာရင်းကို ပြင်ဆင်ရန်', 'ဝန်ထမ်းစာရင်းနှင့် ရာထူးများကို စီမံခန့်ခွဲရန် Owner PIN ရိုက်ပါ')}
        />
      );
      case 'promotions': return <Promotions role={role} />;
      case 'audit-logs': 
        if (!isOwnerUnlocked && role !== 'admin') {
          return (
            <div className="flex flex-col items-center justify-center h-[60vh] bg-white rounded-3xl border border-slate-200 p-8 text-center">
              <div className="p-4 bg-slate-100 rounded-2xl mb-4 text-slate-400">
                <Lock className="w-12 h-12" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 mb-2">Audit Logs Locked</h2>
              <p className="text-slate-500 mb-6 max-w-sm">System activity history is restricted. Please enter the Owner PIN to view these logs.</p>
              <button
                onClick={() => promptPin('Audit Logs ကြည့်ရန်', 'စနစ်မှတ်တမ်းများကို ကြည့်ရှုရန် Owner PIN ရိုက်ထည့်ပါ')}
                className="px-8 py-3 bg-indigo-600 text-white font-bold rounded-2xl shadow-lg shadow-indigo-100 transition-all hover:bg-indigo-700 active:scale-95"
              >
                Unlock with PIN
              </button>
            </div>
          );
        }
        return (
          <AuditLogList />
        );
      case 'tasks': return <Tasks user={user} />;
      default: 
        return (
          <Dashboard 
            onNavigate={setActiveTab} 
            role={role}
            isOwnerUnlocked={isOwnerUnlocked}
            onRequirePin={() => promptPin('ပိုင်ရှင် PIN နံပါတ် ရိုက်ပါ', 'ဆိုင်၏ အမြတ်ငွေ (Profit) စာရင်းကို ကြည့်ရန် Owner PIN ရိုက်ပါ')}
          />
        );
    }
  };

  if (user && !role) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">ဝင်ရောက်ခွင့် မရှိပါ</h1>
          <p className="text-slate-500 mb-8">သင့်ထံတွင် ဤဆိုင်ကို အသုံးပြုရန် သတ်မှတ်ထားသော ရာထူး (Role) မရှိသေးပါ။ ကျေးဇူးပြု၍ ဆိုင်ရှင် (Administrator) ကို ဆက်သွယ်ပါ။</p>
          <button
            onClick={logout}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
          >
            အကောင့်မှ ထွက်ရန် (Sign Out)
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <Layout
        user={user}
        role={role}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onLogout={logout}
        isOwnerUnlocked={isOwnerUnlocked}
        onRequirePin={() => promptPin('Owner PIN နံပါတ် ရိုက်ထည့်ပါ', 'Cashier Mode မှ Owner Mode သို့ ပြောင်းရန် PIN ရိုက်ပါ')}
        onLockCashier={handleLockCashier}
      >
        {renderContent()}
      </Layout>

      <PinPadModal
        isOpen={isPinModalOpen}
        onClose={() => {
          setIsPinModalOpen(false);
          setPendingPinAction(null);
        }}
        onSuccess={() => {
          if (pendingPinAction) {
            pendingPinAction();
          } else {
            handleUnlockOwner();
          }
        }}
        correctPin={settings.ownerPin || '1234'}
        title={pinModalTitle}
        subtitle={pinModalSubtitle}
      />
    </>
  );
}
