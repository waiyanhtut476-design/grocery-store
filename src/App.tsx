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
import { UserRole } from './types';
import { Loader2 } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<'admin' | 'staff' | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        try {
          const roleDoc = await getDoc(doc(db, 'roles', currentUser.uid));
          if (roleDoc.exists()) {
            setRole(roleDoc.data().role as 'admin' | 'staff');
          } else {
            const newRole: 'admin' | 'staff' = 'admin';
            const rolePayload = {
              role: newRole,
              email: currentUser.email,
              updatedAt: serverTimestamp()
            };
            await setDoc(doc(db, 'roles', currentUser.uid), rolePayload);
            setRole(newRole);
          }
        } catch (error) {
          console.error("Error fetching or creating role:", error);
          // If role fetch fails, we stay in loading or show error
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
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Grocery Flow</h1>
          <p className="text-slate-500 mb-8">Manage your store inventory and sales efficiently.</p>
          <button
            onClick={signInWithGoogle}
            className="w-full py-3 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-xl transition-all shadow-lg shadow-indigo-200 flex items-center justify-center gap-2"
          >
            Sign in with Google
          </button>
        </div>
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard': return <Dashboard />;
      case 'inventory': return <Inventory role={role} />;
      case 'pos': return <POS user={user} />;
      case 'history': return <History role={role} />;
      case 'tasks': return <Tasks user={user} />;
      default: return <Dashboard />;
    }
  };

  if (user && !role) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 text-center">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Access Restricted</h1>
          <p className="text-slate-500 mb-8">You do not have a role assigned to this store. Please contact the administrator.</p>
          <button
            onClick={logout}
            className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
          >
            Sign Out
          </button>
        </div>
      </div>
    );
  }

  return (
    <Layout
      user={user}
      role={role}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      onLogout={logout}
    >
      {renderContent()}
    </Layout>
  );
}
